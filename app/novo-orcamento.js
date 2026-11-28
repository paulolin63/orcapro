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
  View, ScrollView, StyleSheet, Alert, KeyboardAvoidingView, Platform, TouchableOpacity
} from 'react-native';
import {
  Text, TextInput, Button, Divider, IconButton, Card,
  SegmentedButtons, Portal, Modal, Switch, Chip
} from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import {
  criarOrcamento,
  lerTodasConfigs,
  marcarEnviado,
  listarClientesRecentes,
  lerConfig,
  salvarConfig,
} from '@src/banco-de-dados';
import { calcularItemSubtotal, calcularTotal, calcularMaquininha,
         formatarReais, parsearReais, TAXAS_MAQUININHA_PADRAO } from '@src/calculos';
import { gerarPDF, compartilharPDF } from '@src/pdf';
import { checarPermissaoNovoOrcamento, consumirQuotaSePermitido, verificarEntitlement } from '@src/assinatura';
import { FEATURE_WATERMARK_FREE, FEATURE_PRO_IA } from '@src/feature-flags';
import AssistenteIA from '@src/componentes/AssistenteIA';
import ModalPaywall from '@src/componentes/ModalPaywall';
import SeletorModelos from '@src/componentes/SeletorModelos';

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
    lucro_pct: '0',
    notas: '',
  });

  // Maquininha e Recursos Pro
  const [modalMaquininha, setModalMaquininha] = useState(false);
  const [parcelasSelecionadas, setParcelasSelecionadas] = useState('1');
  const [quotaOk, setQuotaOk] = useState(false);
  const [modalPaywallIa, setModalPaywallIa] = useState(false);
  const [modeloId, setModeloId] = useState(null);
  const [ehPro, setEhPro] = useState(false);
  const [clientesSalvos, setClientesSalvos] = useState([]);
  const [modalClientes, setModalClientes] = useState(false);
  const [vipIa, setVipIa] = useState(false);
  const [incluirAssinatura, setIncluirAssinatura] = useState(false);
  const [garantiaDias, setGarantiaDias] = useState(90);

  async function atualizarStatusPro() {
    try {
      const ent = await verificarEntitlement();
      setEhPro(!!ent.ilimitadoOrcamentos);
    } catch {}
  }

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
        Alert.alert('OrçaPronto Pro', msg, [
          { text: 'OK', onPress: () => router.back() },
        ]);
        return;
      }
      setQuotaOk(true);
      const ent = await verificarEntitlement();
      if (ativo) setEhPro(!!ent.ilimitadoOrcamentos);
      const listaCli = await listarClientesRecentes(20).catch(() => []);
      if (ativo) setClientesSalvos(listaCli || []);
      const jaVip = await lerConfig('vip_lista_ia').catch(() => null);
      if (ativo && jaVip === '1') setVipIa(true);
    })();
    return () => { ativo = false; };
  }, [router]);

  async function entrarListaVipIa() {
    try {
      await salvarConfig('vip_lista_ia', '1');
      setVipIa(true);
    } catch {
      setVipIa(true);
    }
  }

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

  function aplicarModelo(modelo) {
    const itensModelo = (modelo.itens || []).map((i) => ({
      ...ITEM_VAZIO,
      descricao: String(i.descricao || ''),
      custo_material: i.custo_material != null && i.custo_material !== ''
        ? String(i.custo_material).replace('.', ',')
        : '',
      custo_mao_obra: i.custo_mao_obra != null && i.custo_mao_obra !== ''
        ? String(i.custo_mao_obra).replace('.', ',')
        : '',
      quantidade: i.quantidade != null ? String(i.quantidade) : '1',
    }));
    if (itensModelo.length) setItens(itensModelo);
    setModeloId(
      modelo.id != null && Number.isFinite(Number(modelo.id)) ? Number(modelo.id) : null
    );
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
        Alert.alert('OrçaPronto Pro', msg);
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
        cliente_nome:       cliente.nome.trim(),
        cliente_tel:        cliente.tel.trim() || null,
        endereco:           cliente.endereco.trim() || null,
        validade_dias:      Number(cliente.validade_dias) || 7,
        subtotal:           subtotalItens,
        frete:              parsearReais(extras.frete),
        outros:             parsearReais(extras.outros),
        lucro_pct:          parsearReais(extras.lucro_pct),
        total:              resultado.preco_final,
        notas:              extras.notas.trim() || null,
        modelo_id:          modeloId,
        incluir_assinatura: ehPro && incluirAssinatura ? 1 : 0,
        garantia_dias:      ehPro ? garantiaDias : 90,
      };

      // Salva no SQLite e obtém o ID gerado
      const orcamentoId = await criarOrcamento(dadosOrcamento, itensFinal);

      // Carrega configurações para o PDF
      const config = await lerTodasConfigs();
      const ent = await verificarEntitlement();
      const mostrarMarcaFree = FEATURE_WATERMARK_FREE && !ent.ilimitadoOrcamentos;

      // Gera o PDF
      const orcamentoComId = { ...dadosOrcamento, id: orcamentoId };
      const pdfUri = await gerarPDF(orcamentoComId, itensFinal, config, { mostrarMarcaFree });

      // Compartilha imediatamente via WhatsApp / qualquer app
      await compartilharPDF(pdfUri);
      await marcarEnviado(orcamentoId);

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

            {!FEATURE_PRO_IA && (
              <Card style={estilos.cardIaBreve}>
                <Card.Content style={{ paddingVertical: 10 }}>
                  <View style={estilos.iaBreveTopo}>
                    <View style={estilos.badgeIaBreve}>
                      <Text style={estilos.badgeIaBreveTxt}>🤖 EM BREVE · PRÓXIMA VERSÃO</Text>
                    </View>
                  </View>
                  <Text style={estilos.iaBreveTitulo}>
                    OrçaPronto IA: Orçamento por Voz e Foto ✨
                  </Text>
                  <Text style={estilos.iaBreveSub}>
                    Dite o serviço no microfone ou tire foto da lista de materiais e a IA preencherá todo o orçamento sozinha!
                  </Text>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={entrarListaVipIa}
                    style={[estilos.btnVipIa, vipIa && estilos.btnVipIaOk]}
                  >
                    <MaterialCommunityIcons
                      name={vipIa ? 'check-circle' : 'bell-ring-outline'}
                      size={15}
                      color={vipIa ? '#065F46' : '#0F766E'}
                    />
                    <Text style={[estilos.btnVipIaTxt, vipIa && { color: '#065F46' }]}>
                      {vipIa ? 'Você está na lista VIP da versão IA!' : 'Quero ser avisado quando a IA chegar'}
                    </Text>
                  </TouchableOpacity>
                </Card.Content>
              </Card>
            )}

            <SeletorModelos
              onAplicar={aplicarModelo}
              onPrecisaPro={() => setModalPaywallIa(true)}
            />

            <View style={estilos.cabecalhoCliente}>
              <Text variant="titleMedium" style={[estilos.titulo, { marginBottom: 0 }]}>
                Dados do cliente
              </Text>
              <TouchableOpacity
                activeOpacity={0.8}
                style={estilos.btnClienteSalvo}
                onPress={() => {
                  if (!ehPro) {
                    setModalPaywallIa(true);
                  } else {
                    setModalClientes(true);
                  }
                }}
              >
                <MaterialCommunityIcons name="account-clock-outline" size={15} color="#162544" />
                <Text style={estilos.btnClienteSalvoTxt}>
                  {ehPro
                    ? `Clientes salvos${clientesSalvos.length ? ` (${clientesSalvos.length})` : ''}`
                    : 'Cliente salvo 🔒 Pro'}
                </Text>
              </TouchableOpacity>
            </View>

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
              Continuar
            </Button>
          </View>
        )}

        {/* ── STEP 2: ITENS ────────────────────────────────────── */}
        {step === 2 && (
          <View style={estilos.secao}>
            <Text variant="titleMedium" style={estilos.titulo}>Itens</Text>

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
              <Button mode="text" onPress={() => setStep(1)}>Voltar</Button>
              <Button mode="contained" onPress={() => setStep(3)}>Continuar</Button>
            </View>
          </View>
        )}

        {/* ── STEP 3: EXTRAS, LUCRO E RESUMO ───────────────────── */}
        {step === 3 && (
          <View style={estilos.secao}>
            <Text variant="titleMedium" style={estilos.titulo}>Extras</Text>

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
              label="Margem extra / lucro adicional (%)"
              value={extras.lucro_pct}
              onChangeText={v => setExtras(p => ({ ...p, lucro_pct: v }))}
              style={estilos.input}
              keyboardType="decimal-pad"
              right={<TextInput.Affix text="%" />}
            />
            <Text style={{ fontSize: 12, color: '#64748b', marginTop: -6, marginBottom: 10 }}>
              Se o preço do serviço já inclui seu ganho, deixe em 0%.
            </Text>

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
                {resultado.lucro_valor > 0 && (
                  <LinhaSomatorio
                    label={`Lucro (${extras.lucro_pct || 0}%)`}
                    valor={resultado.lucro_valor}
                    cor="#22c55e"
                  />
                )}
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

            {/* ── OPÇÕES PROFISSIONAIS DO PDF (GATILHO DE VALOR PRO) ── */}
            <Card style={estilos.cardProPdf}>
              <Card.Content>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={{ fontWeight: '800', fontSize: 14, color: '#162544' }}>
                    📄 Apresentação Profissional do PDF
                  </Text>
                  {!ehPro ? (
                    <TouchableOpacity onPress={() => setModalPaywallIa(true)} style={estilos.tagProPequena}>
                      <Text style={estilos.tagProPequenaTxt}>👑 Seja Pro</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                <TouchableOpacity
                  activeOpacity={0.8}
                  disabled={ehPro}
                  onPress={() => setModalPaywallIa(true)}
                  style={estilos.linhaOpcaoPro}
                >
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={estilos.opcaoProTitulo}>
                      PDF limpo (sem rodapé &quot;OrçaPronto Free&quot;)
                    </Text>
                    <Text style={estilos.opcaoProSub}>
                      Transmita máxima credibilidade para fechar mais caro
                    </Text>
                  </View>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: ehPro ? '#16a34a' : '#B45309' }}>
                    {ehPro ? '✓ Ativo' : '🔒 Pro'}
                  </Text>
                </TouchableOpacity>

                <Divider style={{ marginVertical: 8 }} />

                <View style={estilos.linhaOpcaoPro}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={estilos.opcaoProTitulo}>
                      Campo de Assinatura do Cliente {!ehPro ? '🔒' : ''}
                    </Text>
                    <Text style={estilos.opcaoProSub}>
                      Inclui linha &quot;De acordo / Assinatura&quot; no final do PDF
                    </Text>
                  </View>
                  <Switch
                    value={ehPro && incluirAssinatura}
                    color="#162544"
                    onValueChange={(val) => {
                      if (!ehPro) {
                        setModalPaywallIa(true);
                        return;
                      }
                      setIncluirAssinatura(val);
                    }}
                  />
                </View>

                <Divider style={{ marginVertical: 8 }} />

                <Text style={[estilos.opcaoProTitulo, { marginBottom: 6 }]}>
                  Prazo de garantia no PDF {!ehPro ? '(personalizável no Pro 🔒)' : ''}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {[30, 90, 180, 365].map((dias) => {
                    const ativo = (ehPro ? garantiaDias : 90) === dias;
                    return (
                      <Chip
                        key={dias}
                        compact
                        selected={ativo}
                        selectedColor="#ffffff"
                        style={
                          ativo
                            ? { backgroundColor: '#162544' }
                            : { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1' }
                        }
                        textStyle={{ color: ativo ? '#ffffff' : '#162544', fontSize: 11, fontWeight: '700' }}
                        onPress={() => {
                          if (!ehPro && dias !== 90) {
                            setModalPaywallIa(true);
                            return;
                          }
                          setGarantiaDias(dias);
                        }}
                      >
                        {dias === 365 ? '1 ano' : `${dias} dias`}
                        {!ehPro && dias !== 90 ? ' 🔒' : ''}
                      </Chip>
                    );
                  })}
                </View>
              </Card.Content>
            </Card>

            <Divider style={{ marginVertical: 14 }} />

            <View style={estilos.linhaNavegacao}>
              <Button mode="text" onPress={() => setStep(2)}>Voltar</Button>
              <Button
                mode="contained"
                onPress={salvarEGerar}
                loading={salvando}
                disabled={salvando}
                icon="file-pdf-box"
              >
                Salvar
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

        <Modal
          visible={modalClientes}
          onDismiss={() => setModalClientes(false)}
          contentContainerStyle={estilos.modal}
        >
          <ScrollView>
            <Text variant="titleMedium" style={{ fontWeight: '800', color: '#162544', marginBottom: 10 }}>
              👥 Clientes anteriores
            </Text>
            {clientesSalvos.length === 0 ? (
              <Text style={{ color: '#64748b', fontSize: 13 }}>
                Seus clientes aparecerão salvos aqui automaticamente após o 1º orçamento gerado.
              </Text>
            ) : (
              clientesSalvos.map((c, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={estilos.itemClienteModal}
                  onPress={() => {
                    setCliente((p) => ({
                      ...p,
                      nome: c.cliente_nome || p.nome,
                      tel: c.cliente_tel || '',
                      endereco: c.endereco || '',
                    }));
                    setModalClientes(false);
                  }}
                >
                  <Text style={{ fontWeight: '700', color: '#162544', fontSize: 14 }}>
                    {c.cliente_nome}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                    {[c.cliente_tel, c.endereco].filter(Boolean).join(' · ') || 'Toque para preencher'}
                  </Text>
                </TouchableOpacity>
              ))
            )}
            <Button onPress={() => setModalClientes(false)} style={{ marginTop: 12 }}>
              Fechar
            </Button>
          </ScrollView>
        </Modal>

        <ModalPaywall
          visivel={modalPaywallIa}
          onFechar={() => setModalPaywallIa(false)}
          onSucesso={() => {
            setModalPaywallIa(false);
            atualizarStatusPro();
          }}
        />
      </Portal>
    </KeyboardAvoidingView>
  );
}

// ─────────────────────────────────────────
// COMPONENTES AUXILIARES
// ─────────────────────────────────────────

const STEP_LABELS = {
  1: 'Cliente',
  2: 'Itens',
  3: 'Lucro & PDF',
};

function TouchableStep({ step, atual, onPress }) {
  const ativo = step === atual;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={estilos.stepWrapper}
    >
      <View
        style={[
          estilos.step,
          ativo && estilos.stepAtivo,
          step < atual && estilos.stepConcluido,
        ]}
      >
        <Text style={{ color: ativo || step < atual ? '#fff' : '#64748b', fontWeight: '700', fontSize: 12 }}>
          {step < atual ? '✓' : String(step)}
        </Text>
      </View>
      <Text style={[estilos.stepLabel, ativo && estilos.stepLabelAtivo]}>
        {STEP_LABELS[step]}
      </Text>
    </TouchableOpacity>
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
  progressBar:    { flexDirection: 'row', justifyContent: 'center', gap: 16, paddingVertical: 12, paddingHorizontal: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  stepWrapper:    { alignItems: 'center', minWidth: 72 },
  step:           { width: 32, height: 32, borderRadius: 16, backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },
  stepAtivo:      { backgroundColor: '#162544' },
  stepConcluido:  { backgroundColor: '#22c55e' },
  stepLabel:      { fontSize: 11, color: '#64748b', marginTop: 4, fontWeight: '600' },
  stepLabelAtivo: { color: '#162544', fontWeight: '800' },
  secao:          { padding: 16 },
  titulo:         { fontWeight: '800', marginBottom: 16, color: '#162544' },
  input:          { marginBottom: 10, backgroundColor: '#fff' },
  linha2:         { flexDirection: 'row' },
  linhaNavegacao: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  botaoProximo:   { marginTop: 8 },
  cardItem:       { marginBottom: 12, backgroundColor: '#fff', borderRadius: 12 },
  cardItemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  subtotalItem:   { fontSize: 12, color: '#162544', fontWeight: '800', textAlign: 'right', marginTop: 4 },
  cardResumo:          { backgroundColor: '#EBF2FA', marginVertical: 8, borderRadius: 12 },
  cardIaBreve:         { marginBottom: 12, backgroundColor: '#F0FDFA', borderRadius: 12, borderWidth: 1, borderColor: '#99F6E4' },
  iaBreveTopo:         { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  badgeIaBreve:        { backgroundColor: '#CCFBF1', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  badgeIaBreveTxt:     { fontSize: 10, fontWeight: '900', color: '#0F766E' },
  iaBreveTitulo:       { fontSize: 14, fontWeight: '800', color: '#162544', marginBottom: 3 },
  iaBreveSub:          { fontSize: 12, color: '#334155', lineHeight: 17, marginBottom: 8 },
  btnVipIa:            { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: '#ffffff', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#5EEAD4' },
  btnVipIaOk:          { backgroundColor: '#D1FAE5', borderColor: '#6EE7B7' },
  btnVipIaTxt:         { fontSize: 11, fontWeight: '800', color: '#0F766E' },
  cabecalhoCliente:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  btnClienteSalvo:     { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FCD34D', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16 },
  btnClienteSalvoTxt:  { fontSize: 11, fontWeight: '800', color: '#162544' },
  cardProPdf:          { backgroundColor: '#FFFDF5', borderRadius: 12, borderWidth: 1.5, borderColor: '#FDE68A', marginTop: 6 },
  tagProPequena:       { backgroundColor: '#FFA000', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  tagProPequenaTxt:    { fontSize: 10, fontWeight: '900', color: '#162544' },
  linhaOpcaoPro:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  opcaoProTitulo:      { fontSize: 12, fontWeight: '700', color: '#162544' },
  opcaoProSub:         { fontSize: 11, color: '#64748b', marginTop: 1 },
  itemClienteModal:    { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  modal:               { backgroundColor: '#fff', margin: 20, padding: 20, borderRadius: 16, maxHeight: '80%' },
});
