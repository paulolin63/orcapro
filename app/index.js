/**
 * app/index.js
 * Tela inicial — lista de orçamentos.
 * PHP analogy: a página index.php que faz SELECT * FROM orcamentos e exibe em tabela.
 */

import { useState, useCallback } from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { FAB, Text, Chip, Card, Divider, Searchbar, Button } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useFocusEffect, useRouter } from 'expo-router';
import { listarOrcamentos, lerTodasConfigs } from '@src/banco-de-dados';
import { formatarReais } from '@src/calculos';
import { checarPermissaoNovoOrcamento } from '@src/assinatura';
import ModalPaywall from '@src/componentes/ModalPaywall';

// Mapeamento de status → cor e ícone (equivale a um switch/case no PHP)
const STATUS_CONFIG = {
  aguardando: { cor: '#f59e0b', label: 'Aguardando' },
  fechado:    { cor: '#22c55e', label: 'Fechado' },
  recusado:   { cor: '#ef4444', label: 'Recusado' },
  cancelado:  { cor: '#9ca3af', label: 'Cancelado' },
};

export default function TelaInicial() {
  const router = useRouter();
  const [orcamentos, setOrcamentos] = useState([]);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState(null); // null = todos
  const [modalPaywallAberto, setModalPaywallAberto] = useState(false);
  const [statusQuota, setStatusQuota] = useState({ ehPro: false, usados: 0, restantes: 3 });
  const [configs, setConfigs] = useState({});

  // useFocusEffect = executa toda vez que a tela fica visível
  useFocusEffect(
    useCallback(() => {
      carregarOrcamentos();
      checarPermissaoNovoOrcamento().then(setStatusQuota);
      lerTodasConfigs().then(setConfigs).catch(() => {});
    }, [filtroStatus])
  );

  async function carregarOrcamentos() {
    try {
      const lista = await listarOrcamentos(filtroStatus);
      setOrcamentos(lista);
    } catch (erro) {
      console.error('Erro ao carregar orçamentos:', erro);
    }
  }

  // Filtra por busca de texto (equivale a WHERE cliente_nome LIKE '%busca%')
  const orcamentosFiltrados = orcamentos.filter(o =>
    o.cliente_nome.toLowerCase().includes(busca.toLowerCase())
  );

  function abrirOrcamento(id) {
    router.push({ pathname: '/detalhe-orcamento', params: { id } });
  }

  async function novoOrcamento() {
    const permissao = await checarPermissaoNovoOrcamento();
    if (!permissao.podeGerar) {
      setModalPaywallAberto(true);
      return;
    }
    router.push('/novo-orcamento');
  }

  // ── Renderiza cada card da lista ──────────────────────────────
  function renderCard({ item: o }) {
    const status = STATUS_CONFIG[o.status] || STATUS_CONFIG.aguardando;
    const dataFormatada = new Date(o.criado_em).toLocaleDateString('pt-BR');

    return (
      <TouchableOpacity onPress={() => abrirOrcamento(o.id)} activeOpacity={0.75}>
        <Card style={estilos.card}>
          <Card.Content>
            <View style={estilos.cardTopo}>
              <View style={{ flex: 1 }}>
                <Text variant="titleMedium" style={{ fontWeight: '700' }}>
                  {o.cliente_nome}
                </Text>
                <Text variant="bodySmall" style={{ color: '#666', marginTop: 2 }}>
                  #{String(o.id).padStart(4, '0')} · {dataFormatada}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text variant="titleMedium" style={{ fontWeight: '800', color: '#162544' }}>
                  {formatarReais(o.total)}
                </Text>
                <Chip
                  compact
                  style={{ backgroundColor: status.cor + '22', marginTop: 4 }}
                  textStyle={{ color: status.cor, fontSize: 10, fontWeight: '700' }}
                >
                  {status.label}
                </Chip>
              </View>
            </View>
          </Card.Content>
        </Card>
      </TouchableOpacity>
    );
  }

  const temNome = !!String(configs.nome_empresa || '').trim();
  const temLogo = !!String(configs.logo_uri || '').trim();
  const temPix  = !!String(configs.pix_key || '').trim();
  const etapasConcluidas = [temNome, temLogo, temPix].filter(Boolean).length;
  const mostrarGuiaConfig = etapasConcluidas < 3;

  function BannerConfiguracao() {
    if (!mostrarGuiaConfig) return null;
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => router.push('/configuracoes')}
        style={estilos.bannerConfig}
      >
        <View style={estilos.bannerConfigTopo}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
            <MaterialCommunityIcons name="badge-account-horizontal-outline" size={18} color="#162544" />
            <Text style={estilos.bannerConfigTitulo}>
              Personalize seu PDF ({etapasConcluidas}/3)
            </Text>
          </View>
          <View style={estilos.bannerConfigCta}>
            <Text style={estilos.bannerConfigCtaTxt}>Configurar →</Text>
          </View>
        </View>
        <Text style={estilos.bannerConfigSub}>
          Coloque sua Logo e Chave Pix para sair com QR Code automático no orçamento:
        </Text>
        <View style={estilos.bannerConfigPills}>
          <View style={[estilos.pillItem, temNome && estilos.pillItemOk]}>
            <Text style={[estilos.pillTxt, temNome && estilos.pillTxtOk]}>
              {temNome ? '✓' : '○'} Sua Empresa
            </Text>
          </View>
          <View style={[estilos.pillItem, temLogo && estilos.pillItemOk]}>
            <Text style={[estilos.pillTxt, temLogo && estilos.pillTxtOk]}>
              {temLogo ? '✓' : '○'} Sua Logo
            </Text>
          </View>
          <View style={[estilos.pillItem, temPix && estilos.pillItemOk]}>
            <Text style={[estilos.pillTxt, temPix && estilos.pillTxtOk]}>
              {temPix ? '✓' : '○'} Chave Pix (QR)
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  function ListaVazia() {
    return (
      <View style={estilos.vazio}>
        <Card style={estilos.cardOnboarding}>
          <Card.Content style={{ alignItems: 'center', paddingVertical: 16 }}>
            <View style={estilos.iconeOnboarding}>
              <MaterialCommunityIcons name="file-document-edit-outline" size={32} color="#FFA000" />
            </View>
            <Text variant="titleMedium" style={estilos.tituloOnboarding}>
              Crie seu 1º orçamento em 1 minuto
            </Text>

            <View style={estilos.passosOnboarding}>
              <View style={estilos.passoLinha}>
                <View style={estilos.passoNum}><Text style={estilos.passoNumTxt}>1</Text></View>
                <Text style={estilos.passoTxt}>Informe o cliente</Text>
              </View>
              <View style={estilos.passoLinha}>
                <View style={estilos.passoNum}><Text style={estilos.passoNumTxt}>2</Text></View>
                <Text style={estilos.passoTxt}>Adicione materiais, mão de obra e lucro</Text>
              </View>
              <View style={estilos.passoLinha}>
                <View style={estilos.passoNum}><Text style={estilos.passoNumTxt}>3</Text></View>
                <Text style={estilos.passoTxt}>Gere o PDF com Pix e envie no WhatsApp</Text>
              </View>
            </View>

            <Button
              mode="contained"
              icon="plus"
              buttonColor="#162544"
              textColor="#ffffff"
              onPress={novoOrcamento}
              style={estilos.btnOnboardingPrimario}
              contentStyle={{ paddingVertical: 4 }}
            >
              Criar primeiro orçamento
            </Button>

            <Button
              mode="outlined"
              icon="cog-outline"
              textColor="#162544"
              onPress={() => router.push('/configuracoes')}
              style={estilos.btnOnboardingSecundario}
            >
              Configurar minha empresa e Pix
            </Button>
          </Card.Content>
        </Card>
      </View>
    );
  }

  return (
    <View style={estilos.container}>

      {/* Barra de busca */}
      <Searchbar
        placeholder="Buscar cliente..."
        value={busca}
        onChangeText={setBusca}
        style={estilos.busca}
        inputStyle={{ fontSize: 14, color: '#162544' }}
        textColor="#162544"
        placeholderTextColor="#64748b"
        iconColor="#162544"
      />

      {/* Filtros de status */}
      <View style={estilos.filtros}>
        {[null, 'aguardando', 'fechado', 'recusado'].map(s => {
          const selecionado = filtroStatus === s;
          return (
            <Chip
              key={String(s)}
              selected={selecionado}
              onPress={() => setFiltroStatus(s)}
              selectedColor="#ffffff"
              style={[
                estilos.chipFiltro,
                selecionado
                  ? { backgroundColor: '#162544', borderColor: '#162544', borderWidth: 1 }
                  : { backgroundColor: '#ffffff', borderColor: '#cbd5e1', borderWidth: 1 },
              ]}
              textStyle={{ color: selecionado ? '#ffffff' : '#162544', fontWeight: selecionado ? '700' : '500' }}
              compact
            >
              {s === null ? 'Todos' : STATUS_CONFIG[s].label}
            </Chip>
          );
        })}
      </View>

      <Divider />

      <View style={estilos.linhaQuota}>
        {statusQuota.ehPro ? (
          <View style={estilos.proAtivoBar}>
            <MaterialCommunityIcons name="crown" size={16} color="#B45309" />
            <Text style={estilos.proAtivoTxt}>Pro Vitalício Ativo · Orçamentos ilimitados</Text>
          </View>
        ) : (
          <TouchableOpacity
            activeOpacity={0.85}
            style={estilos.barraPro}
            onPress={() => setModalPaywallAberto(true)}
          >
            <View style={{ flex: 1 }}>
              <Text style={estilos.barraProQuota}>
                Plano Grátis: <Text style={{ fontWeight: '900', color: statusQuota.restantes === 0 ? '#FCA5A5' : '#FFA000' }}>{statusQuota.restantes}/3</Text> restantes no mês
              </Text>
              <Text style={estilos.barraProSub}>
                Ilimitado + Modelos 1-toque + PDF sem marca
              </Text>
            </View>
            <View style={estilos.botaoSejaPro}>
              <MaterialCommunityIcons name="crown" size={14} color="#162544" />
              <Text style={estilos.botaoSejaProTxt}>Seja Pro</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* Lista */}
      <FlatList
        data={orcamentosFiltrados}
        keyExtractor={item => String(item.id)}
        renderItem={renderCard}
        ListHeaderComponent={BannerConfiguracao}
        ListEmptyComponent={ListaVazia}
        contentContainerStyle={{ padding: 12, paddingBottom: 100 }}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      />

      {/* Botão flutuante: Novo orçamento */}
      <FAB
        icon="plus"
        label="Novo"
        color="#ffffff"
        style={estilos.fab}
        onPress={novoOrcamento}
      />

      {/* Modal Paywall */}
      <ModalPaywall
        visivel={modalPaywallAberto}
        onFechar={() => setModalPaywallAberto(false)}
        onSucesso={() => checarPermissaoNovoOrcamento().then(setStatusQuota)}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  container:               { flex: 1, backgroundColor: '#F4F7FB' },
  busca:                   { margin: 12, marginBottom: 8, elevation: 2, backgroundColor: '#fff' },
  filtros:                 { flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 8, gap: 8, flexWrap: 'wrap' },
  chipFiltro:              { borderRadius: 20 },
  linhaQuota:              { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 2 },
  proAtivoBar:             { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEF3C7', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#FDE68A' },
  proAtivoTxt:             { color: '#92400E', fontSize: 12, fontWeight: '800' },
  barraPro:                { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#162544', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, elevation: 2 },
  barraProQuota:           { color: '#ffffff', fontSize: 12, fontWeight: '600' },
  barraProSub:             { color: '#CBD5E1', fontSize: 11, marginTop: 2 },
  botaoSejaPro:            { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFA000', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, marginLeft: 10 },
  botaoSejaProTxt:         { color: '#162544', fontSize: 12, fontWeight: '900' },
  bannerConfig:            { backgroundColor: '#FFFBEB', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1.5, borderColor: '#FCD34D' },
  bannerConfigTopo:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  bannerConfigTitulo:      { fontSize: 13, fontWeight: '800', color: '#162544' },
  bannerConfigCta:         { backgroundColor: '#162544', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  bannerConfigCtaTxt:      { color: '#ffffff', fontSize: 11, fontWeight: '700' },
  bannerConfigSub:         { fontSize: 11, color: '#475569', marginBottom: 8 },
  bannerConfigPills:       { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pillItem:                { backgroundColor: '#ffffff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: '#CBD5E1' },
  pillItemOk:              { backgroundColor: '#DCFCE7', borderColor: '#86EFAC' },
  pillTxt:                 { fontSize: 11, color: '#475569', fontWeight: '600' },
  pillTxtOk:               { color: '#166534', fontWeight: '800' },
  card:                    { borderRadius: 12, elevation: 2, backgroundColor: '#fff', borderLeftWidth: 4, borderLeftColor: '#162544' },
  cardTopo:                { flexDirection: 'row', alignItems: 'flex-start' },
  vazio:                   { paddingTop: 8, paddingHorizontal: 4 },
  cardOnboarding:          { borderRadius: 16, backgroundColor: '#fff', elevation: 2, borderTopWidth: 4, borderTopColor: '#FFA000' },
  iconeOnboarding:         { width: 60, height: 60, borderRadius: 30, backgroundColor: '#162544', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  tituloOnboarding:        { fontWeight: '800', color: '#162544', textAlign: 'center', marginBottom: 14 },
  passosOnboarding:        { width: '100%', gap: 8, marginBottom: 18 },
  passoLinha:              { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F8FAFC', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  passoNum:                { width: 22, height: 22, borderRadius: 11, backgroundColor: '#00B49F', alignItems: 'center', justifyContent: 'center' },
  passoNumTxt:             { color: '#ffffff', fontSize: 12, fontWeight: '800' },
  passoTxt:                { flex: 1, color: '#162544', fontSize: 13, fontWeight: '600' },
  btnOnboardingPrimario:   { width: '100%', borderRadius: 10, marginBottom: 10 },
  btnOnboardingSecundario: { width: '100%', borderRadius: 10, borderColor: '#cbd5e1' },
  fab:                     { position: 'absolute', bottom: 24, right: 16, backgroundColor: '#162544' },
});
