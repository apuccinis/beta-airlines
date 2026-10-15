import type { Db } from './db/Db';
import type { Contexto } from './contexto';
import type { DwRepository } from './dw/DwRepository';
import { SqliteDwRepository } from './dw/SqliteDwRepository';
import { AuthService } from './servicios/AuthService';
import { MillasService } from './servicios/MillasService';
import { FacturacionService } from './servicios/FacturacionService';
import { ReservasService } from './servicios/ReservasService';
import { PagosService } from './servicios/PagosService';
import { EquipajeService } from './servicios/EquipajeService';
import { CheckinService } from './servicios/CheckinService';
import { EmbarqueService } from './servicios/EmbarqueService';
import { MantenimientoService } from './servicios/MantenimientoService';
import { OperacionesService } from './servicios/OperacionesService';
import { ServicioClienteService } from './servicios/ServicioClienteService';
import { EtlService } from './servicios/EtlService';
import { AnaliticaService } from './servicios/AnaliticaService';
import type {
  Actor, Busqueda, DatosTarjeta, NuevaReserva, NuevoCaso, Registro,
} from './api/tipos';
import { esClase } from './dominio/reglas';

export interface Servicios {
  ctx: Contexto;
  auth: AuthService;
  millas: MillasService;
  facturacion: FacturacionService;
  reservas: ReservasService;
  pagos: PagosService;
  equipaje: EquipajeService;
  checkin: CheckinService;
  embarque: EmbarqueService;
  mantenimiento: MantenimientoService;
  operaciones: OperacionesService;
  servicioCliente: ServicioClienteService;
  etl: EtlService;
  analitica: AnaliticaService;
}

/** Arma todos los servicios sobre la base operacional (ctx.db) y el repositorio del DW. */
export function crearServicios(ctx: Contexto, dw: Db | DwRepository): Servicios {
  const dwRepo: DwRepository = 'reemplazarTodo' in dw ? dw : new SqliteDwRepository(dw);
  const millas = new MillasService(ctx);
  const facturacion = new FacturacionService(ctx);
  const reservas = new ReservasService(ctx, facturacion);
  const pagos = new PagosService(ctx, reservas, facturacion);
  const equipaje = new EquipajeService(ctx);
  const checkin = new CheckinService(ctx, equipaje);
  const embarque = new EmbarqueService(ctx);
  const mantenimiento = new MantenimientoService(ctx);
  const operaciones = new OperacionesService(ctx, embarque, equipaje, millas, mantenimiento);
  const servicioCliente = new ServicioClienteService(ctx);
  const etl = new EtlService(ctx, dwRepo);
  const analitica = new AnaliticaService(dwRepo, etl);
  const auth = new AuthService(ctx, millas);
  return { ctx, auth, millas, facturacion, reservas, pagos, equipaje, checkin, embarque, mantenimiento, operaciones, servicioCliente, etl, analitica };
}

/**
 * Fachada única de casos de uso con control de acceso. La usan las rutas Express (modo completo)
 * y LocalClient (modo estático), así las reglas de permisos también se escriben una sola vez.
 */
export class BetaApi {
  constructor(readonly s: Servicios) {}

  // --- público ---
  aeropuertos = () => this.s.reservas.aeropuertos();
  buscarVuelos = (b: Busqueda) => this.s.reservas.buscar(b);
  vuelo = (idVuelo: string, clase: string) => this.s.reservas.vueloParaReservar(idVuelo, esClase(clase) ? clase : 'Económica');

  // --- sesión ---
  ingresarCliente = (documento: string, email: string) => this.s.auth.ingresarCliente(documento, email);
  registrar = (r: Registro) => this.s.auth.registrar(r);
  ingresarEmpleado = (documento: string) => this.s.auth.ingresarEmpleado(documento);
  perfil = (a: Actor) => this.s.auth.perfil(a);

  // --- pasajeros ---
  crearReserva = (a: Actor | null, n: NuevaReserva) => this.s.reservas.crear(this.s.auth.exigirCliente(a), n);
  misReservas = (a: Actor | null) => this.s.reservas.misReservas(this.s.auth.exigirCliente(a));
  reserva = (a: Actor | null, id: string) => this.s.reservas.detalle(id, this.s.auth.exigirCliente(a));
  pagar = (a: Actor | null, id: string, t: DatosTarjeta) => this.s.pagos.pagar(this.s.auth.exigirCliente(a), id, t);
  checkin = (a: Actor | null, idTiquete: string) => this.s.checkin.info(this.s.auth.exigirCliente(a), idTiquete);
  hacerCheckin = (a: Actor | null, idTiquete: string, d: { asiento: string; maletas: number[] }) =>
    this.s.checkin.hacer(this.s.auth.exigirCliente(a), idTiquete, { asiento: d?.asiento, maletas: d?.maletas ?? [], canal: 'Web' });
  pase = (a: Actor | null, idTiquete: string) => this.s.checkin.pase(this.s.auth.exigirCliente(a), idTiquete);
  misMaletas = (a: Actor | null) => this.s.equipaje.misMaletas(this.s.auth.exigirCliente(a));
  rastrearMaleta = (a: Actor | null, etiqueta: string) => this.s.equipaje.rastrear(this.s.auth.exigirCliente(a), etiqueta);
  skymiles = (a: Actor | null) => this.s.millas.skymiles(this.s.auth.exigirCliente(a));
  afiliarSkymiles = (a: Actor | null) => {
    const id = this.s.auth.exigirCliente(a);
    this.s.millas.afiliar(id);
    return this.s.millas.skymiles(id);
  };
  misCasos = (a: Actor | null) => this.s.servicioCliente.casosDeCliente(this.s.auth.exigirCliente(a));
  abrirCaso = (a: Actor | null, n: NuevoCaso) => this.s.servicioCliente.abrir(this.s.auth.exigirCliente(a), n);

  // --- portal interno ---
  tablero = (a: Actor | null) => (this.s.auth.exigirSeccion(a, 'tablero'), this.s.operaciones.tablero());
  vueloOperacion = (a: Actor | null, id: string) => (this.s.auth.exigirSeccion(a, 'tablero'), this.s.operaciones.detalle(id));
  registrarEtapa = (a: Actor | null, id: string) => this.s.operaciones.registrarEtapa(id, this.s.auth.exigirSeccion(a, 'tablero'));
  casos = (a: Actor | null, estado?: string) => (this.s.auth.exigirSeccion(a, 'servicio'), this.s.servicioCliente.bandeja(estado || undefined));
  atenderCaso = (a: Actor | null, id: string) => this.s.servicioCliente.atender(id, this.s.auth.exigirSeccion(a, 'servicio'));
  cerrarCaso = (a: Actor | null, id: string) => this.s.servicioCliente.cerrar(id, this.s.auth.exigirSeccion(a, 'servicio'));
  flota = (a: Actor | null) => (this.s.auth.exigirSeccion(a, 'flota'), this.s.mantenimiento.flota());
  mantenimientos = (a: Actor | null) => (this.s.auth.exigirSeccion(a, 'flota'), this.s.mantenimiento.historial());

  // --- analítica ---
  estadoDw = (a: Actor | null) => (this.s.auth.exigirSeccion(a, 'analitica'), this.s.analitica.estado());
  ejecutarEtl = (a: Actor | null) => {
    this.s.auth.exigirSeccion(a, 'analitica');
    this.s.etl.ejecutar();
    return this.s.analitica.estado();
  };
  reporteIngresos = (a: Actor | null, anio: number, dimension?: string) =>
    (this.s.auth.exigirSeccion(a, 'analitica'), this.s.analitica.ingresos(anio, dimension));
  reporteReservas = (a: Actor | null, anio: number, dimension?: string) =>
    (this.s.auth.exigirSeccion(a, 'analitica'), this.s.analitica.reservas(anio, dimension));
  reporteMillas = (a: Actor | null, anio: number, q?: string) =>
    (this.s.auth.exigirSeccion(a, 'analitica'), this.s.analitica.millasNacionales(anio, q));
}
