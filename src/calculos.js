/**
 * calculos.js
 * Toda a matemática de custo, lucro e maquininha.
 * PHP analogy: uma classe utilitária estática.
 *
 * Uso:
 *   import { calcularTotal, calcularMaquininha } from '@src/calculos';
 */

// ─────────────────────────────────────────
// CÁLCULO DO ORÇAMENTO
// ─────────────────────────────────────────

/**
 * Calcula o subtotal de um item.
 *
 * PHP:
 *   function calcularItem($mat, $mao, $qtd) {
 *     return ($mat + $mao) * $qtd;
 *   }
 */
export function calcularItemSubtotal(custo_material, custo_mao_obra, quantidade) {
  return (Number(custo_material) + Number(custo_mao_obra)) * Number(quantidade);
}

/**
 * Calcula o total do orçamento com lucro.
 *
 * Método: Mark-up (custo + % de lucro sobre o custo)
 *   Ex: custo R$100, lucro 30% → preço R$130
 *
 * @param {number} subtotal  - soma dos itens
 * @param {number} frete     - transporte
 * @param {number} outros    - outros custos
 * @param {number} lucro_pct - percentual de lucro desejado (ex: 30 = 30%)
 * @returns {{ custo_total, lucro_valor, preco_final }}
 */
export function calcularTotal(subtotal, frete, outros, lucro_pct) {
  const custo_total = Number(subtotal) + Number(frete) + Number(outros);
  const lucro_valor = custo_total * (Number(lucro_pct) / 100);
  const preco_final = custo_total + lucro_valor;

  return {
    custo_total: arredondar(custo_total),
    lucro_valor: arredondar(lucro_valor),
    preco_final: arredondar(preco_final),
  };
}

/**
 * Dado um preço de venda desejado, descobre qual é o percentual de lucro.
 * (Modo reverso: "quero cobrar R$200, quanto de lucro é isso?")
 *
 * @param {number} custo_total  - todos os custos
 * @param {number} preco_venda  - preço que você quer cobrar
 * @returns {{ lucro_pct, lucro_valor }}
 */
export function calcularLucroPorPreco(custo_total, preco_venda) {
  if (custo_total <= 0) return { lucro_pct: 0, lucro_valor: 0 };
  const lucro_valor = Number(preco_venda) - Number(custo_total);
  const lucro_pct = (lucro_valor / custo_total) * 100;

  return {
    lucro_pct: arredondar(lucro_pct, 1),
    lucro_valor: arredondar(lucro_valor),
  };
}

// ─────────────────────────────────────────
// CALCULADORA DE MAQUININHA
// ─────────────────────────────────────────

/**
 * Taxas típicas de maquininha no Brasil por número de parcelas.
 * Fonte: valores médios de mercado (Stone, PagSeguro, Cielo, Getnet).
 * O técnico pode editar nas configurações.
 *
 * Estrutura: { parcelas: taxa_percentual }
 */
export const TAXAS_MAQUININHA_PADRAO = {
  1:  1.99,   // débito / à vista crédito
  2:  2.69,
  3:  2.99,
  4:  3.29,
  6:  3.89,
  10: 4.69,
  12: 5.19,
};

/**
 * Calcula o preço que você precisa cobrar para "limpar" a taxa da maquininha.
 *
 * Exemplo:
 *   Você quer receber R$ 500 líquido.
 *   Cliente vai pagar em 10x → taxa 4.69%
 *   Você precisa cobrar: R$ 500 / (1 - 0.0469) = R$ 524,49
 *
 * @param {number} valor_liquido   - quanto você quer receber na mão
 * @param {number} parcelas        - número de parcelas do cartão
 * @param {number} taxa_pct        - taxa da maquininha (%) — usa padrão se omitido
 * @returns {{
 *   valor_cobrar,       // o que você precisa cobrar ao cliente
 *   taxa_valor,         // quanto a maquininha vai reter
 *   parcela_cliente,    // valor de cada parcela que o cliente paga
 *   parcela_liquida,    // valor que você recebe por parcela
 * }}
 */
export function calcularMaquininha(valor_liquido, parcelas, taxa_pct = null) {
  const taxa = taxa_pct !== null ? Number(taxa_pct) : (TAXAS_MAQUININHA_PADRAO[parcelas] || 3.99);
  const multiplicador = 1 - (taxa / 100);

  const valor_cobrar   = arredondar(Number(valor_liquido) / multiplicador);
  const taxa_valor     = arredondar(valor_cobrar - Number(valor_liquido));
  const parcela_cliente  = arredondar(valor_cobrar / Number(parcelas));
  const parcela_liquida  = arredondar(valor_liquido / Number(parcelas));

  return {
    valor_cobrar,
    taxa_valor,
    taxa_pct: taxa,
    parcela_cliente,
    parcela_liquida,
    parcelas: Number(parcelas),
  };
}

/**
 * Dado o valor que o CLIENTE vai pagar, descobre quanto você vai receber líquido.
 * (Modo reverso da função acima)
 */
export function calcularLiquidoMaquininha(valor_cliente, parcelas, taxa_pct = null) {
  const taxa = taxa_pct !== null ? Number(taxa_pct) : (TAXAS_MAQUININHA_PADRAO[parcelas] || 3.99);
  const liquido = Number(valor_cliente) * (1 - taxa / 100);

  return {
    valor_liquido: arredondar(liquido),
    taxa_valor: arredondar(Number(valor_cliente) - liquido),
    taxa_pct: taxa,
  };
}

// ─────────────────────────────────────────
// FORMATAÇÃO — equivale a number_format() do PHP
// ─────────────────────────────────────────

/**
 * Formata número como moeda brasileira: R$ 1.234,56
 * PHP: number_format($valor, 2, ',', '.')
 */
export function formatarReais(valor) {
  return 'R$ ' + Number(valor).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Converte string "1.234,56" para número 1234.56
 * PHP: floatval(str_replace(['.', ','], ['', '.'], $valor))
 */
export function parsearReais(str) {
  if (typeof str === 'number') return str;
  return parseFloat(String(str).replace(/\./g, '').replace(',', '.')) || 0;
}

// Arredonda para 2 casas decimais por padrão
function arredondar(valor, casas = 2) {
  return Math.round(Number(valor) * Math.pow(10, casas)) / Math.pow(10, casas);
}
