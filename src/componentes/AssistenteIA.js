/**
 * src/componentes/AssistenteIA.js
 * Assistente IA por Voz, Foto ou Texto.
 *
 * Monetização:
 * - 1 Demo grátis por instalação.
 * - Posteriormente consome 1 crédito IA (Plano Pro IA ou Pacote IA).
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Text, Button, Card, TextInput, ActivityIndicator, Chip } from 'react-native-paper';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import * as SecureStore from 'expo-secure-store';
import {
  obterSaldoCreditosIa,
  consumirCreditoIa,
} from '../assinatura';
import { gerarRascunhoIa } from '../ia-rascunho';

const DEMO_IA_KEY = 'orcapro_ia_demo_gratis_usada';

const INPUT_THEME = {
  colors: {
    text: '#162544',
    onSurface: '#162544',
    onSurfaceVariant: '#475569',
    placeholder: '#64748b',
    background: '#ffffff',
    primary: '#162544',
    outline: '#cbd5e1',
  },
};

export default function AssistenteIA({ onRascunho, onPrecisaCredito }) {
  const [saldo, setSaldo] = useState(null);
  const [demoDisponivel, setDemoDisponivel] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [textoHint, setTextoHint] = useState('');
  const recordingRef = useRef(null);

  async function refreshSaldo() {
    try {
      const s = await obterSaldoCreditosIa();
      setSaldo(s);
      const demo = await SecureStore.getItemAsync(DEMO_IA_KEY);
      setDemoDisponivel(!demo);
    } catch {
      setSaldo({ total: 0, assinaturaRestantes: 0, pacoteSaldo: 0 });
    }
  }

  useEffect(() => {
    refreshSaldo();
    return () => {
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
    };
  }, []);

  /**
   * @returns {'credito'|'demo'|false}
   */
  async function garantirCreditoOuDemo() {
    const s = await obterSaldoCreditosIa();
    setSaldo(s);
    if (s.total > 0) return 'credito';

    const demo = await SecureStore.getItemAsync(DEMO_IA_KEY);
    if (!demo) {
      return await new Promise((resolve) => {
        Alert.alert(
          '✨ Teste Grátis da IA (1x)',
          'Experimente a criação automática por voz agora. Após o teste, você pode assinar o Pro IA ou adquirir créditos.',
          [
            { text: 'Depois', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Usar Teste Grátis', onPress: () => resolve('demo') },
            {
              text: 'Ver Planos Pro',
              onPress: () => {
                if (onPrecisaCredito) onPrecisaCredito();
                resolve(false);
              },
            },
          ]
        );
      });
    }

    Alert.alert(
      '👑 Recurso Exclusivo Pro IA',
      'Você utilizou seu teste grátis. Desbloqueie o Pro IA (com 20 usos de voz/mês) ou adquira um pacote de créditos para continuar.',
      [
        { text: 'Agora não', style: 'cancel' },
        { text: 'Desbloquear Pro IA', onPress: () => onPrecisaCredito && onPrecisaCredito() },
      ]
    );
    return false;
  }

  async function processar({ origem, uri, textoUsuario }) {
    const modo = await garantirCreditoOuDemo();
    if (!modo) return;

    setProcessando(true);
    try {
      if (modo === 'credito') {
        const consumo = await consumirCreditoIa();
        if (!consumo.ok) {
          Alert.alert('Créditos IA', 'Não foi possível debitar o crédito IA.');
          if (consumo.motivo === 'sem_credito_ia' && onPrecisaCredito) onPrecisaCredito();
          return;
        }
      } else {
        await SecureStore.setItemAsync(DEMO_IA_KEY, '1');
      }

      const rascunho = await gerarRascunhoIa({
        origem,
        uri,
        textoUsuario: textoUsuario || textoHint,
      });

      await refreshSaldo();
      Alert.alert('Orçamento Pré-preenchido!', rascunho.resumo + '\n\nRevise os itens nas próximas etapas.');
      if (onRascunho) onRascunho(rascunho);
    } catch (e) {
      console.warn('AssistenteIA:', e);
      Alert.alert('Erro', 'Não foi possível processar o orçamento. Tente novamente.');
    } finally {
      setProcessando(false);
    }
  }

  async function toggleGravacao() {
    if (processando) return;

    if (gravando) {
      try {
        setGravando(false);
        const rec = recordingRef.current;
        if (!rec) return;
        await rec.stopAndUnloadAsync();
        const uri = rec.getURI();
        recordingRef.current = null;
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
        await processar({ origem: 'audio', uri, textoUsuario: textoHint });
      } catch (e) {
        console.warn(e);
        Alert.alert('Áudio', 'Não foi possível finalizar a gravação.');
        setGravando(false);
      }
      return;
    }

    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Microfone Necessário', 'Permita o acesso ao microfone para ditar os serviços do orçamento por voz.');
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setGravando(true);
    } catch (e) {
      console.warn(e);
      Alert.alert('Áudio', 'Não foi possível iniciar a gravação.');
    }
  }

  async function tirarOuEscolherFoto() {
    if (processando || gravando) return;
    Alert.alert('Foto para Orçamento', 'Como deseja anexar os materiais?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Câmera',
        onPress: async () => {
          const cam = await ImagePicker.requestCameraPermissionsAsync();
          if (!cam.granted) {
            Alert.alert('Câmera', 'Permita o acesso à câmera para fotografar materiais.');
            return;
          }
          const res = await ImagePicker.launchCameraAsync({
            quality: 0.7,
            allowsEditing: true,
          });
          if (!res.canceled && res.assets?.[0]?.uri) {
            await processar({
              origem: 'foto',
              uri: res.assets[0].uri,
              textoUsuario: textoHint || 'Foto de materiais para orçamento técnico',
            });
          }
        },
      },
      {
        text: 'Galeria',
        onPress: async () => {
          const lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!lib.granted) {
            Alert.alert('Fotos', 'Permita o acesso às suas fotos.');
            return;
          }
          const res = await ImagePicker.launchImageLibraryAsync({
            quality: 0.7,
            allowsEditing: true,
          });
          if (!res.canceled && res.assets?.[0]?.uri) {
            await processar({
              origem: 'foto',
              uri: res.assets[0].uri,
              textoUsuario: textoHint || 'Foto de materiais para orçamento técnico',
            });
          }
        },
      },
    ]);
  }

  function processarTextoDigitado() {
    if (!textoHint.trim()) {
      Alert.alert('Texto vazio', 'Digite algo no campo acima (ex: Instalação ar split, 400 material, 300 mão de obra).');
      return;
    }
    processar({ origem: 'texto', textoUsuario: textoHint });
  }

  const total = saldo?.total ?? '…';

  return (
    <Card style={estilos.card}>
      <Card.Content>
        <View style={estilos.topo}>
          <Text style={estilos.titulo}>⚡ Assistente IA por Voz</Text>
          <Chip compact style={estilos.chip} textStyle={{ color: '#162544', fontWeight: '700', fontSize: 11 }}>
            {typeof total === 'number'
              ? `${total} crédito${total === 1 ? '' : 's'}${demoDisponivel && total === 0 ? ' · 1x grátis' : ''}`
              : '…'}
          </Chip>
        </View>

        <Text style={estilos.dica}>
          Dite o serviço por voz (ou digite abaixo). A IA extrai o cliente, itens, materiais e mão de obra automaticamente!
        </Text>

        <TextInput
          mode="outlined"
          label="Fale ou digite (ex: Ar split 9000, 300 material, 250 MO)"
          value={textoHint}
          onChangeText={setTextoHint}
          style={estilos.input}
          textColor="#162544"
          placeholderTextColor="#64748b"
          outlineColor="#cbd5e1"
          activeOutlineColor="#162544"
          theme={INPUT_THEME}
          dense
        />

        {processando ? (
          <View style={estilos.loading}>
            <ActivityIndicator size="small" color="#162544" />
            <Text style={{ marginLeft: 10, color: '#162544', fontWeight: '700' }}>
              Processando com IA…
            </Text>
          </View>
        ) : (
          <View style={estilos.botoes}>
            <Button
              mode={gravando ? 'contained' : 'contained'}
              icon={gravando ? 'stop' : 'microphone'}
              onPress={toggleGravacao}
              buttonColor={gravando ? '#d93025' : '#162544'}
              textColor="#ffffff"
              style={{ flex: 1.2 }}
            >
              {gravando ? 'Concluir Fala' : 'Ditar Voz'}
            </Button>
            <View style={{ width: 6 }} />
            {textoHint.trim().length > 0 && !gravando ? (
              <Button
                mode="outlined"
                icon="auto-fix"
                onPress={processarTextoDigitado}
                textColor="#162544"
                style={{ flex: 1, borderColor: '#162544' }}
              >
                Gerar
              </Button>
            ) : (
              <Button
                mode="outlined"
                icon="camera"
                onPress={tirarOuEscolherFoto}
                disabled={gravando}
                textColor="#162544"
                style={{ flex: 1, borderColor: '#cbd5e1' }}
              >
                Foto
              </Button>
            )}
          </View>
        )}
      </Card.Content>
    </Card>
  );
}

const estilos = StyleSheet.create({
  card: {
    marginBottom: 16,
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  topo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  titulo: { fontWeight: '800', color: '#162544', fontSize: 15 },
  chip: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1' },
  dica: { fontSize: 12, color: '#475569', marginBottom: 10, lineHeight: 16 },
  input: { marginBottom: 10, backgroundColor: '#ffffff' },
  botoes: { flexDirection: 'row', alignItems: 'center' },
  loading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
});
