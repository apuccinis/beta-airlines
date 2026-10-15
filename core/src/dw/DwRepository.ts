import type { DimensionCiudad } from '../api/tipos';

/** Filas que el ETL carga en el data warehouse (una propiedad por tabla del modelo TablesDW.sql). */
export interface CargaDw {
  DimTiempo: { IdTiempo: number; Fecha: string; Anio: number; Trimestre: number; Mes: number; NombreMes: string; Dia: number }[];
  DimCiudad: { IdCiudadDW: number; IdCiudad: string; Ciudad: string; EstadoRegion: string; Pais: string }[];
  DimCliente: { IdClienteDW: number; IdCliente: string; NombreCompleto: string; NivelSocio: string; CiudadResidencia: string }[];
  DimCanal: { IdCanal: number; Canal: string }[];
  DimRuta: { IdRutaDW: number; IdRuta: string; CiudadOrigen: string; CiudadDestino: string; TipoRuta: string; DistanciaMillas: number }[];
  FactVentaTiquetes: {
    IdVenta: number; IdTiempo: number; IdCiudadOrigen: number; IdCiudadDestino: number;
    IdClienteDW: number; IdCanal: number; CantidadTiquetes: number; ValorVenta: number;
  }[];
  FactReservas: {
    IdReservaDW: number; IdTiempo: number; IdCiudadOrigen: number; IdCiudadDestino: number;
    IdClienteDW: number; IdCanal: number; CantidadReservas: number; NumeroPasajeros: number;
  }[];
  FactMillasPasajero: {
    IdMillas: number; IdTiempo: number; IdClienteDW: number; IdRutaDW: number; CantidadVuelos: number; MillasAcumuladas: number;
  }[];
}

export const TABLAS_DW = [
  'DimTiempo', 'DimCiudad', 'DimCliente', 'DimCanal', 'DimRuta',
  'FactVentaTiquetes', 'FactReservas', 'FactMillasPasajero',
] as const;
export type TablaDw = (typeof TABLAS_DW)[number];

export interface FilaMesCiudad {
  Mes: number;
  Ciudad: string;
  Valor: number;
  Valor2: number;
}

export interface FilaMesPasajero {
  Mes: number;
  IdClienteDW: number;
  NombreCompleto: string;
  NivelSocio: string;
  Millas: number;
  Vuelos: number;
}

/**
 * Acceso al data warehouse. Hoy la implementación es SqliteDwRepository.
 * Si el DW se migra a Snowflake, basta con agregar en server/ una clase SnowflakeDwRepository
 * que implemente esta interfaz (con el conector oficial snowflake-sdk) e inyectarla en crearServicios;
 * el ETL y la analítica no cambian.
 */
export interface DwRepository {
  /** Vacía todas las tablas y carga los datos nuevos en una sola transacción. */
  reemplazarTodo(carga: CargaDw): void;
  conteos(): { tabla: TablaDw; filas: number }[];
  anios(): number[];
  primerasFilas(tabla: TablaDw, n: number): Record<string, unknown>[];
  /** 4a. Ingresos por venta de tiquetes por mes y ciudad. */
  ingresosPorMesYCiudad(anio: number, dimension: DimensionCiudad): FilaMesCiudad[];
  /** 4b. Número de reservas por mes y ciudad. */
  reservasPorMesYCiudad(anio: number, dimension: DimensionCiudad): FilaMesCiudad[];
  /** 4c. Millas acumuladas por pasajero en vuelos nacionales, por mes. */
  millasNacionalesPorMes(anio: number, busqueda?: string): FilaMesPasajero[];
  /** Texto SQL de cada consulta, para mostrarlo junto al reporte. */
  sql(reporte: '4a' | '4b' | '4c', dimension?: DimensionCiudad): string;
}
