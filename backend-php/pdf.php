<?php
/**
 * pdf.php
 * Geração de PDF do orçamento com DOMPDF.
 * Requer: composer require dompdf/dompdf
 *
 * Uso via POST (do app React Native):
 *   POST /pdf.php
 *   Body: JSON com { orcamento: {...}, itens: [...], config: {...} }
 *   Response: PDF binário (application/pdf)
 *
 * Obs: Para o MVP, o PDF é gerado no próprio app (expo-print).
 *      Este arquivo é para uso futuro (PDF server-side com mais qualidade).
 */

require_once __DIR__ . '/vendor/autoload.php';
require_once __DIR__ . '/pix.php';

use Dompdf\Dompdf;
use Dompdf\Options;

/**
 * Gera o PDF do orçamento e retorna os bytes.
 *
 * @param array $orcamento  - dados do orçamento
 * @param array $itens      - itens do orçamento
 * @param array $config     - configurações do técnico
 * @return string           - conteúdo binário do PDF
 */
function gerarPDFOrcamento(array $orcamento, array $itens, array $config): string
{
    $html = montarHTML($orcamento, $itens, $config);

    $opcoes = new Options();
    $opcoes->set('defaultFont', 'DejaVu Sans');
    $opcoes->set('isRemoteEnabled', true);  // para carregar logo via URL
    $opcoes->set('chroot', __DIR__);

    $dompdf = new Dompdf($opcoes);
    $dompdf->loadHtml($html, 'UTF-8');
    $dompdf->setPaper('A4', 'portrait');
    $dompdf->render();

    return $dompdf->output();
}

function montarHTML(array $orca, array $itens, array $conf): string
{
    $hoje     = date('d/m/Y');
    $validade = date('d/m/Y', strtotime("+{$orca['validade_dias']} days"));
    $payload  = !empty($conf['pix_key'])
        ? gerarPayloadPix($conf['pix_key'], $conf['nome_empresa'] ?? 'Técnico', $conf['cidade'] ?? 'Brasil')
        : null;

    // QR Code Pix inline como Base64 PNG
    $qrBase64 = '';
    if ($payload) {
        $tmpFile = tempnam(sys_get_temp_dir(), 'pix_qr_') . '.png';
        try {
            gerarQRCodePix($payload, $tmpFile);
            $qrBase64 = 'data:image/png;base64,' . base64_encode(file_get_contents($tmpFile));
        } catch (\Exception $e) {
            // Sem QR Code se a lib não estiver instalada
        } finally {
            @unlink($tmpFile);
        }
    }

    // Logo em Base64 (para funcionar offline no DOMPDF)
    $logoHtml = '';
    if (!empty($conf['logo_path']) && file_exists($conf['logo_path'])) {
        $ext    = strtolower(pathinfo($conf['logo_path'], PATHINFO_EXTENSION));
        $mime   = $ext === 'png' ? 'image/png' : 'image/jpeg';
        $b64    = base64_encode(file_get_contents($conf['logo_path']));
        $logoHtml = "<img src=\"data:{$mime};base64,{$b64}\" class=\"logo\" />";
    }

    // Linhas da tabela de itens
    $linhasItens = '';
    foreach ($itens as $i => $item) {
        $classe = ($i % 2 === 0) ? 'par' : 'impar';
        $unitario = $item['custo_material'] + $item['custo_mao_obra'];
        $linhasItens .= "
        <tr class=\"{$classe}\">
          <td>" . htmlspecialchars($item['descricao']) . "</td>
          <td class=\"dir\">{$item['quantidade']}x</td>
          <td class=\"dir\">" . formatarReais($unitario) . "</td>
          <td class=\"dir\"><strong>" . formatarReais($item['subtotal']) . "</strong></td>
        </tr>";
    }

    $total = formatarReais($orca['total']);
    $nome  = htmlspecialchars($conf['nome_empresa'] ?? 'Técnico Autônomo');
    $tel   = htmlspecialchars($conf['telefone'] ?? '');
    $pixKey= htmlspecialchars($conf['pix_key'] ?? '');

    return <<<HTML
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: DejaVu Sans, Arial, sans-serif; font-size: 11px; color: #1a1a1a; padding: 20px 28px; }
  .cab { display:flex; justify-content:space-between; border-bottom:3px solid #1a73e8; padding-bottom:12px; margin-bottom:16px; }
  .emp h1 { font-size:18px; color:#1a73e8; font-weight:700; }
  .emp p { font-size:10px; color:#555; margin-top:2px; }
  .logo { max-height:60px; max-width:150px; }
  .num { background:#f0f4ff; border-left:4px solid #1a73e8; padding:8px 12px; margin-bottom:14px; border-radius:0 6px 6px 0; }
  .num h2 { color:#1a73e8; font-size:14px; }
  .sec { margin-bottom:14px; }
  .sec h3 { font-size:10px; text-transform:uppercase; color:#888; letter-spacing:.7px; margin-bottom:5px; border-bottom:1px solid #eee; padding-bottom:2px; }
  table { width:100%; border-collapse:collapse; margin-bottom:14px; }
  th { background:#1a73e8; color:white; padding:7px 8px; font-size:10px; text-align:left; }
  td { padding:6px 8px; font-size:10px; }
  tr.par td { background:#fafafa; }
  tr.impar td { background:#fff; }
  .dir { text-align:right; }
  .totais { float:right; width:240px; margin-bottom:16px; }
  .ttotal td { background:#1a73e8; color:white; font-size:13px; font-weight:700; }
  .cl { clear:both; }
  .pag { display:flex; align-items:flex-start; gap:16px; background:#f8f9ff; border:1px solid #dde3ff; border-radius:8px; padding:12px; margin-bottom:14px; }
  .pag h4 { color:#1a73e8; font-size:12px; margin-bottom:5px; }
  .cpix { font-family:monospace; background:#e8f0fe; padding:3px 7px; border-radius:4px; font-size:10px; margin-top:5px; display:inline-block; }
  .qr img { width:90px; height:90px; }
  .gar { font-size:9px; color:#666; border:1px solid #ddd; border-radius:5px; padding:8px; margin-bottom:10px; background:#fffdf0; }
  .rod { text-align:center; font-size:9px; color:#aaa; border-top:1px solid #eee; padding-top:6px; margin-top:10px; }
</style>
</head>
<body>

<div class="cab">
  <div class="emp">
    <h1>{$nome}</h1>
    {$tel ? "<p>📞 {$tel}</p>" : ''}
  </div>
  {$logoHtml}
</div>

<div class="num">
  <h2>Orçamento #" . str_pad($orca['id'], 4, '0', STR_PAD_LEFT) . "</h2>
  <p>Data: {$hoje} &nbsp;&nbsp; Válido até: {$validade}</p>
</div>

<div class="sec">
  <h3>Cliente</h3>
  <p><strong>" . htmlspecialchars($orca['cliente_nome']) . "</strong></p>
  " . (!empty($orca['endereco']) ? "<p>📍 " . htmlspecialchars($orca['endereco']) . "</p>" : '') . "
</div>

<div class="sec">
  <h3>Serviços e Materiais</h3>
  <table>
    <thead><tr><th>Descrição</th><th class=\"dir\">Qtd</th><th class=\"dir\">Unit.</th><th class=\"dir\">Total</th></tr></thead>
    <tbody>{$linhasItens}</tbody>
  </table>
</div>

<div class="totais">
  <table>
    " . ($orca['frete'] > 0 ? "<tr><td>Deslocamento</td><td class=\"dir\">" . formatarReais($orca['frete']) . "</td></tr>" : '') . "
    <tr class=\"ttotal\"><td>TOTAL</td><td class=\"dir\">{$total}</td></tr>
  </table>
</div>
<div class="cl"></div>

" . ($pixKey ? "
<div class=\"pag\">
  <div>
    <h4>💳 Pagamento via Pix</h4>
    <div class=\"cpix\">🔑 {$pixKey}</div>
    <p style=\"font-size:9px;color:#888;margin-top:6px;\">Escaneie o QR Code ou copie a chave acima</p>
  </div>
  " . ($qrBase64 ? "<div class=\"qr\"><img src=\"{$qrBase64}\" /></div>" : '') . "
</div>" : '') . "

<div class="gar">
  <strong>⚖️ Garantia:</strong> Os serviços têm garantia de <strong>90 dias</strong>
  conforme o art. 26 do Código de Defesa do Consumidor (Lei nº 8.078/90).
</div>

<div class="rod">Gerado pelo OrçaPro · Válido por {$orca['validade_dias']} dias a partir da emissão</div>

</body>
</html>
HTML;
}

/**
 * Formata valor como R$ 1.234,56 — igual ao number_format do PHP
 */
function formatarReais(float $valor): string
{
    return 'R$ ' . number_format($valor, 2, ',', '.');
}

// ─────────────────────────────────────────
// ENDPOINT REST (usado pelo app se você preferir gerar PDF no servidor)
// POST /pdf.php  →  Content-Type: application/pdf
// ─────────────────────────────────────────

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    header('Content-Type: application/json');

    $body = json_decode(file_get_contents('php://input'), true);
    if (!$body) {
        http_response_code(400);
        echo json_encode(['erro' => 'JSON inválido']);
        exit;
    }

    try {
        $pdfBytes = gerarPDFOrcamento(
            $body['orcamento'],
            $body['itens'],
            $body['config']
        );

        header('Content-Type: application/pdf');
        header('Content-Disposition: inline; filename="orcamento-' . ($body['orcamento']['id'] ?? 0) . '.pdf"');
        header('Content-Length: ' . strlen($pdfBytes));
        echo $pdfBytes;

    } catch (\Exception $e) {
        http_response_code(500);
        echo json_encode(['erro' => $e->getMessage()]);
    }
    exit;
}
