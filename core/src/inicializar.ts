import type { Db } from './db/Db';
import { cargarEsquema } from './db/loadSchema';
import { sembrar, type ResumenSeed } from './seed/seed';
import { crearServicios } from './app';
import { claveValorEnMemoria, pendientesEnMemoria, type AlmacenClaveValor } from './contexto';
import { RelojFijo } from './dominio/fechas';
import type { ResultadoEtl } from './servicios/EtlService';

export interface OpcionesInicializar {
  sqlBd: string;
  sqlDw: string;
  ahora?: Date;
  semilla?: number;
  kv?: AlmacenClaveValor;
}

/** Crea las dos bases vacías desde los scripts de Enterprise Architect, corre el seed y el ETL. */
export function inicializarBases(db: Db, dw: Db, o: OpcionesInicializar): { seed: ResumenSeed; etl: ResultadoEtl } {
  const ahora = o.ahora ?? new Date();
  cargarEsquema(db, o.sqlBd);
  cargarEsquema(dw, o.sqlDw);
  const seed = sembrar(db, { ahora, semilla: o.semilla });
  const s = crearServicios(
    { db, reloj: new RelojFijo(ahora), azar: Math.random, pendientes: pendientesEnMemoria(), kv: o.kv ?? claveValorEnMemoria() },
    dw,
  );
  const etl = s.etl.ejecutar();
  return { seed, etl };
}
