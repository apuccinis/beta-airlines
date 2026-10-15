import type { Db } from './db/Db';
import type { Reloj } from './dominio/fechas';
import type { Azar } from './dominio/azar';
import type { Clase } from './dominio/reglas';

/**
 * Datos de una reserva mientras está pendiente de pago: la clase elegida y los pasajeros.
 * El modelo no tiene columnas para esto, así que se guarda fuera de la base:
 * en memoria del servidor (modo completo) o en el almacenamiento del navegador (modo estático).
 */
export interface ReservaPendiente {
  clase: Clase;
  pasajeros: string[]; // IdCliente de cada pasajero, el titular primero
}

export interface AlmacenPendientes {
  leer(idReserva: string): ReservaPendiente | undefined;
  guardar(idReserva: string, datos: ReservaPendiente): void;
  borrar(idReserva: string): void;
}

/** Almacén clave-valor pequeño para metadatos que no pertenecen al modelo (p. ej. la fecha de la última carga del DW). */
export interface AlmacenClaveValor {
  leer(clave: string): string | null;
  guardar(clave: string, valor: string): void;
}

export function pendientesEnMemoria(): AlmacenPendientes {
  const m = new Map<string, ReservaPendiente>();
  return {
    leer: (id) => m.get(id),
    guardar: (id, d) => void m.set(id, d),
    borrar: (id) => void m.delete(id),
  };
}

export function claveValorEnMemoria(): AlmacenClaveValor {
  const m = new Map<string, string>();
  return { leer: (k) => m.get(k) ?? null, guardar: (k, v) => void m.set(k, v) };
}

export interface Contexto {
  db: Db;
  reloj: Reloj;
  azar: Azar;
  pendientes: AlmacenPendientes;
  kv: AlmacenClaveValor;
}
