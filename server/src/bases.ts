import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  BetaApi, NodeSqliteDb, crearServicios, inicializarBases, pendientesEnMemoria, relojDelSistema, tieneEsquema,
  type AlmacenClaveValor, type ResumenSeed, type ResultadoEtl,
} from '@beta/core';

export const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
export const DIR_DATOS = process.env.BETA_DATOS ?? join(RAIZ, 'data');
export const ARCHIVO_BD = join(DIR_DATOS, 'beta_airlines.db');
export const ARCHIVO_DW = join(DIR_DATOS, 'beta_airlines_dw.db');
const ARCHIVO_ESTADO = join(DIR_DATOS, 'estado.json');

export const SQL_BD = readFileSync(join(RAIZ, 'db', 'TablesBD.sql'), 'utf8');
export const SQL_DW = readFileSync(join(RAIZ, 'db', 'TablesDW.sql'), 'utf8');

/** Metadatos fuera del modelo (fecha de la última carga del DW, secreto de las sesiones) en data/estado.json. */
export function claveValorEnArchivo(): AlmacenClaveValor {
  const leerTodo = (): Record<string, string> => {
    try {
      return JSON.parse(readFileSync(ARCHIVO_ESTADO, 'utf8'));
    } catch {
      return {};
    }
  };
  return {
    leer: (k) => leerTodo()[k] ?? null,
    guardar: (k, v) => {
      mkdirSync(DIR_DATOS, { recursive: true });
      writeFileSync(ARCHIVO_ESTADO, JSON.stringify({ ...leerTodo(), [k]: v }, null, 2));
    },
  };
}

function abrir(archivo: string) {
  const conexion = new DatabaseSync(archivo);
  conexion.exec('PRAGMA journal_mode = WAL');
  return new NodeSqliteDb(conexion);
}

export function borrarBases() {
  for (const f of [ARCHIVO_BD, ARCHIVO_DW]) for (const sufijo of ['', '-wal', '-shm']) rmSync(f + sufijo, { force: true });
}

/** Crea las dos bases desde los scripts de Enterprise Architect, corre el seed y el ETL. */
export function crearBases(ahora = new Date()): { seed: ResumenSeed; etl: ResultadoEtl } {
  mkdirSync(DIR_DATOS, { recursive: true });
  borrarBases();
  const db = abrir(ARCHIVO_BD);
  const dw = abrir(ARCHIVO_DW);
  try {
    return inicializarBases(db, dw, { sqlBd: SQL_BD, sqlDw: SQL_DW, ahora, kv: claveValorEnArchivo() });
  } finally {
    db.close();
    dw.close();
  }
}

export interface Aplicacion {
  api: BetaApi;
  cerrar(): void;
}

/** Abre las bases existentes (o las crea si no existen) y arma los servicios con el reloj del sistema. */
export function abrirAplicacion(): Aplicacion {
  if (!existsSync(ARCHIVO_BD) || !existsSync(ARCHIVO_DW)) {
    console.log('No se encontraron las bases de datos. Creándolas con los datos iniciales…');
    crearBases();
  }
  const db = abrir(ARCHIVO_BD);
  const dw = abrir(ARCHIVO_DW);
  if (!tieneEsquema(db, 'Vuelo') || !tieneEsquema(dw, 'FactReservas')) {
    db.close();
    dw.close();
    crearBases();
    return abrirAplicacion();
  }
  const kv = claveValorEnArchivo();
  // Las reservas pendientes de pago (clase y pasajeros) se guardan en memoria del servidor.
  const s = crearServicios({ db, reloj: relojDelSistema, azar: Math.random, pendientes: pendientesEnMemoria(), kv }, dw);
  if (s.etl.dwVacio()) {
    const r = s.etl.ejecutar();
    console.log(`Data warehouse cargado (${r.filas.FactVentaTiquetes} ventas, ${r.filas.FactReservas} reservas).`);
  }
  return {
    api: new BetaApi(s),
    cerrar: () => {
      db.close();
      dw.close();
    },
  };
}
