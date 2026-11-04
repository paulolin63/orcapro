/**
 * Calculadora isolada de taxa de maquininha (reversa).
 */
import { useMemo, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text, TextInput, SegmentedButtons, Card, Divider } from 'react-native-paper';
import {
  calcularMaquininha,
  formatarReais,
  parsearReais,
  TAXAS_MAQUININHA_PADRAO,
} from '@src/calculos';

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

const OPCOES_PARCELAS = Object.keys(TAXAS_MAQUININHA_PADRAO).map((p) => ({
  value: p,
  label: p === '1' ? '1x' : `${p}x`,
}));

export default function CalculadoraMaquininha() {
  const [liquido, setLiquido] = useState('500');
  const [parcelas, setParcelas] = useState('1');

  const resultado = useMemo(() => {
    const valor = parsearReais(liquido);
    if (valor <= 0) return null;
    return calcularMaquininha(valor, Number(parcelas));
  }, [liquido, parcelas]);

  return (
    <ScrollView style={estilos.container} keyboardShouldPersistTaps="handled">
      <View style={estilos.secao}>
        <Text variant="titleMedium" style={estilos.titulo}>
          Quanto voce quer receber liquido?
        </Text>
        <TextInput
          {...INPUT_OPTS}
          label="Valor liquido desejado (R$)"
          value={liquido}
          onChangeText={setLiquido}
          keyboardType="decimal-pad"
          style={estilos.input}
        />

        <Text variant="titleSmall" style={{ marginBottom: 8, fontWeight: '700' }}>
          Parcelas
        </Text>
        <SegmentedButtons
          value={parcelas}
          onValueChange={setParcelas}
          buttons={OPCOES_PARCELAS.slice(0, 4)}
          style={{ marginBottom: 8 }}
        />
        <SegmentedButtons
          value={parcelas}
          onValueChange={setParcelas}
          buttons={OPCOES_PARCELAS.slice(4)}
          style={{ marginBottom: 16 }}
        />

        {resultado ? (
          <Card style={estilos.card}>
            <Card.Content>
              <Linha label="Taxa aplicada" valor={`${resultado.taxa_pct}%`} />
              <Divider style={{ marginVertical: 8 }} />
              <Linha
                label="Cobrar do cliente"
                valor={formatarReais(resultado.valor_cobrar)}
                destaque
              />
              <Linha label="Taxa retida" valor={formatarReais(resultado.taxa_valor)} />
              <Linha
                label="Parcela do cliente"
                valor={formatarReais(resultado.parcela_cliente)}
              />
              <Linha
                label="Voce recebe / parcela"
                valor={formatarReais(resultado.parcela_liquida)}
              />
            </Card.Content>
          </Card>
        ) : (
          <Text style={{ color: '#888' }}>Informe um valor valido.</Text>
        )}

        <Text style={estilos.dica}>
          Taxas medias de mercado (Stone/PagSeguro/Cielo). Ajuste mentalmente se a sua maquina for diferente.
        </Text>
      </View>
    </ScrollView>
  );
}

function Linha({ label, valor, destaque }) {
  return (
    <View style={estilos.linha}>
      <Text style={{ color: '#555', flex: 1 }}>{label}</Text>
      <Text style={{ fontWeight: destaque ? '800' : '600', color: destaque ? '#162544' : '#333' }}>
        {valor}
      </Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FC' },
  secao: { padding: 16 },
  titulo: { fontWeight: '800', color: '#162544', marginBottom: 12 },
  input: { marginBottom: 16, backgroundColor: '#fff' },
  card: { borderRadius: 12, backgroundColor: '#fff' },
  linha: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 4 },
  dica: { fontSize: 11, color: '#888', marginTop: 16, lineHeight: 16 },
});
