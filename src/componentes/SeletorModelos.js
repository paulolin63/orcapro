/**
 * SeletorModelos — lista modelos salvos (recurso Pro / Lifetime).
 * API: listarModelos / deletarModelo em banco-de-dados.js
 */

import React, { useCallback, useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Text, Button, Card, Chip, IconButton, ActivityIndicator } from 'react-native-paper';
import { useFocusEffect } from 'expo-router';
import { listarModelos, deletarModelo } from '../banco-de-dados';
import { FEATURE_MODELOS_PRO } from '../feature-flags';
import { verificarEntitlement } from '../assinatura';

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
          <Text style={estilos.titulo}>Modelos</Text>
          <Button mode="outlined" onPress={() => onPrecisaPro && onPrecisaPro()}>
            Desbloquear
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
        <Text style={estilos.titulo}>Modelos</Text>
        {modelos.length === 0 ? null : (
          <View style={estilos.lista}>
            {modelos.map((m) => (
              <View key={m.id} style={estilos.linha}>
                <Chip
                  style={estilos.chip}
                  textStyle={{ fontSize: 12, fontWeight: '700' }}
                  onPress={() => onAplicar && onAplicar(m)}
                >
                  {m.nome}
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
        )}
      </Card.Content>
    </Card>
  );
}

const estilos = StyleSheet.create({
  card: {
    marginBottom: 14,
    backgroundColor: '#FFF8E7',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFE0A3',
  },
  titulo: { fontWeight: '800', color: '#162544', fontSize: 14, marginBottom: 4 },
  lista: { gap: 4 },
  linha: { flexDirection: 'row', alignItems: 'center' },
  chip: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#FFA000', flexShrink: 1 },
  loading: { paddingVertical: 8, alignItems: 'center' },
});
