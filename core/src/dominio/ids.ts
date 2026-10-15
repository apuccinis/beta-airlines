import type { Db, Param } from '../db/Db';
import { digitos, type Azar } from './azar';

/** Prefijos de los IDs CHAR(10): 2 letras + 8 dígitos. */
export const TABLAS = {
  Ciudad: ['CI', 'IdCiudad'],
  Aeropuerto: ['AP', 'IdAeropuerto'],
  Departamento: ['DP', 'IdDepartamento'],
  Empleado: ['EM', 'IdEmpleado'],
  Cliente: ['CL', 'IdCliente'],
  Ruta: ['RU', 'IdRuta'],
  Vuelo: ['VU', 'IdVuelo'],
  Aeronave: ['AN', 'IdAeronave'],
  Equipo: ['EQ', 'IdEquipo'],
  Mantenimiento: ['MT', 'IdMantenimiento'],
  AsignacionTripulacion: ['AT', 'IdAsignacion'],
  EventoVuelo: ['EV', 'IdEvento'],
  Reserva: ['RS', 'IdReserva'],
  Tiquete: ['TQ', 'IdTiquete'],
  Factura: ['FA', 'IdFactura'],
  Pago: ['PG', 'IdPago'],
  Checkin: ['CK', 'IdCheckin'],
  Equipaje: ['EJ', 'IdEquipaje'],
  RastreoEquipaje: ['RE', 'IdRastreo'],
  CuentaMillas: ['CM', 'IdCuentaMillas'],
  MovimientoMillas: ['MM', 'IdMovimiento'],
  CasoServicio: ['CS', 'IdCaso'],
} as const;
export type Tabla = keyof typeof TABLAS;

export const formatoId = (tabla: Tabla, n: number) => TABLAS[tabla][0] + String(n).padStart(8, '0');

/** Siguiente ID de una tabla a partir del máximo existente. */
export function siguienteId(db: Db, tabla: Tabla): string {
  const [, pk] = TABLAS[tabla];
  const r = db.get<{ m: string | null }>(`SELECT MAX(${pk}) AS m FROM ${tabla}`);
  const n = r?.m ? parseInt(r.m.slice(2), 10) : 0;
  return formatoId(tabla, n + 1);
}

/** Inserta una fila a partir de un objeto columna → valor. */
export function insertar(db: Db, tabla: string, fila: Record<string, Param>) {
  const cols = Object.keys(fila);
  db.run(
    `INSERT INTO ${tabla} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
    cols.map((c) => fila[c]),
  );
}

/** Código de reserva: 6 caracteres en mayúscula sin ambiguos (sin 0/O, 1/I/L). */
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function codigoReserva(azar: Azar) {
  let s = '';
  for (let i = 0; i < 6; i++) s += ALFABETO[Math.floor(azar() * ALFABETO.length)];
  return s;
}

/** Genera un valor que no exista en la columna indicada. */
export function valorUnico(db: Db, tabla: string, columna: string, generar: () => string): string {
  for (let i = 0; i < 50; i++) {
    const v = generar();
    if (!db.get(`SELECT 1 AS x FROM ${tabla} WHERE ${columna} = ?`, [v])) return v;
  }
  throw new Error(`No se pudo generar un valor único para ${tabla}.${columna}`);
}

export const generadores = {
  numeroTiquete: (azar: Azar) => '777' + digitos(azar, 10),
  etiqueta: (azar: Azar) => 'BA' + digitos(azar, 8),
  numeroSocio: (azar: Azar) => 'BA' + digitos(azar, 9),
  referenciaPago: (azar: Azar) => 'PSX-' + digitos(azar, 8),
};
export const numeroFactura = (idFactura: string) => 'FE-' + idFactura.slice(2);
