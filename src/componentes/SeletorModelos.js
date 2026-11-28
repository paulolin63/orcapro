/**
 * SeletorModelos — lista modelos prontos em 1 toque + modelos salvos pelo técnico (Pro / Lifetime).
 * API: listarModelos / deletarModelo em banco-de-dados.js
 */

import React, { useCallback, useState } from 'react';
import { View, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { Text, Button, Card, Chip, IconButton, ActivityIndicator } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useFocusEffect } from 'expo-router';
import { listarModelos, deletarModelo } from '../banco-de-dados';
import { FEATURE_MODELOS_PRO } from '../feature-flags';
import { verificarEntitlement } from '../assinatura';

export const MODELOS_PRONTOS_PADRAO = [
  {
    id: 'padrao_split',
    nome: '❄️ Instalação Split',
    itens: [
      {
        descricao: 'Instalação de Ar-Condicionado Split (mão de obra + suporte)',
        custo_material: 120,
        custo_mao_obra: 380,
        quantidade: 1,
      },
    ],
  },
  {
    id: 'padrao_higienizacao',
    nome: '🧹 Higienização de Ar',
    itens: [
      {
        descricao: 'Limpeza e higienização completa com bactericida',
        custo_material: 30,
        custo_mao_obra: 170,
        quantidade: 1,
      },
    ],
  },
  {
    id: 'padrao_eletrica',
    nome: '⚡ Serviço Elétrico',
    itens: [
      {
        descricao: 'Revisão de quadro elétrico / instalação de disjuntor',
        custo_material: 80,
        custo_mao_obra: 220,
        quantidade: 1,
      },
    ],
  },
  {
    id: 'padrao_visita',
    nome: '🔧 Visita Técnica',
    itens: [
      {
        descricao: 'Visita técnica, avaliação e diagnóstico no local',
        custo_material: 0,
        custo_mao_obra: 120,
        quantidade: 1,
      },
    ],
  },
];

export default function SeletorModelos({ onAplicar, onPrecisaPro }) {
  const [modelos, setModelos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [ehPro, setEhPro] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const ent = await verificarEntitlement();
      setEhPro(!!ent.ilimitadoOrcamentos);
      if (ent.ilimitadoOrcamentos && FEATURE_MODELOS_PRO) {
        const lista = await listarModelos();
        setModelos(lista);
      } else {
        setModelos([]);
      }
    } catch {
      setModelos([]);
    } finally {
      setCarregando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  if (!FEATURE_MODELOS_PRO) return null;

  if (!ehPro) {
    return (
      <Card style={estilos.card}>
        <Card.Content>
          <View style={estilos.topo}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <MaterialCommunityIcons name="lightning-bolt" size={18} color="#B45309" />
              <Text style={estilos.titulo}>Modelos em 1 Toque</Text>
            </View>
            <View style={estilos.badgePro}>
              <MaterialCommunityIcons name="lock" size={11} color="#162544" />
              <Text style={estilos.badgeProTxt}>PRO</Text>
            </View>
          </View>
          <Text style={estilos.subtitulo}>
            Preencha serviços inteiros e valores em 1 segundo sem digitar tudo de novo:
          </Text>
          <View style={estilos.gradeChips}>
            {MODELOS_PRONTOS_PADRAO.map((m) => (
              <TouchableOpacity
                key={m.id}
                activeOpacity={0.75}
                style={estilos.chipBloqueado}
                onPress={() => onPrecisaPro && onPrecisaPro()}
              >
                <Text style={estilos.chipBloqueadoTxt}>{m.nome} 🔒</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Button
            mode="contained"
            compact
            buttonColor="#162544"
            textColor="#ffffff"
            icon="crown"
            style={{ marginTop: 10, borderRadius: 8 }}
            onPress={() => onPrecisaPro && onPrecisaPro()}
          >
            Desbloquear Modelos 1-Toque
          </Button>
        </Card.Content>
      </Card>
    );
  }

  if (carregando) {
    return (
      <View style={estilos.loading}>
        <ActivityIndicator size="small" color="#162544" />
      </View>
    );
  }

  return (
    <Card style={estilos.card}>
      <Card.Content>
        <View style={estilos.topo}>
          <Text style={estilos.titulo}>⚡ Modelos Rápidos (1 toque)</Text>
          <Text style={{ fontSize: 11, color: '#B45309', fontWeight: '700' }}>Pro Ativo</Text>
        </View>

        <View style={estilos.gradeChips}>
          {MODELOS_PRONTOS_PADRAO.map((m) => (
            <Chip
              key={m.id}
              compact
              style={estilos.chip}
              textStyle={{ fontSize: 12, fontWeight: '700', color: '#162544' }}
              onPress={() => onAplicar && onAplicar(m)}
            >
              {m.nome}
            </Chip>
          ))}
        </View>

        {modelos.length > 0 ? (
          <View style={[estilos.lista, { marginTop: 8 }]}>
            <Text style={{ fontSize: 11, color: '#64748b', fontWeight: '700' }}>
              Meus modelos salvos:
            </Text>
            {modelos.map((m) => (
              <View key={m.id} style={estilos.linha}>
                <Chip
                  compact
                  style={estilos.chip}
                  textStyle={{ fontSize: 12, fontWeight: '700', color: '#162544' }}
                  onPress={() => onAplicar && onAplicar(m)}
                >
                  ⭐ {m.nome}
                </Chip>
                <IconButton
                  icon="delete-outline"
                  size={18}
                  iconColor="#d93025"
                  onPress={() => {
                    Alert.alert('Excluir modelo', `Remover "${m.nome}"?`, [
                      { text: 'Cancelar', style: 'cancel' },
                      {
                        text: 'Excluir',
                        style: 'destructive',
                        onPress: async () => {
                          await deletarModelo(m.id);
                          carregar();
                        },
                      },
                    ]);
                  }}
                />
              </View>
            ))}
          </View>
        ) : null}
      </Card.Content>
    </Card>
  );
}

const estilos = StyleSheet.create({
  card: {
    marginBottom: 14,
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#FDE68A',
  },
  topo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  titulo: { fontWeight: '800', color: '#162544', fontSize: 14 },
  subtitulo: { fontSize: 12, color: '#475569', marginBottom: 8 },
  badgePro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFA000',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeProTxt: { fontSize: 10, fontWeight: '900', color: '#162544' },
  gradeChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chipBloqueado: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#FCD34D',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  chipBloqueadoTxt: { fontSize: 12, fontWeight: '700', color: '#162544' },
  lista: { gap: 4 },
  linha: { flexDirection: 'row', alignItems: 'center' },
  chip: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#FFA000', flexShrink: 1 },
  loading: { paddingVertical: 8, alignItems: 'center' },
});
