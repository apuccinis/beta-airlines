import type { Contexto } from '../contexto';
import type { CheckinInfo, PaseAbordar, TiqueteInfo } from '../api/tipos';
import { ErrorNegocio, noEncontrado } from '../errores';
import { insertar, siguienteId } from '../dominio/ids';
import { CANALES_CHECKIN, CHECKIN_CERRADO, MINUTOS_EMBARQUE, configuracionCabina, filaDeSilla, type Clase } from '../dominio/reglas';
import { aFechaHora, deTexto, sumarMinutos } from '../dominio/fechas';
import { aVueloResumen, filaVuelo, nombreCompleto, type FilaVuelo } from './consultas';
import { EquipajeService, PESO_MAXIMO_KG } from './EquipajeService';

/** Check-in por tiquete: silla, maletas y pase de abordar. */
export class CheckinService {
  constructor(
    private ctx: Contexto,
    private equipaje: EquipajeService,
  ) {}

  private tiquete(idTiquete: string, idCliente: string | null) {
    const t = this.ctx.db.get<any>(
      `SELECT t.*, c.Nombres, c.Apellidos, c.Documento, r.CodigoReserva, r.IdVuelo, r.Estado AS EstadoReserva, r.IdCliente AS Titular,
              ck.FechaHora AS Checkin, (SELECT COUNT(*) FROM Equipaje e WHERE e.IdTiquete = t.IdTiquete) AS Maletas
       FROM Tiquete t JOIN Cliente c ON c.IdCliente = t.IdCliente
       JOIN Reserva r ON r.IdReserva = t.IdReserva
       LEFT JOIN Checkin ck ON ck.IdTiquete = t.IdTiquete
       WHERE t.IdTiquete = ?`,
      [idTiquete],
    );
    if (!t || (idCliente && t.IdCliente !== idCliente && t.Titular !== idCliente)) throw noEncontrado('el tiquete');
    return t;
  }

  private aTiqueteInfo(t: any): TiqueteInfo {
    return {
      idTiquete: t.IdTiquete,
      numero: t.NumeroTiquete,
      pasajero: nombreCompleto(t),
      documento: t.Documento,
      clase: t.Clase,
      asiento: t.Asiento,
      valor: t.Valor,
      estado: t.Estado,
      checkin: t.Checkin,
      maletas: t.Maletas,
    };
  }

  /** Motivo por el que no se puede hacer check-in, o null si está abierto. */
  private motivoCerrado(t: any, f: FilaVuelo): string | null {
    if (t.EstadoReserva !== 'Confirmada') return 'La reserva no está confirmada.';
    if (t.Estado !== 'Emitido') return `El tiquete está ${t.Estado.toLowerCase()}.`;
    if (CHECKIN_CERRADO.includes(f.Estado) || f.SalidaReal) return 'El check-in de este vuelo ya cerró.';
    if (deTexto(f.SalidaProgramada) <= this.ctx.reloj.ahora()) return 'El vuelo ya salió.';
    return null;
  }

  private ocupadas(idVuelo: string, excepto: string): string[] {
    return this.ctx.db
      .all<{ Asiento: string }>(
        `SELECT t.Asiento FROM Tiquete t JOIN Reserva r ON r.IdReserva = t.IdReserva
         WHERE r.IdVuelo = ? AND t.Asiento IS NOT NULL AND t.Estado <> 'Anulado' AND t.IdTiquete <> ?`,
        [idVuelo, excepto],
      )
      .map((x) => x.Asiento);
  }

  info(idCliente: string, idTiquete: string): CheckinInfo {
    const t = this.tiquete(idTiquete, idCliente);
    const f = filaVuelo(this.ctx.db, t.IdVuelo);
    const cab = configuracionCabina(f.CapacidadPasajeros);
    const claseDeFila: Record<number, Clase> = {};
    for (let i = 1; i <= cab.filas; i++) claseDeFila[i] = cab.claseDeFila(i);
    const motivo = t.Checkin ? 'Ya hiciste el check-in de este tiquete.' : this.motivoCerrado(t, f);
    return {
      tiquete: this.aTiqueteInfo(t),
      codigoReserva: t.CodigoReserva,
      vuelo: aVueloResumen(f),
      mapa: { filas: cab.filas, letras: cab.letras, ocupadas: this.ocupadas(t.IdVuelo, idTiquete), claseDeFila },
      abierto: !motivo,
      motivoCerrado: motivo,
      pesoMaximoKg: PESO_MAXIMO_KG,
    };
  }

  /**
   * Hace el check-in en una transacción: Checkin, Tiquete.Asiento, Equipaje y primer RastreoEquipaje.
   * idCliente null permite al seed registrar check-ins de mostrador.
   */
  hacer(idCliente: string | null, idTiquete: string, datos: { asiento: string; maletas: number[]; canal?: string }): PaseAbordar {
    const db = this.ctx.db;
    const canal = datos.canal && (CANALES_CHECKIN as readonly string[]).includes(datos.canal) ? datos.canal : 'Web';
    const pesos = this.equipaje.validarPesos(datos.maletas ?? []);
    const asiento = String(datos.asiento ?? '').trim().toUpperCase();

    db.transaction(() => {
      const t = this.tiquete(idTiquete, idCliente);
      if (t.Checkin) throw new ErrorNegocio('Ya hiciste el check-in de este tiquete.', 409);
      const f = filaVuelo(db, t.IdVuelo);
      const motivo = this.motivoCerrado(t, f);
      if (motivo) throw new ErrorNegocio(motivo, 409);

      const cab = configuracionCabina(f.CapacidadPasajeros);
      if (!cab.sillas.includes(asiento)) throw new ErrorNegocio('Elige una silla válida.');
      if (cab.claseDeFila(filaDeSilla(asiento)) !== t.Clase) {
        throw new ErrorNegocio(`La silla ${asiento} no corresponde a la cabina ${t.Clase}.`);
      }
      if (this.ocupadas(t.IdVuelo, idTiquete).includes(asiento)) throw new ErrorNegocio(`La silla ${asiento} ya está ocupada. Elige otra.`, 409);

      insertar(db, 'Checkin', {
        IdCheckin: siguienteId(db, 'Checkin'),
        FechaHora: aFechaHora(this.ctx.reloj.ahora()),
        Canal: canal,
        PuertaEmbarque: null,
        FechaEmbarque: null,
        IdTiquete: idTiquete,
      });
      db.run(`UPDATE Tiquete SET Asiento = ? WHERE IdTiquete = ?`, [asiento, idTiquete]);
      this.equipaje.documentar(idTiquete, pesos, f.IdOrigen, canal);
    });
    return this.pase(idCliente, idTiquete);
  }

  pase(idCliente: string | null, idTiquete: string): PaseAbordar {
    const db = this.ctx.db;
    const t = this.tiquete(idTiquete, idCliente);
    if (!t.Checkin) throw new ErrorNegocio('Haz el check-in para obtener tu pase de abordar.', 409);
    const f = filaVuelo(db, t.IdVuelo);
    const socio = db.get<any>(`SELECT NumeroSocio, Nivel FROM CuentaMillas WHERE IdCliente = ?`, [t.IdCliente]);
    const maletas = db.all<any>(`SELECT CodigoEtiqueta, PesoKg FROM Equipaje WHERE IdTiquete = ? ORDER BY IdEquipaje`, [idTiquete]);
    const fila = filaDeSilla(t.Asiento);
    const zona = t.Clase === 'Ejecutiva' ? 1 : t.Clase === 'Premium' ? 2 : fila > 20 ? 3 : 4;
    return {
      idTiquete,
      numeroTiquete: t.NumeroTiquete,
      pasajero: nombreCompleto(t),
      codigoReserva: t.CodigoReserva,
      vuelo: aVueloResumen(f),
      clase: t.Clase,
      asiento: t.Asiento,
      puerta: f.Puerta,
      embarque: aFechaHora(sumarMinutos(deTexto(f.SalidaProgramada), -MINUTOS_EMBARQUE)),
      zona,
      socio: socio ? { numero: socio.NumeroSocio, nivel: socio.Nivel } : null,
      maletas: maletas.map((m) => ({ etiqueta: m.CodigoEtiqueta, pesoKg: m.PesoKg })),
      checkin: t.Checkin,
    };
  }
}
