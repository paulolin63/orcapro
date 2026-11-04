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
  } catch (e) {
    failed += 1;
    console.error('FAIL qrcode data url', e.message);
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
  assert.equal(appJson.expo.android.package, 'com.paulolin.orcapro');
  assert.ok(appJson.expo.plugins.includes('expo-secure-store') || appJson.expo.plugins.some((p) => p === 'expo-secure-store' || p[0] === 'react-native-iap'));
  console.log('PASS app.json package/plugins');

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
    'privacy-policy.html',
  ]) {
    assert.ok(fs.existsSync(new URL('../' + f, import.meta.url)), `missing ${f}`);
  }
  console.log('PASS required screens/files');

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
