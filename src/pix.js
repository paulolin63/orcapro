/**
 * pix.js
 * Geração do payload Pix estático (padrão BR Code do Banco Central do Brasil).
 *
 * Dois modos:
 *   1. gerarPayloadPix()  → string do payload completo (para gerar QR Code)
 *   2. A chave Pix em texto puro (para copiar e colar)
 *
 * Documentação oficial: https://www.bcb.gov.br/content/estabilidadefinanceira/pix/Regulamento_Pix/II_ManualdePadroesparaIniciacaodoPix.pdf
 *
 * PHP analogy: esta seria uma classe PixHelper com métodos estáticos.
 */

// ─────────────────────────────────────────
// GERAÇÃO DO PAYLOAD PIX (BR Code Estático)
// ─────────────────────────────────────────

/**
 * Gera o payload Pix estático completo.
 * Este é o texto que vai dentro do QR Code.
 *
 * @param {object} params
 * @param {string} params.chave       - Chave Pix (CPF, CNPJ, telefone, email ou aleatória)
 * @param {string} params.nome        - Nome do recebedor (máx 25 caracteres)
 * @param {string} params.cidade      - Cidade do recebedor (máx 15 caracteres)
 * @param {string} [params.descricao] - Descrição/identificador (opcional, máx 72 chars)
 * @param {number} [params.valor]     - Valor fixo (opcional — deixe null para o cliente digitar)
 * @returns {string} payload - String para gerar o QR Code
 *
 * Exemplo de uso:
 *   const payload = gerarPayloadPix({
 *     chave: '11987654321',
 *     nome: 'João Eletricista',
 *     cidade: 'São Paulo',
 *   });
 */
/**
 * Normaliza chave Pix para o padrao BCB (telefone em E.164 +55...).
 * CPF/CNPJ ficam so digitos; email/aleatoria trimmed.
 */
export function normalizarChavePix(chave) {
  const raw = String(chave || '').trim();
  if (!raw) return '';

  const tipo = detectarTipoChave(raw);

  if (tipo === 'Telefone') {
    let digitos = raw.replace(/\D/g, '');
    if (digitos.startsWith('0')) digitos = digitos.slice(1);
    if (!digitos.startsWith('55') && (digitos.length === 10 || digitos.length === 11)) {
      digitos = '55' + digitos;
    }
    return '+' + digitos;
  }

  if (tipo === 'CPF' || tipo === 'CNPJ') {
    return raw.replace(/\D/g, '');
  }

  if (tipo === 'E-mail') {
    return raw.toLowerCase();
  }

  if (tipo === 'Aleatória' || tipo === 'Aleatoria') {
    return raw.toLowerCase();
  }

  return raw;
}

export function gerarPayloadPix({ chave, nome, cidade, descricao = '', valor = null }) {
  // Sanitiza os campos (remove acentos e caracteres especiais)
  const nomeLimpo    = sanitizarTexto(nome).substring(0, 25).trim();
  const cidadeLimpa  = sanitizarTexto(cidade).substring(0, 15).trim();
  const chaveLimpa   = sanitizarChavePix(normalizarChavePix(chave));

  // ── Merchant Account Information (campo 26) ──────────────────────
  // Estrutura: GUI (00) + Chave Pix (01) + Descrição (02, opcional)
  let mercAccountInfo = campo('00', 'BR.GOV.BCB.PIX') + campo('01', chaveLimpa);
  if (descricao) {
    mercAccountInfo += campo('02', sanitizarTexto(descricao).substring(0, 72));
  }

  // ── Monta o payload sem o CRC ────────────────────────────────────
  let payload = '';
  payload += campo('00', '01');                           // Payload Format Indicator
  payload += campo('26', mercAccountInfo);                // Merchant Account Info (Pix)
  payload += campo('52', '0000');                         // Merchant Category Code
  payload += campo('53', '986');                          // Transaction Currency (BRL)

  if (valor !== null && Number(valor) > 0) {
    // Valor fixo: "100.50" (ponto decimal, sem símbolo R$)
    payload += campo('54', Number(valor).toFixed(2));     // Transaction Amount
  }

  payload += campo('58', 'BR');                           // Country Code
  payload += campo('59', nomeLimpo);                      // Merchant Name
  payload += campo('60', cidadeLimpa);                    // Merchant City
  payload += campo('62', campo('05', '***'));             // Additional Data (txid obrigatório)

  // Adiciona o campo do CRC sem o valor (os 4 últimos chars são o CRC)
  payload += '6304';

  // Calcula e adiciona o CRC16
  const crc = calcularCRC16(payload).toString(16).toUpperCase().padStart(4, '0');
  payload += crc;

  return payload;
}

// ─────────────────────────────────────────
// HELPERS INTERNOS
// ─────────────────────────────────────────

/**
 * Formata um campo EMV: ID (2 chars) + tamanho (2 chars) + valor
 * PHP: sprintf('%s%02d%s', $id, strlen($valor), $valor)
 */
function campo(id, valor) {
  const tamanho = String(valor).length.toString().padStart(2, '0');
  return `${id}${tamanho}${valor}`;
}

/**
 * Remove acentos e caracteres não-ASCII.
 * PHP: iconv('UTF-8', 'ASCII//TRANSLIT', $texto)
 */
function sanitizarTexto(texto) {
  return String(texto)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // remove acentos
    .replace(/[^a-zA-Z0-9 \-\.\/]/g, ' ') // só permite chars válidos no payload
    .trim();
}

/** Chave Pix: permite + @ . - _ e alfanumerico (EMV-safe). */
function sanitizarChavePix(chave) {
  return String(chave || '')
    .trim()
    .replace(/[^\w@.+-]/g, '');
}

/**
 * Calcula CRC16-CCITT (polinômio 0x1021, valor inicial 0xFFFF).
 * Obrigatório no padrão BR Code do Banco Central.
 *
 * PHP:
 *   function crc16($str) {
 *     $crc = 0xFFFF;
 *     for ($i = 0; $i < strlen($str); $i++) {
 *       $crc ^= (ord($str[$i]) << 8);
 *       for ($j = 0; $j < 8; $j++) {
 *         $crc = ($crc & 0x8000) ? ($crc << 1) ^ 0x1021 : $crc << 1;
 *         $crc &= 0xFFFF;
 *       }
 *     }
 *     return $crc;
 *   }
 */
function calcularCRC16(payload) {
  let crc = 0xFFFF;

  for (let i = 0; i < payload.length; i++) {
    crc ^= (payload.charCodeAt(i) << 8);
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xFFFF;
    }
  }

  return crc;
}

// ─────────────────────────────────────────
// TIPO DA CHAVE PIX — para exibição
// ─────────────────────────────────────────

/**
 * Detecta automaticamente o tipo da chave Pix.
 * PHP: use regex para identificar o tipo.
 */
export function detectarTipoChave(chave) {
  const c = String(chave).trim().replace(/\s/g, '');

  // Email
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c)) return 'E-mail';

  // Chave aleatória (UUID)
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(c)) return 'Aleatória';

  // Telefone E.164 ou local (antes do CPF: 11 digitos puros sao ambiguos)
  if (/^\+55\d{10,11}$/.test(c)) return 'Telefone';
  if (/^(\+55)?0?[1-9]{2}9\d{8}$/.test(c)) return 'Telefone';
  // Fixo 10 digitos: DDD + 8
  if (/^(\+55)?0?[1-9]{2}[2-5]\d{7}$/.test(c)) return 'Telefone';

  // CPF: formatado ou 11 digitos (apos heuristica de celular)
  if (/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/.test(c)) return 'CPF';

  // CNPJ: 00.000.000/0000-00 ou 00000000000000
  if (/^\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}$/.test(c) || /^\d{14}$/.test(c)) return 'CNPJ';

  return 'Desconhecido';
}

/**
 * Formata a chave Pix para exibição bonita.
 * Ex: "11987654321" → "(11) 98765-4321"
 */
export function formatarChavePix(chave) {
  const c = String(chave).trim().replace(/\s/g, '');
  const tipo = detectarTipoChave(c);

  if (tipo === 'CPF') {
    const d = c.replace(/\D/g, '');
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }

  if (tipo === 'Telefone') {
    const d = c.replace(/\D/g, '').replace(/^(55|0)/, '');
    if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  }

  return chave; // email e aleatória ficam como estão
}
