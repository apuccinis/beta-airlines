import type { Contexto } from '../contexto';
import type { CargaDw, DwRepository } from '../dw/DwRepository';
import { MESES, aFecha, aFechaHora, deTexto, sumarDias } from '../dominio/fechas';

const CLAVE_ULTIMA_CARGA = 'dw.ultimaCarga';
const idTiempo = (fecha: string) => Number(fecha.slice(0, 10).replace(/-/g, ''));

export interface ResultadoEtl {
  fecha: string;
  filas: Record<keyof CargaDw, number>;
  ms: number;
}

/** ETL: vacía y recarga el data warehouse a partir de la base operacional. */
export class EtlService {
  constructor(
    private ctx: Contexto,
    private dw: DwRepository,
  ) {}

  ultimaCarga(): string | null {
    return this.ctx.kv.leer(CLAVE_ULTIMA_CARGA);
  }

  extraer(): CargaDw {
    const db = this.ctx.db;

    // DimTiempo: un registro por día del rango de fechas presente en los hechos
    const rango = db.get<{ mn: string | null; mx: string | null }>(
      `SELECT MIN(d) AS mn, MAX(d) AS mx FROM (
         SELECT date(FechaReserva) AS d FROM Reserva
         UNION SELECT date(FechaEmision) FROM Tiquete
         UNION SELECT date(Fecha) FROM MovimientoMillas WHERE Tipo = 'Acumulacion')`,
    )!;
    const DimTiempo: CargaDw['DimTiempo'] = [];
    if (rango.mn && rango.mx) {
      for (let d = deTexto(rango.mn); d <= deTexto(rango.mx); d = sumarDias(d, 1)) {
        const f = aFecha(d);
        DimTiempo.push({
          IdTiempo: idTiempo(f),
          Fecha: f,
          Anio: d.getFullYear(),
          Trimestre: Math.floor(d.getMonth() / 3) + 1,
          Mes: d.getMonth() + 1,
          NombreMes: MESES[d.getMonth()],
          Dia: d.getDate(),
        });
      }
    }

    const ciudad = new Map<string, number>();
    const DimCiudad = db
      .all<any>(`SELECT IdCiudad, Nombre, EstadoRegion, Pais FROM Ciudad ORDER BY IdCiudad`)
      .map((c, i) => {
        ciudad.set(c.IdCiudad, i + 1);
        return { IdCiudadDW: i + 1, IdCiudad: c.IdCiudad, Ciudad: c.Nombre, EstadoRegion: c.EstadoRegion, Pais: c.Pais };
      });

    const cliente = new Map<string, number>();
    const DimCliente = db
      .all<any>(
        `SELECT c.IdCliente, c.Nombres || ' ' || c.Apellidos AS NombreCompleto,
                COALESCE(cm.Nivel, 'Sin afiliar') AS NivelSocio, ci.Nombre AS CiudadResidencia
         FROM Cliente c
         JOIN Ciudad ci ON ci.IdCiudad = c.IdCiudad
         LEFT JOIN CuentaMillas cm ON cm.IdCliente = c.IdCliente
         ORDER BY c.IdCliente`,
      )
      .map((c, i) => {
        cliente.set(c.IdCliente, i + 1);
        return { IdClienteDW: i + 1, ...c };
      });

    const canal = new Map<string, number>();
    const DimCanal = db.all<{ Canal: string }>(`SELECT DISTINCT Canal FROM Reserva ORDER BY Canal`).map((c, i) => {
      canal.set(c.Canal, i + 1);
      return { IdCanal: i + 1, Canal: c.Canal };
    });

    const ruta = new Map<string, number>();
    const DimRuta = db
      .all<any>(
        `SELECT r.IdRuta, co.Nombre AS CiudadOrigen, cd.Nombre AS CiudadDestino, r.TipoRuta, r.DistanciaMillas
         FROM Ruta r
         JOIN Aeropuerto ao ON ao.IdAeropuerto = r.IdAeropuertoOrigen JOIN Ciudad co ON co.IdCiudad = ao.IdCiudad
         JOIN Aeropuerto ad ON ad.IdAeropuerto = r.IdAeropuertoDestino JOIN Ciudad cd ON cd.IdCiudad = ad.IdCiudad
         ORDER BY r.IdRuta`,
      )
      .map((r, i) => {
        ruta.set(r.IdRuta, i + 1);
        return { IdRutaDW: i + 1, ...r };
      });

    const joinVuelo = `
      JOIN Vuelo v ON v.IdVuelo = r.IdVuelo
      JOIN Ruta ru ON ru.IdRuta = v.IdRuta
      JOIN Aeropuerto ao ON ao.IdAeropuerto = ru.IdAeropuertoOrigen
      JOIN Aeropuerto ad ON ad.IdAeropuerto = ru.IdAeropuertoDestino`;

    const FactVentaTiquetes = db
      .all<any>(
        `SELECT t.FechaEmision, ao.IdCiudad AS Origen, ad.IdCiudad AS Destino, t.IdCliente, r.Canal, t.Valor
         FROM Tiquete t JOIN Reserva r ON r.IdReserva = t.IdReserva ${joinVuelo}
         WHERE t.Estado <> 'Anulado' ORDER BY t.IdTiquete`,
      )
      .map((x, i) => ({
        IdVenta: i + 1,
        IdTiempo: idTiempo(x.FechaEmision),
        IdCiudadOrigen: ciudad.get(x.Origen)!,
        IdCiudadDestino: ciudad.get(x.Destino)!,
        IdClienteDW: cliente.get(x.IdCliente)!,
        IdCanal: canal.get(x.Canal)!,
        CantidadTiquetes: 1,
        ValorVenta: x.Valor,
      }));

    const FactReservas = db
      .all<any>(
        `SELECT r.FechaReserva, ao.IdCiudad AS Origen, ad.IdCiudad AS Destino, r.IdCliente, r.Canal, r.NumeroPasajeros
         FROM Reserva r ${joinVuelo} ORDER BY r.IdReserva`,
      )
      .map((x, i) => ({
        IdReservaDW: i + 1,
        IdTiempo: idTiempo(x.FechaReserva),
        IdCiudadOrigen: ciudad.get(x.Origen)!,
        IdCiudadDestino: ciudad.get(x.Destino)!,
        IdClienteDW: cliente.get(x.IdCliente)!,
        IdCanal: canal.get(x.Canal)!,
        CantidadReservas: 1,
        NumeroPasajeros: x.NumeroPasajeros,
      }));

    const FactMillasPasajero = db
      .all<any>(
        `SELECT m.Fecha, cm.IdCliente, v.IdRuta, m.Millas
         FROM MovimientoMillas m
         JOIN CuentaMillas cm ON cm.IdCuentaMillas = m.IdCuentaMillas
         JOIN Tiquete t ON t.IdTiquete = m.IdTiquete
         JOIN Reserva r ON r.IdReserva = t.IdReserva
         JOIN Vuelo v ON v.IdVuelo = r.IdVuelo
         WHERE m.Tipo = 'Acumulacion' ORDER BY m.IdMovimiento`,
      )
      .map((x, i) => ({
        IdMillas: i + 1,
        IdTiempo: idTiempo(x.Fecha),
        IdClienteDW: cliente.get(x.IdCliente)!,
        IdRutaDW: ruta.get(x.IdRuta)!,
        CantidadVuelos: 1,
        MillasAcumuladas: x.Millas,
      }));

    return { DimTiempo, DimCiudad, DimCliente, DimCanal, DimRuta, FactVentaTiquetes, FactReservas, FactMillasPasajero };
  }

  ejecutar(): ResultadoEtl {
    const t0 = Date.now();
    const carga = this.extraer();
    this.dw.reemplazarTodo(carga);
    const fecha = aFechaHora(this.ctx.reloj.ahora());
    this.ctx.kv.guardar(CLAVE_ULTIMA_CARGA, fecha);
    const filas = Object.fromEntries(Object.entries(carga).map(([k, v]) => [k, v.length])) as ResultadoEtl['filas'];
    return { fecha, filas, ms: Date.now() - t0 };
  }

  /** true si el DW no tiene datos (se usa al iniciar el servidor). */
  dwVacio(): boolean {
    return this.dw.conteos().every((c) => c.filas === 0);
  }
}
