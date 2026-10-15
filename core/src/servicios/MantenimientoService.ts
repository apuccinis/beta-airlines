import type { Contexto } from '../contexto';
import type { AeronaveFlota, MantenimientoInfo } from '../api/tipos';
import { ErrorNegocio } from '../errores';
import { insertar, siguienteId } from '../dominio/ids';
import { elegir } from '../dominio/azar';
import { aFechaHora, sumarMinutos } from '../dominio/fechas';
import { nombreCompleto } from './consultas';

/** Flota y mantenimiento de aeronaves. */
export class MantenimientoService {
  constructor(private ctx: Contexto) {}

  tecnicoDisponible(): string {
    const tecnicos = this.ctx.db.all<{ IdEmpleado: string }>(
      `SELECT IdEmpleado FROM Empleado WHERE Cargo = 'Técnico de mantenimiento' ORDER BY IdEmpleado`,
    );
    if (!tecnicos.length) throw new ErrorNegocio('No hay técnicos de mantenimiento registrados.', 409);
    return elegir(this.ctx.azar, tecnicos).IdEmpleado;
  }

  /** Limpieza y alistamiento después de un vuelo: Mantenimiento tipo "Servicio de rutina". */
  servicioRutina(idAeronave: string, descripcion: string, fin = this.ctx.reloj.ahora()): string {
    const id = siguienteId(this.ctx.db, 'Mantenimiento');
    insertar(this.ctx.db, 'Mantenimiento', {
      IdMantenimiento: id,
      FechaInicio: aFechaHora(sumarMinutos(fin, -45)),
      FechaFin: aFechaHora(fin),
      Tipo: 'Servicio de rutina',
      Descripcion: descripcion.slice(0, 200),
      Estado: 'Completado',
      IdAeronave: idAeronave,
      IdEmpleado: this.tecnicoDisponible(),
    });
    return id;
  }

  flota(): AeronaveFlota[] {
    const db = this.ctx.db;
    const ahora = aFechaHora(this.ctx.reloj.ahora());
    return db
      .all<any>(
        `SELECT a.*,
           (SELECT COUNT(*) FROM Vuelo v WHERE v.IdAeronave = a.IdAeronave AND v.LlegadaReal IS NOT NULL) AS Vuelos,
           (SELECT COALESCE(SUM((julianday(v.LlegadaReal) - julianday(v.SalidaReal)) * 24), 0)
              FROM Vuelo v WHERE v.IdAeronave = a.IdAeronave AND v.LlegadaReal IS NOT NULL) AS Horas
         FROM Aeronave a ORDER BY a.Matricula`,
      )
      .map((a) => {
        const m = db.get<any>(
          `SELECT FechaInicio, Tipo FROM Mantenimiento WHERE IdAeronave = ? ORDER BY FechaInicio DESC LIMIT 1`,
          [a.IdAeronave],
        );
        const p = db.get<any>(
          `SELECT v.NumeroVuelo, v.SalidaProgramada, ao.CodigoIATA AS O, ad.CodigoIATA AS D
           FROM Vuelo v JOIN Ruta ru ON ru.IdRuta = v.IdRuta
           JOIN Aeropuerto ao ON ao.IdAeropuerto = ru.IdAeropuertoOrigen
           JOIN Aeropuerto ad ON ad.IdAeropuerto = ru.IdAeropuertoDestino
           WHERE v.IdAeronave = ? AND v.SalidaProgramada >= ? AND v.SalidaReal IS NULL
           ORDER BY v.SalidaProgramada LIMIT 1`,
          [a.IdAeronave, ahora],
        );
        return {
          idAeronave: a.IdAeronave,
          matricula: a.Matricula,
          modelo: a.Modelo,
          capacidad: a.CapacidadPasajeros,
          estado: a.Estado,
          vuelosRealizados: a.Vuelos,
          horasVuelo: Math.round(a.Horas),
          ultimoMantenimiento: m ? { fecha: m.FechaInicio, tipo: m.Tipo } : null,
          proximoVuelo: p ? { numero: p.NumeroVuelo, salida: p.SalidaProgramada, ruta: `${p.O} → ${p.D}` } : null,
        };
      });
  }

  historial(idAeronave?: string, limite = 60): MantenimientoInfo[] {
    const filtro = idAeronave ? 'WHERE m.IdAeronave = ?' : '';
    return this.ctx.db
      .all<any>(
        `SELECT m.*, a.Matricula, a.Modelo, e.Nombres, e.Apellidos
         FROM Mantenimiento m JOIN Aeronave a ON a.IdAeronave = m.IdAeronave
         JOIN Empleado e ON e.IdEmpleado = m.IdEmpleado
         ${filtro} ORDER BY m.FechaInicio DESC LIMIT ${Math.max(1, Math.min(500, limite | 0))}`,
        idAeronave ? [idAeronave] : [],
      )
      .map((m) => ({
        id: m.IdMantenimiento,
        matricula: m.Matricula,
        modelo: m.Modelo,
        tipo: m.Tipo,
        descripcion: m.Descripcion,
        inicio: m.FechaInicio,
        fin: m.FechaFin,
        estado: m.Estado,
        tecnico: nombreCompleto(m),
      }));
  }
}
