/**
 * app/index.js
 * Tela inicial — lista de orçamentos.
 * PHP analogy: a página index.php que faz SELECT * FROM orcamentos e exibe em tabela.
 */

import { useState, useCallback } from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { FAB, Text, Chip, Card, Badge, Divider, Searchbar, IconButton } from 'react-native-paper';
import { useFocusEffect, useRouter } from 'expo-router';
import { listarOrcamentos } from '@src/banco-de-dados';
import { formatarReais } from '@src/calculos';
import { checarPermissaoNovoOrcamento } from '@src/assinatura';
import ModalPaywall from '@src/componentes/ModalPaywall';

// Mapeamento de status → cor e ícone (equivale a um switch/case no PHP)
const STATUS_CONFIG = {
  aguardando: { cor: '#f59e0b', label: 'Aguardando',  icone: '⏳' },
  fechado:    { cor: '#22c55e', label: 'Fechado',     icone: '✅' },
  recusado:   { cor: '#ef4444', label: 'Recusado',    icone: '❌' },
  cancelado:  { cor: '#9ca3af', label: 'Cancelado',   icone: '🚫' },
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
                  {status.icone} {status.label}
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
        <Text style={{ fontSize: 48 }}>📋</Text>
        <Text variant="titleMedium" style={{ marginTop: 12, color: '#555' }}>
          Nenhum orçamento ainda
        </Text>
        <Text variant="bodySmall" style={{ color: '#888', textAlign: 'center', marginTop: 6 }}>
          Toque no botão + para criar seu primeiro orçamento
        </Text>
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
        {[null, 'aguardando', 'fechado', 'recusado'].map(s => (
          <Chip
            key={String(s)}
            selected={filtroStatus === s}
            onPress={() => setFiltroStatus(s)}
            style={estilos.chipFiltro}
            compact
          >
            {s === null ? 'Todos' : STATUS_CONFIG[s].label}
          </Chip>
        ))}
      </View>

      <Divider />

      {/* Quota / Status Pro */}
      <View style={estilos.linhaQuota}>
        <Text style={estilos.contador}>
          {orcamentosFiltrados.length} orçamento{orcamentosFiltrados.length !== 1 ? 's' : ''}
        </Text>
        {statusQuota.ehPro ? (
          <Chip compact style={{ backgroundColor: '#e6f4ea' }} textStyle={{ color: '#1e8e3e', fontSize: 11, fontWeight: '700' }}>
            👑 Pro Ilimitado
          </Chip>
        ) : (
          <TouchableOpacity onPress={() => setModalPaywallAberto(true)}>
            <Chip
              compact
              style={{ backgroundColor: statusQuota.restantes === 0 ? '#fce8e6' : '#e8f0fe' }}
              textStyle={{ color: statusQuota.restantes === 0 ? '#d93025' : '#1a73e8', fontSize: 11, fontWeight: '700' }}
            >
              {statusQuota.restantes === 0
                ? '⚠️ 0/3 restantes (Desbloquear)'
                : `⚡ ${statusQuota.restantes}/3 grátis no mês`}
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
        label="Novo Orçamento"
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
  container:   { flex: 1, backgroundColor: '#F4F7FB' },
  busca:       { margin: 12, marginBottom: 8, elevation: 2, backgroundColor: '#fff' },
  filtros:     { flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 8, gap: 8 },
  chipFiltro:  { borderRadius: 20 },
  linhaQuota:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 6 },
  contador:    { fontSize: 12, color: '#888' },
  card:        { borderRadius: 12, elevation: 2, backgroundColor: '#fff', borderLeftWidth: 4, borderLeftColor: '#162544' },
  cardTopo:    { flexDirection: 'row', alignItems: 'flex-start' },
  vazio:       { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40 },
  fab:         { position: 'absolute', bottom: 24, right: 16, backgroundColor: '#162544' },
});
