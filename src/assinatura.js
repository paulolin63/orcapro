/**
 * assinatura.js
 * Monetizacao hibrida:
 * - Free: 3 orcamentos/mes
 * - Lifetime: PDF/orcamentos ilimitados
 * - Assinatura IA: ilimitado + creditos IA/mes
 * - Pacote consumivel: +creditos IA
 *
 * Ver MONETIZACAO.md
 */

import * as Application from 'expo-application';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import * as RNIap from 'react-native-iap';

export const LIMITE_GRATIS_MENSAL = 3;
export const CREDITOS_IA_ASSINATURA_MES = 20;
export const CREDITOS_IA_PACK = 15;

export const IAP_SKUS = {
  LIFETIME: 'orcapro_pro_lifetime',     // R$ 29,90 — PDF ilimitado
  MENSAL:   'orcapro_pro_ia_mensal',    // R$ 19,90 — ilimitado + 20 IA
  ANUAL:    'orcapro_pro_ia_anual',     // R$ 149,90 — idem
  PACK_IA:  'orcapro_ia_pack_15',       // R$ 9,90 consumivel +15 IA
  // legado (aceitar restore se ja existirem no Console)
  MENSAL_LEGACY: 'orcapro_pro_mensal',
  ANUAL_LEGACY:  'orcapro_pro_anual',
};

export const IAP_PRODUCT_IDS = [IAP_SKUS.LIFETIME, IAP_SKUS.PACK_IA];
export const IAP_SUBSCRIPTION_IDS = [
  IAP_SKUS.MENSAL,
  IAP_SKUS.ANUAL,
  IAP_SKUS.MENSAL_LEGACY,
  IAP_SKUS.ANUAL_LEGACY,
];

const CACHE_PRO_KEY = 'orcapro_entitlement_v2';
const CACHE_PRO_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CREDITOS_PACK_KEY = 'orcapro_ia_pack_saldo';
const CREDITOS_SUB_PREFIX = 'orcapro_ia_sub_'; // + YYYY-MM

const PRECOS_FALLBACK = {
  [IAP_SKUS.LIFETIME]: 'R$ 29,90',
  [IAP_SKUS.MENSAL]:   'R$ 19,90',
  [IAP_SKUS.ANUAL]:    'R$ 149,90',
  [IAP_SKUS.PACK_IA]:  'R$ 9,90',
};

function skuEhLifetimeetime(id) {
  return id === IAP_SKUS.LIFETIME;
}

function skuEhAssinaturaIa(id) {
  return (
    id === IAP_SKUS.MENSAL ||
    id === IAP_SKUS.ANUAL ||
    id === IAP_SKUS.MENSAL_LEGACY ||
    id === IAP_SKUS.ANUAL_LEGACY
  );
}

function skuEhPackIa(id) {
  return id === IAP_SKUS.PACK_IA;
}

export async function obterIdentificadorAparelho() {
  try {
    if (Platform.OS === 'android') {
      const androidId = Application.getAndroidId();
      if (!androidId) throw new Error('android_id_indisponivel');
      return androidId;
    }
    if (Platform.OS === 'ios') {
      const iosId = await Application.getIosIdForVendorAsync();
      if (!iosId) throw new Error('ios_id_indisponivel');
      return iosId;
    }
  } catch (e) {
    console.warn('Device ID indisponivel:', e);
    throw e;
  }
  throw new Error('platform_sem_device_id');
}

function obterChaveMesAtual() {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  return `${ano}-${mes}`;
}

async function chaveQuotaMes() {
  const deviceId = await obterIdentificadorAparelho();
  return `quota_${deviceId}_${obterChaveMesAtual()}`;
}

/**
 * @returns {Promise<{
 *   ilimitadoOrcamentos: boolean,
 *   temAssinaturaIa: boolean,
 *   source: string,
 *   fromCache: boolean
 * }>}
 */
export async function marcarEntitlementLocal({
  ilimitadoOrcamentos = false,
  temAssinaturaIa = false,
  source = 'play',
} = {}) {
  const payload = JSON.stringify({
    ilimitadoOrcamentos: !!ilimitadoOrcamentos,
    temAssinaturaIa: !!temAssinaturaIa,
    source,
    checkedAt: Date.now(),
  });
  await SecureStore.setItemAsync(CACHE_PRO_KEY, payload);
}

async function lerCacheEntitlement() {
  try {
    const raw = await SecureStore.getItemAsync(CACHE_PRO_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data.checkedAt !== 'number') return null;
    if (Date.now() - data.checkedAt > CACHE_PRO_TTL_MS) return null;
    return data;
  } catch (e) {
    return null;
  }
}

/** Compat: marca Pro generico (lifetime ou sub). */
export async function marcarProLocal({ source = 'play', ehPro = true } = {}) {
  const temIa = source === 'mensal' || source === 'anual' || source === 'assinatura_ia';
  await marcarEntitlementLocal({
    ilimitadoOrcamentos: !!ehPro,
    temAssinaturaIa: !!ehPro && temIa,
    source,
  });
}

export async function verificarSeUsuarioEhPro() {
  const e = await verificarEntitlement();
  return {
    ehPro: e.ilimitadoOrcamentos,
    source: e.source,
    fromCache: e.fromCache,
    temAssinaturaIa: e.temAssinaturaIa,
  };
}

export async function verificarEntitlement() {
  try {
    await RNIap.initConnection();
    const purchases = await RNIap.getAvailablePurchases();
    let ilimitado = false;
    let temIa = false;
    let source = 'none';

    for (const p of purchases || []) {
      const id = p.productId || p.productIds?.[0];
      if (skuEhLifetimeetime(id)) {
        ilimitado = true;
        if (source === 'none') source = 'lifetime';
      }
      if (skuEhAssinaturaIa(id)) {
        ilimitado = true;
        temIa = true;
        source = id.includes('anual') ? 'anual' : 'mensal';
      }
    }

    try {
      await marcarEntitlementLocal({
        ilimitadoOrcamentos: ilimitado,
        temAssinaturaIa: temIa,
        source,
      });
    } catch (_) { /* ignore */ }

    return {
      ilimitadoOrcamentos: ilimitado,
      temAssinaturaIa: temIa,
      source,
      fromCache: false,
    };
  } catch (erro) {
    console.warn('Erro Play Purchases:', erro);
    const cache = await lerCacheEntitlement();
    if (cache?.ilimitadoOrcamentos) {
      return {
        ilimitadoOrcamentos: true,
        temAssinaturaIa: !!cache.temAssinaturaIa,
        source: cache.source || 'cache',
        fromCache: true,
      };
    }
    return {
      ilimitadoOrcamentos: false,
      temAssinaturaIa: false,
      source: 'offline',
      fromCache: true,
    };
  }
}

export async function restaurarCompras() {
  return verificarSeUsuarioEhPro();
}

export async function obterOrcamentosUsadosMes() {
  const storageKey = await chaveQuotaMes();
  const valor = await SecureStore.getItemAsync(storageKey);
  if (valor == null || valor === '') return 0;
  const n = parseInt(valor, 10);
  if (Number.isNaN(n) || n < 0) throw new Error('quota_corrompida');
  return n;
}

export async function registrarUsoOrcamento() {
  const storageKey = await chaveQuotaMes();
  const atual = await obterOrcamentosUsadosMes();
  const novoValor = atual + 1;
  await SecureStore.setItemAsync(storageKey, String(novoValor));
  return novoValor;
}

export async function checarPermissaoNovoOrcamento() {
  const ent = await verificarEntitlement();
  if (ent.ilimitadoOrcamentos) {
    return {
      podeGerar: true,
      ehPro: true,
      temAssinaturaIa: ent.temAssinaturaIa,
      usados: 0,
      restantes: 9999,
      limite: 9999,
      source: ent.source,
    };
  }

  try {
    const usados = await obterOrcamentosUsadosMes();
    const restantes = Math.max(0, LIMITE_GRATIS_MENSAL - usados);
    return {
      podeGerar: usados < LIMITE_GRATIS_MENSAL,
      ehPro: false,
      temAssinaturaIa: false,
      usados,
      restantes,
      limite: LIMITE_GRATIS_MENSAL,
      motivo: usados < LIMITE_GRATIS_MENSAL ? undefined : 'quota_esgotada',
    };
  } catch (e) {
    console.error('Quota fail-closed:', e);
    return {
      podeGerar: false,
      ehPro: false,
      temAssinaturaIa: false,
      usados: LIMITE_GRATIS_MENSAL,
      restantes: 0,
      limite: LIMITE_GRATIS_MENSAL,
      motivo: 'storage_indisponivel',
    };
  }
}

export async function consumirQuotaSePermitido() {
  const permissao = await checarPermissaoNovoOrcamento();
  if (permissao.ehPro) return { ok: true, usados: 0 };
  if (!permissao.podeGerar) {
    return { ok: false, motivo: permissao.motivo || 'quota_esgotada', usados: permissao.usados };
  }
  try {
    const usados = await registrarUsoOrcamento();
    return { ok: true, usados };
  } catch (e) {
    return { ok: false, motivo: 'storage_indisponivel' };
  }
}

// ── Creditos IA ──────────────────────────────────────────────

async function lerIntSecure(key, fallback = 0) {
  const raw = await SecureStore.getItemAsync(key);
  if (raw == null || raw === '') return fallback;
  const n = parseInt(raw, 10);
  if (Number.isNaN(n) || n < 0) throw new Error('credito_corrompido');
  return n;
}

async function escreverIntSecure(key, n) {
  await SecureStore.setItemAsync(key, String(n));
}

/**
 * Saldo IA = creditos do mes da assinatura (se ativa) + pacotes.
 */
export async function obterSaldoCreditosIa() {
  const ent = await verificarEntitlement();
  let subRestantes = 0;
  if (ent.temAssinaturaIa) {
    const key = CREDITOS_SUB_PREFIX + obterChaveMesAtual();
    try {
      const usados = await lerIntSecure(key, 0);
      subRestantes = Math.max(0, CREDITOS_IA_ASSINATURA_MES - usados);
    } catch {
      subRestantes = 0;
    }
  }
  let pack = 0;
  try {
    pack = await lerIntSecure(CREDITOS_PACK_KEY, 0);
  } catch {
    pack = 0;
  }
  return {
    total: subRestantes + pack,
    assinaturaRestantes: subRestantes,
    pacoteSaldo: pack,
    temAssinaturaIa: ent.temAssinaturaIa,
    limiteAssinaturaMes: CREDITOS_IA_ASSINATURA_MES,
  };
}

/**
 * Consome 1 credito: primeiro da assinatura do mes, depois do pacote.
 */
export async function consumirCreditoIa() {
  const saldo = await obterSaldoCreditosIa();
  if (saldo.total <= 0) {
    return { ok: false, motivo: 'sem_credito_ia' };
  }

  try {
    if (saldo.assinaturaRestantes > 0) {
      const key = CREDITOS_SUB_PREFIX + obterChaveMesAtual();
      const usados = await lerIntSecure(key, 0);
      await escreverIntSecure(key, usados + 1);
      return { ok: true, origem: 'assinatura' };
    }
    const pack = await lerIntSecure(CREDITOS_PACK_KEY, 0);
    if (pack <= 0) return { ok: false, motivo: 'sem_credito_ia' };
    await escreverIntSecure(CREDITOS_PACK_KEY, pack - 1);
    return { ok: true, origem: 'pacote' };
  } catch (e) {
    return { ok: false, motivo: 'storage_indisponivel' };
  }
}

/** Apos compra consumivel do pacote. */
export async function creditarPacoteIa(qtd = CREDITOS_IA_PACK) {
  const atual = await lerIntSecure(CREDITOS_PACK_KEY, 0);
  await escreverIntSecure(CREDITOS_PACK_KEY, atual + qtd);
  return atual + qtd;
}

export async function obterPrecosIap() {
  const precos = { ...PRECOS_FALLBACK };
  const offerTokens = {};

  try {
    await RNIap.initConnection();
    try {
      const products = await RNIap.getProducts({ skus: IAP_PRODUCT_IDS });
      for (const p of products || []) {
        if (p.productId && p.localizedPrice) precos[p.productId] = p.localizedPrice;
      }
    } catch (e) {
      console.warn('getProducts falhou:', e);
    }
    try {
      const subs = await RNIap.getSubscriptions({ skus: IAP_SUBSCRIPTION_IDS });
      for (const s of subs || []) {
        if (s.productId && s.localizedPrice) precos[s.productId] = s.localizedPrice;
        const offers = s.subscriptionOfferDetails || s.subscriptionOffers || [];
        if (offers.length > 0) {
          const token = offers[0].offerToken || offers[0].offerIdToken;
          if (token) offerTokens[s.productId] = token;
        }
      }
    } catch (e) {
      console.warn('getSubscriptions falhou:', e);
    }
  } catch (e) {
    console.warn('IAP precos indisponiveis:', e);
  }

  return { precos, offerTokens };
}

export function precoFallback(sku) {
  return PRECOS_FALLBACK[sku] || '';
}

export { skuEhLifetimeetime, skuEhAssinaturaIa, skuEhPackIa };
