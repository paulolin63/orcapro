/**
 * app/detalhe-orcamento.js
 * Visualização detalhada do orçamento com reenvio de PDF e alteração de status.
 */

import { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { Text, Card, Chip, Button, Divider, IconButton, ActivityIndicator } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { buscarOrcamento, atualizarStatusOrcamento, deletarOrcamento, lerTodasConfigs } from '@src/banco-de-dados';
import { formatarReais } from '@src/calculos';
import { gerarPDF, compartilharPDF } from '@src/pdf';

const STATUS_MAP = {
  aguardando: { label: '⏳ Aguardando', cor: '#f59e0b', bg: '#fef7e0' },
  fechado:    { label: '✅ Fechado',    cor: '#1e8e3e', bg: '#e6f4ea' },
  recusado:   { label: '❌ Recusado',   cor: '#d93025', bg: '#fce8e6' },
  cancelado:  { label: '🚫 Cancelado',  cor: '#757575', bg: '#f5f5f5' },
};

export default function DetalheOrcamento() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [orcamento, setOrcamento] = useState(null);
  const [gerandoPdf, setGerandoPdf] = useState(false);

  useEffect(() => {
    carregar();
  }, [id]);

  async function carregar() {
    const dados = await buscarOrcamento(id);
    setOrcamento(dados);
  }

  async function mudarStatus(novoStatus) {
    await atualizarStatusOrcamento(id, novoStatus);
    carregar();
  }

  async function reenviarPdf() {
    setGerandoPdf(true);
    try {
      const config = await lerTodasConfigs();
      const pdfUri = await gerarPDF(orcamento, orcamento.itens, config);
      await compartilharPDF(pdfUri);
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível gerar ou enviar o PDF.');
    } finally {
      setGerandoPdf(false);
    }
  }

  function confirmarExclusao() {
    Alert.alert('Excluir Orçamento', 'Tem certeza que deseja apagar este orçamento permanentemente?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await deletarOrcamento(id);
          router.replace('/');
        },
      },
    ]);
  }

  if (!orcamento) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#1a73e8" />
      </View>
    );
  }

  const statusInfo = STATUS_MAP[orcamento.status] || STATUS_MAP.aguardando;

  return (
    <ScrollView style={estilos.container}>
      <View style={estilos.topo}>
        <View>
          <Text variant="headlineSmall" style={{ fontWeight: '800', color: '#162544' }}>
            #{String(orcamento.id).padStart(4, '0')}
          </Text>
          <Text variant="bodySmall" style={{ color: '#666' }}>
            Criado em: {new Date(orcamento.criado_em).toLocaleDateString('pt-BR')}
          </Text>
        </View>
        <Chip style={{ backgroundColor: statusInfo.bg }} textStyle={{ color: statusInfo.cor, fontWeight: '700' }}>
          {statusInfo.label}
        </Chip>
      </View>

      {/* Dados do Cliente */}
      <Card style={estilos.card}>
        <Card.Content>
          <Text variant="titleMedium" style={{ fontWeight: '700', marginBottom: 4 }}>
            👤 {orcamento.cliente_nome}
          </Text>
          {orcamento.cliente_tel ? (
            <Text style={{ color: '#555', fontSize: 13 }}>📞 {orcamento.cliente_tel}</Text>
          ) : null}
          {orcamento.endereco ? (
            <Text style={{ color: '#555', fontSize: 13, marginTop: 2 }}>📍 {orcamento.endereco}</Text>
          ) : null}
        </Card.Content>
      </Card>

      {/* Itens */}
      <Card style={estilos.card}>
        <Card.Content>
          <Text variant="titleSmall" style={{ fontWeight: '700', color: '#555', marginBottom: 8 }}>
            🔧 ITENS E SERVIÇOS
          </Text>
          {orcamento.itens.map((item, index) => (
            <View key={index} style={estilos.itemLinha}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '600' }}>{item.descricao}</Text>
                <Text style={{ fontSize: 11, color: '#888' }}>
                  Mat: {formatarReais(item.custo_material)} · M.O: {formatarReais(item.custo_mao_obra)} ({item.quantidade}x)
                </Text>
              </View>
              <Text style={{ fontWeight: '700', color: '#162544' }}>
                {formatarReais(item.subtotal)}
              </Text>
            </View>
          ))}

          <Divider style={{ marginVertical: 10 }} />

          {orcamento.frete > 0 ? (
            <View style={estilos.resumoLinha}>
              <Text style={{ color: '#666' }}>Deslocamento</Text>
              <Text style={{ fontWeight: '600' }}>{formatarReais(orcamento.frete)}</Text>
            </View>
          ) : null}

          <View style={[estilos.resumoLinha, { marginTop: 6 }]}>
            <Text style={{ fontSize: 16, fontWeight: '800' }}>TOTAL</Text>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#162544' }}>
              {formatarReais(orcamento.total)}
            </Text>
          </View>
        </Card.Content>
      </Card>

      {/* Alterar Status */}
      <Card style={estilos.card}>
        <Card.Content>
          <Text variant="titleSmall" style={{ fontWeight: '700', color: '#555', marginBottom: 10 }}>
            MUDAR STATUS
          </Text>
          <View style={estilos.botoesStatus}>
            <Button
              mode={orcamento.status === 'fechado' ? 'contained' : 'outlined'}
              buttonColor={orcamento.status === 'fechado' ? '#1e8e3e' : undefined}
              textColor={orcamento.status === 'fechado' ? '#fff' : '#1e8e3e'}
              style={{ flex: 1, borderColor: '#1e8e3e' }}
              onPress={() => mudarStatus('fechado')}
            >
              Fechado
            </Button>
            <Button
              mode={orcamento.status === 'recusado' ? 'contained' : 'outlined'}
              buttonColor={orcamento.status === 'recusado' ? '#d93025' : undefined}
              textColor={orcamento.status === 'recusado' ? '#fff' : '#d93025'}
              style={{ flex: 1, borderColor: '#d93025' }}
              onPress={() => mudarStatus('recusado')}
            >
              Recusado
            </Button>
          </View>
        </Card.Content>
      </Card>

      {/* Ações */}
      <View style={{ padding: 16, gap: 10, marginBottom: 40 }}>
        <Button
          mode="contained"
          icon="whatsapp"
          onPress={reenviarPdf}
          loading={gerandoPdf}
          disabled={gerandoPdf}
          style={{ backgroundColor: '#25D366' }}
        >
          Enviar Orçamento no WhatsApp
        </Button>

        <Button mode="outlined" textColor="#d93025" style={{ borderColor: '#d93025' }} onPress={confirmarExclusao}>
          Excluir Orçamento
        </Button>
      </View>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FB' },
  topo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  card: { marginHorizontal: 16, marginBottom: 12, backgroundColor: '#fff', borderRadius: 12 },
  itemLinha: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  resumoLinha: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  botoesStatus: { flexDirection: 'row', gap: 10 },
});
