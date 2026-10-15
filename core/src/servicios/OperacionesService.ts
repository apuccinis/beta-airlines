import type { Contexto } from '../contexto';
import type { EtapaVuelo, PasajeroVuelo, VueloOperacion, VueloTablero } from '../api/tipos';
import { ErrorNegocio } from '../errores';
import { insertar, siguienteId } from '../dominio/ids';
import { barajar, elegir, entero } from '../dominio/azar';
import { ETAPAS, ESTADO_RESERVA } from '../dominio/reglas';
import { aFecha, aFechaHora, sumarDias } from '../dominio/fechas';
import { aVueloResumen, filaVuelo, nombreCompleto, vuelos, type FilaVuelo } from './consultas';
import type { EmbarqueService } from './EmbarqueService';
import type { EquipajeService } from './EquipajeService';
import type { MillasService } from './MillasService';
import type { MantenimientoService } from './MantenimientoService';

const ROLES = ['Capitán', 'Primer oficial', 'Auxiliar de vuelo', 'Auxiliar de vuelo'] as const;
const hora = (d: Date) => aFechaHora(d).slice(11, 16);
const miles = (n: number) => n.toLocaleString('es-CO');
const cuenta = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** Pipeline operacional: tablero de vuelos y las 8 etapas de cada vuelo. */
export class OperacionesService {
  constructor(
    private ctx: Contexto,
    private embarque: EmbarqueService,
    private equipaje: EquipajeService,
    private millas: MillasService,
    private mantenimiento: MantenimientoService,
  ) {}

  private conConteos(f: FilaVuelo): VueloTablero {
    const c = this.ctx.db.get<{ p: number; k: number }>(
      `SELECT COUNT(t.IdTiquete) AS p, COUNT(ck.IdCheckin) AS k
       FROM Reserva r JOIN Tiquete t ON t.IdReserva = r.IdReserva
       LEFT JOIN Checkin ck ON ck.IdTiquete = t.IdTiquete
       WHERE r.IdVuelo = ? AND t.Estado <> 'Anulado'`,
      [f.IdVuelo],
    )!;
    return { ...aVueloResumen(f), pasajeros: c.p, checkins: c.k };
  }

  /** Vuelos de hoy y de los dos días siguientes. */
  tablero(dias = 3): VueloTablero[] {
    const hoy = this.ctx.reloj.ahora();
    const desde = aFecha(hoy);
    const hasta = aFecha(sumarDias(hoy, Math.max(1, Math.min(10, dias)) - 1));
    return vuelos(this.ctx.db, `WHERE date(v.SalidaProgramada) BETWEEN ? AND ? ORDER BY v.SalidaProgramada, v.NumeroVuelo`, [
      desde,
      hasta,
    ]).map((f) => this.conConteos(f));
  }

  detalle(idVuelo: string): VueloOperacion {
    const db = this.ctx.db;
    const f = filaVuelo(db, idVuelo);
    const eventos = db.all<any>(
      `SELECT ev.*, e.Nombres, e.Apellidos FROM EventoVuelo ev
       LEFT JOIN Empleado e ON e.IdEmpleado = ev.IdEmpleado
       WHERE ev.IdVuelo = ? ORDER BY ev.FechaHora, ev.IdEvento`,
      [idVuelo],
    );
    const etapas: EtapaVuelo[] = ETAPAS.map((et, i) => {
      const ev = eventos.find((e) => e.TipoEvento === et.tipo);
      return {
        n: i + 1,
        tipo: et.tipo,
        diagrama: et.diagrama,
        estado: et.estado,
        hecho: !!ev,
        fechaHora: ev?.FechaHora ?? null,
        empleado: ev?.Nombres ? nombreCompleto(ev) : null,
      };
    });
    const pendiente = etapas.findIndex((e) => !e.hecho);
    const tripulacion = db
      .all<any>(
        `SELECT a.Rol, e.IdEmpleado, e.Nombres, e.Apellidos FROM AsignacionTripulacion a
         JOIN Empleado e ON e.IdEmpleado = a.IdEmpleado WHERE a.IdVuelo = ?
         ORDER BY CASE a.Rol WHEN 'Capitán' THEN 0 WHEN 'Primer oficial' THEN 1 ELSE 2 END, a.IdAsignacion`,
        [idVuelo],
      )
      .map((x) => ({ rol: x.Rol, nombre: nombreCompleto(x), idEmpleado: x.IdEmpleado }));
    const pasajeros: PasajeroVuelo[] = db
      .all<any>(
        `SELECT t.NumeroTiquete, t.Clase, t.Asiento, t.Estado, c.Nombres, c.Apellidos, r.CodigoReserva,
                ck.FechaHora AS Checkin, ck.FechaEmbarque, cm.Nivel,
                (SELECT COUNT(*) FROM Equipaje e WHERE e.IdTiquete = t.IdTiquete) AS Maletas
         FROM Tiquete t JOIN Reserva r ON r.IdReserva = t.IdReserva
         JOIN Cliente c ON c.IdCliente = t.IdCliente
         LEFT JOIN Checkin ck ON ck.IdTiquete = t.IdTiquete
         LEFT JOIN CuentaMillas cm ON cm.IdCliente = t.IdCliente
         WHERE r.IdVuelo = ? AND t.Estado <> 'Anulado'
         ORDER BY CASE WHEN t.Asiento IS NULL THEN 1 ELSE 0 END, CAST(t.Asiento AS INTEGER), t.Asiento, c.Apellidos`,
        [idVuelo],
      )
      .map((p) => ({
        numeroTiquete: p.NumeroTiquete,
        nombre: nombreCompleto(p),
        codigoReserva: p.CodigoReserva,
        clase: p.Clase,
        asiento: p.Asiento,
        checkin: p.Checkin,
        embarque: p.FechaEmbarque,
        maletas: p.Maletas,
        estado: p.Estado,
        socio: p.Nivel ?? null,
      }));
    return {
      vuelo: this.conConteos(f),
      etapas,
      siguiente: pendiente < 0 ? null : pendiente,
      tripulacion,
      pasajeros,
      eventos: eventos.map((e) => ({
        tipo: e.TipoEvento,
        fechaHora: e.FechaHora,
        descripcion: e.Descripcion,
        empleado: e.Nombres ? nombreCompleto(e) : null,
      })),
    };
  }

  /** Despachador que firma el evento: el empleado en sesión si es despachador o coordinador; si no, uno de turno. */
  private despachador(idEmpleado?: string | null): string {
    const db = this.ctx.db;
    if (idEmpleado) {
      const e = db.get<{ Cargo: string }>(`SELECT Cargo FROM Empleado WHERE IdEmpleado = ?`, [idEmpleado]);
      if (e && (e.Cargo === 'Despachador' || e.Cargo === 'Coordinador de operaciones')) return idEmpleado;
    }
    const d = db.all<{ IdEmpleado: string }>(`SELECT IdEmpleado FROM Empleado WHERE Cargo = 'Despachador' ORDER BY IdEmpleado`);
    if (!d.length) throw new ErrorNegocio('No hay despachadores registrados.', 409);
    return elegir(this.ctx.azar, d).IdEmpleado;
  }

  /** Tripulación de 4 personas, prefiriendo quienes no vuelan ese mismo día. */
  private elegirTripulacion(f: FilaVuelo): string[] {
    const db = this.ctx.db;
    const dia = f.SalidaProgramada.slice(0, 10);
    const candidatos = (cargo: string, n: number) => {
      const todos = db.all<{ IdEmpleado: string; Ocupado: number }>(
        `SELECT e.IdEmpleado, EXISTS (
           SELECT 1 FROM AsignacionTripulacion a JOIN Vuelo v ON v.IdVuelo = a.IdVuelo
           WHERE a.IdEmpleado = e.IdEmpleado AND date(v.SalidaProgramada) = ?) AS Ocupado
         FROM Empleado e WHERE e.Cargo = ? ORDER BY e.IdEmpleado`,
        [dia, cargo],
      );
      const libres = barajar(this.ctx.azar, todos.filter((x) => !x.Ocupado));
      const ocupados = barajar(this.ctx.azar, todos.filter((x) => x.Ocupado));
      const elegidos = [...libres, ...ocupados].slice(0, n).map((x) => x.IdEmpleado);
      if (elegidos.length < n) throw new ErrorNegocio(`No hay suficiente personal con el cargo ${cargo}.`, 409);
      return elegidos;
    };
    return [...candidatos('Capitán', 1), ...candidatos('Primer oficial', 1), ...candidatos('Auxiliar de vuelo', 2)];
  }

  /** Ejecuta la siguiente etapa del pipeline operacional del vuelo, con sus efectos, en una transacción. */
  registrarEtapa(idVuelo: string, idEmpleado?: string | null): VueloOperacion {
    const db = this.ctx.db;
    db.transaction(() => {
      const f = filaVuelo(db, idVuelo);
      const hechas = new Set(
        db.all<{ TipoEvento: string }>(`SELECT TipoEvento FROM EventoVuelo WHERE IdVuelo = ?`, [idVuelo]).map((e) => e.TipoEvento),
      );
      const k = ETAPAS.findIndex((e) => !hechas.has(e.tipo));
      if (k < 0) throw new ErrorNegocio('Este vuelo ya completó todas sus etapas.', 409);
      const etapa = ETAPAS[k];
      const ahora = this.ctx.reloj.ahora();
      const fh = aFechaHora(ahora);
      let descripcion = '';

      switch (k) {
        case 0: {
          const crew = this.elegirTripulacion(f);
          crew.forEach((idEmp, i) =>
            insertar(db, 'AsignacionTripulacion', {
              IdAsignacion: siguienteId(db, 'AsignacionTripulacion'),
              Rol: ROLES[i],
              IdVuelo: idVuelo,
              IdEmpleado: idEmp,
            }),
          );
          const puerta = f.Puerta ?? `${elegir(this.ctx.azar, ['A', 'B', 'C', 'D', 'E'])}${entero(this.ctx.azar, 1, 36)}`;
          db.run(`UPDATE Vuelo SET Puerta = ? WHERE IdVuelo = ?`, [puerta, idVuelo]);
          descripcion = `Tripulación de 4 personas asignada. Aeronave ${f.Matricula}, puerta ${puerta}`;
          break;
        }
        case 1:
          descripcion = `Plan de vuelo ${f.CodOrigen} → ${f.CodDestino} y combustible aprobados`;
          break;
        case 2: {
          const abordaron = this.embarque.embarcar(idVuelo, f.Puerta, ahora);
          const maletas = this.equipaje.cargarEnBodega(idVuelo, f.IdOrigen, ahora);
          descripcion = `${cuenta(abordaron, 'pasajero abordó', 'pasajeros abordaron')} por la puerta ${f.Puerta ?? '—'}. ${cuenta(maletas, 'maleta', 'maletas')} en bodega`;
          break;
        }
        case 3:
          db.run(`UPDATE Vuelo SET SalidaReal = ? WHERE IdVuelo = ?`, [fh, idVuelo]);
          descripcion = `Despegue desde ${f.CodOrigen} a las ${hora(ahora)}`;
          break;
        case 4:
          descripcion = `Vuelo en ruta a ${f.CiudadDestino}, ${miles(f.DistanciaMillas)} millas`;
          break;
        case 5: {
          db.run(`UPDATE Vuelo SET LlegadaReal = ? WHERE IdVuelo = ?`, [fh, idVuelo]);
          const acumulado = this.millas.acumularVuelo(idVuelo);
          db.run(
            `UPDATE Tiquete SET Estado = 'Volado'
             WHERE Estado = 'Abordado' AND IdReserva IN (SELECT IdReserva FROM Reserva WHERE IdVuelo = ?)`,
            [idVuelo],
          );
          db.run(`UPDATE Reserva SET Estado = ? WHERE IdVuelo = ? AND Estado = ?`, [
            ESTADO_RESERVA.completada,
            idVuelo,
            ESTADO_RESERVA.confirmada,
          ]);
          descripcion = `Aterrizaje en ${f.CodDestino} a las ${hora(ahora)}. ${miles(acumulado.millas)} millas acreditadas a ${cuenta(acumulado.pasajeros, 'socio', 'socios')}`;
          break;
        }
        case 6: {
          const n = this.equipaje.descargar(idVuelo, f.IdDestino, ahora);
          descripcion = `${cuenta(n, 'maleta descargada y lista', 'maletas descargadas y listas')} en la banda de entrega`;
          break;
        }
        case 7:
          this.mantenimiento.servicioRutina(f.IdAeronave, `Limpieza de cabina y alistamiento tras el vuelo ${f.NumeroVuelo}`, ahora);
          descripcion = `Aeronave ${f.Matricula} limpia y lista para el siguiente vuelo`;
          break;
      }

      insertar(db, 'EventoVuelo', {
        IdEvento: siguienteId(db, 'EventoVuelo'),
        TipoEvento: etapa.tipo,
        FechaHora: fh,
        Descripcion: descripcion.slice(0, 200),
        IdVuelo: idVuelo,
        IdEmpleado: this.despachador(idEmpleado),
      });
      db.run(`UPDATE Vuelo SET Estado = ? WHERE IdVuelo = ?`, [etapa.estado, idVuelo]);
    });
    return this.detalle(idVuelo);
  }
}
