import * as SQLite from 'expo-sqlite';

import { getDatabaseKey } from '@/lib/secure-store';

const MIGRATIONS = [
  `CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha TEXT NOT NULL,
    monto REAL NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('gasto', 'ingreso')),
    descripcion TEXT NOT NULL,
    categoria TEXT NOT NULL DEFAULT 'otros',
    cuenta TEXT NOT NULL DEFAULT 'efectivo',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS budgets (
    categoria TEXT PRIMARY KEY,
    monto_mensual REAL NOT NULL
  );
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT NOT NULL,
    fecha_limite TEXT,
    prioridad TEXT NOT NULL DEFAULT 'media',
    hecha INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    categoria TEXT NOT NULL,
    ruta TEXT NOT NULL,
    texto TEXT,
    fecha_vencimiento TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS workout_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha TEXT NOT NULL,
    ejercicio TEXT NOT NULL,
    serie INTEGER NOT NULL,
    peso_kg REAL NOT NULL,
    repeticiones INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS checkins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    semana TEXT NOT NULL UNIQUE,
    peso_promedio REAL,
    energia INTEGER,
    sueno INTEGER,
    notas TEXT
  );`,
  // v2: segundo cerebro con búsqueda de texto completo.
  `ALTER TABLE documents ADD COLUMN resumen TEXT;
  CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
    nombre, texto, content='documents', content_rowid='id', tokenize='unicode61 remove_diacritics 2'
  );
  CREATE TRIGGER IF NOT EXISTS documents_ai AFTER INSERT ON documents BEGIN
    INSERT INTO documents_fts(rowid, nombre, texto) VALUES (new.id, new.nombre, new.texto);
  END;
  CREATE TRIGGER IF NOT EXISTS documents_ad AFTER DELETE ON documents BEGIN
    INSERT INTO documents_fts(documents_fts, rowid, nombre, texto) VALUES ('delete', old.id, old.nombre, old.texto);
  END;
  CREATE TRIGGER IF NOT EXISTS documents_au AFTER UPDATE ON documents BEGIN
    INSERT INTO documents_fts(documents_fts, rowid, nombre, texto) VALUES ('delete', old.id, old.nombre, old.texto);
    INSERT INTO documents_fts(rowid, nombre, texto) VALUES (new.id, new.nombre, new.texto);
  END;`,
];

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function open() {
  const db = await SQLite.openDatabaseAsync('mivida.db');
  // SQLCipher: sin esta llave el archivo es ilegible.
  const key = await getDatabaseKey();
  await db.execAsync(`PRAGMA key = "x'${key}'"`);
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  const { user_version } = (await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))!;
  for (let v = user_version; v < MIGRATIONS.length; v++) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATIONS[v]);
      await db.execAsync(`PRAGMA user_version = ${v + 1}`);
    });
  }
  return db;
}

export function getDb() {
  dbPromise ??= open();
  return dbPromise;
}
