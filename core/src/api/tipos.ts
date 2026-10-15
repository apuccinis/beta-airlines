/** Tipos de datos que intercambian la interfaz y los servicios (iguales en modo API y modo local). */
import type { Clase } from '../dominio/reglas';
export type { Clase };

export interface Aeropuerto {
  codigo: string;
  nombre: string;
  ciudad: string;
  pais: string;
}

export interface PuntoRuta {
  codigo: string;
  ciudad: string;
  aeropuerto: string;
}

export interface VueloResumen {
  idVuelo: string;
  numero: string;
  origen: PuntoRuta;
  destino: PuntoRuta;
  salida: string;
  llegada: string;
  salidaReal: string | null;
  llegadaReal: string | null;
  duracionMin: number;
  distancia: number;
  tipoRuta: string;
  aeronave: { modelo: string; matricula: string; capacidad: number };
  puerta: string | null;
  estado: string;
}

export interface ResultadoVuelo extends VueloResumen {
  sillasDisponibles: number;
  precio: number;
  precios: Record<Clase, number>;
}

export interface Busqueda {
  origen: string;
  destino: string;
  fecha: string;
  pasajeros: number;
  clase: Clase;
}

export interface ResultadoBusqueda {
  vuelos: ResultadoVuelo[];
  fechasCercanas: { fecha: string; vuelos: number; desde: number }[];
  rutaExiste: boolean;
}

export interface PerfilCliente {
  tipo: 'cliente';
  id: string;
  nombres: string;
  apellidos: string;
  email: string;
  documento: string;
  ciudad: string;
  socio: { numero: string; nivel: string; saldo: number } | null;
}

export interface PerfilEmpleado {
  tipo: 'empleado';
  id: string;
  nombres: string;
  apellidos: string;
  cargo: string;
  departamento: string;
  secciones: string[];
}

export type Perfil = PerfilCliente | PerfilEmpleado;
export interface Actor {
  tipo: 'cliente' | 'empleado';
  id: string;
}
export interface Sesion {
  token: string;
  perfil: Perfil;
}

export interface Registro {
  documento: string;
  nombres: string;
  apellidos: string;
  email: string;
  telefono?: string;
  fechaNacimiento?: string;
  ciudad: string; // código IATA del aeropuerto de la ciudad de residencia
  afiliarSkymiles: boolean;
}

export interface PasajeroEntrada {
  nombres: string;
  apellidos: string;
  documento: string;
}

export interface NuevaReserva {
  idVuelo: string;
  clase: Clase;
  /** Pasajeros adicionales; el titular de la cuenta siempre viaja. */
  acompanantes: PasajeroEntrada[];
}

export interface TiqueteInfo {
  idTiquete: string;
  numero: string;
  pasajero: string;
  documento: string;
  clase: string;
  asiento: string | null;
  valor: number;
  estado: string;
  checkin: string | null;
  maletas: number;
}

export interface FacturaInfo {
  numero: string;
  fecha: string;
  subtotal: number;
  impuestos: number;
  total: number;
  pagos: { referencia: string | null; estado: string; valor: number; medio: string; fecha: string }[];
}

export interface ReservaDetalle {
  idReserva: string;
  codigo: string;
  fecha: string;
  canal: string;
  estado: string;
  numeroPasajeros: number;
  clase: Clase | null;
  vuelo: VueloResumen;
  pasajeros: { nombre: string; documento: string }[];
  tiquetes: TiqueteInfo[];
  factura: FacturaInfo | null;
  /** Liquidación esperada mientras está pendiente de pago. */
  liquidacion: { unitario: number; subtotal: number; impuestos: number; total: number } | null;
  email: string;
}

export interface MisReservas {
  proximas: ReservaDetalle[];
  anteriores: ReservaDetalle[];
}

export interface DatosTarjeta {
  numero: string;
  titular: string;
  vencimiento: string; // MM/AA
  cvv: string;
}

export interface MapaSillas {
  filas: number;
  letras: string[];
  ocupadas: string[];
  claseDeFila: Record<number, Clase>;
}

export interface CheckinInfo {
  tiquete: TiqueteInfo;
  codigoReserva: string;
  vuelo: VueloResumen;
  mapa: MapaSillas;
  abierto: boolean;
  motivoCerrado: string | null;
  pesoMaximoKg: number;
}

export interface PaseAbordar {
  idTiquete: string;
  numeroTiquete: string;
  pasajero: string;
  codigoReserva: string;
  vuelo: VueloResumen;
  clase: string;
  asiento: string;
  puerta: string | null;
  embarque: string;
  zona: number;
  socio: { numero: string; nivel: string } | null;
  maletas: { etiqueta: string; pesoKg: number }[];
  checkin: string;
}

export interface RastreoPunto {
  fechaHora: string;
  punto: string;
  estado: string;
  aeropuerto: string;
  ciudad: string;
}

export interface Maleta {
  etiqueta: string;
  pesoKg: number;
  estado: string;
  pasajero: string;
  vuelo: { numero: string; origen: string; destino: string; salida: string };
  ultimo: RastreoPunto | null;
  rastreo: RastreoPunto[];
}

export interface MovimientoMillasInfo {
  fecha: string;
  tipo: string;
  millas: number;
  detalle: string;
}

export interface CuentaSkymiles {
  numeroSocio: string;
  nivel: string;
  saldo: number;
  fechaAfiliacion: string;
  crownRoom: boolean;
  siguienteNivel: { nivel: string; faltan: number } | null;
  millasAnio: number;
  vuelosAnio: number;
}

export interface Skymiles {
  cuenta: CuentaSkymiles | null;
  movimientos: MovimientoMillasInfo[];
}

export interface Caso {
  idCaso: string;
  tipo: string;
  canal: string;
  descripcion: string;
  estado: string;
  apertura: string;
  cierre: string | null;
  cliente: string;
  documentoCliente: string;
  agente: string | null;
}

export interface NuevoCaso {
  tipo: string;
  descripcion: string;
}

export interface VueloTablero extends VueloResumen {
  pasajeros: number;
  checkins: number;
}

export interface EtapaVuelo {
  n: number;
  tipo: string;
  diagrama: string;
  estado: string;
  hecho: boolean;
  fechaHora: string | null;
  empleado: string | null;
}

export interface PasajeroVuelo {
  numeroTiquete: string;
  nombre: string;
  codigoReserva: string;
  clase: string;
  asiento: string | null;
  checkin: string | null;
  embarque: string | null;
  maletas: number;
  estado: string;
  socio: string | null;
}

export interface VueloOperacion {
  vuelo: VueloTablero;
  etapas: EtapaVuelo[];
  siguiente: number | null;
  tripulacion: { rol: string; nombre: string; idEmpleado: string }[];
  pasajeros: PasajeroVuelo[];
  eventos: { tipo: string; fechaHora: string; descripcion: string | null; empleado: string | null }[];
}

export interface AeronaveFlota {
  idAeronave: string;
  matricula: string;
  modelo: string;
  capacidad: number;
  estado: string;
  vuelosRealizados: number;
  horasVuelo: number;
  ultimoMantenimiento: { fecha: string; tipo: string } | null;
  proximoVuelo: { numero: string; salida: string; ruta: string } | null;
}

export interface MantenimientoInfo {
  id: string;
  matricula: string;
  modelo: string;
  tipo: string;
  descripcion: string | null;
  inicio: string;
  fin: string | null;
  estado: string;
  tecnico: string;
}

export interface EstadoDw {
  ultimaCarga: string | null;
  anios: number[];
  conteos: { tabla: string; filas: number }[];
}

export type DimensionCiudad = 'origen' | 'destino';

export interface FilaReporteCiudad {
  ciudad: string;
  valores: number[];
  valores2: number[];
  total: number;
  total2: number;
}

export interface ReporteCiudad {
  anio: number;
  dimension: DimensionCiudad;
  meses: string[];
  filas: FilaReporteCiudad[];
  totalesMes: number[];
  totalesMes2: number[];
  total: number;
  total2: number;
  sql: string;
}

export interface FilaReporteMillas {
  pasajero: string;
  nivel: string;
  valores: number[];
  vuelos: number[];
  total: number;
  totalVuelos: number;
}

export interface ReporteMillas {
  anio: number;
  meses: string[];
  filas: FilaReporteMillas[];
  totalPasajeros: number;
  totalesMes: number[];
  total: number;
  sql: string;
}
