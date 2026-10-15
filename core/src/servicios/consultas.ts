import type { Db, Param } from '../db/Db';
import type { VueloResumen } from '../api/tipos';
import { deTexto } from '../dominio/fechas';
import { noEncontrado } from '../errores';

/** SELECT base con los datos de un vuelo, su ruta, aeropuertos, ciudades y aeronave. */
export const SQL_VUELO = `
SELECT v.IdVuelo, v.NumeroVuelo, v.SalidaProgramada, v.LlegadaProgramada, v.SalidaReal, v.LlegadaReal,
       v.Puerta, v.Estado, v.IdRuta, v.IdAeronave,
       ru.DistanciaMillas, ru.TipoRuta,
       ao.IdAeropuerto AS IdOrigen, ao.CodigoIATA AS CodOrigen, ao.Nombre AS AeroOrigen, co.Nombre AS CiudadOrigen,
       ad.IdAeropuerto AS IdDestino, ad.CodigoIATA AS CodDestino, ad.Nombre AS AeroDestino, cd.Nombre AS CiudadDestino,
       an.Modelo, an.Matricula, an.CapacidadPasajeros
FROM Vuelo v
JOIN Ruta ru        ON ru.IdRuta = v.IdRuta
JOIN Aeropuerto ao  ON ao.IdAeropuerto = ru.IdAeropuertoOrigen
JOIN Ciudad co      ON co.IdCiudad = ao.IdCiudad
JOIN Aeropuerto ad  ON ad.IdAeropuerto = ru.IdAeropuertoDestino
JOIN Ciudad cd      ON cd.IdCiudad = ad.IdCiudad
JOIN Aeronave an    ON an.IdAeronave = v.IdAeronave`;

export interface FilaVuelo {
  IdVuelo: string;
  NumeroVuelo: string;
  SalidaProgramada: string;
  LlegadaProgramada: string;
  SalidaReal: string | null;
  LlegadaReal: string | null;
  Puerta: string | null;
  Estado: string;
  IdRuta: string;
  IdAeronave: string;
  DistanciaMillas: number;
  TipoRuta: string;
  IdOrigen: string;
  CodOrigen: string;
  AeroOrigen: string;
  CiudadOrigen: string;
  IdDestino: string;
  CodDestino: string;
  AeroDestino: string;
  CiudadDestino: string;
  Modelo: string;
  Matricula: string;
  CapacidadPasajeros: number;
}

export function aVueloResumen(f: FilaVuelo): VueloResumen {
  return {
    idVuelo: f.IdVuelo,
    numero: f.NumeroVuelo,
    origen: { codigo: f.CodOrigen, ciudad: f.CiudadOrigen, aeropuerto: f.AeroOrigen },
    destino: { codigo: f.CodDestino, ciudad: f.CiudadDestino, aeropuerto: f.AeroDestino },
    salida: f.SalidaProgramada,
    llegada: f.LlegadaProgramada,
    salidaReal: f.SalidaReal,
    llegadaReal: f.LlegadaReal,
    duracionMin: Math.round((deTexto(f.LlegadaProgramada).getTime() - deTexto(f.SalidaProgramada).getTime()) / 60000),
    distancia: f.DistanciaMillas,
    tipoRuta: f.TipoRuta,
    aeronave: { modelo: f.Modelo, matricula: f.Matricula, capacidad: f.CapacidadPasajeros },
    puerta: f.Puerta,
    estado: f.Estado,
  };
}

export function filaVuelo(db: Db, idVuelo: string): FilaVuelo {
  const f = db.get<FilaVuelo>(`${SQL_VUELO} WHERE v.IdVuelo = ?`, [idVuelo]);
  if (!f) throw noEncontrado('el vuelo');
  return f;
}

export function vuelos(db: Db, where: string, params: Param[] = []): FilaVuelo[] {
  return db.all<FilaVuelo>(`${SQL_VUELO} ${where}`, params);
}

/** Tiquetes vendidos (no anulados) de un vuelo. */
export function tiquetesVendidos(db: Db, idVuelo: string): number {
  return (
    db.get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM Tiquete t JOIN Reserva r ON r.IdReserva = t.IdReserva
       WHERE r.IdVuelo = ? AND t.Estado <> 'Anulado'`,
      [idVuelo],
    )?.n ?? 0
  );
}

export const nombreCompleto = (r: { Nombres: string; Apellidos: string }) => `${r.Nombres} ${r.Apellidos}`;
