/**
 * app/_layout.js
 * Layout raiz do app — equivale ao index.php que carrega o template base.
 * O Expo Router usa este arquivo para definir navegação e temas globais.
 */

import { useEffect, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { PaperProvider, MD3LightTheme, IconButton, Menu } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import { abrirBanco } from '@src/banco-de-dados';

function HeaderMais() {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);

  function ir(rota) {
    setAberto(false);
    router.push(rota);
  }

  return (
    <Menu
      visible={aberto}
      onDismiss={() => setAberto(false)}
      anchor={
        <IconButton
          icon="dots-vertical"
          iconColor="#fff"
          size={22}
          onPress={() => setAberto(true)}
        />
      }
    >
      <Menu.Item onPress={() => ir('/calculadora-maquininha')} title="Maquininha" leadingIcon="credit-card-outline" />
      <Menu.Item onPress={() => ir('/estatisticas')} title="Estatisticas" leadingIcon="chart-bar" />
      <Menu.Item onPress={() => ir('/configuracoes')} title="Configuracoes" leadingIcon="cog" />
    </Menu>
  );
}

// Tema OrçaPronto 3D (Prancheta Navy & Âmbar Ouro & Pix Verde-Água)
const tema = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#162544',          // Azul Marinho da Prancheta 3D
    onPrimary: '#ffffff',
    primaryContainer: '#E8EDF5',
    onPrimaryContainer: '#162544',
    secondary: '#FFA000',        // Dourado Âmbar da Chave Inglesa e R$
    onSecondary: '#ffffff',
    secondaryContainer: '#E8EDF5',
    onSecondaryContainer: '#162544',
    tertiary: '#00B49F',         // Verde-água Oficial do Diamante Pix
    onTertiary: '#ffffff',
    surface: '#ffffff',          // Fundo de cards e modais branco
    onSurface: '#162544',        // Texto principal escuro (NUNCA invisível)
    surfaceVariant: '#ffffff',   // Inputs fundo branco
    onSurfaceVariant: '#475569', // Labels e placeholders visíveis
    outline: '#cbd5e1',          // Bordas visíveis
    outlineVariant: '#e2e8f0',
    background: '#F8F9FC',       // Fundo limpo e suave
    onBackground: '#162544',     // Texto geral
  },
};

export default function RootLayout() {
  // Inicia o banco de dados quando o app abre — como conectar ao banco no __construct()
  useEffect(() => {
    abrirBanco().catch(console.error);
  }, []);

  return (
    <PaperProvider theme={tema}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#162544' },
          headerTintColor: '#ffffff',
          headerTitleStyle: { fontWeight: '800' },
          contentStyle: { backgroundColor: '#F8F9FC' },
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            title: 'OrçaPronto',
            headerRight: () => <HeaderMais />,
          }}
        />
        <Stack.Screen name="novo-orcamento" options={{ title: 'Novo Orçamento', presentation: 'modal' }} />
        <Stack.Screen name="detalhe-orcamento" options={{ title: 'Orçamento' }} />
        <Stack.Screen name="configuracoes" options={{ title: 'Configurações' }} />
        <Stack.Screen name="estatisticas" options={{ title: 'Estatísticas' }} />
        <Stack.Screen name="calculadora-maquininha" options={{ title: 'Calculadora Maquininha', presentation: 'modal' }} />
      </Stack>
    </PaperProvider>
  );
}
