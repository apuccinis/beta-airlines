import type { Contexto } from '../contexto';
import type { DatosTarjeta, ReservaDetalle } from '../api/tipos';
import { ErrorNegocio, noEncontrado } from '../errores';
import { generadores, insertar, siguienteId } from '../dominio/ids';
import { ESTADO_RESERVA, liquidar, tarifa } from '../dominio/reglas';
import { aFechaHora, deTexto } from '../dominio/fechas';
import type { Azar } from '../dominio/azar';
import { filaVuelo, tiquetesVendidos } from './consultas';
import type { ReservasService } from './ReservasService';
import type { FacturacionService } from './FacturacionService';

export interface RespuestaPasarela {
  aprobado: boolean;
  referencia: string;
  mensaje: string;
}

/**
 * Pasarela de pagos SIMULADA (no hay integración con un banco real).
 * Aprueba toda tarjeta con número válido (13 a 19 dígitos) excepto las que terminan en 0000,
 * que el "banco" rechaza. Siempre devuelve una referencia con el formato de la pasarela (PSX-########).
 */
export class PasarelaSimulada {
  constructor(private azar: Azar) {}
  autorizar(t: DatosTarjeta, _valor: number): RespuestaPasarela {
    const referencia = generadores.referenciaPago(this.azar);
    if (t.numero.endsWith('0000')) {
      return { aprobado: false, referencia, mensaje: 'Tu banco rechazó la transacción. Intenta con otra tarjeta o comunícate con tu banco.' };
    }
    return { aprobado: true, referencia, mensaje: 'Transacción aprobada' };
  }
}

export function validarTarjeta(t: DatosTarjeta, hoy: Date): DatosTarjeta {
  const numero = String(t?.numero ?? '').replace(/[\s-]/g, '');
  const titular = String(t?.titular ?? '').trim();
  const venc = String(t?.vencimiento ?? '').trim();
  const cvv = String(t?.cvv ?? '').trim();
  if (!/^\d{13,19}$/.test(numero)) throw new ErrorNegocio('El número de la tarjeta no es válido.');
  if (titular.length < 3) throw new ErrorNegocio('Escribe el nombre del titular como aparece en la tarjeta.');
  const m = venc.match(/^(\d{2})\s*\/\s*(\d{2})$/);
  if (!m || +m[1] < 1 || +m[1] > 12) throw new ErrorNegocio('La fecha de vencimiento debe tener el formato MM/AA.');
  const fin = new Date(2000 + +m[2], +m[1], 1); // primer día del mes siguiente al vencimiento
  if (fin <= hoy) throw new ErrorNegocio('La tarjeta está vencida.');
  if (!/^\d{3,4}$/.test(cvv)) throw new ErrorNegocio('El código de seguridad (CVV) no es válido.');
  return { numero, titular, vencimiento: venc, cvv };
}

export const marcaTarjeta = (numero: string) =>
  /^4/.test(numero) ? 'Visa' : /^(5[1-5]|2[2-7])/.test(numero) ? 'Mastercard' : /^3[47]/.test(numero) ? 'American Express' : 'Tarjeta';

export class PagosService {
  readonly pasarela: PasarelaSimulada;

  constructor(
    private ctx: Contexto,
    private reservas: ReservasService,
    private facturacion: FacturacionService,
  ) {
    this.pasarela = new PasarelaSimulada(ctx.azar);
  }

  /**
   * Paga una reserva pendiente. Si la pasarela aprueba, en una sola transacción:
   * Factura, Pago (Aprobado), un Tiquete por pasajero y Reserva → Confirmada.
   * Si el banco rechaza, queda registrado el Pago (Rechazado) y la reserva sigue pendiente.
   */
  pagar(idCliente: string, idReserva: string, tarjeta: DatosTarjeta): ReservaDetalle {
    const db = this.ctx.db;
    const r = db.get<any>(`SELECT * FROM Reserva WHERE IdReserva = ? AND IdCliente = ?`, [idReserva, idCliente]);
    if (!r) throw noEncontrado('la reserva');
    if (r.Estado === ESTADO_RESERVA.confirmada) throw new ErrorNegocio('Esta reserva ya está pagada.', 409);
    if (r.Estado !== ESTADO_RESERVA.pendiente) throw new ErrorNegocio(`La reserva está ${r.Estado.toLowerCase()} y no se puede pagar.`, 409);

    const pendiente = this.ctx.pendientes.leer(idReserva);
    if (!pendiente) {
      this.reservas.detalle(idReserva, idCliente); // la marca como cancelada
      throw new ErrorNegocio('El tiempo para pagar esta reserva terminó. Haz una nueva búsqueda para reservar.', 409);
    }

    const t = validarTarjeta(tarjeta, this.ctx.reloj.ahora());
    const f = filaVuelo(db, r.IdVuelo);
    if (f.Estado !== 'Programado' && f.Estado !== 'Recursos asignados' && f.Estado !== 'En preparación') {
      throw new ErrorNegocio('Este vuelo ya no está disponible para la venta.', 409);
    }
    const unitario = tarifa(f.DistanciaMillas, deTexto(f.SalidaProgramada).getMonth(), pendiente.clase);
    const liq = liquidar(unitario, pendiente.pasajeros.length);
    const medio = `${marcaTarjeta(t.numero)} ${t.numero.slice(-4)}`.slice(0, 20);

    const respuesta = this.pasarela.autorizar(t, liq.total);

    if (!respuesta.aprobado) {
      db.transaction(() => {
        const idFactura = this.facturacion.facturar(idReserva, liq);
        this.registrarPago(idFactura, liq.total, medio, 'Rechazado', respuesta.referencia);
      });
      throw new ErrorNegocio(respuesta.mensaje, 422);
    }

    db.transaction(() => {
      if (tiquetesVendidos(db, f.IdVuelo) + pendiente.pasajeros.length > f.CapacidadPasajeros) {
        throw new ErrorNegocio('Se agotaron las sillas de este vuelo mientras completabas el pago. No se hizo ningún cobro.', 409);
      }
      const idFactura = this.facturacion.facturar(idReserva, liq);
      this.registrarPago(idFactura, liq.total, medio, 'Aprobado', respuesta.referencia);
      this.reservas.emitirTiquetes(idReserva, pendiente.clase, pendiente.pasajeros, unitario);
      db.run(`UPDATE Reserva SET Estado = ? WHERE IdReserva = ?`, [ESTADO_RESERVA.confirmada, idReserva]);
    });
    this.ctx.pendientes.borrar(idReserva);
    return this.reservas.detalle(idReserva, idCliente);
  }

  private registrarPago(idFactura: string, valor: number, medio: string, estado: string, referencia: string) {
    insertar(this.ctx.db, 'Pago', {
      IdPago: siguienteId(this.ctx.db, 'Pago'),
      FechaPago: aFechaHora(this.ctx.reloj.ahora()),
      Valor: valor,
      MedioPago: medio,
      Estado: estado,
      Referencia: referencia,
      IdFactura: idFactura,
    });
  }
}
