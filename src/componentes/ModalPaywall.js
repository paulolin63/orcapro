/**
 * ModalPaywall — Vitrine de valor Pro Vitalício + Teaser da próxima versão com IA.
 * Permanente (1x) = PDF/orcamentos ilimitados + assinatura/garantia + modelos 1-toque + clientes salvos + follow-up + funil/stats.
 * Pro IA (mensal/anual) = ilimitado + creditos voz/foto (quando FEATURE_PRO_IA ativo).
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { Modal, Portal, Text, Button, Card } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as RNIap from 'react-native-iap';
import {
  IAP_SKUS,
  obterPrecosIap,
  precoFallback,
  restaurarCompras,
  marcarEntitlementLocal,
  creditarPacoteIa,
  CREDITOS_IA_PACK,
  skuEhLifetimeetime,
  skuEhAssinaturaIa,
  skuEhPackIa,
} from '../assinatura';
import { lerConfig, salvarConfig } from '../banco-de-dados';
import { FEATURE_PRO_IA } from '../feature-flags';

const BENEFICIOS_VITALICIO = [
  {
    icone: 'infinity',
    texto: 'Orçamentos e PDFs ilimitados todos os meses',
  },
  {
    icone: 'file-certificate-outline',
    texto: 'PDF limpo sem marca "Free" + Assinatura do cliente e garantia editável',
  },
  {
    icone: 'lightning-bolt',
    texto: 'Modelos prontos em 1 toque (Split, Higienização, Elétrica + seus modelos)',
  },
  {
    icone: 'account-clock-outline',
    texto: 'Clientes salvos para preencher dados em 1 clique',
  },
  {
    icone: 'whatsapp',
    texto: 'Mensagem pronta de cobrança/follow-up no WhatsApp para fechar mais',
  },
  {
    icone: 'chart-bar',
    texto: 'Estatisticas de fechamento (tempo medio, faixas de valor e funil)',
  },
];

export default function ModalPaywall({ visivel, onFechar, onSucesso }) {
  const [carregando, setCarregando] = useState(false);
  const [vipIa, setVipIa] = useState(false);
  const [precos, setPrecos] = useState({
    [IAP_SKUS.LIFETIME]: precoFallback(IAP_SKUS.LIFETIME),
    [IAP_SKUS.MENSAL]: precoFallback(IAP_SKUS.MENSAL),
    [IAP_SKUS.ANUAL]: precoFallback(IAP_SKUS.ANUAL),
    [IAP_SKUS.PACK_IA]: precoFallback(IAP_SKUS.PACK_IA),
  });
  const [offerTokens, setOfferTokens] = useState({});
  const purchaseSub = useRef(null);
  const errorSub = useRef(null);

  useEffect(() => {
    if (!visivel) return;
    let cancelado = false;

    (async () => {
      const { precos: p, offerTokens: tokens } = await obterPrecosIap();
      if (!cancelado) {
        setPrecos(p);
        setOfferTokens(tokens);
      }
      const jaVip = await lerConfig('vip_lista_ia').catch(() => null);
      if (!cancelado && jaVip === '1') setVipIa(true);
    })();

    purchaseSub.current = RNIap.purchaseUpdatedListener(async (purchase) => {
      try {
        const id = purchase?.productId;
        if (!id) return;

        const isConsumable = skuEhPackIa(id);
        if (purchase.transactionReceipt || purchase.purchaseToken) {
          await RNIap.finishTransaction({ purchase, isConsumable });
        }

        if (skuEhPackIa(id)) {
          await creditarPacoteIa(CREDITOS_IA_PACK);
          Alert.alert('Pacote IA', `+${CREDITOS_IA_PACK} creditos adicionados.`);
          if (onSucesso) onSucesso();
          onFechar();
          return;
        }

        if (skuEhLifetimeetime(id)) {
          await marcarEntitlementLocal({
            ilimitadoOrcamentos: true,
            temAssinaturaIa: false,
            source: 'lifetime',
          });
          Alert.alert('Pro Vitalício Ativo! 🎉', 'Todos os recursos Pro foram liberados para sempre.');
        } else if (skuEhAssinaturaIa(id)) {
          await marcarEntitlementLocal({
            ilimitadoOrcamentos: true,
            temAssinaturaIa: true,
            source: id.includes('anual') ? 'anual' : 'mensal',
          });
          Alert.alert('Pro IA', 'Assinatura ativa!');
        } else {
          return;
        }

        if (onSucesso) onSucesso();
        onFechar();
      } catch (e) {
        console.warn('purchaseUpdatedListener:', e);
      } finally {
        setCarregando(false);
      }
    });

    errorSub.current = RNIap.purchaseErrorListener((erro) => {
      setCarregando(false);
      if (erro?.code !== 'E_USER_CANCELLED') {
        Alert.alert('Aviso', 'Nao foi possivel concluir a compra no Google Play.');
      }
    });

    return () => {
      cancelado = true;
      purchaseSub.current?.remove();
      errorSub.current?.remove();
      purchaseSub.current = null;
      errorSub.current = null;
    };
  }, [visivel, onFechar, onSucesso]);

  async function comprarProduto(sku) {
    setCarregando(true);
    try {
      await RNIap.initConnection();
      await RNIap.requestPurchase({ skus: [sku] });
    } catch (erro) {
      setCarregando(false);
      if (erro?.code !== 'E_USER_CANCELLED') {
        Alert.alert('Aviso', 'Nao foi possivel iniciar a compra.');
      }
    }
  }

  async function comprarAssinatura(sku) {
    setCarregando(true);
    try {
      await RNIap.initConnection();
      const token = offerTokens[sku];
      if (token) {
        await RNIap.requestSubscription({
          subscriptionOffers: [{ sku, offerToken: token }],
        });
      } else {
        await RNIap.requestSubscription({ sku });
      }
    } catch (erro) {
      setCarregando(false);
      if (erro?.code !== 'E_USER_CANCELLED') {
        Alert.alert('Aviso', 'Nao foi possivel iniciar a assinatura.');
      }
    }
  }

  async function onRestaurar() {
    setCarregando(true);
    try {
      const r = await restaurarCompras();
      if (r.ehPro) {
        Alert.alert('Compra restaurada!', 'Seu acesso Pro foi reativado.');
        if (onSucesso) onSucesso();
        onFechar();
      } else {
        Alert.alert('Sem compras', 'Nenhuma compra anterior encontrada nesta conta Google Play.');
      }
    } catch (e) {
      Alert.alert('Erro', 'Nao foi possivel conectar ao Google Play.');
    } finally {
      setCarregando(false);
    }
  }

  async function entrarVipIa() {
    try {
      await salvarConfig('vip_lista_ia', '1');
      setVipIa(true);
    } catch {
      setVipIa(true);
    }
  }

  return (
    <Portal>
      <Modal visible={visivel} onDismiss={onFechar} contentContainerStyle={estilos.modal}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={estilos.topo}>
            <View style={estilos.seloVitalicio}>
              <MaterialCommunityIcons name="crown" size={14} color="#162544" />
              <Text style={estilos.seloVitalicioTxt}>ACESSO VITALÍCIO · PAGUE 1 ÚNICA VEZ</Text>
            </View>

            <Text variant="titleLarge" style={estilos.titulo}>
              OrçaPronto Pro Permanente
            </Text>

            <View style={estilos.caixaPreco}>
              <Text style={estilos.precoDestaque}>{precos[IAP_SKUS.LIFETIME]}</Text>
              <Text style={estilos.precoSub}>
                Sem mensalidade · Se paga já no 1º orçamento fechado!
              </Text>
            </View>

            <View style={estilos.beneficios}>
              {BENEFICIOS_VITALICIO.map((b, idx) => (
                <View key={idx} style={estilos.linhaBeneficio}>
                  <View style={estilos.iconeBeneficio}>
                    <MaterialCommunityIcons name={b.icone} size={16} color="#00B49F" />
                  </View>
                  <Text style={estilos.beneficio}>{b.texto}</Text>
                </View>
              ))}
            </View>
          </View>

          {FEATURE_PRO_IA ? (
            <>
              <Card
                style={estilos.cardPlano}
                onPress={() => comprarAssinatura(IAP_SKUS.MENSAL)}
              >
                <Card.Content style={estilos.conteudoPlano}>
                  <Text style={estilos.planoTitulo}>Pro IA Mensal</Text>
                  <Text style={estilos.preco}>{precos[IAP_SKUS.MENSAL]}</Text>
                </Card.Content>
              </Card>

              <Card
                style={estilos.cardPlano}
                onPress={() => comprarAssinatura(IAP_SKUS.ANUAL)}
              >
                <Card.Content style={estilos.conteudoPlano}>
                  <Text style={estilos.planoTitulo}>Pro IA Anual</Text>
                  <Text style={estilos.preco}>{precos[IAP_SKUS.ANUAL]}</Text>
                </Card.Content>
              </Card>

              <Card
                style={estilos.cardPlano}
                onPress={() => comprarProduto(IAP_SKUS.PACK_IA)}
              >
                <Card.Content style={estilos.conteudoPlano}>
                  <Text style={estilos.planoTitulo}>Pacote IA</Text>
                  <Text style={estilos.preco}>{precos[IAP_SKUS.PACK_IA]}</Text>
                </Card.Content>
              </Card>
            </>
          ) : null}

          <Button
            mode="contained"
            icon="crown"
            buttonColor="#FFA000"
            textColor="#162544"
            labelStyle={{ fontWeight: '900', fontSize: 14 }}
            style={estilos.botao}
            contentStyle={{ paddingVertical: 5 }}
            loading={carregando}
            disabled={carregando}
            onPress={() => comprarProduto(IAP_SKUS.LIFETIME)}
          >
            Desbloquear Pro — {precos[IAP_SKUS.LIFETIME]}
          </Button>

          {/* ── TEASER PRÓXIMA VERSÃO: ORÇAPRONTO IA ── */}
          {!FEATURE_PRO_IA ? (
            <View style={estilos.cardTeaserIa}>
              <View style={estilos.badgeTeaserIa}>
                <Text style={estilos.badgeTeaserIaTxt}>🤖 PRÓXIMA ATUALIZAÇÃO · EM BREVE</Text>
              </View>
              <Text style={estilos.tituloTeaserIa}>
                Vem aí o OrçaPronto IA ✨
              </Text>
              <Text style={estilos.itemTeaserIa}>
                🎙️ Fale o serviço por áudio e a IA monta os itens e preços sozinha
              </Text>
              <Text style={estilos.itemTeaserIa}>
                📸 Tire foto do local ou da lista de materiais para gerar o rascunho
              </Text>
              <Text style={estilos.itemTeaserIa}>
                ✍️ Textos técnicos automáticos para valorizar seu serviço
              </Text>
              <Text style={estilos.notaTeaserIa}>
                O Pro Permanente acima já libera todas as ferramentas offline para sempre. Os recursos de IA chegarão na próxima versão como módulo opcional!
              </Text>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={entrarVipIa}
                style={[estilos.btnListaIa, vipIa && estilos.btnListaIaAtivo]}
              >
                <MaterialCommunityIcons
                  name={vipIa ? 'check-decagram' : 'bell-ring-outline'}
                  size={15}
                  color={vipIa ? '#064E3B' : '#162544'}
                />
                <Text style={[estilos.btnListaIaTxt, vipIa && { color: '#064E3B' }]}>
                  {vipIa
                    ? 'Você está na lista VIP de lançamento da IA!'
                    : 'Quero ser avisado quando a IA lançar'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={estilos.rodapeAcoes}>
            <Button compact mode="text" textColor="#162544" onPress={onRestaurar} disabled={carregando}>
              Restaurar compra
            </Button>
            <Button compact mode="text" textColor="#64748b" onPress={onFechar}>
              Agora não
            </Button>
          </View>
        </ScrollView>
      </Modal>
    </Portal>
  );
}

const estilos = StyleSheet.create({
  modal: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 18,
    borderRadius: 20,
    maxHeight: '92%',
  },
  topo: { alignItems: 'center', marginBottom: 12 },
  seloVitalicio: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFA000',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    marginBottom: 8,
  },
  seloVitalicioTxt: { fontSize: 10, fontWeight: '900', color: '#162544', letterSpacing: 0.4 },
  titulo: { fontWeight: '900', color: '#162544', textAlign: 'center', fontSize: 20 },
  caixaPreco: {
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginTop: 8,
    alignSelf: 'stretch',
  },
  precoDestaque: { fontSize: 24, fontWeight: '900', color: '#162544' },
  precoSub: { fontSize: 11, color: '#92400E', fontWeight: '700', marginTop: 2, textAlign: 'center' },
  beneficios: { marginTop: 12, alignSelf: 'stretch', gap: 7 },
  linhaBeneficio: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconeBeneficio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E6FFFA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  beneficio: { flex: 1, fontSize: 12.5, color: '#1E293B', fontWeight: '600', lineHeight: 17 },
  cardPlano: {
    marginBottom: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  conteudoPlano: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  planoTitulo: { fontSize: 15, fontWeight: '800', color: '#162544' },
  preco: { fontSize: 17, fontWeight: '800', color: '#162544' },
  botao: { borderRadius: 12, marginTop: 2, elevation: 2 },
  cardTeaserIa: {
    marginTop: 14,
    backgroundColor: '#162544',
    borderRadius: 14,
    padding: 13,
    borderWidth: 1,
    borderColor: '#00B49F',
  },
  badgeTeaserIa: {
    alignSelf: 'flex-start',
    backgroundColor: '#00B49F',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginBottom: 6,
  },
  badgeTeaserIaTxt: { fontSize: 9.5, fontWeight: '900', color: '#ffffff' },
  tituloTeaserIa: { fontSize: 15, fontWeight: '900', color: '#ffffff', marginBottom: 6 },
  itemTeaserIa: { fontSize: 11.5, color: '#E2E8F0', marginBottom: 4, lineHeight: 16 },
  notaTeaserIa: { fontSize: 10.5, color: '#94A3B8', marginTop: 4, marginBottom: 10, lineHeight: 14 },
  btnListaIa: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#5EEAD4',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  btnListaIaAtivo: { backgroundColor: '#A7F3D0' },
  btnListaIaTxt: { fontSize: 11.5, fontWeight: '800', color: '#162544' },
  rodapeAcoes: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 6,
  },
});
