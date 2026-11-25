/**
 * Smoke tests offline (Node) — Pix, calculos, QR.
 * Run: node scripts/smoke-test.mjs
 */
import assert from 'node:assert/strict';
import QRCode from 'qrcode';
import {
  detectarTipoChave,
  normalizarChavePix,
  gerarPayloadPix,
} from '../src/pix.js';
import {
  calcularTotal,
  calcularItensParaPdf,
  calcularMaquininha,
  calcularItemSubtotal,
  parsearReais,
  formatarReais,
} from '../src/calculos.js';

let failed = 0;
function ok(name, fn) {
  try {
    fn();
    console.log('PASS', name);
  } catch (e) {
    failed += 1;
    console.error('FAIL', name, e.message);
  }
}

ok('phone normalize E.164', () => {
  assert.equal(detectarTipoChave('11987654321'), 'Telefone');
  assert.equal(normalizarChavePix('11987654321'), '+5511987654321');
  assert.equal(normalizarChavePix('+5511987654321'), '+5511987654321');
});

ok('cpf digits only', () => {
  assert.equal(detectarTipoChave('529.982.247-25'), 'CPF');
  assert.equal(normalizarChavePix('529.982.247-25'), '52998224725');
});

ok('cnpj', () => {
  assert.equal(detectarTipoChave('11.222.333/0001-81'), 'CNPJ');
  assert.equal(normalizarChavePix('11222333000181'), '11222333000181');
});

ok('reject unknown', () => {
  assert.equal(detectarTipoChave('nao-e-chave'), 'Desconhecido');
});

ok('pix payload CRC length', () => {
  const p = gerarPayloadPix({
    chave: '11987654321',
    nome: 'Joao Tecnico',
    cidade: 'Sao Paulo',
    valor: 199.9,
  });
  assert.ok(p.startsWith('000201'));
  assert.ok(p.includes('BR.GOV.BCB.PIX'));
  assert.ok(p.includes('+5511987654321'));
  assert.ok(p.includes('199.90'));
  assert.match(p.slice(-4), /^[0-9A-F]{4}$/);
});

ok('markup calc', () => {
  const r = calcularTotal(100, 10, 0, 30);
  assert.equal(r.custo_total, 110);
  assert.equal(r.lucro_valor, 33);
  assert.equal(r.preco_final, 143);
});

ok('item subtotal', () => {
  assert.equal(calcularItemSubtotal(50, 100, 2), 300);
});

ok('maquininha reverse', () => {
  const r = calcularMaquininha(500, 1, 1.99);
  assert.ok(r.valor_cobrar > 500);
  assert.ok(Math.abs(r.valor_cobrar * (1 - 0.0199) - 500) < 0.02);
});

ok('parse/format BRL', () => {
  assert.equal(parsearReais('1.234,56'), 1234.56);
  assert.ok(formatarReais(1234.56).includes('1.234,56'));
});

ok('pdf line items lucro 0% (500 + 50 = 550)', () => {
  const tot = calcularTotal(500, 50, 0, 0);
  assert.equal(tot.preco_final, 550);
  const res = calcularItensParaPdf(
    { frete: 50, outros: 0, total: tot.preco_final },
    [{ descricao: 'Instalar ar', custo_material: 0, custo_mao_obra: 500, quantidade: 1, subtotal: 500 }]
  );
  assert.equal(res[0].exibido_unitario, 500);
  assert.equal(res[0].exibido_subtotal, 500);
  assert.equal(res[0].exibido_subtotal + 50, 550);
});

ok('pdf line items lucro 20% (500 + 50 -> total 660, item 610)', () => {
  const tot = calcularTotal(500, 50, 0, 20);
  assert.equal(tot.preco_final, 660);
  const res = calcularItensParaPdf(
    { frete: 50, outros: 0, total: tot.preco_final },
    [{ descricao: 'Instalar ar', custo_material: 0, custo_mao_obra: 500, quantidade: 1, subtotal: 500 }]
  );
  assert.equal(res[0].exibido_unitario, 610);
  assert.equal(res[0].exibido_subtotal, 610);
  assert.equal(res[0].exibido_subtotal + 50, 660);
});

await (async () => {
  try {
    const p = gerarPayloadPix({
      chave: 'teste@email.com',
      nome: 'Teste',
      cidade: 'Brasilia',
      valor: 10,
    });
    const url = await QRCode.toDataURL(p, { width: 128, margin: 1 });
    assert.ok(url.startsWith('data:image/png;base64,'));
    console.log('PASS qrcode data url');

    const svg = await QRCode.toString(p, { type: 'svg', errorCorrectionLevel: 'M', margin: 1 });
    assert.ok(svg.includes('<svg') && svg.includes('</svg>'));
    console.log('PASS qrcode svg string');
  } catch (e) {
    failed += 1;
    console.error('FAIL qrcode svg/data url', e.message);
  }

  // IAP SKU constants without RN imports: parse file text
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../src/assinatura.js', import.meta.url), 'utf8');
  for (const sku of [
    'orcapro_pro_lifetime',
    'orcapro_pro_ia_mensal',
    'orcapro_pro_ia_anual',
    'orcapro_ia_pack_15',
  ]) {
    assert.ok(src.includes(sku), `missing sku ${sku}`);
  }
  assert.ok(src.includes('consumirCreditoIa'));
  assert.ok(src.includes('creditarPacoteIa'));
  assert.ok(src.includes('consumirQuotaSePermitido'));
  assert.ok(src.includes('fail-closed') || src.includes('storage_indisponivel'));
  console.log('PASS assinatura skus present');

  const appJson = JSON.parse(fs.readFileSync(new URL('../app.json', import.meta.url), 'utf8'));
  assert.equal(appJson.expo.android.package, 'com.orcapro.myapp');
  assert.ok(appJson.expo.android.versionCode >= 3, 'versionCode must bump after Billing 8 rebuild');
  assert.ok(appJson.expo.plugins.includes('expo-secure-store') || appJson.expo.plugins.some((p) => p === 'expo-secure-store' || p[0] === 'react-native-iap'));
  const billingPlugin = appJson.expo.plugins.find((p) => Array.isArray(p) && String(p[0]).includes('withBillingVersion'));
  assert.ok(billingPlugin, 'withBillingVersion plugin missing');
  assert.equal(String(billingPlugin[1]), '8.0.0');
  console.log('PASS app.json package/plugins/billing8');

  const rniapProps = fs.readFileSync(
    new URL('../node_modules/react-native-iap/android/gradle.properties', import.meta.url),
    'utf8'
  );
  assert.match(rniapProps, /RNIap_playBillingSdkVersion=8\.0\.0/);
  console.log('PASS rniap billing sdk 8.0.0');

  const rniapKt = fs.readFileSync(
    new URL('../node_modules/react-native-iap/android/src/play/java/com/dooboolab/rniap/RNIapModule.kt', import.meta.url),
    'utf8'
  );
  assert.ok(rniapKt.includes('PendingPurchasesParams'), 'billing8 pending purchases patch');
  assert.ok(rniapKt.includes('productDetailsResult'), 'billing8 product details patch');
  assert.ok(!rniapKt.includes('queryPurchaseHistoryAsync'), 'billing8 history removed');
  console.log('PASS rniap billing8 kotlin patch');

  const rniapGradle = fs.readFileSync(
    new URL('../node_modules/react-native-iap/android/build.gradle', import.meta.url),
    'utf8'
  );
  assert.match(rniapGradle, /billingclient:billing:\$playBillingSdkVersion/);
  assert.ok(!rniapGradle.includes('billing-ktx:$playBillingSdkVersion'), 'must not use billing-ktx on Expo 52');
  console.log('PASS rniap uses billing artifact (not ktx)');

  const buildProps = appJson.expo.plugins.find((p) => Array.isArray(p) && p[0] === 'expo-build-properties');
  assert.ok(buildProps, 'expo-build-properties missing');
  assert.ok(!buildProps[1]?.android?.kotlinVersion || !String(buildProps[1].android.kotlinVersion).startsWith('2.'), 'do not force Kotlin 2.x on Expo 52');
  console.log('PASS expo 52 kotlin (no forced 2.x)');

  const { FEATURE_PRO_IA } = await import('../src/feature-flags.js');
  assert.equal(FEATURE_PRO_IA, false);
  console.log('PASS feature flag Pro IA off on launch');

  // required screens exist
  for (const f of [
    'app/index.js',
    'app/novo-orcamento.js',
    'app/configuracoes.js',
    'app/detalhe-orcamento.js',
    'app/estatisticas.js',
    'app/calculadora-maquininha.js',
    'src/ia-rascunho.js',
    'src/componentes/AssistenteIA.js',
    'src/componentes/SeletorModelos.js',
    'src/feature-flags.js',
    'privacy-policy.html',
    'CLOSED_TESTING_RUNBOOK.md',
    'plugins/withBillingVersion.js',
    'scripts/patch-billing-version.mjs',
  ]) {
    assert.ok(fs.existsSync(new URL('../' + f, import.meta.url)), `missing ${f}`);
  }
  console.log('PASS required screens/files');

  const bancoSrc = fs.readFileSync(new URL('../src/banco-de-dados.js', import.meta.url), 'utf8');
  for (const sym of [
    'migrarColunasOrcamento',
    'marcarEnviado',
    'definirFollowup',
    'listarFollowupsPendentes',
    'estatisticasFunil',
    'enviado_em',
    'fechado_em',
    'followup_em',
    'valor_fechado',
    'modelo_id',
  ]) {
    assert.ok(bancoSrc.includes(sym), `banco missing ${sym}`);
  }
  console.log('PASS funil schema/api symbols');

  const estSrc = fs.readFileSync(new URL('../app/estatisticas.js', import.meta.url), 'utf8');
  assert.ok(estSrc.includes('estatisticasFunil'));
  assert.ok(estSrc.includes('Fechamento (Pro)'));
  assert.ok(estSrc.includes('Desbloquear'));
  console.log('PASS estatisticas funil gate copy');

  const paySrc = fs.readFileSync(new URL('../src/componentes/ModalPaywall.js', import.meta.url), 'utf8');
  assert.ok(paySrc.includes('Estatisticas de fechamento'));
  assert.ok(paySrc.includes('Sem IA'));
  console.log('PASS paywall permanente benefits');

  const { gerarRascunhoMock } = await import('../src/ia-rascunho.js');
  const r = await gerarRascunhoMock({ origem: 'audio', textoUsuario: 'instalar ar split 12000 btu' });
  assert.ok(r.itens.length >= 1);
  assert.ok(r.itens[0].descricao.toLowerCase().includes('ar') || r.resumo.toLowerCase().includes('ar'));
  console.log('PASS ia rascunho mock');

  if (failed) {
    console.error(`\n${failed} FAILED`);
    process.exit(1);
  }
  console.log('\nALL SMOKE TESTS PASSED');
})();
