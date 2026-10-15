import type { Contexto } from '../contexto';
import { aFechaHora } from '../dominio/fechas';

/** Embarque: registra el abordaje de los pasajeros que hicieron check-in. */
export class EmbarqueService {
  constructor(private ctx: Contexto) {}

  /** Pasajeros con check-in → FechaEmbarque, PuertaEmbarque y Tiquete.Estado = 'Abordado'. Devuelve cuántos abordaron. */
  embarcar(idVuelo: string, puerta: string | null, fecha = this.ctx.reloj.ahora()): number {
    const db = this.ctx.db;
    const filas = db.all<{ IdCheckin: string; IdTiquete: string }>(
      `SELECT ck.IdCheckin, t.IdTiquete FROM Checkin ck
       JOIN Tiquete t ON t.IdTiquete = ck.IdTiquete
       JOIN Reserva r ON r.IdReserva = t.IdReserva
       WHERE r.IdVuelo = ? AND t.Estado = 'Emitido'`,
      [idVuelo],
    );
    const f = aFechaHora(fecha);
    for (const x of filas) {
      db.run(`UPDATE Checkin SET FechaEmbarque = ?, PuertaEmbarque = ? WHERE IdCheckin = ?`, [f, puerta, x.IdCheckin]);
      db.run(`UPDATE Tiquete SET Estado = 'Abordado' WHERE IdTiquete = ?`, [x.IdTiquete]);
    }
    return filas.length;
  }
}
