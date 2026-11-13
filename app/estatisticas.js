/**
 * app/estatisticas.js
 * Mes (todos) + funil de fechamento (Pro / Lifetime).
 */

import { useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text, Card, Button } from 'react-native-paper';
import { useFocusEffect } from 'expo-router';
import { estatisticasMes, listarOrcamentos, estatisticasFunil } from '@src/banco-de-dados';
import { formatarReais } from '@src/calculos';
import { verificarEntitlement } from '@src/assinatura';
import ModalPaywall from '@src/componentes/ModalPaywall';

export default function Estatisticas() {
  const [stats, setStats] = useState({
    total_orcamentos: 0,
    total_fechados: 0,
    receita_total: 0,
    lucro_estimado: 0,
    taxa_fechamento: 0,
  });
  const [ultimosFechados, setUltimosFechados] = useState([]);
  const [ehPro, setEhPro] = useState(false);
  const [funil, setFunil] = useState(null);
  const [paywall, setPaywall] = useState(false);

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

    const ent = await verificarEntitlement();
    const pro = !!ent.ilimitadoOrcamentos;
    setEhPro(pro);
    if (pro) {
      setFunil(await estatisticasFunil());
    } else {
      setFunil(null);
    }
  }

  const mesAtual = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <ScrollView style={estilos.container}>
      <View style={estilos.banner}>
        <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, textTransform: 'capitalize' }}>
          {mesAtual}
        </Text>
        <Text style={{ color: '#fff', fontSize: 32, fontWeight: '800', marginTop: 4 }}>
          {formatarReais(stats.receita_total || 0)}
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 }}>
          Receita fechada
        </Text>
      </View>

      <View style={estilos.grid}>
        <Card style={estilos.cardStat}>
          <Card.Content>
            <Text style={estilos.statValor}>{stats.total_orcamentos || 0}</Text>
            <Text style={estilos.statRotulo}>Orcamentos</Text>
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
            <Text style={estilos.statRotulo}>Conversao</Text>
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

      <View style={estilos.bloco}>
        <Text style={estilos.blocoTitulo}>Fechamento (Pro)</Text>

        {!ehPro ? (
          <Card style={estilos.cardEmpty}>
            <Card.Content>
              <Text style={estilos.bullet}>Tempo medio ate o cliente aceitar</Text>
              <Text style={estilos.bullet}>Faixas de valor que mais fecham</Text>
              <Text style={estilos.bullet}>Taxa por modelo de servico</Text>
              <Text style={estilos.bullet}>Lista de follow-up (quem ainda aguarda)</Text>
              <Button
                mode="contained"
                style={estilos.cta}
                onPress={() => setPaywall(true)}
              >
                Desbloquear
              </Button>
            </Card.Content>
          </Card>
        ) : (
          <>
            <Card style={estilos.cardFunil}>
              <Card.Content>
                <Text style={estilos.statRotulo}>Tempo medio ate fechar</Text>
                <Text style={estilos.statValor}>
                  {funil?.dias_medios != null ? `${funil.dias_medios} dias` : '—'}
                </Text>
              </Card.Content>
            </Card>

            <Text style={estilos.subTitulo}>Faixas de valor</Text>
            {(funil?.faixas || []).map((f) => (
              <View key={f.faixa} style={estilos.linha}>
                <Text style={estilos.linhaLabel}>R$ {f.faixa}</Text>
                <Text style={estilos.linhaValor}>
                  {f.fechados}/{f.enviados} · {f.taxa}%
                </Text>
              </View>
            ))}

            <Text style={estilos.subTitulo}>Por modelo</Text>
            {(funil?.porModelo || []).length === 0 ? (
              <Text style={estilos.vazio}>Sem dados</Text>
            ) : (
              (funil.porModelo || []).map((m) => (
                <View key={m.nome} style={estilos.linha}>
                  <Text style={estilos.linhaLabel} numberOfLines={1}>{m.nome}</Text>
                  <Text style={estilos.linhaValor}>
                    {m.fechados}/{m.total} · {m.taxa}%
                  </Text>
                </View>
              ))
            )}

            <Text style={estilos.subTitulo}>Follow-up</Text>
            {(funil?.followups || []).length === 0 ? (
              <Text style={estilos.vazio}>Nada pendente</Text>
            ) : (
              (funil.followups || []).map((o) => (
                <Card key={o.id} style={{ marginBottom: 8, backgroundColor: '#fff' }}>
                  <Card.Content style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={{ fontWeight: '700' }}>{o.cliente_nome}</Text>
                      <Text style={{ fontSize: 11, color: '#888' }}>
                        {String(o.followup_em).slice(0, 10)}
                        {o.cliente_tel ? ` · ${o.cliente_tel}` : ''}
                      </Text>
                    </View>
                    <Text style={{ fontWeight: '800', color: '#162544' }}>
                      {formatarReais(o.total)}
                    </Text>
                  </Card.Content>
                </Card>
              ))
            )}
          </>
        )}
      </View>

      <View style={[estilos.bloco, { marginBottom: 30 }]}>
        <Text style={estilos.blocoTitulo}>Ultimos fechados</Text>
        {ultimosFechados.length === 0 ? (
          <Text style={estilos.vazio}>Nenhum ainda</Text>
        ) : (
          ultimosFechados.map((o) => (
            <Card key={o.id} style={{ marginBottom: 8, backgroundColor: '#fff' }}>
              <Card.Content style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Text style={{ fontWeight: '700' }}>{o.cliente_nome}</Text>
                  <Text style={{ fontSize: 11, color: '#888' }}>
                    {new Date(o.criado_em).toLocaleDateString('pt-BR')}
                  </Text>
                </View>
                <Text style={{ fontWeight: '800', color: '#1e8e3e', fontSize: 16 }}>
                  {formatarReais(o.valor_fechado != null ? o.valor_fechado : o.total)}
                </Text>
              </Card.Content>
            </Card>
          ))
        )}
      </View>

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
  banner: { backgroundColor: '#162544', padding: 24, alignItems: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 8 },
  cardStat: { width: '48%', backgroundColor: '#fff', borderRadius: 12 },
  statValor: { fontSize: 24, fontWeight: '800', color: '#333' },
  statRotulo: { fontSize: 11, color: '#777', marginTop: 4 },
  bloco: { paddingHorizontal: 16, marginTop: 8 },
  blocoTitulo: { fontWeight: '700', fontSize: 16, color: '#162544', marginBottom: 10 },
  subTitulo: { fontWeight: '700', fontSize: 13, color: '#555', marginTop: 14, marginBottom: 6 },
  cardEmpty: { backgroundColor: '#fff', borderRadius: 12 },
  cardFunil: { backgroundColor: '#fff', borderRadius: 12, marginBottom: 8 },
  bullet: { fontSize: 13, color: '#333', marginBottom: 6 },
  cta: { backgroundColor: '#162544', marginTop: 12 },
  linha: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  linhaLabel: { flex: 1, color: '#333', fontSize: 13, paddingRight: 8 },
  linhaValor: { color: '#162544', fontWeight: '700', fontSize: 13 },
  vazio: { color: '#888', fontSize: 13 },
});
