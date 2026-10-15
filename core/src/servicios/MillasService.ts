import type { Contexto } from '../contexto';
import type { Skymiles } from '../api/tipos';
import { ErrorNegocio } from '../errores';
import { generadores, insertar, siguienteId, valorUnico } from '../dominio/ids';
import { NIVELES, nivelPorSaldo, tieneCrownRoom } from '../dominio/reglas';
import { aFecha, aFechaHora } from '../dominio/fechas';

/** Skymiles: cuentas de millas, movimientos y niveles. */
export class MillasService {
  constructor(private ctx: Contexto) {}

  afiliar(idCliente: string): string {
    const db = this.ctx.db;
    return db.transaction(() => {
      if (db.get(`SELECT 1 AS x FROM CuentaMillas WHERE IdCliente = ?`, [idCliente])) {
        throw new ErrorNegocio('Ya eres socio Skymiles.', 409);
      }
      const id = siguienteId(db, 'CuentaMillas');
      insertar(db, 'CuentaMillas', {
        IdCuentaMillas: id,
        NumeroSocio: valorUnico(db, 'CuentaMillas', 'NumeroSocio', () => generadores.numeroSocio(this.ctx.azar)),
        Nivel: 'Azul',
        SaldoMillas: 0,
        FechaAfiliacion: aFecha(this.ctx.reloj.ahora()),
        IdCliente: idCliente,
      });
      return id;
    });
  }

  /** Registra un movimiento y actualiza saldo y nivel de la cuenta. */
  registrarMovimiento(idCuenta: string, tipo: string, millas: number, idTiquete: string | null, fecha = this.ctx.reloj.ahora()) {
    const db = this.ctx.db;
    db.transaction(() => {
      insertar(db, 'MovimientoMillas', {
        IdMovimiento: siguienteId(db, 'MovimientoMillas'),
        Fecha: aFechaHora(fecha),
        Tipo: tipo,
        Millas: millas,
        IdCuentaMillas: idCuenta,
        IdTiquete: idTiquete,
      });
      const c = db.get<{ SaldoMillas: number }>(`SELECT SaldoMillas FROM CuentaMillas WHERE IdCuentaMillas = ?`, [idCuenta])!;
      const saldo = c.SaldoMillas + millas;
      db.run(`UPDATE CuentaMillas SET SaldoMillas = ?, Nivel = ? WHERE IdCuentaMillas = ?`, [saldo, nivelPorSaldo(saldo), idCuenta]);
    });
  }

  /**
   * Acumulación al aterrizar: cada pasajero que abordó (tiquete Abordado) y tiene cuenta Skymiles
   * suma las millas de la ruta. Devuelve cuántos pasajeros acumularon.
   */
  acumularVuelo(idVuelo: string): { pasajeros: number; millas: number } {
    const db = this.ctx.db;
    const filas = db.all<{ IdTiquete: string; IdCuentaMillas: string; DistanciaMillas: number }>(
      `SELECT t.IdTiquete, cm.IdCuentaMillas, ru.DistanciaMillas
       FROM Tiquete t
       JOIN Reserva r       ON r.IdReserva = t.IdReserva
       JOIN Vuelo v         ON v.IdVuelo = r.IdVuelo
       JOIN Ruta ru         ON ru.IdRuta = v.IdRuta
       JOIN CuentaMillas cm ON cm.IdCliente = t.IdCliente
       WHERE r.IdVuelo = ? AND t.Estado = 'Abordado'
         AND NOT EXISTS (SELECT 1 FROM MovimientoMillas m WHERE m.IdTiquete = t.IdTiquete AND m.Tipo = 'Acumulacion')`,
      [idVuelo],
    );
    let millas = 0;
    for (const f of filas) {
      this.registrarMovimiento(f.IdCuentaMillas, 'Acumulacion', f.DistanciaMillas, f.IdTiquete);
      millas += f.DistanciaMillas;
    }
    return { pasajeros: filas.length, millas };
  }

  skymiles(idCliente: string): Skymiles {
    const db = this.ctx.db;
    const c = db.get<any>(`SELECT * FROM CuentaMillas WHERE IdCliente = ?`, [idCliente]);
    if (!c) return { cuenta: null, movimientos: [] };
    const anio = String(this.ctx.reloj.ahora().getFullYear());
    const movs = db.all<any>(
      `SELECT m.Fecha, m.Tipo, m.Millas, v.NumeroVuelo, ao.CodigoIATA AS O, ad.CodigoIATA AS D
       FROM MovimientoMillas m
       LEFT JOIN Tiquete t    ON t.IdTiquete = m.IdTiquete
       LEFT JOIN Reserva r    ON r.IdReserva = t.IdReserva
       LEFT JOIN Vuelo v      ON v.IdVuelo = r.IdVuelo
       LEFT JOIN Ruta ru      ON ru.IdRuta = v.IdRuta
       LEFT JOIN Aeropuerto ao ON ao.IdAeropuerto = ru.IdAeropuertoOrigen
       LEFT JOIN Aeropuerto ad ON ad.IdAeropuerto = ru.IdAeropuertoDestino
       WHERE m.IdCuentaMillas = ?
       ORDER BY m.Fecha DESC, m.IdMovimiento DESC`,
      [c.IdCuentaMillas],
    );
    const delAnio = movs.filter((m) => m.Tipo === 'Acumulacion' && String(m.Fecha).startsWith(anio));
    const sig = NIVELES.find((n) => n.desde > c.SaldoMillas);
    return {
      cuenta: {
        numeroSocio: c.NumeroSocio,
        nivel: c.Nivel,
        saldo: c.SaldoMillas,
        fechaAfiliacion: c.FechaAfiliacion,
        crownRoom: tieneCrownRoom(c.Nivel),
        siguienteNivel: sig ? { nivel: sig.nivel, faltan: sig.desde - c.SaldoMillas } : null,
        millasAnio: delAnio.reduce((s, m) => s + m.Millas, 0),
        vuelosAnio: delAnio.length,
      },
      movimientos: movs.map((m) => ({
        fecha: m.Fecha,
        tipo: m.Tipo,
        millas: m.Millas,
        detalle: m.NumeroVuelo
          ? `Vuelo ${m.NumeroVuelo}, ${m.O} → ${m.D}`
          : m.Tipo === 'Saldo inicial'
            ? 'Saldo de años anteriores'
            : m.Tipo === 'Redencion'
              ? 'Canje de millas'
              : m.Tipo,
      })),
    };
  }
}
