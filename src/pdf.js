/**
 * pdf.js
 * Gera o HTML do orçamento e converte para PDF com expo-print.
 *
 * PHP analogy:
 *   Em PHP você usaria DOMPDF ou TCPDF para gerar PDF.
 *   Aqui fazemos a mesma coisa: montamos um HTML e mandamos para a biblioteca converter.
 *   expo-print.printToFileAsync({ html }) → equivale a $dompdf->render() no PHP.
 */

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import QRCode from 'qrcode';
import { gerarPayloadPix } from './pix';
import { formatarReais } from './calculos';

// ─────────────────────────────────────────
// GERAR PDF E SALVAR NO CELULAR
// ─────────────────────────────────────────

/**
 * Gera o PDF do orçamento e retorna o URI do arquivo salvo.
 *
 * @param {object} orcamento  - dados do orçamento (da tabela orcamentos)
 * @param {array}  itens      - itens do orçamento
 * @param {object} config     - configurações do técnico (nome, pix_key, etc.)
 * @returns {string} uri      - caminho do arquivo PDF no celular
 */
export async function gerarPDF(orcamento, itens, config) {
  let qrCodeUrl = null;
  if (config.pix_key) {
    try {
      const pixPayload = gerarPayloadPix({
        chave: config.pix_key,
        nome: config.nome_empresa || 'Tecnico',
        cidade: config.cidade || 'Brasil',
        valor: orcamento.total > 0 ? orcamento.total : null,
      });
      qrCodeUrl = await QRCode.toDataURL(pixPayload, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 220,
        type: 'image/png',
      });
    } catch (e) {
      console.warn('Falha ao gerar QR Pix offline:', e);
    }
  }

  const html = montarHTML(orcamento, itens, config, qrCodeUrl);

  // Converte HTML → PDF (igual ao DOMPDF no PHP)
  const { uri } = await Print.printToFileAsync({
    html,
    base64: false,
  });

  // Move para uma pasta permanente (o caminho gerado é temporário)
  const destino = `${FileSystem.documentDirectory}orcamentos/orca-${orcamento.id}.pdf`;
  await FileSystem.makeDirectoryAsync(
    `${FileSystem.documentDirectory}orcamentos/`,
    { intermediates: true }
  );
  await FileSystem.moveAsync({ from: uri, to: destino });

  return destino;
}

/**
 * Compartilha o PDF via WhatsApp / qualquer app instalado.
 * No Android abre o seletor de compartilhamento.
 */
export async function compartilharPDF(uri) {
  const disponivel = await Sharing.isAvailableAsync();
  if (!disponivel) {
    throw new Error('Compartilhamento não disponível neste dispositivo.');
  }
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: 'Enviar orçamento',
  });
}

// ─────────────────────────────────────────
// MONTAR HTML DO ORÇAMENTO
// PHP analogy: como montar uma view com ob_start() + include()
// ─────────────────────────────────────────

function montarHTML(orcamento, itens, config, qrCodeUrl = null) {
  const hoje          = new Date().toLocaleDateString('pt-BR');
  const validade      = calcularDataValidade(orcamento.validade_dias);

  // ── Linhas da tabela de itens ──────────────────────────────────
  const linhasItens = itens.map((item, i) => `
    <tr class="${i % 2 === 0 ? 'par' : 'impar'}">
      <td>${escapar(item.descricao)}</td>
      <td class="direita">${item.quantidade}x</td>
      <td class="direita">${formatarReais(item.custo_material + item.custo_mao_obra)}</td>
      <td class="direita"><strong>${formatarReais(item.subtotal)}</strong></td>
    </tr>
  `).join('');

  // ── Logo do técnico ───────────────────────────────────────────
  const logoHtml = config.logo_uri
    ? `<img src="${config.logo_uri}" class="logo" alt="Logo" />`
    : `<div class="logo-placeholder">${escapar(config.nome_empresa || 'OrçaPro')}</div>`;

  // ── HTML completo ─────────────────────────────────────────────
  // PHP analogy: echo $html; dentro de um template
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Orçamento #${orcamento.id}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 12px;
      color: #1a1a1a;
      padding: 20px 28px;
      max-width: 700px;
      margin: 0 auto;
    }

    /* ── Cabeçalho ── */
    .cabecalho {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 3px solid #162544;
      padding-bottom: 14px;
      margin-bottom: 18px;
    }
    .info-empresa h1 {
      font-size: 20px;
      color: #162544;
      font-weight: 800;
    }
    .info-empresa p { color: #555; margin-top: 3px; font-size: 11px; }
    .logo { max-height: 70px; max-width: 160px; object-fit: contain; }
    .logo-placeholder {
      font-size: 18px;
      font-weight: 800;
      color: #162544;
      border: 2px solid #162544;
      padding: 8px 16px;
      border-radius: 6px;
    }

    /* ── Número e datas ── */
    .numero-orca {
      background: #EBF2FA;
      border-left: 4px solid #162544;
      padding: 10px 14px;
      margin-bottom: 16px;
      border-radius: 0 6px 6px 0;
    }
    .numero-orca h2 { font-size: 16px; color: #162544; }
    .numero-orca p  { font-size: 11px; color: #555; margin-top: 2px; }

    /* ── Dados do cliente ── */
    .secao { margin-bottom: 16px; }
    .secao h3 {
      font-size: 11px;
      text-transform: uppercase;
      color: #888;
      letter-spacing: 0.8px;
      margin-bottom: 6px;
      border-bottom: 1px solid #eee;
      padding-bottom: 3px;
    }
    .secao p { font-size: 12px; margin-top: 2px; }

    /* ── Tabela de itens ── */
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th {
      background: #162544;
      color: white;
      padding: 8px 10px;
      text-align: left;
      font-size: 11px;
    }
    td { padding: 7px 10px; font-size: 11px; vertical-align: top; }
    tr.par  td { background: #fafafa; }
    tr.impar td { background: #ffffff; }
    .direita { text-align: right; }

    /* ── Totais ── */
    .totais {
      float: right;
      width: 280px;
      margin-bottom: 20px;
    }
    .totais table { margin-bottom: 0; }
    .totais td { padding: 5px 10px; }
    .totais .linha-total td {
      background: #162544;
      color: white;
      font-size: 14px;
      font-weight: 700;
    }
    .clearfix { clear: both; }

    /* ── Pagamento / Pix ── */
    .pagamento {
      display: flex;
      align-items: flex-start;
      gap: 20px;
      background: #F4F8FC;
      border: 1.5px solid #C5D8ED;
      border-radius: 8px;
      padding: 14px;
      margin-bottom: 16px;
    }
    .pagamento-info h4 { color: #162544; margin-bottom: 6px; font-size: 13px; font-weight: 800; }
    .pagamento-info p  { font-size: 11px; color: #444; margin-top: 3px; }
    .pagamento-info .chave-pix {
      font-family: monospace;
      background: #EBF2FA;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
      margin-top: 6px;
      display: inline-block;
      color: #162544;
      font-weight: 700;
    }
    .qrcode-box { text-align: center; }
    .qrcode-box img { width: 100px; height: 100px; }
    .qrcode-box small { font-size: 9px; color: #888; display: block; margin-top: 3px; }

    /* ── Garantia e notas ── */
    .garantia {
      font-size: 10px;
      color: #666;
      border: 1px solid #ddd;
      border-radius: 6px;
      padding: 10px;
      margin-bottom: 12px;
      background: #fffdf0;
    }
    .garantia strong { color: #333; }
    .notas {
      font-size: 11px;
      color: #444;
      border-left: 3px solid #ccc;
      padding-left: 10px;
      margin-bottom: 12px;
    }

    /* ── Rodapé ── */
    .rodape {
      text-align: center;
      font-size: 9px;
      color: #aaa;
      border-top: 1px solid #eee;
      padding-top: 8px;
    }
  </style>
</head>
<body>

  <!-- CABEÇALHO -->
  <div class="cabecalho">
    <div class="info-empresa">
      <h1>${escapar(config.nome_empresa || 'Técnico Autônomo')}</h1>
      ${config.telefone ? `<p>📞 ${escapar(config.telefone)}</p>` : ''}
      ${config.email    ? `<p>✉️ ${escapar(config.email)}</p>`    : ''}
    </div>
    ${logoHtml}
  </div>

  <!-- NÚMERO E DATAS -->
  <div class="numero-orca">
    <h2>Orçamento #${orcamento.id.toString().padStart(4, '0')}</h2>
    <p>Data: ${hoje} &nbsp;&nbsp; Válido até: ${validade}</p>
  </div>

  <!-- DADOS DO CLIENTE -->
  <div class="secao">
    <h3>Cliente</h3>
    <p><strong>${escapar(orcamento.cliente_nome)}</strong></p>
    ${orcamento.cliente_tel ? `<p>📞 ${escapar(orcamento.cliente_tel)}</p>` : ''}
    ${orcamento.endereco    ? `<p>📍 ${escapar(orcamento.endereco)}</p>`    : ''}
  </div>

  <!-- TABELA DE ITENS -->
  <div class="secao">
    <h3>Serviços e Materiais</h3>
    <table>
      <thead>
        <tr>
          <th>Descrição</th>
          <th class="direita">Qtd</th>
          <th class="direita">Unit.</th>
          <th class="direita">Total</th>
        </tr>
      </thead>
      <tbody>
        ${linhasItens}
      </tbody>
    </table>
  </div>

  <!-- TOTAIS -->
  <div class="totais">
    <table>
      ${orcamento.frete > 0 ? `
      <tr>
        <td>Deslocamento</td>
        <td class="direita">${formatarReais(orcamento.frete)}</td>
      </tr>` : ''}
      ${orcamento.outros > 0 ? `
      <tr>
        <td>Outros</td>
        <td class="direita">${formatarReais(orcamento.outros)}</td>
      </tr>` : ''}
      <tr class="linha-total">
        <td>TOTAL</td>
        <td class="direita">${formatarReais(orcamento.total)}</td>
      </tr>
    </table>
  </div>
  <div class="clearfix"></div>

  <!-- PAGAMENTO / PIX -->
  ${config.pix_key ? `
  <div class="pagamento">
    <div class="pagamento-info">
      <h4>💳 Formas de Pagamento</h4>
      <p>Pix — transferência imediata</p>
      <div class="chave-pix">
        🔑 ${escapar(config.pix_key_tipo || 'Chave Pix')}: ${escapar(config.pix_key)}
      </div>
      <p style="margin-top: 8px; font-size: 10px; color: #888;">
        Escaneie o QR Code ao lado ou copie a chave Pix acima
      </p>
    </div>
    ${qrCodeUrl ? `
    <div class="qrcode-box">
      <img src="${qrCodeUrl}" alt="QR Code Pix" />
      <small>QR Code Pix</small>
    </div>` : ''}
  </div>` : ''}

  <!-- NOTAS -->
  ${orcamento.notas ? `
  <div class="notas">
    <strong>Observações:</strong><br>
    ${escapar(orcamento.notas)}
  </div>` : ''}

  <!-- GARANTIA LEGAL -->
  <div class="garantia">
    <strong>⚖️ Garantia:</strong>
    Os serviços prestados têm garantia de <strong>90 (noventa) dias</strong> conforme o
    art. 26 do Código de Defesa do Consumidor (Lei nº 8.078/90).
    A garantia cobre apenas defeitos decorrentes da execução dos serviços contratados.
    Peças e materiais fornecidos pelo cliente não estão cobertos por esta garantia.
  </div>

  <!-- RODAPÉ -->
  <div class="rodape">
    Orçamento gerado pelo OrçaPro · orçamento válido por ${orcamento.validade_dias} dias a partir da data de emissão
  </div>

</body>
</html>
  `.trim();
}

// ─────────────────────────────────────────
// UTILITÁRIOS
// ─────────────────────────────────────────

/**
 * Escapa HTML para evitar XSS no PDF.
 * PHP: htmlspecialchars($str, ENT_QUOTES, 'UTF-8')
 */
function escapar(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Calcula a data de validade do orçamento.
 * PHP: date('d/m/Y', strtotime("+{$dias} days"))
 */
function calcularDataValidade(dias) {
  const data = new Date();
  data.setDate(data.getDate() + Number(dias || 7));
  return data.toLocaleDateString('pt-BR');
}
