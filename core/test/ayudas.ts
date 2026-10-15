import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import initSqlJs from 'sql.js';
import {
  NodeSqliteDb, SqlJsDb, BetaApi, crearServicios, inicializarBases, pendientesEnMemoria, claveValorEnMemoria, RelojFijo,
  type Db,
} from '../src';

const raiz = new URL('../../db/', import.meta.url);
export const SQL_BD = readFileSync(new URL('TablesBD.sql', raiz), 'utf8');
export const SQL_DW = readFileSync(new URL('TablesDW.sql', raiz), 'utf8');

/** "Hoy" fijo para las pruebas: 15 de octubre de 2026, 10:00. */
export const AHORA = new Date(2026, 9, 15, 10, 0, 0);

let sqlJs: Awaited<ReturnType<typeof initSqlJs>> | null = null;

export const ADAPTADORES: { nombre: string; crear: () => Promise<Db> }[] = [
  { nombre: 'NodeSqliteDb', crear: async () => new NodeSqliteDb(new DatabaseSync(':memory:')) },
  {
    nombre: 'SqlJsDb',
    crear: async () => {
      sqlJs ??= await initSqlJs();
      return new SqlJsDb(new sqlJs.Database());
    },
  },
];

/** Bases sembradas + servicios con un reloj controlable. */
export async function entorno(adaptador: (typeof ADAPTADORES)[number]) {
  const db = await adaptador.crear();
  const dw = await adaptador.crear();
  const kv = claveValorEnMemoria();
  const resultado = inicializarBases(db, dw, { sqlBd: SQL_BD, sqlDw: SQL_DW, ahora: AHORA, kv });
  const reloj = new RelojFijo(AHORA);
  let n = 0;
  const azar = () => ((n = (n * 9301 + 49297) % 233280) / 233280);
  const s = crearServicios({ db, reloj, azar, pendientes: pendientesEnMemoria(), kv }, dw);
  return { db, dw, s, api: new BetaApi(s), reloj, resultado };
}
