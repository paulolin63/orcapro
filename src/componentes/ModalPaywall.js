/**
 * ModalPaywall — Free esgotou cota de orcamentos.
 * Permanente = PDF ilimitado.
 * Pro IA = ilimitado + creditos voz/foto.
 * Pacote = +15 creditos IA (consumivel).
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Modal, Portal, Text, Button, Card } from 'react-native-paper';
import * as RNIap from 'react-native-iap';
import {
  IAP_SKUS,
  obterPrecosIap,
  precoFallback,
  restaurarCompras,
  marcarEntitlementLocal,
  creditarPacoteIa,
  CREDITOS_IA_ASSINATURA_MES,
  CREDITOS_IA_PACK,
  skuEhLifetimeetime,
  skuEhAssinaturaIa,
  skuEhPackIa,
} from '../assinatura';

export default function ModalPaywall({ visivel, onFechar, onSucesso }) {
  const [carregando, setCarregando] = useState(false);
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
          Alert.alert('Sucesso!', 'Orcamentos e PDF ilimitados desbloqueados.');
        } else if (skuEhAssinaturaIa(id)) {
          await marcarEntitlementLocal({
            ilimitadoOrcamentos: true,
            temAssinaturaIa: true,
            source: id.includes('anual') ? 'anual' : 'mensal',
          });
          Alert.alert(
            'Pro IA ativo!',
            `Ilimitado + ${CREDITOS_IA_ASSINATURA_MES} creditos de voz/foto por mes.`
          );
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
        Alert.alert('Restaurado', r.temAssinaturaIa
          ? 'Pro IA reconhecido.'
          : 'Desbloqueio permanente reconhecido.');
        if (onSucesso) onSucesso();
        onFechar();
      } else {
        Alert.alert('Nenhuma compra ativa', 'Esta conta Google nao tem Pro do OrçaPro.');
      }
    } catch (e) {
      Alert.alert('Erro', 'Nao foi possivel conectar ao Google Play.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <Portal>
      <Modal visible={visivel} onDismiss={onFechar} contentContainerStyle={estilos.modal}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={estilos.topo}>
            <Text style={{ fontSize: 44, textAlign: 'center' }}>👑</Text>
            <Text variant="headlineSmall" style={estilos.titulo}>
              Continue gerando orcamentos
            </Text>
            <Text variant="bodyMedium" style={estilos.subtitulo}>
              Limite free: 3 orcamentos/mes. Escolha PDF ilimitado ou Pro com IA.
            </Text>
          </View>

          {/* Permanente */}
          <Card
            style={[estilos.cardPlano, estilos.cardPlanoDestaque]}
            onPress={() => comprarProduto(IAP_SKUS.LIFETIME)}
          >
            <View style={estilos.badge}>
              <Text style={estilos.badgeTxt}>MAIS ESCOLHIDO</Text>
            </View>
            <Card.Content style={estilos.conteudoPlano}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={estilos.planoTituloDestaque}>Permanente</Text>
                <Text style={estilos.planoDesc}>
                  Orcamentos + PDF + Pix ilimitados. Sem assinatura.
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={estilos.precoDestaque}>{precos[IAP_SKUS.LIFETIME]}</Text>
                <Text style={estilos.precoHint}>uma vez</Text>
              </View>
            </Card.Content>
          </Card>

          {/* Pro IA Mensal */}
          <Card
            style={estilos.cardPlano}
            onPress={() => comprarAssinatura(IAP_SKUS.MENSAL)}
          >
            <Card.Content style={estilos.conteudoPlano}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={estilos.planoTitulo}>Pro IA Mensal</Text>
                <Text style={estilos.planoDesc}>
                  Tudo do Permanente + {CREDITOS_IA_ASSINATURA_MES}x voz ou foto → orcamento / mes
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={estilos.preco}>{precos[IAP_SKUS.MENSAL]}</Text>
                <Text style={estilos.precoHint}>/ mes</Text>
              </View>
            </Card.Content>
          </Card>

          {/* Pro IA Anual */}
          <Card
            style={estilos.cardPlano}
            onPress={() => comprarAssinatura(IAP_SKUS.ANUAL)}
          >
            <Card.Content style={estilos.conteudoPlano}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={estilos.planoTitulo}>Pro IA Anual</Text>
                <Text style={estilos.planoDesc}>
                  Mesmo Pro IA com desconto (~37% vs 12x mensal)
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={estilos.preco}>{precos[IAP_SKUS.ANUAL]}</Text>
                <Text style={estilos.precoHint}>/ ano</Text>
              </View>
            </Card.Content>
          </Card>

          {/* Pacote */}
          <Card
            style={estilos.cardPlano}
            onPress={() => comprarProduto(IAP_SKUS.PACK_IA)}
          >
            <Card.Content style={estilos.conteudoPlano}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={estilos.planoTitulo}>Pacote IA</Text>
                <Text style={estilos.planoDesc}>
                  +{CREDITOS_IA_PACK} usos de voz/foto (sem assinatura). Ideal com Permanente.
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={estilos.preco}>{precos[IAP_SKUS.PACK_IA]}</Text>
                <Text style={estilos.precoHint}>avulso</Text>
              </View>
            </Card.Content>
          </Card>

          <Text style={estilos.notaIa}>
            Recursos de voz/foto por IA entram na v1.1. Creditos so sao cobrados quando o recurso estiver ativo.
          </Text>

          <Button
            mode="contained"
            style={estilos.botao}
            loading={carregando}
            disabled={carregando}
            onPress={() => comprarProduto(IAP_SKUS.LIFETIME)}
          >
            Desbloquear permanente
          </Button>

          <Button mode="text" onPress={onRestaurar} disabled={carregando}>
            Restaurar compras
          </Button>
          <Button mode="text" textColor="#888" onPress={onFechar}>
            Voltar
          </Button>
        </ScrollView>
      </Modal>
    </Portal>
  );
}

const estilos = StyleSheet.create({
  modal: {
    backgroundColor: '#fff',
    margin: 20,
    padding: 20,
    borderRadius: 20,
    maxHeight: '90%',
  },
  topo: { alignItems: 'center', marginBottom: 14 },
  titulo: { fontWeight: '800', color: '#162544', marginTop: 8, textAlign: 'center' },
  subtitulo: { textAlign: 'center', color: '#666', marginTop: 6, fontSize: 13 },
  cardPlano: {
    marginBottom: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  cardPlanoDestaque: {
    borderColor: '#FFA000',
    backgroundColor: '#FFFDF5',
  },
  badge: {
    position: 'absolute',
    top: -1,
    right: 12,
    backgroundColor: '#FFA000',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    zIndex: 2,
  },
  badgeTxt: { color: '#fff', fontSize: 10, fontWeight: '800' },
  conteudoPlano: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  planoTitulo: { fontSize: 15, fontWeight: '800', color: '#162544' },
  planoTituloDestaque: { fontSize: 15, fontWeight: '800', color: '#B45309' },
  planoDesc: { fontSize: 11, color: '#666', marginTop: 2 },
  preco: { fontSize: 17, fontWeight: '800', color: '#162544' },
  precoDestaque: { fontSize: 17, fontWeight: '800', color: '#B45309' },
  precoHint: { fontSize: 10, color: '#666' },
  notaIa: { fontSize: 11, color: '#888', textAlign: 'center', marginVertical: 8, lineHeight: 15 },
  botao: { backgroundColor: '#162544', borderRadius: 10, marginTop: 4, paddingVertical: 4 },
});
