import type { Contexto } from '../contexto';
import type {
  Aeropuerto, Busqueda, MisReservas, NuevaReserva, PasajeroEntrada, ReservaDetalle, ResultadoBusqueda, ResultadoVuelo, TiqueteInfo,
} from '../api/tipos';
import { ErrorNegocio, noEncontrado } from '../errores';
import { codigoReserva, generadores, insertar, siguienteId, valorUnico } from '../dominio/ids';
import { CLASES, ESTADO_RESERVA, esClase, liquidar, tarifa, type Clase } from '../dominio/reglas';
import { aFecha, aFechaHora, deTexto, sumarDias, sumarMinutos } from '../dominio/fechas';
import { aVueloResumen, filaVuelo, nombreCompleto, tiquetesVendidos, vuelos, type FilaVuelo } from './consultas';
import type { FacturacionService } from './FacturacionService';

/** Estados en los que un vuelo todavía se puede vender. */
const VENDIBLE = `v.Estado IN ('Programado', 'Recursos asignados', 'En preparación')`;
/** Se deja de vender 60 minutos antes de la salida. */
const CIERRE_VENTA_MIN = 60;

export class ReservasService {
  constructor(
    private ctx: Contexto,
    private facturacion: FacturacionService,
  ) {}

  aeropuertos(): Aeropuerto[] {
    return this.ctx.db
      .all<any>(
        `SELECT a.CodigoIATA, a.Nombre, c.Nombre AS Ciudad, c.Pais
         FROM Aeropuerto a JOIN Ciudad c ON c.IdCiudad = a.IdCiudad ORDER BY c.Nombre`,
      )
      .map((a) => ({ codigo: a.CodigoIATA, nombre: a.Nombre, ciudad: a.Ciudad, pais: a.Pais }));
  }

  private precioPara(f: FilaVuelo, clase: Clase) {
    return tarifa(f.DistanciaMillas, deTexto(f.SalidaProgramada).getMonth(), clase);
  }

  private aResultado(f: FilaVuelo, clase: Clase): ResultadoVuelo {
    const precios = Object.fromEntries(CLASES.map((c) => [c, this.precioPara(f, c)])) as Record<Clase, number>;
    return {
      ...aVueloResumen(f),
      sillasDisponibles: Math.max(0, f.CapacidadPasajeros - tiquetesVendidos(this.ctx.db, f.IdVuelo)),
      precio: precios[clase],
      precios,
    };
  }

  private vuelosVendibles(origen: string, destino: string, desde: string, hasta: string) {
    const limite = aFechaHora(sumarMinutos(this.ctx.reloj.ahora(), CIERRE_VENTA_MIN));
    return vuelos(
      this.ctx.db,
      `WHERE ao.CodigoIATA = ? AND ad.CodigoIATA = ? AND date(v.SalidaProgramada) BETWEEN ? AND ?
         AND ${VENDIBLE} AND v.SalidaProgramada > ?
       ORDER BY v.SalidaProgramada`,
      [origen, destino, desde, hasta, limite],
    );
  }

  buscar(b: Busqueda): ResultadoBusqueda {
    const pasajeros = Number(b.pasajeros);
    if (!b.origen || !b.destino) throw new ErrorNegocio('Elige el origen y el destino.');
    if (b.origen === b.destino) throw new ErrorNegocio('El origen y el destino deben ser distintos.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.fecha ?? '')) throw new ErrorNegocio('Elige una fecha de viaje.');
    if (!Number.isInteger(pasajeros) || pasajeros < 1 || pasajeros > 4) throw new ErrorNegocio('Puedes reservar de 1 a 4 pasajeros.');
    const clase: Clase = esClase(b.clase) ? b.clase : 'Económica';

    const ruta = this.ctx.db.get(
      `SELECT ru.IdRuta FROM Ruta ru
       JOIN Aeropuerto ao ON ao.IdAeropuerto = ru.IdAeropuertoOrigen
       JOIN Aeropuerto ad ON ad.IdAeropuerto = ru.IdAeropuertoDestino
       WHERE ao.CodigoIATA = ? AND ad.CodigoIATA = ?`,
      [b.origen, b.destino],
    );
    if (!ruta) return { vuelos: [], fechasCercanas: [], rutaExiste: false };

    const resultados = this.vuelosVendibles(b.origen, b.destino, b.fecha, b.fecha).map((f) => this.aResultado(f, clase));
    let fechasCercanas: ResultadoBusqueda['fechasCercanas'] = [];
    if (!resultados.some((v) => v.sillasDisponibles >= pasajeros)) {
      const base = deTexto(b.fecha);
      const desde = aFecha(sumarDias(base, -10));
      const hasta = aFecha(sumarDias(base, 10));
      const porFecha = new Map<string, { vuelos: number; desde: number }>();
      for (const f of this.vuelosVendibles(b.origen, b.destino, desde, hasta)) {
        const r = this.aResultado(f, clase);
        const fecha = f.SalidaProgramada.slice(0, 10);
        if (fecha === b.fecha || r.sillasDisponibles < pasajeros) continue;
        const prev = porFecha.get(fecha);
        porFecha.set(fecha, { vuelos: (prev?.vuelos ?? 0) + 1, desde: Math.min(prev?.desde ?? Infinity, r.precio) });
      }
      fechasCercanas = [...porFecha.entries()]
        .sort((a, z) => Math.abs(deTexto(a[0]).getTime() - base.getTime()) - Math.abs(deTexto(z[0]).getTime() - base.getTime()))
        .slice(0, 4)
        .sort((a, z) => a[0].localeCompare(z[0]))
        .map(([fecha, d]) => ({ fecha, ...d }));
    }
    return { vuelos: resultados, fechasCercanas, rutaExiste: true };
  }

  vueloParaReservar(idVuelo: string, clase: Clase): ResultadoVuelo {
    return this.aResultado(filaVuelo(this.ctx.db, idVuelo), clase);
  }

  /** Crea la reserva en estado Pendiente de pago (canal Web). Los pasajeros nuevos se registran como Cliente. */
  crear(idTitular: string, n: NuevaReserva): ReservaDetalle {
    const db = this.ctx.db;
    if (!esClase(n.clase)) throw new ErrorNegocio('Elige una clase válida.');
    const acompanantes = (n.acompanantes ?? []).map(limpiarPasajero);
    if (acompanantes.length > 3) throw new ErrorNegocio('Puedes reservar hasta 4 pasajeros.');
    const titular = db.get<any>(`SELECT * FROM Cliente WHERE IdCliente = ?`, [idTitular]);
    if (!titular) throw noEncontrado('tu cuenta');

    const docs = [titular.Documento, ...acompanantes.map((p) => p.documento)];
    if (new Set(docs).size !== docs.length) throw new ErrorNegocio('Cada pasajero debe tener un documento distinto.');

    const f = filaVuelo(db, n.idVuelo);
    const limite = sumarMinutos(this.ctx.reloj.ahora(), CIERRE_VENTA_MIN);
    if (!['Programado', 'Recursos asignados', 'En preparación'].includes(f.Estado) || deTexto(f.SalidaProgramada) <= limite) {
      throw new ErrorNegocio('Este vuelo ya no está disponible para la venta.', 409);
    }
    const pax = 1 + acompanantes.length;

    return db.transaction(() => {
      if (tiquetesVendidos(db, f.IdVuelo) + pax > f.CapacidadPasajeros) {
        throw new ErrorNegocio('No quedan sillas suficientes en este vuelo.', 409);
      }
      const pasajeros = [idTitular, ...acompanantes.map((p) => this.clientePorDocumento(p, titular))];
      const id = siguienteId(db, 'Reserva');
      insertar(db, 'Reserva', {
        IdReserva: id,
        CodigoReserva: valorUnico(db, 'Reserva', 'CodigoReserva', () => codigoReserva(this.ctx.azar)),
        FechaReserva: aFechaHora(this.ctx.reloj.ahora()),
        Canal: 'Web',
        NumeroPasajeros: pax,
        Estado: ESTADO_RESERVA.pendiente,
        IdCliente: idTitular,
        IdVuelo: f.IdVuelo,
      });
      this.ctx.pendientes.guardar(id, { clase: n.clase, pasajeros });
      return this.detalle(id, idTitular);
    });
  }

  private clientePorDocumento(p: PasajeroEntrada, titular: any): string {
    const db = this.ctx.db;
    const ex = db.get<{ IdCliente: string }>(`SELECT IdCliente FROM Cliente WHERE Documento = ?`, [p.documento]);
    if (ex) return ex.IdCliente;
    const id = siguienteId(db, 'Cliente');
    insertar(db, 'Cliente', {
      IdCliente: id,
      Documento: p.documento,
      Nombres: p.nombres,
      Apellidos: p.apellidos,
      Email: titular.Email,
      Telefono: null,
      FechaNacimiento: null,
      IdCiudad: titular.IdCiudad,
    });
    return id;
  }

  /** Emite un tiquete por pasajero (lo usa PagosService dentro de su transacción). */
  emitirTiquetes(idReserva: string, clase: Clase, pasajeros: string[], valorUnitario: number) {
    const db = this.ctx.db;
    const fecha = aFechaHora(this.ctx.reloj.ahora());
    for (const idCliente of pasajeros) {
      insertar(db, 'Tiquete', {
        IdTiquete: siguienteId(db, 'Tiquete'),
        NumeroTiquete: valorUnico(db, 'Tiquete', 'NumeroTiquete', () => generadores.numeroTiquete(this.ctx.azar)),
        FechaEmision: fecha,
        Clase: clase,
        Asiento: null,
        Valor: valorUnitario,
        Estado: 'Emitido',
        IdReserva: idReserva,
        IdCliente: idCliente,
      });
    }
  }

  /** Reserva visible para el cliente: es el titular o viaja en ella. */
  private exigirAcceso(idReserva: string, idCliente: string) {
    const r = this.ctx.db.get<any>(
      `SELECT r.* FROM Reserva r WHERE r.IdReserva = ? AND (r.IdCliente = ?
         OR EXISTS (SELECT 1 FROM Tiquete t WHERE t.IdReserva = r.IdReserva AND t.IdCliente = ?))`,
      [idReserva, idCliente, idCliente],
    );
    if (!r) throw noEncontrado('la reserva');
    return r;
  }

  /** Si los datos de una reserva pendiente se perdieron (p. ej. venció la sesión de compra), la reserva se cancela. */
  private vencerSiCorresponde(r: any) {
    if (r.Estado === ESTADO_RESERVA.pendiente && !this.ctx.pendientes.leer(r.IdReserva)) {
      this.ctx.db.run(`UPDATE Reserva SET Estado = ? WHERE IdReserva = ?`, [ESTADO_RESERVA.cancelada, r.IdReserva]);
      r.Estado = ESTADO_RESERVA.cancelada;
    }
  }

  detalle(idReserva: string, idCliente: string): ReservaDetalle {
    const db = this.ctx.db;
    const r = this.exigirAcceso(idReserva, idCliente);
    this.vencerSiCorresponde(r);
    const f = filaVuelo(db, r.IdVuelo);
    const titular = db.get<any>(`SELECT * FROM Cliente WHERE IdCliente = ?`, [r.IdCliente]);
    const tiquetes = db
      .all<any>(
        `SELECT t.*, c.Nombres, c.Apellidos, c.Documento, ck.FechaHora AS Checkin,
                (SELECT COUNT(*) FROM Equipaje e WHERE e.IdTiquete = t.IdTiquete) AS Maletas
         FROM Tiquete t JOIN Cliente c ON c.IdCliente = t.IdCliente
         LEFT JOIN Checkin ck ON ck.IdTiquete = t.IdTiquete
         WHERE t.IdReserva = ? ORDER BY t.IdTiquete`,
        [idReserva],
      )
      .map(
        (t): TiqueteInfo => ({
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
        }),
      );

    const pendiente = r.Estado === ESTADO_RESERVA.pendiente ? this.ctx.pendientes.leer(idReserva) : undefined;
    let pasajeros = tiquetes.map((t) => ({ nombre: t.pasajero, documento: t.documento }));
    let liquidacion: ReservaDetalle['liquidacion'] = null;
    if (pendiente) {
      pasajeros = pendiente.pasajeros.map((id) => {
        const c = db.get<any>(`SELECT Nombres, Apellidos, Documento FROM Cliente WHERE IdCliente = ?`, [id]);
        return { nombre: nombreCompleto(c), documento: c.Documento };
      });
      const unitario = this.precioPara(f, pendiente.clase);
      liquidacion = { unitario, ...liquidar(unitario, pendiente.pasajeros.length) };
    } else if (!tiquetes.length) {
      pasajeros = [{ nombre: nombreCompleto(titular), documento: titular.Documento }];
    }

    return {
      idReserva: r.IdReserva,
      codigo: r.CodigoReserva,
      fecha: r.FechaReserva,
      canal: r.Canal,
      estado: r.Estado,
      numeroPasajeros: r.NumeroPasajeros,
      clase: (tiquetes[0]?.clase as Clase) ?? pendiente?.clase ?? null,
      vuelo: aVueloResumen(f),
      pasajeros,
      tiquetes,
      factura: this.facturacion.facturaDeReserva(idReserva),
      liquidacion,
      email: titular.Email,
    };
  }

  misReservas(idCliente: string): MisReservas {
    const ids = this.ctx.db.all<{ IdReserva: string }>(
      `SELECT DISTINCT r.IdReserva FROM Reserva r
       LEFT JOIN Tiquete t ON t.IdReserva = r.IdReserva
       WHERE r.IdCliente = ? OR t.IdCliente = ?`,
      [idCliente, idCliente],
    );
    const todas = ids.map((x) => this.detalle(x.IdReserva, idCliente));
    const terminado = ['Aterrizado', 'Descargando', 'Finalizado'];
    const proximas = todas
      .filter((r) => (r.estado === ESTADO_RESERVA.pendiente || r.estado === ESTADO_RESERVA.confirmada) && !terminado.includes(r.vuelo.estado))
      .sort((a, z) => a.vuelo.salida.localeCompare(z.vuelo.salida));
    const anteriores = todas.filter((r) => !proximas.includes(r)).sort((a, z) => z.vuelo.salida.localeCompare(a.vuelo.salida));
    return { proximas, anteriores };
  }
}

function limpiarPasajero(p: PasajeroEntrada): PasajeroEntrada {
  const nombres = String(p?.nombres ?? '').trim();
  const apellidos = String(p?.apellidos ?? '').trim();
  const documento = String(p?.documento ?? '').replace(/[\s.\-]/g, '');
  if (!nombres || !apellidos) throw new ErrorNegocio('Escribe los nombres y apellidos de cada pasajero.');
  if (!/^[A-Za-z0-9]{5,15}$/.test(documento)) throw new ErrorNegocio(`El documento de ${nombres} no es válido.`);
  return { nombres: nombres.slice(0, 40), apellidos: apellidos.slice(0, 40), documento };
}
