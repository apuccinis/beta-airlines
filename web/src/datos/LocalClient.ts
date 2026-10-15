import initSqlJs from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import sqlBd from '../../../db/TablesBD.sql?raw';
import sqlDw from '../../../db/TablesDW.sql?raw';
import {
  BetaApi, ErrorNegocio, SqlJsDb, crearServicios, inicializarBases, relojDelSistema, tieneEsquema,
  type Actor, type AlmacenClaveValor, type AlmacenPendientes, type PerfilCliente, type PerfilEmpleado, type ReservaPendiente,
} from '@beta/core';
import { ErrorDatos, type ClienteDatos } from './ClienteDatos';

/* ---------- almacenamiento del navegador ---------- */

const ls = {
  leer(k: string) {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  escribir(k: string, v: string | null) {
    try {
      if (v === null) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    } catch {
      /* sin almacenamiento: se trabaja en memoria */
    }
  },
};

const memoria = new Map<string, string>();
const kvNavegador: AlmacenClaveValor = {
  leer: (k) => ls.leer(`beta.kv.${k}`) ?? memoria.get(k) ?? null,
  guardar: (k, v) => {
    memoria.set(k, v);
    ls.escribir(`beta.kv.${k}`, v);
  },
};

/** Datos de las reservas pendientes de pago, guardados en la sesión del navegador. */
function pendientesNavegador(): AlmacenPendientes {
  const CLAVE = 'beta.pendientes';
  let cache: Record<string, ReservaPendiente> = {};
  try {
    cache = JSON.parse(ls.leer(CLAVE) ?? '{}');
  } catch {
    cache = {};
  }
  const guardar = () => ls.escribir(CLAVE, JSON.stringify(cache));
  return {
    leer: (id) => cache[id],
    guardar: (id, d) => {
      cache[id] = d;
      guardar();
    },
    borrar: (id) => {
      delete cache[id];
      guardar();
    },
  };
}

const IDB = { nombre: 'beta-airlines', almacen: 'bases' };

function abrirIdb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB.nombre, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(IDB.almacen);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function idbLeer(idb: IDBDatabase, clave: string): Promise<Uint8Array | null> {
  return new Promise((resolve) => {
    const req = idb.transaction(IDB.almacen, 'readonly').objectStore(IDB.almacen).get(clave);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => resolve(null);
  });
}

function idbEscribir(idb: IDBDatabase, datos: Record<string, Uint8Array | undefined>): Promise<void> {
  return new Promise((resolve) => {
    const tx = idb.transaction(IDB.almacen, 'readwrite');
    const store = tx.objectStore(IDB.almacen);
    for (const [k, v] of Object.entries(datos)) {
      if (v) store.put(v, k);
      else store.delete(k);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

/* ---------- cliente ---------- */

const SESION = { cliente: 'beta.sesion.cliente', empleado: 'beta.sesion.empleado' } as const;

/**
 * Modo estático (GitHub Pages): los mismos servicios de core/ corren en el navegador sobre sql.js.
 * En la primera visita se crean las dos bases con los scripts de Enterprise Architect, el seed y el ETL;
 * después se cargan desde IndexedDB, así lo que haga el visitante se conserva.
 */
export class LocalClient implements ClienteDatos {
  private api!: BetaApi;
  private db!: SqlJsDb;
  private dw!: SqlJsDb;
  private idb: IDBDatabase | null = null;
  private temporizador: ReturnType<typeof setTimeout> | null = null;
  private SQL!: Awaited<ReturnType<typeof initSqlJs>>;

  static async crear(): Promise<LocalClient> {
    const c = new LocalClient();
    c.SQL = await initSqlJs({ locateFile: () => wasmUrl });
    c.idb = await abrirIdb();
    const [bd, dw] = c.idb ? await Promise.all([idbLeer(c.idb, 'bd'), idbLeer(c.idb, 'dw')]) : [null, null];
    if (bd && dw) {
      c.montar(new SqlJsDb(new c.SQL.Database(bd)), new SqlJsDb(new c.SQL.Database(dw)));
      if (!tieneEsquema(c.db, 'Vuelo') || !tieneEsquema(c.dw, 'FactReservas')) await c.crearBases();
    } else {
      await c.crearBases();
    }
    addEventListener('pagehide', () => c.guardarAhora());
    return c;
  }

  private montar(db: SqlJsDb, dw: SqlJsDb) {
    this.db = db;
    this.dw = dw;
    const s = crearServicios({ db, reloj: relojDelSistema, azar: Math.random, pendientes: pendientesNavegador(), kv: kvNavegador }, dw);
    this.api = new BetaApi(s);
    db.onCambio = () => this.programarGuardado();
    dw.onCambio = () => this.programarGuardado();
  }

  private async crearBases() {
    const db = new SqlJsDb(new this.SQL.Database());
    const dw = new SqlJsDb(new this.SQL.Database());
    inicializarBases(db, dw, { sqlBd, sqlDw, ahora: new Date(), kv: kvNavegador });
    ls.escribir('beta.pendientes', null);
    this.montar(db, dw);
    await this.guardarAhora();
  }

  private programarGuardado() {
    if (this.temporizador) clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => void this.guardarAhora(), 400);
  }

  private async guardarAhora() {
    if (this.temporizador) clearTimeout(this.temporizador);
    this.temporizador = null;
    if (!this.idb) return;
    await idbEscribir(this.idb, { bd: this.db.exportar(), dw: this.dw.exportar() });
  }

  private actor(area: 'cliente' | 'empleado'): Actor | null {
    const id = ls.leer(SESION[area]);
    return id ? { tipo: area, id } : null;
  }

  private ejecutar<T>(fn: () => T): Promise<T> {
    try {
      return Promise.resolve(structuredClone(fn()));
    } catch (e) {
      if (e instanceof ErrorNegocio) return Promise.reject(new ErrorDatos(e.message, e.codigo));
      console.error(e);
      return Promise.reject(new ErrorDatos('Tuvimos un problema procesando tu solicitud. Intenta de nuevo.', 500));
    }
  }

  private cli = <T>(fn: (a: Actor | null) => T) => this.ejecutar(() => fn(this.actor('cliente')));
  private emp = <T>(fn: (a: Actor | null) => T) => this.ejecutar(() => fn(this.actor('empleado')));

  private async sesion<T>(area: 'cliente' | 'empleado'): Promise<T | null> {
    const a = this.actor(area);
    if (!a) return null;
    try {
      return (await this.ejecutar(() => this.api.perfil(a))) as T;
    } catch {
      ls.escribir(SESION[area], null);
      return null;
    }
  }

  sesionCliente = () => this.sesion<PerfilCliente>('cliente');
  sesionEmpleado = () => this.sesion<PerfilEmpleado>('empleado');
  ingresarCliente = (documento: string, email: string) =>
    this.ejecutar(() => {
      const p = this.api.ingresarCliente(documento, email);
      ls.escribir(SESION.cliente, p.id);
      return p;
    });
  registrar: ClienteDatos['registrar'] = (r) =>
    this.ejecutar(() => {
      const p = this.api.registrar(r);
      ls.escribir(SESION.cliente, p.id);
      return p;
    });
  ingresarEmpleado = (documento: string) =>
    this.ejecutar(() => {
      const p = this.api.ingresarEmpleado(documento);
      ls.escribir(SESION.empleado, p.id);
      return p;
    });
  salirCliente = async () => ls.escribir(SESION.cliente, null);
  salirEmpleado = async () => ls.escribir(SESION.empleado, null);

  aeropuertos: ClienteDatos['aeropuertos'] = () => this.ejecutar(() => this.api.aeropuertos());
  buscarVuelos: ClienteDatos['buscarVuelos'] = (b) => this.ejecutar(() => this.api.buscarVuelos(b));
  vuelo: ClienteDatos['vuelo'] = (id, clase) => this.ejecutar(() => this.api.vuelo(id, clase));

  crearReserva: ClienteDatos['crearReserva'] = (n) => this.cli((a) => this.api.crearReserva(a, n));
  misReservas: ClienteDatos['misReservas'] = () => this.cli((a) => this.api.misReservas(a));
  reserva: ClienteDatos['reserva'] = (id) => this.cli((a) => this.api.reserva(a, id));
  pagar: ClienteDatos['pagar'] = (id, t) => this.cli((a) => this.api.pagar(a, id, t));
  checkin: ClienteDatos['checkin'] = (id) => this.cli((a) => this.api.checkin(a, id));
  hacerCheckin: ClienteDatos['hacerCheckin'] = (id, d) => this.cli((a) => this.api.hacerCheckin(a, id, d));
  pase: ClienteDatos['pase'] = (id) => this.cli((a) => this.api.pase(a, id));
  misMaletas: ClienteDatos['misMaletas'] = () => this.cli((a) => this.api.misMaletas(a));
  rastrearMaleta: ClienteDatos['rastrearMaleta'] = (e) => this.cli((a) => this.api.rastrearMaleta(a, e));
  skymiles: ClienteDatos['skymiles'] = () => this.cli((a) => this.api.skymiles(a));
  afiliarSkymiles: ClienteDatos['afiliarSkymiles'] = () => this.cli((a) => this.api.afiliarSkymiles(a));
  misCasos: ClienteDatos['misCasos'] = () => this.cli((a) => this.api.misCasos(a));
  abrirCaso: ClienteDatos['abrirCaso'] = (n) => this.cli((a) => this.api.abrirCaso(a, n));

  tablero: ClienteDatos['tablero'] = () => this.emp((a) => this.api.tablero(a));
  vueloOperacion: ClienteDatos['vueloOperacion'] = (id) => this.emp((a) => this.api.vueloOperacion(a, id));
  registrarEtapa: ClienteDatos['registrarEtapa'] = (id) => this.emp((a) => this.api.registrarEtapa(a, id));
  casos: ClienteDatos['casos'] = (estado) => this.emp((a) => this.api.casos(a, estado));
  atenderCaso: ClienteDatos['atenderCaso'] = (id) => this.emp((a) => this.api.atenderCaso(a, id));
  cerrarCaso: ClienteDatos['cerrarCaso'] = (id) => this.emp((a) => this.api.cerrarCaso(a, id));
  flota: ClienteDatos['flota'] = () => this.emp((a) => this.api.flota(a));
  mantenimientos: ClienteDatos['mantenimientos'] = () => this.emp((a) => this.api.mantenimientos(a));
  restablecerDatos = async () => {
    await this.emp((a) => this.api.s.auth.exigirEmpleado(a));
    this.db.close();
    this.dw.close();
    await this.crearBases();
    ls.escribir(SESION.cliente, null);
  };

  estadoDw: ClienteDatos['estadoDw'] = () => this.emp((a) => this.api.estadoDw(a));
  ejecutarEtl: ClienteDatos['ejecutarEtl'] = () => this.emp((a) => this.api.ejecutarEtl(a));
  reporteIngresos: ClienteDatos['reporteIngresos'] = (anio, c) => this.emp((a) => this.api.reporteIngresos(a, anio, c));
  reporteReservas: ClienteDatos['reporteReservas'] = (anio, c) => this.emp((a) => this.api.reporteReservas(a, anio, c));
  reporteMillas: ClienteDatos['reporteMillas'] = (anio, q) => this.emp((a) => this.api.reporteMillas(a, anio, q));
}
