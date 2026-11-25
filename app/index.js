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
import { listarOrcamentos } from '@src/banco-de-dados';
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

  // useFocusEffect = executa toda vez que a tela fica visível
  useFocusEffect(
    useCallback(() => {
      carregarOrcamentos();
      checarPermissaoNovoOrcamento().then(setStatusQuota);
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
          <Chip compact style={{ backgroundColor: '#e6f4ea' }} textStyle={{ color: '#1e8e3e', fontSize: 11, fontWeight: '700' }}>
            Pro
          </Chip>
        ) : (
          <TouchableOpacity onPress={() => setModalPaywallAberto(true)}>
            <Chip
              compact
              style={{ backgroundColor: statusQuota.restantes === 0 ? '#fce8e6' : '#e8f0fe' }}
              textStyle={{ color: statusQuota.restantes === 0 ? '#d93025' : '#1a73e8', fontSize: 11, fontWeight: '700' }}
            >
              {statusQuota.restantes}/3
            </Chip>
          </TouchableOpacity>
        )}
      </View>

      {/* Lista */}
      <FlatList
        data={orcamentosFiltrados}
        keyExtractor={item => String(item.id)}
        renderItem={renderCard}
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
  linhaQuota:              { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 6 },
  card:                    { borderRadius: 12, elevation: 2, backgroundColor: '#fff', borderLeftWidth: 4, borderLeftColor: '#162544' },
  cardTopo:                { flexDirection: 'row', alignItems: 'flex-start' },
  vazio:                   { paddingTop: 24, paddingHorizontal: 16 },
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
