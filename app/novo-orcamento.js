/**
 * app/novo-orcamento.js
 * Tela de criação de orçamento (formulário multi-step).
 * PHP analogy: um formulário POST com múltiplos campos.
 *
 * Fluxo:
 *   Step 1: Dados do cliente
 *   Step 2: Itens do serviço
 *   Step 3: Custos extras + lucro + maquininha
 *   Step 4: Preview → gerar PDF → compartilhar
 */

import { useState, useEffect } from 'react';
import {
  View, ScrollView, StyleSheet, Alert, KeyboardAvoidingView, Platform
} from 'react-native';
import {
  Text, TextInput, Button, Divider, IconButton, Card,
  SegmentedButtons, Portal, Modal, Switch
} from 'react-native-paper';
import { useRouter } from 'expo-router';
import { criarOrcamento, lerTodasConfigs } from '@src/banco-de-dados';
import { calcularItemSubtotal, calcularTotal, calcularMaquininha,
         formatarReais, parsearReais, TAXAS_MAQUININHA_PADRAO } from '@src/calculos';
import { gerarPDF, compartilharPDF } from '@src/pdf';
import { checarPermissaoNovoOrcamento, consumirQuotaSePermitido } from '@src/assinatura';
import AssistenteIA from '@src/componentes/AssistenteIA';
import ModalPaywall from '@src/componentes/ModalPaywall';

// ─────────────────────────────────────────
// ESTADO INICIAL — equivale a $dados = [] no PHP
// ─────────────────────────────────────────

const ITEM_VAZIO = {
  descricao: '',
  custo_material: '',
  custo_mao_obra: '',
  quantidade: '1',
};

// Configuração de alto contraste para inputs (imune a Dark Mode do sistema)
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

export default function NovoOrcamento() {
  const router = useRouter();
  const [step, setStep] = useState(1);     // etapa atual do formulário
  const [salvando, setSalvando] = useState(false);

  // Step 1 — cliente
  const [cliente, setCliente] = useState({
    nome: '',
    tel: '',
    endereco: '',
    validade_dias: '7',
  });

  // Step 2 — itens
  const [itens, setItens] = useState([{ ...ITEM_VAZIO }]);

  // Step 3 — extras e lucro
  const [extras, setExtras] = useState({
    frete: '',
    outros: '',
    lucro_pct: '30',
    notas: '',
  });

  // Maquininha
  const [modalMaquininha, setModalMaquininha] = useState(false);
  const [parcelasSelecionadas, setParcelasSelecionadas] = useState('1');
  const [quotaOk, setQuotaOk] = useState(false);
  const [modalPaywallIa, setModalPaywallIa] = useState(false);

  // Re-check gate on mount (FAB check is UX only)
  useEffect(() => {
    let ativo = true;
    (async () => {
      const permissao = await checarPermissaoNovoOrcamento();
      if (!ativo) return;
      if (!permissao.podeGerar) {
        const msg = permissao.motivo === 'storage_indisponivel'
          ? 'Nao foi possivel validar sua cota local. Tente novamente.'
          : 'Voce atingiu o limite gratuito deste mes.';
        Alert.alert('OrçaPro Pro', msg, [
          { text: 'OK', onPress: () => router.back() },
        ]);
        return;
      }
      setQuotaOk(true);
    })();
    return () => { ativo = false; };
  }, [router]);

  // ─────────────────────────────────────────
  // CÁLCULOS em tempo real (equivale a JS inline numa página PHP)
  // ─────────────────────────────────────────

  const subtotalItens = itens.reduce((acc, item) => {
    return acc + calcularItemSubtotal(
      parsearReais(item.custo_material),
      parsearReais(item.custo_mao_obra),
      parsearReais(item.quantidade)
    );
  }, 0);

  const resultado = calcularTotal(
    subtotalItens,
    parsearReais(extras.frete),
    parsearReais(extras.outros),
    parsearReais(extras.lucro_pct)
  );

  // ─────────────────────────────────────────
  // GERENCIAR ITENS (adicionar/remover/editar)
  // PHP analogy: manipular $_POST['itens'][] array
  // ─────────────────────────────────────────

  function adicionarItem() {
    setItens(prev => [...prev, { ...ITEM_VAZIO }]);
  }

  function removerItem(index) {
    if (itens.length <= 1) return; // Mínimo 1 item
    setItens(prev => prev.filter((_, i) => i !== index));
  }

  function editarItem(index, campo, valor) {
    // PHP: $itens[$index][$campo] = $valor;
    setItens(prev => prev.map((item, i) =>
      i === index ? { ...item, [campo]: valor } : item
    ));
  }

  function aplicarRascunhoIa(rascunho) {
    if (rascunho.cliente) {
      setCliente(p => ({
        ...p,
        nome: rascunho.cliente.nome || p.nome,
        tel: rascunho.cliente.tel || p.tel,
        endereco: rascunho.cliente.endereco || p.endereco,
      }));
    }
    if (rascunho.itens?.length) {
      setItens(rascunho.itens.map(i => ({ ...ITEM_VAZIO, ...i })));
    }
    if (rascunho.extras) {
      setExtras(p => ({
        ...p,
        frete: rascunho.extras.frete ?? p.frete,
        lucro_pct: rascunho.extras.lucro_pct ?? p.lucro_pct,
        notas: rascunho.extras.notas ?? p.notas,
      }));
    }
    setStep(2);
  }

  // ─────────────────────────────────────────
  // SALVAR ORÇAMENTO E GERAR PDF
  // PHP analogy: INSERT INTO orcamentos + gerar PDF com DOMPDF
  // ─────────────────────────────────────────

  async function salvarEGerar() {
    // Validação básica — como o PHP validaria os campos obrigatórios
    if (!cliente.nome.trim()) {
      Alert.alert('Atenção', 'Informe o nome do cliente.');
      setStep(1);
      return;
    }
    if (itens.some(i => !i.descricao.trim())) {
      Alert.alert('Atenção', 'Preencha a descrição de todos os itens.');
      setStep(2);
      return;
    }

    if (!quotaOk) {
      Alert.alert('Aguarde', 'Validando permissao...');
      return;
    }

    setSalvando(true);
    try {
      // Consome quota ANTES do INSERT (fail-closed)
      const consumo = await consumirQuotaSePermitido();
      if (!consumo.ok) {
        const msg = consumo.motivo === 'storage_indisponivel'
          ? 'Nao foi possivel gravar a cota local. Tente novamente.'
          : 'Limite gratuito atingido. Desbloqueie o Pro para continuar.';
        Alert.alert('OrçaPro Pro', msg);
        return;
      }

      // Prepara os itens com subtotais calculados
      const itensFinal = itens.map(item => ({
        ...item,
        custo_material: parsearReais(item.custo_material),
        custo_mao_obra: parsearReais(item.custo_mao_obra),
        quantidade:     parsearReais(item.quantidade),
        subtotal: calcularItemSubtotal(
          parsearReais(item.custo_material),
          parsearReais(item.custo_mao_obra),
          parsearReais(item.quantidade)
        ),
      }));

      // Dados do orçamento para inserir no banco
      const dadosOrcamento = {
        cliente_nome:  cliente.nome.trim(),
        cliente_tel:   cliente.tel.trim() || null,
        endereco:      cliente.endereco.trim() || null,
        validade_dias: Number(cliente.validade_dias) || 7,
        subtotal:      subtotalItens,
        frete:         parsearReais(extras.frete),
        outros:        parsearReais(extras.outros),
        lucro_pct:     parsearReais(extras.lucro_pct),
        total:         resultado.preco_final,
        notas:         extras.notas.trim() || null,
      };

      // Salva no SQLite e obtém o ID gerado
      const orcamentoId = await criarOrcamento(dadosOrcamento, itensFinal);

      // Carrega configurações para o PDF
      const config = await lerTodasConfigs();

      // Gera o PDF
      const orcamentoComId = { ...dadosOrcamento, id: orcamentoId };
      const pdfUri = await gerarPDF(orcamentoComId, itensFinal, config);

      // Compartilha imediatamente via WhatsApp / qualquer app
      await compartilharPDF(pdfUri);

      // Volta para a lista
      router.replace('/');

    } catch (erro) {
      console.error('Erro ao salvar:', erro);
      Alert.alert('Erro', 'Não foi possível salvar o orçamento. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  // ─────────────────────────────────────────
  // RENDER — cada step é uma "aba" do formulário
  // ─────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Indicador de progresso */}
      <View style={estilos.progressBar}>
        {[1, 2, 3].map(s => (
          <TouchableStep key={s} step={s} atual={step} onPress={() => setStep(s)} />
        ))}
      </View>

      <ScrollView style={estilos.container} keyboardShouldPersistTaps="handled">

        {/* ── STEP 1: CLIENTE ──────────────────────────────────── */}
        {step === 1 && (
          <View style={estilos.secao}>
            <AssistenteIA
              onRascunho={aplicarRascunhoIa}
              onPrecisaCredito={() => setModalPaywallIa(true)}
            />

            <Text variant="titleMedium" style={estilos.titulo}>👤 Dados do Cliente</Text>

            <TextInput
              {...INPUT_OPTS}
              label="Nome do cliente *"
              value={cliente.nome}
              onChangeText={v => setCliente(p => ({ ...p, nome: v }))}
              style={estilos.input}
              autoCapitalize="words"
            />
            <TextInput
              {...INPUT_OPTS}
              label="Telefone (opcional)"
              value={cliente.tel}
              onChangeText={v => setCliente(p => ({ ...p, tel: v }))}
              style={estilos.input}
              keyboardType="phone-pad"
            />
            <TextInput
              {...INPUT_OPTS}
              label="Endereço do serviço (opcional)"
              value={cliente.endereco}
              onChangeText={v => setCliente(p => ({ ...p, endereco: v }))}
              style={estilos.input}
              multiline
            />
            <TextInput
              {...INPUT_OPTS}
              label="Validade do orçamento (dias)"
              value={cliente.validade_dias}
              onChangeText={v => setCliente(p => ({ ...p, validade_dias: v }))}
              style={estilos.input}
              keyboardType="numeric"
            />

            <Button mode="contained" onPress={() => setStep(2)} style={estilos.botaoProximo}>
              Próximo → Itens do Serviço
            </Button>
          </View>
        )}

        {/* ── STEP 2: ITENS ────────────────────────────────────── */}
        {step === 2 && (
          <View style={estilos.secao}>
            <Text variant="titleMedium" style={estilos.titulo}>🔧 Itens e Serviços</Text>

            {itens.map((item, index) => (
              <Card key={index} style={estilos.cardItem}>
                <Card.Content>
                  <View style={estilos.cardItemHeader}>
                    <Text style={{ fontWeight: '800', color: '#162544' }}>
                      Item {index + 1}
                    </Text>
                    {itens.length > 1 && (
                      <IconButton
                        icon="delete"
                        size={18}
                        iconColor="#ef4444"
                        onPress={() => removerItem(index)}
                      />
                    )}
                  </View>

                  <TextInput
                    {...INPUT_OPTS}
                    label="Descrição do serviço *"
                    value={item.descricao}
                    onChangeText={v => editarItem(index, 'descricao', v)}
                    style={estilos.input}
                    placeholder="Ex: Instalação de ar condicionado split 9000 BTU"
                  />

                  <View style={estilos.linha2}>
                    <TextInput
                      {...INPUT_OPTS}
                      label="Custo material (R$)"
                      value={item.custo_material}
                      onChangeText={v => editarItem(index, 'custo_material', v)}
                      style={[estilos.input, { flex: 1 }]}
                      keyboardType="decimal-pad"
                      placeholder="0,00"
                    />
                    <View style={{ width: 8 }} />
                    <TextInput
                      {...INPUT_OPTS}
                      label="Mão de obra (R$)"
                      value={item.custo_mao_obra}
                      onChangeText={v => editarItem(index, 'custo_mao_obra', v)}
                      style={[estilos.input, { flex: 1 }]}
                      keyboardType="decimal-pad"
                      placeholder="0,00"
                    />
                  </View>

                  <TextInput
                    {...INPUT_OPTS}
                    label="Quantidade"
                    value={item.quantidade}
                    onChangeText={v => editarItem(index, 'quantidade', v)}
                    style={[estilos.input, { width: 120 }]}
                    keyboardType="decimal-pad"
                  />

                  {/* Subtotal do item */}
                  <Text style={estilos.subtotalItem}>
                    Subtotal: {formatarReais(
                      calcularItemSubtotal(
                        parsearReais(item.custo_material),
                        parsearReais(item.custo_mao_obra),
                        parsearReais(item.quantidade)
                      )
                    )}
                  </Text>
                </Card.Content>
              </Card>
            ))}

            <Button
              mode="outlined"
              icon="plus"
              onPress={adicionarItem}
              style={{ marginTop: 8 }}
            >
              Adicionar Item
            </Button>

            <Divider style={{ marginVertical: 16 }} />

            <View style={estilos.linhaNavegacao}>
              <Button mode="text" onPress={() => setStep(1)}>← Voltar</Button>
              <Button mode="contained" onPress={() => setStep(3)}>Próximo →</Button>
            </View>
          </View>
        )}

        {/* ── STEP 3: EXTRAS, LUCRO E RESUMO ───────────────────── */}
        {step === 3 && (
          <View style={estilos.secao}>
            <Text variant="titleMedium" style={estilos.titulo}>💰 Custos Extras e Lucro</Text>

            <View style={estilos.linha2}>
              <TextInput
                {...INPUT_OPTS}
                label="Deslocamento (R$)"
                value={extras.frete}
                onChangeText={v => setExtras(p => ({ ...p, frete: v }))}
                style={[estilos.input, { flex: 1 }]}
                keyboardType="decimal-pad"
                placeholder="0,00"
              />
              <View style={{ width: 8 }} />
              <TextInput
                {...INPUT_OPTS}
                label="Outros custos (R$)"
                value={extras.outros}
                onChangeText={v => setExtras(p => ({ ...p, outros: v }))}
                style={[estilos.input, { flex: 1 }]}
                keyboardType="decimal-pad"
                placeholder="0,00"
              />
            </View>

            <TextInput
              {...INPUT_OPTS}
              label="Margem de lucro (%)"
              value={extras.lucro_pct}
              onChangeText={v => setExtras(p => ({ ...p, lucro_pct: v }))}
              style={estilos.input}
              keyboardType="decimal-pad"
              right={<TextInput.Affix text="%" />}
            />

            <TextInput
              {...INPUT_OPTS}
              label="Observações (opcional)"
              value={extras.notas}
              onChangeText={v => setExtras(p => ({ ...p, notas: v }))}
              style={estilos.input}
              multiline
              numberOfLines={3}
            />

            {/* ── RESUMO FINANCEIRO ── */}
            <Card style={estilos.cardResumo}>
              <Card.Content>
                <Text variant="titleSmall" style={{ marginBottom: 10, color: '#555' }}>
                  📊 Resumo do Orçamento
                </Text>
                <LinhaSomatorio label="Subtotal serviços"   valor={subtotalItens} />
                <LinhaSomatorio label="Deslocamento"         valor={parsearReais(extras.frete)} />
                <LinhaSomatorio label="Outros"               valor={parsearReais(extras.outros)} />
                <LinhaSomatorio label="Custo total"          valor={resultado.custo_total} destaque />
                <LinhaSomatorio
                  label={`Lucro (${extras.lucro_pct || 0}%)`}
                  valor={resultado.lucro_valor}
                  cor="#22c55e"
                />
                <Divider style={{ marginVertical: 8 }} />
                <LinhaSomatorio
                  label="💵 PREÇO FINAL"
                  valor={resultado.preco_final}
                  destaque
                  grande
                />
              </Card.Content>
            </Card>

            {/* ── CALCULADORA MAQUININHA ── */}
            <Button
              mode="outlined"
              icon="credit-card"
              onPress={() => setModalMaquininha(true)}
              style={{ marginVertical: 8 }}
            >
              Calcular taxa da maquininha
            </Button>

            <Divider style={{ marginVertical: 16 }} />

            <View style={estilos.linhaNavegacao}>
              <Button mode="text" onPress={() => setStep(2)}>← Voltar</Button>
              <Button
                mode="contained"
                onPress={salvarEGerar}
                loading={salvando}
                disabled={salvando}
                icon="file-pdf-box"
              >
                Gerar PDF e Enviar
              </Button>
            </View>
          </View>
        )}
      </ScrollView>

      {/* ── MODAL MAQUININHA ── */}
      <Portal>
        <Modal
          visible={modalMaquininha}
          onDismiss={() => setModalMaquininha(false)}
          contentContainerStyle={estilos.modal}
        >
          <ModalMaquininha
            valorBase={resultado.preco_final}
            onFechar={() => setModalMaquininha(false)}
          />
        </Modal>

        <ModalPaywall
          visivel={modalPaywallIa}
          onFechar={() => setModalPaywallIa(false)}
          onSucesso={() => setModalPaywallIa(false)}
        />
      </Portal>
    </KeyboardAvoidingView>
  );
}

// ─────────────────────────────────────────
// COMPONENTES AUXILIARES
// ─────────────────────────────────────────

function TouchableStep({ step, atual, onPress }) {
  const ativo = step === atual;
  return (
    <View
      style={[
        estilos.step,
        ativo && estilos.stepAtivo,
        step < atual && estilos.stepConcluido,
      ]}
    >
      <Text style={{ color: ativo || step < atual ? '#fff' : '#999', fontWeight: '700', fontSize: 12 }}>
        {step < atual ? '✓' : String(step)}
      </Text>
    </View>
  );
}

function LinhaSomatorio({ label, valor, destaque, grande, cor }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginVertical: 2 }}>
      <Text style={{ fontSize: grande ? 15 : 13, fontWeight: destaque ? '700' : '400', color: '#333' }}>
        {label}
      </Text>
      <Text style={{ fontSize: grande ? 15 : 13, fontWeight: destaque ? '800' : '400', color: cor || (grande ? '#162544' : '#333') }}>
        {formatarReais(valor)}
      </Text>
    </View>
  );
}

function ModalMaquininha({ valorBase, onFechar }) {
  const [parcelas, setParcelas] = useState('1');
  const resultado = calcularMaquininha(valorBase, Number(parcelas));

  const opcoesParcelas = Object.keys(TAXAS_MAQUININHA_PADRAO).map(p => ({
    value: String(p),
    label: p === '1' ? 'À vista' : `${p}x`,
  }));

  return (
    <ScrollView>
      <Text variant="titleMedium" style={{ fontWeight: '700', marginBottom: 12 }}>
        💳 Calculadora Maquininha
      </Text>
      <Text style={{ color: '#555', marginBottom: 16, fontSize: 13 }}>
        Baseado no preço final de {formatarReais(valorBase)}.{'\n'}
        Quanto você precisa cobrar para receber esse valor líquido?
      </Text>

      <Text style={{ fontWeight: '600', marginBottom: 8 }}>Parcelas do cartão:</Text>
      <SegmentedButtons
        value={parcelas}
        onValueChange={setParcelas}
        buttons={opcoesParcelas}
        style={{ marginBottom: 16 }}
      />

      <Card style={{ backgroundColor: '#f0f9f0' }}>
        <Card.Content>
          <LinhaSomatorio label="Você quer receber"   valor={valorBase} />
          <LinhaSomatorio label={`Taxa maquininha (${resultado.taxa_pct}%)`} valor={resultado.taxa_valor} cor="#ef4444" />
          <Divider style={{ marginVertical: 8 }} />
          <LinhaSomatorio label="Cobrar do cliente"   valor={resultado.valor_cobrar}  destaque grande />
          {Number(parcelas) > 1 && (
            <LinhaSomatorio label={`Parcela do cliente (${parcelas}x)`} valor={resultado.parcela_cliente} cor="#555" />
          )}
        </Card.Content>
      </Card>

      <Button onPress={onFechar} style={{ marginTop: 16 }}>Fechar</Button>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#F4F7FB' },
  progressBar:    { flexDirection: 'row', justifyContent: 'center', gap: 12, padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  step:           { width: 32, height: 32, borderRadius: 16, backgroundColor: '#ddd', alignItems: 'center', justifyContent: 'center' },
  stepAtivo:      { backgroundColor: '#162544' },
  stepConcluido:  { backgroundColor: '#22c55e' },
  secao:          { padding: 16 },
  titulo:         { fontWeight: '800', marginBottom: 16, color: '#162544' },
  input:          { marginBottom: 10, backgroundColor: '#fff' },
  linha2:         { flexDirection: 'row' },
  linhaNavegacao: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  botaoProximo:   { marginTop: 8 },
  cardItem:       { marginBottom: 12, backgroundColor: '#fff', borderRadius: 12 },
  cardItemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  subtotalItem:   { fontSize: 12, color: '#162544', fontWeight: '800', textAlign: 'right', marginTop: 4 },
  cardResumo:     { backgroundColor: '#EBF2FA', marginVertical: 8, borderRadius: 12 },
  modal:          { backgroundColor: '#fff', margin: 20, padding: 20, borderRadius: 16, maxHeight: '80%' },
});
