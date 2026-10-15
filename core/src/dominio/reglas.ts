/** Reglas de negocio de Beta Airlines. */

export const TEMPORADA = [1, 0.92, 1, 1.03, 1.05, 1.18, 1.22, 1.12, 0.95, 0.98, 1.06, 1.2];

export const CLASES = ['Económica', 'Premium', 'Ejecutiva'] as const;
export type Clase = (typeof CLASES)[number];
export const FACTOR_CLASE: Record<Clase, number> = { Económica: 1, Premium: 1.7, Ejecutiva: 3.2 };
export const esClase = (c: unknown): c is Clase => CLASES.includes(c as Clase);

export const IMPUESTOS = 0.075;
export const redondear = (v: number) => Math.round(v * 100) / 100;

/** Tarifa por persona (USD) = (49 + millas × 0.14) × temporada del mes de salida × factor de clase. */
export function tarifa(distanciaMillas: number, mesSalida0: number, clase: Clase): number {
  return redondear((49 + distanciaMillas * 0.14) * TEMPORADA[mesSalida0] * FACTOR_CLASE[clase]);
}

/** Subtotal, impuestos (7,5 %) y total de una compra. */
export function liquidar(valorUnitario: number, pasajeros: number) {
  const subtotal = redondear(valorUnitario * pasajeros);
  const impuestos = redondear(subtotal * IMPUESTOS);
  return { subtotal, impuestos, total: redondear(subtotal + impuestos) };
}

/** Duración ≈ distancia / 470 mph + 30 min. */
export const duracionMinutos = (millas: number) => Math.round((millas / 470) * 60 + 30);

export function nivelPorSaldo(saldo: number): string {
  return saldo >= 60000 ? 'Platino' : saldo >= 30000 ? 'Oro' : saldo >= 12000 ? 'Plata' : 'Azul';
}
export const NIVELES = [
  { nivel: 'Azul', desde: 0 },
  { nivel: 'Plata', desde: 12000 },
  { nivel: 'Oro', desde: 30000 },
  { nivel: 'Platino', desde: 60000 },
] as const;
export const tieneCrownRoom = (nivel: string) => nivel === 'Oro' || nivel === 'Platino';

export const ESTADO_RESERVA = {
  pendiente: 'Pendiente de pago',
  confirmada: 'Confirmada',
  completada: 'Completada',
  cancelada: 'Cancelada',
} as const;
export const ESTADO_TIQUETE = { emitido: 'Emitido', abordado: 'Abordado', volado: 'Volado', anulado: 'Anulado' } as const;
export const ESTADOS_VUELO = [
  'Programado', 'Recursos asignados', 'En preparación', 'Abordando',
  'En vuelo', 'Aterrizado', 'Descargando', 'Finalizado',
] as const;
export const CANALES_RESERVA = ['Web', 'App', 'Agente de viajes', 'Call center', 'Mostrador'] as const;
export const CANALES_CHECKIN = ['Web', 'App', 'Kiosko', 'Mostrador'] as const;
export const TIPOS_CASO = ['Equipaje demorado', 'Cambio de vuelo', 'Reembolso', 'Queja de servicio', 'Solicitud de asistencia'] as const;

/** Las 8 etapas del pipeline operacional (EventoVuelo.TipoEvento) y el estado en que dejan el vuelo. */
export const ETAPAS = [
  { tipo: 'Asignar recursos', diagrama: 'Allocate Resources', estado: 'Recursos asignados' },
  { tipo: 'Preparar salida', diagrama: 'Prepare for Flight Departure', estado: 'En preparación' },
  { tipo: 'Cargar aeronave', diagrama: 'Load Aircraft', estado: 'Abordando' },
  { tipo: 'Despegue y cierre', diagrama: 'Flight Departure and Closeout', estado: 'En vuelo' },
  { tipo: 'Monitorear vuelo', diagrama: 'Monitor Flight', estado: 'En vuelo' },
  { tipo: 'Llegada y cierre', diagrama: 'Flight Arrival and Closeout', estado: 'Aterrizado' },
  { tipo: 'Descargar aeronave', diagrama: 'Unload Aircraft', estado: 'Descargando' },
  { tipo: 'Limpiar y alistar', diagrama: 'Clean / Service Aircraft', estado: 'Finalizado' },
] as const;

/** Estados del vuelo en los que ya no se permite check-in. */
export const VUELO_YA_SALIO = ['En vuelo', 'Aterrizado', 'Descargando', 'Finalizado'];
/** Estados del vuelo en los que el check-in ya cerró (abordaje en curso o vuelo salido). */
export const CHECKIN_CERRADO = ['Abordando', ...VUELO_YA_SALIO];

/** Hora de embarque = salida − 40 min. */
export const MINUTOS_EMBARQUE = 40;

/** Cargos con acceso al portal interno y las secciones que ve cada uno. */
export const SECCIONES_POR_CARGO: Record<string, string[]> = {
  'Coordinador de operaciones': ['tablero', 'servicio', 'flota', 'analitica'],
  Despachador: ['tablero', 'flota'],
  'Agente de servicio al cliente': ['servicio'],
  'Técnico de mantenimiento': ['flota'],
  'Analista de datos': ['analitica'],
};

/** Distribución de sillas: 6 por fila (A–F). Las primeras filas son Ejecutiva, luego Premium y el resto Económica. */
export const LETRAS_SILLA = ['A', 'B', 'C', 'D', 'E', 'F'];
export function configuracionCabina(capacidad: number) {
  const filas = Math.ceil(capacidad / LETRAS_SILLA.length);
  const ejecutiva = Math.max(2, Math.round(filas * 0.08));
  const premium = Math.max(3, Math.round(filas * 0.15));
  const claseDeFila = (fila: number): Clase =>
    fila <= ejecutiva ? 'Ejecutiva' : fila <= ejecutiva + premium ? 'Premium' : 'Económica';
  const sillas: string[] = [];
  for (let f = 1; f <= filas; f++) for (const l of LETRAS_SILLA) if (sillas.length < capacidad) sillas.push(`${f}${l}`);
  return { filas, letras: LETRAS_SILLA, claseDeFila, sillas };
}
export const filaDeSilla = (silla: string) => parseInt(silla, 10);
