import type { Contexto } from '../contexto';
import type { Maleta, RastreoPunto } from '../api/tipos';
import { ErrorNegocio, noEncontrado } from '../errores';
import { generadores, insertar, siguienteId, valorUnico } from '../dominio/ids';
import { aFechaHora } from '../dominio/fechas';
import { nombreCompleto } from './consultas';

export const PESO_MAXIMO_KG = 32;
const PUNTO_DOCUMENTACION: Record<string, string> = {
  Web: 'Documentada en web',
  App: 'Documentada en app',
  Kiosko: 'Documentada en kiosko',
  Mostrador: 'Documentada en mostrador',
};

/** Equipaje: documentación de maletas y su rastreo por puntos de control. */
export class EquipajeService {
  constructor(private ctx: Contexto) {}

  validarPesos(pesos: number[]): number[] {
    if (!Array.isArray(pesos) || pesos.length > 2) throw new ErrorNegocio('Puedes registrar hasta 2 maletas por pasajero.');
    return pesos.map((p) => {
      const kg = Math.round(Number(p) * 10) / 10;
      if (!Number.isFinite(kg) || kg < 1 || kg > PESO_MAXIMO_KG) {
        throw new ErrorNegocio(`Cada maleta debe pesar entre 1 y ${PESO_MAXIMO_KG} kg.`);
      }
      return kg;
    });
  }

  /** Documenta las maletas de un tiquete: Equipaje + primer punto de rastreo en el aeropuerto de origen. */
  documentar(idTiquete: string, pesos: number[], idAeropuerto: string, canal: string, fecha = this.ctx.reloj.ahora()): string[] {
    const db = this.ctx.db;
    return pesos.map((kg) => {
      const id = siguienteId(db, 'Equipaje');
      const etiqueta = valorUnico(db, 'Equipaje', 'CodigoEtiqueta', () => generadores.etiqueta(this.ctx.azar));
      insertar(db, 'Equipaje', { IdEquipaje: id, CodigoEtiqueta: etiqueta, PesoKg: kg, Estado: 'Documentada', IdTiquete: idTiquete });
      this.registrarPunto(id, PUNTO_DOCUMENTACION[canal] ?? 'Documentada en mostrador', 'Documentada', idAeropuerto, fecha);
      return etiqueta;
    });
  }

  registrarPunto(idEquipaje: string, punto: string, estado: string, idAeropuerto: string, fecha = this.ctx.reloj.ahora()) {
    insertar(this.ctx.db, 'RastreoEquipaje', {
      IdRastreo: siguienteId(this.ctx.db, 'RastreoEquipaje'),
      FechaHora: aFechaHora(fecha),
      PuntoControl: punto,
      Estado: estado,
      IdEquipaje: idEquipaje,
      IdAeropuerto: idAeropuerto,
    });
  }

  maletasDeVuelo(idVuelo: string): { IdEquipaje: string; CodigoEtiqueta: string }[] {
    return this.ctx.db.all(
      `SELECT e.IdEquipaje, e.CodigoEtiqueta FROM Equipaje e
       JOIN Tiquete t ON t.IdTiquete = e.IdTiquete
       JOIN Reserva r ON r.IdReserva = t.IdReserva
       WHERE r.IdVuelo = ? AND t.Estado <> 'Anulado' ORDER BY e.IdEquipaje`,
      [idVuelo],
    );
  }

  /** Cargar aeronave: cada maleta queda en bodega. */
  cargarEnBodega(idVuelo: string, idAeropuertoOrigen: string, fecha = this.ctx.reloj.ahora()): number {
    const maletas = this.maletasDeVuelo(idVuelo);
    for (const m of maletas) {
      this.registrarPunto(m.IdEquipaje, 'Cargada en bodega', 'En bodega', idAeropuertoOrigen, fecha);
      this.ctx.db.run(`UPDATE Equipaje SET Estado = 'En bodega' WHERE IdEquipaje = ?`, [m.IdEquipaje]);
    }
    return maletas.length;
  }

  /** Descargar aeronave: cada maleta se descarga y queda lista en la banda del aeropuerto destino. */
  descargar(idVuelo: string, idAeropuertoDestino: string, fecha = this.ctx.reloj.ahora()): number {
    const maletas = this.maletasDeVuelo(idVuelo);
    for (const m of maletas) {
      this.registrarPunto(m.IdEquipaje, 'Descargada', 'Descargada', idAeropuertoDestino, fecha);
      this.registrarPunto(m.IdEquipaje, 'Lista en banda de entrega', 'En banda', idAeropuertoDestino, fecha);
      this.ctx.db.run(`UPDATE Equipaje SET Estado = 'En banda' WHERE IdEquipaje = ?`, [m.IdEquipaje]);
    }
    return maletas.length;
  }

  private rastreo(idEquipaje: string): RastreoPunto[] {
    return this.ctx.db
      .all<any>(
        `SELECT re.FechaHora, re.PuntoControl, re.Estado, a.CodigoIATA, c.Nombre AS Ciudad
         FROM RastreoEquipaje re JOIN Aeropuerto a ON a.IdAeropuerto = re.IdAeropuerto
         JOIN Ciudad c ON c.IdCiudad = a.IdCiudad
         WHERE re.IdEquipaje = ? ORDER BY re.FechaHora, re.IdRastreo`,
        [idEquipaje],
      )
      .map((x) => ({ fechaHora: x.FechaHora, punto: x.PuntoControl, estado: x.Estado, aeropuerto: x.CodigoIATA, ciudad: x.Ciudad }));
  }

  private SQL = `
    SELECT e.*, c.Nombres, c.Apellidos, v.NumeroVuelo, v.SalidaProgramada, ao.CodigoIATA AS O, ad.CodigoIATA AS D
    FROM Equipaje e
    JOIN Tiquete t ON t.IdTiquete = e.IdTiquete
    JOIN Cliente c ON c.IdCliente = t.IdCliente
    JOIN Reserva r ON r.IdReserva = t.IdReserva
    JOIN Vuelo v   ON v.IdVuelo = r.IdVuelo
    JOIN Ruta ru   ON ru.IdRuta = v.IdRuta
    JOIN Aeropuerto ao ON ao.IdAeropuerto = ru.IdAeropuertoOrigen
    JOIN Aeropuerto ad ON ad.IdAeropuerto = ru.IdAeropuertoDestino`;

  private aMaleta(e: any): Maleta {
    const rastreo = this.rastreo(e.IdEquipaje);
    return {
      etiqueta: e.CodigoEtiqueta,
      pesoKg: e.PesoKg,
      estado: e.Estado,
      pasajero: nombreCompleto(e),
      vuelo: { numero: e.NumeroVuelo, origen: e.O, destino: e.D, salida: e.SalidaProgramada },
      ultimo: rastreo[rastreo.length - 1] ?? null,
      rastreo,
    };
  }

  misMaletas(idCliente: string): Maleta[] {
    return this.ctx.db
      .all<any>(`${this.SQL} WHERE t.IdCliente = ? OR r.IdCliente = ? ORDER BY v.SalidaProgramada DESC, e.IdEquipaje`, [idCliente, idCliente])
      .map((e) => this.aMaleta(e));
  }

  rastrear(idCliente: string, etiqueta: string): Maleta {
    const e = this.ctx.db.get<any>(`${this.SQL} WHERE e.CodigoEtiqueta = ? AND (t.IdCliente = ? OR r.IdCliente = ?)`, [
      String(etiqueta ?? '').trim().toUpperCase(),
      idCliente,
      idCliente,
    ]);
    if (!e) throw noEncontrado('una maleta con esa etiqueta en tus viajes');
    return this.aMaleta(e);
  }
}
