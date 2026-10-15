import type {
  AeronaveFlota, Aeropuerto, Busqueda, Caso, CheckinInfo, DatosTarjeta, EstadoDw, MantenimientoInfo, Maleta, MisReservas,
  NuevaReserva, NuevoCaso, PaseAbordar, PerfilCliente, PerfilEmpleado, Registro, ReporteCiudad, ReporteMillas, ReservaDetalle,
  ResultadoBusqueda, ResultadoVuelo, Skymiles, VueloOperacion, VueloTablero,
} from '@beta/core';

/** Error que muestra la interfaz: mensaje para el usuario y código HTTP equivalente. */
export class ErrorDatos extends Error {
  constructor(
    message: string,
    readonly codigo: number,
  ) {
    super(message);
  }
}

/**
 * Cliente de datos que usa la interfaz. Hay dos implementaciones con la misma forma:
 * ApiClient (HTTP contra /api, modo completo) y LocalClient (servicios de core/ sobre sql.js, modo estático).
 * Las sesiones de pasajero y de empleado son independientes.
 */
export interface ClienteDatos {
  // sesión
  sesionCliente(): Promise<PerfilCliente | null>;
  sesionEmpleado(): Promise<PerfilEmpleado | null>;
  ingresarCliente(documento: string, email: string): Promise<PerfilCliente>;
  registrar(r: Registro): Promise<PerfilCliente>;
  ingresarEmpleado(documento: string): Promise<PerfilEmpleado>;
  salirCliente(): Promise<void>;
  salirEmpleado(): Promise<void>;

  // público
  aeropuertos(): Promise<Aeropuerto[]>;
  buscarVuelos(b: Busqueda): Promise<ResultadoBusqueda>;
  vuelo(idVuelo: string, clase: string): Promise<ResultadoVuelo>;

  // pasajeros
  crearReserva(n: NuevaReserva): Promise<ReservaDetalle>;
  misReservas(): Promise<MisReservas>;
  reserva(id: string): Promise<ReservaDetalle>;
  pagar(id: string, t: DatosTarjeta): Promise<ReservaDetalle>;
  checkin(idTiquete: string): Promise<CheckinInfo>;
  hacerCheckin(idTiquete: string, d: { asiento: string; maletas: number[] }): Promise<PaseAbordar>;
  pase(idTiquete: string): Promise<PaseAbordar>;
  misMaletas(): Promise<Maleta[]>;
  rastrearMaleta(etiqueta: string): Promise<Maleta>;
  skymiles(): Promise<Skymiles>;
  afiliarSkymiles(): Promise<Skymiles>;
  misCasos(): Promise<Caso[]>;
  abrirCaso(n: NuevoCaso): Promise<Caso>;

  // portal interno
  tablero(): Promise<VueloTablero[]>;
  vueloOperacion(id: string): Promise<VueloOperacion>;
  registrarEtapa(id: string): Promise<VueloOperacion>;
  casos(estado?: string): Promise<Caso[]>;
  atenderCaso(id: string): Promise<Caso>;
  cerrarCaso(id: string): Promise<Caso>;
  flota(): Promise<AeronaveFlota[]>;
  mantenimientos(): Promise<MantenimientoInfo[]>;
  restablecerDatos(): Promise<void>;

  // analítica
  estadoDw(): Promise<EstadoDw>;
  ejecutarEtl(): Promise<EstadoDw>;
  reporteIngresos(anio: number, ciudad: string): Promise<ReporteCiudad>;
  reporteReservas(anio: number, ciudad: string): Promise<ReporteCiudad>;
  reporteMillas(anio: number, q?: string): Promise<ReporteMillas>;
}
