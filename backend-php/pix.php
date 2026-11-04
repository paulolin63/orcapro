<?php
/**
 * pix.php
 * Geração do payload Pix estático (padrão BR Code do Banco Central).
 * Idêntica lógica ao arquivo src/pix.js — aqui é para gerar server-side se precisar.
 *
 * Uso:
 *   require 'pix.php';
 *   $payload = gerarPayloadPix('11987654321', 'João Eletricista', 'São Paulo');
 *   echo $payload; // → string para gerar QR Code
 */

/**
 * Gera o payload Pix estático completo.
 *
 * @param string $chave     Chave Pix (CPF, CNPJ, telefone, email ou aleatória)
 * @param string $nome      Nome do recebedor (máx 25 chars)
 * @param string $cidade    Cidade do recebedor (máx 15 chars)
 * @param string $descricao Descrição opcional (máx 72 chars)
 * @param float  $valor     Valor fixo (null = cliente digita no app de banco)
 * @return string           Payload completo com CRC16
 */
function gerarPayloadPix(
    string $chave,
    string $nome,
    string $cidade,
    string $descricao = '',
    ?float $valor = null
): string {
    $nomeLimpo   = substr(sanitizarTexto($nome),   0, 25);
    $cidadeLimpa = substr(sanitizarTexto($cidade), 0, 15);
    $chaveLimpa  = trim($chave);

    // Merchant Account Information (campo 26)
    $mercAccountInfo = campo('00', 'BR.GOV.BCB.PIX') . campo('01', $chaveLimpa);
    if ($descricao !== '') {
        $mercAccountInfo .= campo('02', substr(sanitizarTexto($descricao), 0, 72));
    }

    // Monta payload sem o CRC
    $payload  = campo('00', '01');                          // Payload Format Indicator
    $payload .= campo('26', $mercAccountInfo);              // Merchant Account Info (Pix)
    $payload .= campo('52', '0000');                        // Merchant Category Code
    $payload .= campo('53', '986');                         // Transaction Currency (BRL)

    if ($valor !== null && $valor > 0) {
        $payload .= campo('54', number_format($valor, 2, '.', '')); // Transaction Amount
    }

    $payload .= campo('58', 'BR');                          // Country Code
    $payload .= campo('59', $nomeLimpo);                    // Merchant Name
    $payload .= campo('60', $cidadeLimpa);                  // Merchant City
    $payload .= campo('62', campo('05', '***'));             // Additional Data (txid)

    // Adiciona prefixo do CRC sem o valor
    $payload .= '6304';

    // Calcula e anexa o CRC16
    $crc      = calcularCRC16($payload);
    $payload .= strtoupper(str_pad(dechex($crc), 4, '0', STR_PAD_LEFT));

    return $payload;
}

/**
 * Formata campo EMV: ID (2 chars) + tamanho (2 chars) + valor
 * Ex: campo('00', '01') → '000201'
 */
function campo(string $id, string $valor): string
{
    return $id . str_pad(strlen($valor), 2, '0', STR_PAD_LEFT) . $valor;
}

/**
 * Remove acentos e caracteres especiais (equivalente ao JS normalize/replace).
 * PHP nativo: iconv + preg_replace.
 */
function sanitizarTexto(string $texto): string
{
    // Remove acentos
    $texto = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $texto);
    // Mantém apenas letras, números, espaço, hífen, ponto, barra
    $texto = preg_replace('/[^a-zA-Z0-9 \-\.\/]/', ' ', $texto);
    return trim($texto);
}

/**
 * Calcula CRC16-CCITT (polinômio 0x1021, inicial 0xFFFF).
 * Obrigatório no padrão BR Code do Banco Central do Brasil.
 */
function calcularCRC16(string $payload): int
{
    $crc = 0xFFFF;

    for ($i = 0; $i < strlen($payload); $i++) {
        $crc ^= (ord($payload[$i]) << 8);
        for ($j = 0; $j < 8; $j++) {
            $crc = ($crc & 0x8000)
                ? (($crc << 1) ^ 0x1021) & 0xFFFF
                : ($crc << 1) & 0xFFFF;
        }
    }

    return $crc;
}

// ─────────────────────────────────────────
// DETECÇÃO DO TIPO DE CHAVE PIX
// ─────────────────────────────────────────

function detectarTipoChave(string $chave): string
{
    $c = trim(str_replace(' ', '', $chave));

    if (preg_match('/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/', $c))            return 'CPF';
    if (preg_match('/^\d{2}\.?\d{3}\.?\d{3}\/?\.?\d{4}-?\d{2}$/', $c)) return 'CNPJ';
    if (preg_match('/^(\+55)?0?[1-9]{2}9?\d{8}$/', $c))                return 'Telefone';
    if (filter_var($c, FILTER_VALIDATE_EMAIL))                           return 'Email';
    if (preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $c)) return 'Aleatória';

    return 'Desconhecido';
}

// ─────────────────────────────────────────
// GERAR QR CODE COMO PNG (com chillerlan/php-qrcode)
// ─────────────────────────────────────────

/**
 * Gera o QR Code Pix como PNG e retorna o caminho do arquivo.
 * Requer: composer require chillerlan/php-qrcode
 *
 * @param string $payload  - string do payload Pix (retorno de gerarPayloadPix())
 * @param string $destino  - caminho onde salvar o PNG
 * @return string          - caminho do arquivo gerado
 */
function gerarQRCodePix(string $payload, string $destino): string
{
    if (!class_exists('\chillerlan\QRCode\QRCode')) {
        throw new RuntimeException('Instale: composer require chillerlan/php-qrcode');
    }

    $opcoes = new \chillerlan\QRCode\QROptions([
        'outputType' => \chillerlan\QRCode\Output\QROutputInterface::IMAGETYPE_PNG,
        'scale'      => 5,
        'imageBase64' => false,
    ]);

    (new \chillerlan\QRCode\QRCode($opcoes))->render($payload, $destino);
    return $destino;
}

// ─────────────────────────────────────────
// ENDPOINT DE TESTE (remova em produção)
// Acesse: GET /pix.php?chave=11987654321&nome=João&cidade=SaoPaulo
// ─────────────────────────────────────────

if (php_sapi_name() === 'cli' || (isset($_GET['test']) && $_GET['test'] === '1')) {
    $payload = gerarPayloadPix(
        chave:   '11987654321',
        nome:    'João Eletricista',
        cidade:  'São Paulo'
    );

    echo "Payload Pix gerado:\n";
    echo $payload . "\n";
    echo "\nTipo da chave: " . detectarTipoChave('11987654321') . "\n";
}
