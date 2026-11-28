/**
 * app/detalhe-orcamento.js
 * Visualizacao detalhada: status, PDF, duplicar, salvar modelo (Pro).
 */

import { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Alert, TextInput as RNTextInput, Linking } from 'react-native';
import { Text, Card, Chip, Button, Divider, ActivityIndicator, Portal, Modal, Menu, IconButton } from 'react-native-paper';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import {
  buscarOrcamento,
  atualizarStatusOrcamento,
  deletarOrcamento,
  lerTodasConfigs,
  criarOrcamento,
  salvarModelo,
  marcarEnviado,
  definirFollowup,
} from '@src/banco-de-dados';
import { formatarReais } from '@src/calculos';
import { gerarPDF, compartilharPDF } from '@src/pdf';
import {
  checarPermissaoNovoOrcamento,
  consumirQuotaSePermitido,
  verificarEntitlement,
} from '@src/assinatura';
import { FEATURE_MODELOS_PRO, FEATURE_WATERMARK_FREE } from '@src/feature-flags';
import ModalPaywall from '@src/componentes/ModalPaywall';

const STATUS_MAP = {
  aguardando: { label: 'Aguardando', cor: '#f59e0b', bg: '#fef7e0' },
  fechado:    { label: 'Fechado',    cor: '#1e8e3e', bg: '#e6f4ea' },
  recusado:   { label: 'Recusado',   cor: '#d93025', bg: '#fce8e6' },
  cancelado:  { label: 'Cancelado',  cor: '#757575', bg: '#f5f5f5' },
};

export default function DetalheOrcamento() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [orcamento, setOrcamento] = useState(null);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [busy, setBusy] = useState(false);
  const [paywall, setPaywall] = useState(false);
  const [modalModelo, setModalModelo] = useState(false);
  const [nomeModelo, setNomeModelo] = useState('');
  const [menuAberto, setMenuAberto] = useState(false);
  const [statusAberto, setStatusAberto] = useState(false);
  const [ehPro, setEhPro] = useState(false);

  useEffect(() => {
    carregar();
  }, [id]);

  async function carregar() {
    const dados = await buscarOrcamento(id);
    setOrcamento(dados);
    try {
      const ent = await verificarEntitlement();
      setEhPro(!!ent.ilimitadoOrcamentos);
    } catch {}
  }

  async function cobrarRetornoWhatsApp() {
    if (!ehPro) {
      setPaywall(true);
      return;
    }
    try {
      const numero = String(orcamento.id).padStart(4, '0');
      const msg = `Olá ${orcamento.cliente_nome}, tudo bem? Passando para saber se conseguiu avaliar o orçamento #${numero} (${formatarReais(orcamento.total)}) e se ficou alguma dúvida. Consigo reservar um horário para você esta semana!`;
      const digitos = String(orcamento.cliente_tel || '').replace(/\D/g, '');
      const fone =
        digitos.length === 10 || digitos.length === 11 ? `55${digitos}` : digitos;
      const url = fone
        ? `https://wa.me/${fone}?text=${encodeURIComponent(msg)}`
        : `https://wa.me/?text=${encodeURIComponent(msg)}`;
      await Linking.openURL(url);
    } catch {
      Alert.alert('WhatsApp', 'Não foi possível abrir o WhatsApp neste aparelho.');
    }
  }

  async function mudarStatus(novoStatus) {
    await atualizarStatusOrcamento(id, novoStatus);
    carregar();
  }

  async function reenviarPdf() {
    setGerandoPdf(true);
    try {
      const config = await lerTodasConfigs();
      const ent = await verificarEntitlement();
      const mostrarMarcaFree = FEATURE_WATERMARK_FREE && !ent.ilimitadoOrcamentos;
      const pdfUri = await gerarPDF(orcamento, orcamento.itens, config, { mostrarMarcaFree });
      await compartilharPDF(pdfUri);
      await marcarEnviado(id);
      carregar();
    } catch (e) {
      Alert.alert('Erro', 'Nao foi possivel gerar ou enviar o PDF.');
    } finally {
      setGerandoPdf(false);
    }
  }

  function agendarFollowup() {
    Alert.alert('Follow-up', 'Quando cobrar de novo?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: '+3 dias',
        onPress: async () => {
          const d = new Date();
          d.setDate(d.getDate() + 3);
          await definirFollowup(id, d.toISOString().slice(0, 10));
          carregar();
        },
      },
      {
        text: '+7 dias',
        onPress: async () => {
          const d = new Date();
          d.setDate(d.getDate() + 7);
          await definirFollowup(id, d.toISOString().slice(0, 10));
          carregar();
        },
      },
      {
        text: 'Limpar',
        style: 'destructive',
        onPress: async () => {
          await definirFollowup(id, null);
          carregar();
        },
      },
    ]);
  }

  async function duplicarOrcamento() {
    const permissao = await checarPermissaoNovoOrcamento();
    if (!permissao.podeGerar) {
      setPaywall(true);
      return;
    }
    setBusy(true);
    try {
      const consumo = await consumirQuotaSePermitido();
      if (!consumo.ok) {
        setPaywall(true);
        return;
      }
      const itens = (orcamento.itens || []).map((i) => ({
        descricao: i.descricao,
        custo_material: i.custo_material,
        custo_mao_obra: i.custo_mao_obra,
        quantidade: i.quantidade,
        subtotal: i.subtotal,
      }));
      const novoId = await criarOrcamento(
        {
          cliente_nome: orcamento.cliente_nome,
          cliente_tel: orcamento.cliente_tel,
          endereco: orcamento.endereco,
          validade_dias: orcamento.validade_dias,
          subtotal: orcamento.subtotal,
          frete: orcamento.frete,
          outros: orcamento.outros,
          lucro_pct: orcamento.lucro_pct,
          total: orcamento.total,
          notas: orcamento.notas,
          modelo_id: orcamento.modelo_id || null,
        },
        itens
      );
      Alert.alert('Duplicado', 'Novo orcamento criado a partir deste.', [
        { text: 'Abrir', onPress: () => router.replace({ pathname: '/detalhe-orcamento', params: { id: String(novoId) } }) },
      ]);
    } catch (e) {
      Alert.alert('Erro', 'Nao foi possivel duplicar.');
    } finally {
      setBusy(false);
    }
  }

  async function abrirSalvarModelo() {
    if (!FEATURE_MODELOS_PRO) return;
    const ent = await verificarEntitlement();
    if (!ent.ilimitadoOrcamentos) {
      setPaywall(true);
      return;
    }
    setNomeModelo(orcamento.cliente_nome ? `Servico ${orcamento.cliente_nome}` : 'Meu modelo');
    setModalModelo(true);
  }

  async function confirmarSalvarModelo() {
    const nome = nomeModelo.trim();
    if (!nome) {
      Alert.alert('Nome', 'Informe um nome para o modelo.');
      return;
    }
    setBusy(true);
    try {
      const itens = (orcamento.itens || []).map((i) => ({
        descricao: i.descricao,
        custo_material: i.custo_material,
        custo_mao_obra: i.custo_mao_obra,
        quantidade: i.quantidade,
      }));
      await salvarModelo(nome, itens);
      setModalModelo(false);
      Alert.alert('Modelo salvo', `"${nome}" disponivel em Novo orcamento.`);
    } catch (e) {
      Alert.alert('Erro', 'Nao foi possivel salvar o modelo.');
    } finally {
      setBusy(false);
    }
  }

  function confirmarExclusao() {
    Alert.alert('Excluir Orcamento', 'Tem certeza que deseja apagar este orcamento permanentemente?', [
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
      <Stack.Screen
        options={{
          headerRight: () => (
            <Menu
              visible={menuAberto}
              onDismiss={() => setMenuAberto(false)}
              anchor={
                <IconButton
                  icon="dots-vertical"
                  iconColor="#fff"
                  size={22}
                  onPress={() => setMenuAberto(true)}
                />
              }
            >
              <Menu.Item
                onPress={() => { setMenuAberto(false); setStatusAberto((v) => !v); }}
                title="Status"
                leadingIcon="flag-outline"
              />
              <Menu.Item
                onPress={() => { setMenuAberto(false); agendarFollowup(); }}
                title="Follow-up"
                leadingIcon="calendar-clock"
              />
              <Menu.Item
                onPress={() => { setMenuAberto(false); duplicarOrcamento(); }}
                title="Duplicar"
                leadingIcon="content-copy"
                disabled={busy}
              />
              {FEATURE_MODELOS_PRO ? (
                <Menu.Item
                  onPress={() => { setMenuAberto(false); abrirSalvarModelo(); }}
                  title="Salvar modelo"
                  leadingIcon="bookmark-outline"
                  disabled={busy}
                />
              ) : null}
              <Menu.Item
                onPress={() => { setMenuAberto(false); confirmarExclusao(); }}
                title="Excluir"
                leadingIcon="delete-outline"
              />
            </Menu>
          ),
        }}
      />

      <View style={estilos.topo}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text variant="headlineSmall" style={{ fontWeight: '800', color: '#162544' }}>
            {orcamento.cliente_nome}
          </Text>
          <Text style={{ fontSize: 22, fontWeight: '800', color: '#162544', marginTop: 4 }}>
            {formatarReais(orcamento.total)}
          </Text>
          {orcamento.followup_em ? (
            <Text style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
              Follow-up {String(orcamento.followup_em).slice(0, 10)}
            </Text>
          ) : null}
        </View>
        <Chip style={{ backgroundColor: statusInfo.bg }} textStyle={{ color: statusInfo.cor, fontWeight: '700' }}>
          {statusInfo.label}
        </Chip>
      </View>

      {(orcamento.cliente_tel || orcamento.endereco) ? (
        <Card style={estilos.card}>
          <Card.Content>
            {orcamento.cliente_tel ? (
              <Text style={{ color: '#555', fontSize: 13 }}>{orcamento.cliente_tel}</Text>
            ) : null}
            {orcamento.endereco ? (
              <Text style={{ color: '#555', fontSize: 13, marginTop: 2 }}>{orcamento.endereco}</Text>
            ) : null}
          </Card.Content>
        </Card>
      ) : null}

      <Card style={estilos.card}>
        <Card.Content>
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
            <Text style={{ fontSize: 16, fontWeight: '800' }}>Total</Text>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#162544' }}>
              {formatarReais(orcamento.total)}
            </Text>
          </View>
        </Card.Content>
      </Card>

      {statusAberto ? (
        <Card style={estilos.card}>
          <Card.Content>
            <View style={estilos.botoesStatus}>
              <Button
                mode={orcamento.status === 'fechado' ? 'contained' : 'outlined'}
                buttonColor={orcamento.status === 'fechado' ? '#1e8e3e' : undefined}
                textColor={orcamento.status === 'fechado' ? '#fff' : '#1e8e3e'}
                style={{ flex: 1, borderColor: '#1e8e3e' }}
                onPress={() => { mudarStatus('fechado'); setStatusAberto(false); }}
              >
                Fechado
              </Button>
              <Button
                mode={orcamento.status === 'recusado' ? 'contained' : 'outlined'}
                buttonColor={orcamento.status === 'recusado' ? '#d93025' : undefined}
                textColor={orcamento.status === 'recusado' ? '#fff' : '#d93025'}
                style={{ flex: 1, borderColor: '#d93025' }}
                onPress={() => { mudarStatus('recusado'); setStatusAberto(false); }}
              >
                Recusado
              </Button>
            </View>
          </Card.Content>
        </Card>
      ) : null}

      <View style={{ padding: 16, marginBottom: 40 }}>
        <Button
          mode="contained"
          icon="whatsapp"
          onPress={reenviarPdf}
          loading={gerandoPdf}
          disabled={gerandoPdf || busy}
          textColor="#ffffff"
          style={{ backgroundColor: '#25D366' }}
        >
          Enviar PDF no WhatsApp
        </Button>

        {orcamento.status === 'aguardando' ? (
          <Button
            mode="outlined"
            icon="message-text-clock-outline"
            textColor="#162544"
            onPress={cobrarRetornoWhatsApp}
            style={{
              marginTop: 10,
              borderColor: '#FFA000',
              borderWidth: 1.5,
              backgroundColor: '#FFFBEB',
            }}
          >
            {ehPro
              ? 'Cobrar retorno gentil no WhatsApp'
              : 'Cobrar retorno no WhatsApp · 🔒 Pro'}
          </Button>
        ) : null}
      </View>

      <Portal>
        <Modal visible={modalModelo} onDismiss={() => setModalModelo(false)} contentContainerStyle={estilos.modal}>
          <Text style={{ fontWeight: '800', fontSize: 16, marginBottom: 8, color: '#162544' }}>
            Nome do modelo
          </Text>
          <RNTextInput
            value={nomeModelo}
            onChangeText={setNomeModelo}
            placeholder="Ex: Instalacao Split 12000 BTU"
            style={estilos.inputNome}
            placeholderTextColor="#94a3b8"
          />
          <Button mode="contained" onPress={confirmarSalvarModelo} loading={busy} style={{ marginTop: 12, backgroundColor: '#162544' }}>
            Salvar
          </Button>
          <Button mode="text" onPress={() => setModalModelo(false)}>Cancelar</Button>
        </Modal>
      </Portal>

      <ModalPaywall
        visivel={paywall}
        onFechar={() => setPaywall(false)}
        onSucesso={() => {
          setPaywall(false);
          carregar();
        }}
      />
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
  modal: { backgroundColor: '#fff', margin: 24, padding: 20, borderRadius: 16 },
  inputNome: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#162544',
    backgroundColor: '#fff',
  },
});
