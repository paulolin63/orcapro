/**
 * banco-de-dados.js
 * Equivalente PHP: PDO com SQLite. Aqui é tudo local no celular.
 *
 * PHP analogy:
 *   $pdo = new PDO('sqlite:orcapro.db');  →  openDatabaseAsync('orcapro.db')
 *   $pdo->exec($sql)                      →  db.execAsync(sql)
 *   $pdo->prepare($sql)->execute()        →  db.runAsync(sql, params)
 *   $stmt->fetchAll()                     →  db.getAllAsync(sql, params)
 */

import * as SQLite from 'expo-sqlite';

// Abre (ou cria) o banco de dados local
let db = null;

export async function abrirBanco() {
  if (db) return db; // Já aberto, retorna o mesmo
  db = await SQLite.openDatabaseAsync('orcapro.db');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await criarTabelas();
  return db;
}

// ─────────────────────────────────────────
// CRIAR TABELAS (equivale ao seu migration SQL)
// ─────────────────────────────────────────

async function criarTabelas() {
  // Em PHP seria: $pdo->exec("CREATE TABLE IF NOT EXISTS ...");
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    -- Configurações do técnico (logo, nome, pix key)
    CREATE TABLE IF NOT EXISTS configuracoes (
      id        INTEGER PRIMARY KEY,
      chave     TEXT UNIQUE NOT NULL,
      valor     TEXT
    );

    -- Modelos de serviço reutilizáveis (ex: "Instalação Ar Split 9000 BTU")
    CREATE TABLE IF NOT EXISTS modelos (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      nome        TEXT NOT NULL,
      itens_json  TEXT NOT NULL,  -- JSON com materiais e mão de obra
      criado_em   TEXT DEFAULT (datetime('now','localtime'))
    );

    -- Orçamentos gerados
    CREATE TABLE IF NOT EXISTS orcamentos (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_nome    TEXT NOT NULL,
      cliente_tel     TEXT,
      endereco        TEXT,
      validade_dias   INTEGER DEFAULT 7,
      status          TEXT DEFAULT 'aguardando',  -- aguardando, fechado, recusado, cancelado
      subtotal        REAL DEFAULT 0,
      frete           REAL DEFAULT 0,
      outros          REAL DEFAULT 0,
      lucro_pct       REAL DEFAULT 30,
      total           REAL DEFAULT 0,
      notas           TEXT,
      pdf_uri         TEXT,
      criado_em       TEXT DEFAULT (datetime('now','localtime')),
      atualizado_em   TEXT DEFAULT (datetime('now','localtime'))
    );

    -- Itens de cada orçamento (materiais + mão de obra)
    CREATE TABLE IF NOT EXISTS orcamento_itens (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      orcamento_id    INTEGER NOT NULL REFERENCES orcamentos(id) ON DELETE CASCADE,
      descricao       TEXT NOT NULL,
      custo_material  REAL DEFAULT 0,
      custo_mao_obra  REAL DEFAULT 0,
      quantidade      REAL DEFAULT 1,
      subtotal        REAL DEFAULT 0   -- calculado: (material + mao_obra) * qtd
    );

    CREATE INDEX IF NOT EXISTS idx_orcamentos_status ON orcamentos(status);
    CREATE INDEX IF NOT EXISTS idx_itens_orcamento ON orcamento_itens(orcamento_id);
  `);
}

// ─────────────────────────────────────────
// CONFIGURAÇÕES
// Equivale a uma tabela key/value de configuração
// ─────────────────────────────────────────

export async function salvarConfig(chave, valor) {
  // PHP: INSERT INTO configuracoes ... ON CONFLICT DO UPDATE ...
  await db.runAsync(
    `INSERT INTO configuracoes (chave, valor)
     VALUES (?, ?)
     ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor`,
    [chave, String(valor)]
  );
}

export async function lerConfig(chave, padrao = null) {
  // PHP: $stmt = $pdo->prepare("SELECT valor FROM configuracoes WHERE chave = ?");
  const row = await db.getFirstAsync(
    'SELECT valor FROM configuracoes WHERE chave = ?',
    [chave]
  );
  return row ? row.valor : padrao;
}

export async function lerTodasConfigs() {
  const rows = await db.getAllAsync('SELECT chave, valor FROM configuracoes');
  // Transforma array [{chave, valor}] em objeto {chave: valor} — como PHP array_column()
  return Object.fromEntries(rows.map(r => [r.chave, r.valor]));
}

// ─────────────────────────────────────────
// ORÇAMENTOS — CRUD
// ─────────────────────────────────────────

export async function criarOrcamento(dados, itens) {
  // Inicia "transação" — como $pdo->beginTransaction()
  let orcamentoId = null;

  await db.withTransactionAsync(async () => {
    const result = await db.runAsync(
      `INSERT INTO orcamentos
        (cliente_nome, cliente_tel, endereco, validade_dias, subtotal, frete, outros, lucro_pct, total, notas)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        dados.cliente_nome,
        dados.cliente_tel || null,
        dados.endereco || null,
        dados.validade_dias || 7,
        dados.subtotal || 0,
        dados.frete || 0,
        dados.outros || 0,
        dados.lucro_pct || 30,
        dados.total || 0,
        dados.notas || null,
      ]
    );

    orcamentoId = result.lastInsertRowId;

    // Insere os itens do orçamento
    for (const item of itens) {
      await db.runAsync(
        `INSERT INTO orcamento_itens
          (orcamento_id, descricao, custo_material, custo_mao_obra, quantidade, subtotal)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          orcamentoId,
          item.descricao,
          item.custo_material || 0,
          item.custo_mao_obra || 0,
          item.quantidade || 1,
          item.subtotal || 0,
        ]
      );
    }
  });

  return orcamentoId;
}

export async function listarOrcamentos(filtroStatus = null) {
  // PHP: SELECT * FROM orcamentos ORDER BY criado_em DESC
  if (filtroStatus) {
    return await db.getAllAsync(
      'SELECT * FROM orcamentos WHERE status = ? ORDER BY criado_em DESC',
      [filtroStatus]
    );
  }
  return await db.getAllAsync(
    'SELECT * FROM orcamentos ORDER BY criado_em DESC'
  );
}

export async function buscarOrcamento(id) {
  const orcamento = await db.getFirstAsync(
    'SELECT * FROM orcamentos WHERE id = ?',
    [id]
  );
  if (!orcamento) return null;

  const itens = await db.getAllAsync(
    'SELECT * FROM orcamento_itens WHERE orcamento_id = ? ORDER BY id',
    [id]
  );

  return { ...orcamento, itens };
}

export async function atualizarStatusOrcamento(id, status) {
  // status: 'aguardando' | 'fechado' | 'recusado' | 'cancelado'
  await db.runAsync(
    `UPDATE orcamentos
     SET status = ?, atualizado_em = datetime('now','localtime')
     WHERE id = ?`,
    [status, id]
  );
}

export async function salvarPdfUri(orcamentoId, uri) {
  await db.runAsync(
    'UPDATE orcamentos SET pdf_uri = ? WHERE id = ?',
    [uri, orcamentoId]
  );
}

export async function deletarOrcamento(id) {
  // ON DELETE CASCADE cuida dos itens automaticamente
  await db.runAsync('DELETE FROM orcamentos WHERE id = ?', [id]);
}

// ─────────────────────────────────────────
// ESTATÍSTICAS DO MÊS
// ─────────────────────────────────────────

export async function estatisticasMes() {
  const row = await db.getFirstAsync(`
    SELECT
      COUNT(*) as total_orcamentos,
      SUM(CASE WHEN status = 'fechado' THEN 1 ELSE 0 END) as total_fechados,
      SUM(CASE WHEN status = 'fechado' THEN total ELSE 0 END) as receita_total,
      SUM(CASE WHEN status = 'fechado' THEN (total - subtotal - frete - outros) ELSE 0 END) as lucro_estimado
    FROM orcamentos
    WHERE strftime('%Y-%m', criado_em) = strftime('%Y-%m', 'now', 'localtime')
  `);

  const taxa = row.total_orcamentos > 0
    ? Math.round((row.total_fechados / row.total_orcamentos) * 100)
    : 0;

  return { ...row, taxa_fechamento: taxa };
}

// ─────────────────────────────────────────
// MODELOS REUTILIZÁVEIS
// ─────────────────────────────────────────

export async function salvarModelo(nome, itens) {
  await db.runAsync(
    'INSERT INTO modelos (nome, itens_json) VALUES (?, ?)',
    [nome, JSON.stringify(itens)]
  );
}

export async function listarModelos() {
  const rows = await db.getAllAsync('SELECT * FROM modelos ORDER BY nome');
  // Parse do JSON — como json_decode() no PHP
  return rows.map(r => ({ ...r, itens: JSON.parse(r.itens_json) }));
}

export async function deletarModelo(id) {
  await db.runAsync('DELETE FROM modelos WHERE id = ?', [id]);
}
