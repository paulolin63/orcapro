/**
 * ModalPaywall — Free esgotou cota de orcamentos.
 * Permanente (1x) = PDF/orcamentos ilimitados + funil/stats. SEM IA.
 * Pro IA (mensal/anual) = ilimitado + creditos voz/foto.
 * Pacote = +15 creditos IA (consumivel; nao vem no Permanente).
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
  CREDITOS_IA_PACK,
  skuEhLifetimeetime,
  skuEhAssinaturaIa,
  skuEhPackIa,
} from '../assinatura';
import { FEATURE_PRO_IA } from '../feature-flags';

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
          Alert.alert('Permanente', 'Desbloqueado.');
        } else if (skuEhAssinaturaIa(id)) {
          await marcarEntitlementLocal({
            ilimitadoOrcamentos: true,
            temAssinaturaIa: true,
            source: id.includes('anual') ? 'anual' : 'mensal',
          });
          Alert.alert('Pro IA', 'Ativo.');
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
        Alert.alert('Restaurado', 'Ok.');
        if (onSucesso) onSucesso();
        onFechar();
      } else {
        Alert.alert('Sem compras', 'Nada encontrado nesta conta.');
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
            <Text variant="headlineSmall" style={estilos.titulo}>
              Permanente
            </Text>
            <Text style={estilos.precoDestaque}>{precos[IAP_SKUS.LIFETIME]}</Text>
            <View style={estilos.beneficios}>
              <Text style={estilos.beneficio}>Orcamentos e PDF ilimitados</Text>
              <Text style={estilos.beneficio}>Modelos reutilizaveis</Text>
              <Text style={estilos.beneficio}>Estatisticas de fechamento (tempo, faixas, follow-up)</Text>
              <Text style={estilos.beneficio}>Sem IA — voz/foto so na assinatura Pro IA</Text>
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
            style={estilos.botao}
            loading={carregando}
            disabled={carregando}
            onPress={() => comprarProduto(IAP_SKUS.LIFETIME)}
          >
            Desbloquear
          </Button>

          <Button mode="text" onPress={onRestaurar} disabled={carregando}>
            Restaurar
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
  titulo: { fontWeight: '800', color: '#162544', textAlign: 'center' },
  beneficios: { marginTop: 12, alignSelf: 'stretch' },
  beneficio: { fontSize: 13, color: '#475569', marginTop: 4, textAlign: 'left' },
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
  conteudoPlano: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  planoTitulo: { fontSize: 15, fontWeight: '800', color: '#162544' },
  planoTituloDestaque: { fontSize: 15, fontWeight: '800', color: '#B45309' },
  preco: { fontSize: 17, fontWeight: '800', color: '#162544' },
  precoDestaque: { fontSize: 17, fontWeight: '800', color: '#B45309', marginTop: 4 },
  botao: { backgroundColor: '#162544', borderRadius: 10, marginTop: 4, paddingVertical: 4 },
});
