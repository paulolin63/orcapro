/**
 * app/configuracoes.js
 * Tela de configurações do técnico: logo, nome, pix key.
 * PHP analogy: uma página settings.php que salva em banco de dados.
 */

import { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Alert, Image } from 'react-native';
import { Text, TextInput, Button, Divider, Card, List } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';
import { lerTodasConfigs, salvarConfig } from '@src/banco-de-dados';
import { detectarTipoChave, formatarChavePix, normalizarChavePix } from '@src/pix';
import { CHAVE_GEMINI_STORE } from '@src/ia-rascunho';
import { FEATURE_PRO_IA } from '@src/feature-flags';

const INPUT_THEME = {
  colors: {
    text: '#162544',
    onSurface: '#162544',
    onSurfaceVariant: '#475569',
    placeholder: '#64748b',
    background: '#ffffff',
    primary: '#162544',
    outline: '#94a3b8',
  },
};

const INPUT_OPTS = {
  mode: 'outlined',
  textColor: '#162544',
  outlineColor: '#cbd5e1',
  activeOutlineColor: '#162544',
  placeholderTextColor: '#64748b',
  theme: INPUT_THEME,
};

export default function Configuracoes() {
  const router = useRouter();
  const [salvando, setSalvando] = useState(false);
  const [chaveGemini, setChaveGemini] = useState('');
  const [config, setConfig] = useState({
    nome_empresa: '',
    telefone: '',
    email: '',
    cidade: '',
    pix_key: '',
    logo_uri: '',
  });

  // Carrega as configurações salvas ao abrir a tela
  useEffect(() => {
    async function carregar() {
      const dados = await lerTodasConfigs();
      setConfig(prev => ({ ...prev, ...dados }));
      try {
        const k = await SecureStore.getItemAsync(CHAVE_GEMINI_STORE);
        if (k) setChaveGemini(k);
      } catch (_) {}
    }
    carregar();
  }, []);

  function editar(campo, valor) {
    setConfig(prev => ({ ...prev, [campo]: valor }));
  }

  async function salvar() {
    if (!config.nome_empresa.trim()) {
      Alert.alert('Atenção', 'Informe o nome da sua empresa ou seu nome.');
      return;
    }

    let pixKey = (config.pix_key || '').trim();
    if (pixKey) {
      const tipoBruto = detectarTipoChave(pixKey);
      if (tipoBruto === 'Desconhecido') {
        Alert.alert(
          'Chave Pix invalida',
          'Informe CPF, CNPJ, telefone, e-mail ou chave aleatoria valida.'
        );
        return;
      }
      pixKey = normalizarChavePix(pixKey);
      const tipoNorm = detectarTipoChave(pixKey);
      if (tipoNorm === 'Desconhecido') {
        Alert.alert('Chave Pix invalida', 'Nao foi possivel normalizar a chave.');
        return;
      }
    }

    setSalvando(true);
    try {
      const configFinal = { ...config, pix_key: pixKey };
      for (const [chave, valor] of Object.entries(configFinal)) {
        if (valor) await salvarConfig(chave, valor);
      }

      if (pixKey) {
        await salvarConfig('pix_key_tipo', detectarTipoChave(pixKey));
      }

      if (chaveGemini.trim()) {
        await SecureStore.setItemAsync(CHAVE_GEMINI_STORE, chaveGemini.trim());
      } else {
        await SecureStore.deleteItemAsync(CHAVE_GEMINI_STORE).catch(() => {});
      }

      setConfig(prev => ({ ...prev, pix_key: pixKey }));

      Alert.alert('Salvo!', 'Configurações salvas com sucesso.', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (erro) {
      Alert.alert('Erro', 'Não foi possível salvar as configurações.');
    } finally {
      setSalvando(false);
    }
  }

  async function selecionarLogo() {
    const permissao = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissao.granted) {
      Alert.alert('Permissão negada', 'Precisamos de acesso às suas fotos para selecionar o logo.');
      return;
    }

    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 1],       // proporção ideal para logos
      quality: 0.8,
    });

    if (!resultado.canceled) {
      const assetUri = resultado.assets[0].uri;
      try {
        const cleanUri = assetUri.split('?')[0].toLowerCase();
        const ext = cleanUri.endsWith('.png') ? 'png' : 'jpg';
        const dest = `${FileSystem.documentDirectory}empresa-logo.${ext}`;
        await FileSystem.deleteAsync(dest, { idempotent: true });
        await FileSystem.copyAsync({ from: assetUri, to: dest });
        editar('logo_uri', dest);
      } catch (e) {
        console.warn('Falha ao persistir logo localmente:', e);
        editar('logo_uri', assetUri);
      }
    }
  }

  const tipoChave = config.pix_key ? detectarTipoChave(config.pix_key) : '';

  return (
    <ScrollView style={estilos.container}>
      <View style={estilos.secao}>

        {/* ── LOGO ── */}
        <Text variant="titleSmall" style={estilos.subtitulo}>Logo da Empresa</Text>
        <Card style={estilos.cardLogo} onPress={selecionarLogo}>
          <Card.Content style={estilos.conteudoLogo}>
            {config.logo_uri ? (
              <Image
                source={{ uri: config.logo_uri }}
                style={{ width: 200, height: 60, resizeMode: 'contain' }}
              />
            ) : (
              <Text style={{ color: '#888', fontSize: 13 }}>Logo</Text>
            )}
          </Card.Content>
        </Card>

        <Divider style={{ marginVertical: 16 }} />

        {/* ── DADOS DA EMPRESA ── */}
        <Text variant="titleSmall" style={estilos.subtitulo}>Seus Dados</Text>

        <TextInput
          {...INPUT_OPTS}
          label="Nome / Empresa *"
          value={config.nome_empresa}
          onChangeText={v => editar('nome_empresa', v)}
          style={estilos.input}
          placeholder="Ex: João Elétrica ou Eletricista Silva"
          autoCapitalize="words"
        />
        <TextInput
          {...INPUT_OPTS}
          label="Telefone / WhatsApp"
          value={config.telefone}
          onChangeText={v => editar('telefone', v)}
          style={estilos.input}
          keyboardType="phone-pad"
          placeholder="(11) 98765-4321"
        />
        <TextInput
          {...INPUT_OPTS}
          label="E-mail (opcional)"
          value={config.email}
          onChangeText={v => editar('email', v)}
          style={estilos.input}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextInput
          {...INPUT_OPTS}
          label="Cidade"
          value={config.cidade}
          onChangeText={v => editar('cidade', v)}
          style={estilos.input}
          placeholder="Ex: São Paulo"
          autoCapitalize="words"
        />

        <Divider style={{ marginVertical: 16 }} />

        {/* ── PIX ── */}
        <Text variant="titleSmall" style={estilos.subtitulo}>Chave Pix</Text>

        <TextInput
          {...INPUT_OPTS}
          label="Chave Pix"
          value={config.pix_key}
          onChangeText={v => editar('pix_key', v)}
          style={estilos.input}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="CPF, CNPJ, telefone, e-mail ou chave aleatória"
        />

        {config.pix_key ? (
          <Card style={estilos.cardPix}>
            <Card.Content>
              <Text style={{ fontSize: 12, color: '#1a73e8', fontWeight: '700' }}>
                {tipoChave}
              </Text>
              <Text style={{ fontSize: 11, color: '#555', marginTop: 4 }}>
                {formatarChavePix(config.pix_key)}
              </Text>
            </Card.Content>
          </Card>
        ) : null}

        {FEATURE_PRO_IA ? (
          <>
            <Divider style={{ marginVertical: 16 }} />
            <Text variant="titleSmall" style={estilos.subtitulo}>Gemini</Text>
            <TextInput
              {...INPUT_OPTS}
              label="Chave Google Gemini API (opcional)"
              value={chaveGemini}
              onChangeText={setChaveGemini}
              style={estilos.input}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="AIzaSy..."
            />
          </>
        ) : null}

        <Divider style={{ marginVertical: 16 }} />

        {/* BOTÃO SALVAR */}
        <Button
          mode="contained"
          onPress={salvar}
          loading={salvando}
          disabled={salvando}
          style={{ marginBottom: 40 }}
          icon="content-save"
        >
          Salvar
        </Button>
      </View>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#f5f7ff' },
  secao:        { padding: 16 },
  subtitulo:    { fontWeight: '700', color: '#333', marginBottom: 10 },
  input:        { marginBottom: 10, backgroundColor: '#fff' },
  cardLogo:     { alignItems: 'center', marginBottom: 8 },
  conteudoLogo: { height: 80, justifyContent: 'center', alignItems: 'center' },
  cardPix:      { backgroundColor: '#e8f4fd', marginBottom: 10 },
});
