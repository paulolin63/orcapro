/**
 * app/estatisticas.js
 * Painel de Estatísticas e Métricas Mensais (Receita, Taxa de Fechamento, Lucro).
 */

import { useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text, Card, Divider } from 'react-native-paper';
import { useFocusEffect } from 'expo-router';
import { estatisticasMes, listarOrcamentos } from '@src/banco-de-dados';
import { formatarReais } from '@src/calculos';

export default function Estatisticas() {
  const [stats, setStats] = useState({
    total_orcamentos: 0,
    total_fechados: 0,
    receita_total: 0,
    lucro_estimado: 0,
    taxa_fechamento: 0,
  });
  const [ultimosFechados, setUltimosFechados] = useState([]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [])
  );

  async function carregar() {
    const dados = await estatisticasMes();
    setStats(dados);

    const fechados = await listarOrcamentos('fechado');
    setUltimosFechados(fechados.slice(0, 5));
  }

  const mesAtual = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <ScrollView style={estilos.container}>
      {/* Banner Principal */}
      <View style={estilos.banner}>
        <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, textTransform: 'capitalize' }}>
          {mesAtual}
        </Text>
        <Text style={{ color: '#fff', fontSize: 32, fontWeight: '800', marginTop: 4 }}>
          {formatarReais(stats.receita_total || 0)}
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 }}>
          Receita em serviços fechados
        </Text>
      </View>

      {/* Grid de Métricas */}
      <View style={estilos.grid}>
        <Card style={estilos.cardStat}>
          <Card.Content>
            <Text style={estilos.statValor}>{stats.total_orcamentos || 0}</Text>
            <Text style={estilos.statRotulo}>Total de orçamentos</Text>
          </Card.Content>
        </Card>

        <Card style={estilos.cardStat}>
          <Card.Content>
            <Text style={[estilos.statValor, { color: '#1e8e3e' }]}>
              {stats.total_fechados || 0}
            </Text>
            <Text style={estilos.statRotulo}>Fechados</Text>
          </Card.Content>
        </Card>

        <Card style={estilos.cardStat}>
          <Card.Content>
            <Text style={[estilos.statValor, { color: '#f59e0b' }]}>
              {stats.taxa_fechamento || 0}%
            </Text>
            <Text style={estilos.statRotulo}>Taxa de conversão</Text>
          </Card.Content>
        </Card>

        <Card style={estilos.cardStat}>
          <Card.Content>
            <Text style={[estilos.statValor, { color: '#162544' }]}>
              {formatarReais(stats.lucro_estimado || 0)}
            </Text>
            <Text style={estilos.statRotulo}>Lucro estimado</Text>
          </Card.Content>
        </Card>
      </View>

      {/* Últimos Fechados */}
      <View style={{ paddingHorizontal: 16, marginTop: 8, marginBottom: 30 }}>
        <Text variant="titleMedium" style={{ fontWeight: '700', marginBottom: 10 }}>
          Últimos orçamentos fechados
        </Text>
        {ultimosFechados.length === 0 ? (
          <Text style={{ color: '#888', fontStyle: 'italic' }}>Nenhum orçamento fechado este mês ainda.</Text>
        ) : (
          ultimosFechados.map(o => (
            <Card key={o.id} style={{ marginBottom: 8, backgroundColor: '#fff' }}>
              <Card.Content style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Text style={{ fontWeight: '700' }}>{o.cliente_nome}</Text>
                  <Text style={{ fontSize: 11, color: '#888' }}>
                    {new Date(o.criado_em).toLocaleDateString('pt-BR')}
                  </Text>
                </View>
                <Text style={{ fontWeight: '800', color: '#1e8e3e', fontSize: 16 }}>
                  {formatarReais(o.total)}
                </Text>
              </Card.Content>
            </Card>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FB' },
  banner: { backgroundColor: '#162544', padding: 24, alignItems: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 8 },
  cardStat: { width: '48%', backgroundColor: '#fff', borderRadius: 12 },
  statValor: { fontSize: 24, fontWeight: '800', color: '#333' },
  statRotulo: { fontSize: 11, color: '#777', marginTop: 4 },
});
