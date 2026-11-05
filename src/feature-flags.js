/**
 * Feature flags de launch.
 * Pro IA fica off ate existir proxy proprio (sem BYO Gemini do usuario).
 * Ver MONETIZACAO.md.
 */

/** Assinatura Pro IA + pack no paywall + AssistenteIA na UI. */
export const FEATURE_PRO_IA = false;

/** Modelos reutilizaveis liberados com Lifetime / assinatura (ilimitado). */
export const FEATURE_MODELOS_PRO = true;

/** Marca "Gerado no OrcaPro Free" no PDF quando nao Pro. */
export const FEATURE_WATERMARK_FREE = true;
