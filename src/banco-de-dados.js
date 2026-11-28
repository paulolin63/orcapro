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
  await migrarColunasOrcamento();
}

/** ALTER TABLE idempotente — DBs antigos sem colunas de funil. */
async function migrarColunasOrcamento() {
  const cols = await db.getAllAsync('PRAGMA table_info(orcamentos)');
  const nomes = new Set(cols.map((c) => c.name));
  const adicionar = [
    ['enviado_em', 'TEXT'],
    ['fechado_em', 'TEXT'],
    ['respondido_em', 'TEXT'],
    ['followup_em', 'TEXT'],
    ['valor_fechado', 'REAL'],
    ['modelo_id', 'INTEGER'],
    ['incluir_assinatura', 'INTEGER'],
    ['garantia_dias', 'INTEGER'],
  ];
  for (const [nome, tipo] of adicionar) {
    if (!nomes.has(nome)) {
      await db.execAsync(`ALTER TABLE orcamentos ADD COLUMN ${nome} ${tipo}`);
    }
  }
  await db.execAsync(
    'CREATE INDEX IF NOT EXISTS idx_orcamentos_followup ON orcamentos(followup_em)'
  );
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
    const modeloIdNum =
      dados.modelo_id != null && dados.modelo_id !== '' && Number.isFinite(Number(dados.modelo_id))
        ? Number(dados.modelo_id)
        : null;

    const result = await db.runAsync(
      `INSERT INTO orcamentos
        (cliente_nome, cliente_tel, endereco, validade_dias, subtotal, frete, outros, lucro_pct, total, notas, modelo_id, incluir_assinatura, garantia_dias)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        dados.cliente_nome,
        dados.cliente_tel || null,
        dados.endereco || null,
        dados.validade_dias || 7,
        dados.subtotal || 0,
        dados.frete || 0,
        dados.outros || 0,
        dados.lucro_pct ?? 0,
        dados.total || 0,
        dados.notas || null,
        modeloIdNum,
        dados.incluir_assinatura ? 1 : 0,
        Number(dados.garantia_dias) || 90,
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
  if (status === 'fechado') {
    await db.runAsync(
      `UPDATE orcamentos
       SET status = ?,
           atualizado_em = datetime('now','localtime'),
           respondido_em = COALESCE(respondido_em, datetime('now','localtime')),
           fechado_em = COALESCE(fechado_em, datetime('now','localtime')),
           valor_fechado = COALESCE(valor_fechado, total)
       WHERE id = ?`,
      [status, id]
    );
    return;
  }
  if (status === 'recusado') {
    await db.runAsync(
      `UPDATE orcamentos
       SET status = ?,
           atualizado_em = datetime('now','localtime'),
           respondido_em = COALESCE(respondido_em, datetime('now','localtime'))
       WHERE id = ?`,
      [status, id]
    );
    return;
  }
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

/** 1o share bem-sucedido — nao sobrescreve. */
export async function marcarEnviado(id) {
  await db.runAsync(
    `UPDATE orcamentos
     SET enviado_em = COALESCE(enviado_em, datetime('now','localtime')),
         atualizado_em = datetime('now','localtime')
     WHERE id = ?`,
    [id]
  );
}

/** isoDate: 'YYYY-MM-DD' ou null para limpar. */
export async function definirFollowup(id, isoDate) {
  await db.runAsync(
    `UPDATE orcamentos
     SET followup_em = ?, atualizado_em = datetime('now','localtime')
     WHERE id = ?`,
    [isoDate || null, id]
  );
}

export async function listarFollowupsPendentes(limite = 10) {
  return await db.getAllAsync(
    `SELECT id, cliente_nome, cliente_tel, total, followup_em, status
     FROM orcamentos
     WHERE status = 'aguardando'
       AND followup_em IS NOT NULL
       AND date(followup_em) <= date('now','localtime')
     ORDER BY followup_em ASC
     LIMIT ?`,
    [limite]
  );
}

/**
 * Funil local (Pro UI). Sem ML.
 * tempo medio dias; faixas de preco; taxa por modelo.
 */
export async function estatisticasFunil() {
  const tempo = await db.getFirstAsync(`
    SELECT AVG(
      julianday(fechado_em) - julianday(COALESCE(enviado_em, criado_em))
    ) AS dias_medios
    FROM orcamentos
    WHERE status = 'fechado' AND fechado_em IS NOT NULL
  `);

  const faixasRaw = await db.getAllAsync(`
    SELECT
      CASE
        WHEN COALESCE(total, 0) < 500 THEN '<500'
        WHEN COALESCE(total, 0) < 1500 THEN '500-1500'
        WHEN COALESCE(total, 0) < 3000 THEN '1500-3000'
        ELSE '>3000'
      END AS faixa,
      COUNT(*) AS enviados,
      SUM(CASE WHEN status = 'fechado' THEN 1 ELSE 0 END) AS fechados
    FROM orcamentos
    GROUP BY faixa
  `);

  const ordemFaixa = ['<500', '500-1500', '1500-3000', '>3000'];
  const faixas = ordemFaixa.map((faixa) => {
    const row = faixasRaw.find((r) => r.faixa === faixa) || { enviados: 0, fechados: 0 };
    const enviados = Number(row.enviados) || 0;
    const fechados = Number(row.fechados) || 0;
    return {
      faixa,
      enviados,
      fechados,
      taxa: enviados > 0 ? Math.round((fechados / enviados) * 100) : 0,
    };
  });

  const modelos = await db.getAllAsync(`
    SELECT
      COALESCE(m.nome, 'Sem modelo') AS nome,
      COUNT(*) AS total,
      SUM(CASE WHEN o.status = 'fechado' THEN 1 ELSE 0 END) AS fechados
    FROM orcamentos o
    LEFT JOIN modelos m ON m.id = o.modelo_id
    GROUP BY COALESCE(m.nome, 'Sem modelo')
    ORDER BY total DESC
    LIMIT 8
  `);

  const porModelo = (modelos || []).map((r) => {
    const total = Number(r.total) || 0;
    const fechados = Number(r.fechados) || 0;
    return {
      nome: r.nome,
      total,
      fechados,
      taxa: total > 0 ? Math.round((fechados / total) * 100) : 0,
    };
  });

  const followups = await listarFollowupsPendentes(10);
  const dias = tempo?.dias_medios != null ? Number(tempo.dias_medios) : null;

  return {
    dias_medios: dias != null && !Number.isNaN(dias) ? Math.round(dias * 10) / 10 : null,
    faixas,
    porModelo,
    followups,
  };
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

// ─────────────────────────────────────────
// CLIENTES SALVOS (RECORRENTES)
// ─────────────────────────────────────────

export async function listarClientesRecentes(limite = 20) {
  return await db.getAllAsync(
    `SELECT
       TRIM(cliente_nome) AS cliente_nome,
       MAX(cliente_tel) AS cliente_tel,
       MAX(endereco) AS endereco,
       COUNT(*) AS total_orcamentos
     FROM orcamentos
     WHERE TRIM(COALESCE(cliente_nome, '')) != ''
     GROUP BY LOWER(TRIM(cliente_nome))
     ORDER BY MAX(id) DESC
     LIMIT ?`,
    [limite]
  );
}
