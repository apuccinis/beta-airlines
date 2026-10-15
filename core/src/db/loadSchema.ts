import type { Db } from './Db';

/**
 * Adapta en tiempo de ejecución los scripts MySQL generados por Enterprise Architect a SQLite,
 * sin modificar el modelo:
 *  1. Ignora SET FOREIGN_KEY_CHECKS y DROP TABLE ... CASCADE (la base se crea vacía).
 *  2. Conserva los CREATE TABLE tal cual (SQLite acepta comillas invertidas y PRIMARY KEY (col ASC)).
 *  3. ALTER TABLE x ADD INDEX n (cols)  →  CREATE INDEX n ON x (cols).
 *  4. ALTER TABLE x ADD CONSTRAINT n UNIQUE / FOREIGN KEY ... se incorporan dentro del CREATE TABLE
 *     de su tabla, conservando el nombre de la restricción (SQLite no admite agregarlas con ALTER TABLE).
 *  5. Ignora ON DELETE No Action ON UPDATE No Action (es el comportamiento por defecto).
 */
export interface EsquemaAdaptado {
  tablas: string[];
  sentencias: string[];
}

const nombre = (s: string) => s.replace(/`/g, '').trim();

export function adaptarEsquema(textoMySql: string): EsquemaAdaptado {
  const sinComentarios = textoMySql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*--.*$/gm, '');
  const sentencias = sinComentarios
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);

  const tablas = new Map<string, { cuerpo: string; restricciones: string[] }>();
  const indices: string[] = [];
  const desconocidas: string[] = [];

  for (const s of sentencias) {
    const plano = s.replace(/\s+/g, ' ');
    if (/^SET\s/i.test(plano) || /^DROP\s+TABLE/i.test(plano)) continue;

    const create = s.match(/^CREATE\s+TABLE\s+(`?\w+`?)\s*\(([\s\S]*)\)\s*$/i);
    if (create) {
      tablas.set(nombre(create[1]), { cuerpo: create[2].trim(), restricciones: [] });
      continue;
    }

    const index = plano.match(/^ALTER TABLE (`?\w+`?) ADD INDEX (`?\w+`?) \((.+)\)$/i);
    if (index) {
      indices.push(`CREATE INDEX ${index[2]} ON ${index[1]} (${index[3]})`);
      continue;
    }

    const unique = plano.match(/^ALTER TABLE (`?\w+`?) ADD CONSTRAINT (`?\w+`?) UNIQUE \((.+)\)$/i);
    if (unique) {
      tablaDe(tablas, unique[1]).restricciones.push(`CONSTRAINT ${unique[2]} UNIQUE (${unique[3]})`);
      continue;
    }

    const fk = plano.match(
      /^ALTER TABLE (`?\w+`?) ADD CONSTRAINT (`?\w+`?) FOREIGN KEY \((.+?)\) REFERENCES (`?\w+`?) \((.+?)\)(?: ON DELETE No Action)?(?: ON UPDATE No Action)?$/i,
    );
    if (fk) {
      tablaDe(tablas, fk[1]).restricciones.push(`CONSTRAINT ${fk[2]} FOREIGN KEY (${fk[3]}) REFERENCES ${fk[4]} (${fk[5]})`);
      continue;
    }

    desconocidas.push(plano);
  }

  if (desconocidas.length) {
    throw new Error(`Sentencias del esquema sin adaptar: ${desconocidas.join(' | ')}`);
  }

  const creates = [...tablas.entries()].map(([t, { cuerpo, restricciones }]) => {
    const partes = [cuerpo, ...restricciones.map((r) => `\t${r}`)];
    return `CREATE TABLE \`${t}\`\n(\n\t${partes.join(',\n')}\n)`;
  });

  return { tablas: [...tablas.keys()], sentencias: [...creates, ...indices] };
}

function tablaDe(tablas: Map<string, { cuerpo: string; restricciones: string[] }>, t: string) {
  const tabla = tablas.get(nombre(t));
  if (!tabla) throw new Error(`La tabla ${t} no está definida antes de sus restricciones.`);
  return tabla;
}

/** Crea las tablas e índices del script en una base vacía. */
export function cargarEsquema(db: Db, textoMySql: string): EsquemaAdaptado {
  const esquema = adaptarEsquema(textoMySql);
  db.transaction(() => {
    for (const s of esquema.sentencias) db.exec(s);
  });
  return esquema;
}

/** true si la base ya tiene las tablas del esquema. */
export function tieneEsquema(db: Db, tabla: string): boolean {
  return !!db.get(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`, [tabla]);
}
