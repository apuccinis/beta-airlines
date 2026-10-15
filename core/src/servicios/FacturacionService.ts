import type { Contexto } from '../contexto';
import type { FacturaInfo } from '../api/tipos';
import { insertar, numeroFactura, siguienteId } from '../dominio/ids';
import { aFechaHora } from '../dominio/fechas';

/** Facturación electrónica de las reservas. */
export class FacturacionService {
  constructor(private ctx: Contexto) {}

  /** Devuelve la factura de la reserva o la crea con la liquidación indicada. */
  facturar(idReserva: string, liq: { subtotal: number; impuestos: number; total: number }): string {
    const db = this.ctx.db;
    const ex = db.get<{ IdFactura: string }>(`SELECT IdFactura FROM Factura WHERE IdReserva = ?`, [idReserva]);
    if (ex) return ex.IdFactura;
    const id = siguienteId(db, 'Factura');
    insertar(db, 'Factura', {
      IdFactura: id,
      NumeroFactura: numeroFactura(id),
      FechaEmision: aFechaHora(this.ctx.reloj.ahora()),
      Subtotal: liq.subtotal,
      Impuestos: liq.impuestos,
      Total: liq.total,
      IdReserva: idReserva,
    });
    return id;
  }

  facturaDeReserva(idReserva: string): FacturaInfo | null {
    const db = this.ctx.db;
    const f = db.get<any>(`SELECT * FROM Factura WHERE IdReserva = ?`, [idReserva]);
    if (!f) return null;
    const pagos = db.all<any>(`SELECT * FROM Pago WHERE IdFactura = ? ORDER BY FechaPago, IdPago`, [f.IdFactura]);
    return {
      numero: f.NumeroFactura,
      fecha: f.FechaEmision,
      subtotal: f.Subtotal,
      impuestos: f.Impuestos,
      total: f.Total,
      pagos: pagos.map((p) => ({ referencia: p.Referencia, estado: p.Estado, valor: p.Valor, medio: p.MedioPago, fecha: p.FechaPago })),
    };
  }
}
