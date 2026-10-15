import type { PerfilCliente, PerfilEmpleado, Sesion } from '@beta/core';
import { ErrorDatos, type ClienteDatos } from './ClienteDatos';

type Area = 'cliente' | 'empleado' | null;
const CLAVE = { cliente: 'beta.token.cliente', empleado: 'beta.token.empleado' } as const;

const leer = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const escribir = (k: string, v: string | null) => {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {
    /* almacenamiento no disponible */
  }
};

/** Modo completo: llama a la API REST en /api con un token JWT por área. */
export class ApiClient implements ClienteDatos {
  private async pedir<T>(area: Area, metodo: string, ruta: string, cuerpo?: unknown): Promise<T> {
    const headers: Record<string, string> = {};
    if (cuerpo !== undefined) headers['content-type'] = 'application/json';
    const token = area ? leer(CLAVE[area]) : null;
    if (token) headers.authorization = `Bearer ${token}`;
    let r: Response;
    try {
      r = await fetch(`/api${ruta}`, { method: metodo, headers, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) });
    } catch {
      throw new ErrorDatos('No pudimos conectarnos. Revisa tu conexión e intenta de nuevo.', 0);
    }
    const datos = await r.json().catch(() => ({}));
    if (!r.ok) {
      if (r.status === 401 && area) escribir(CLAVE[area], null);
      throw new ErrorDatos(datos.error ?? 'Tuvimos un problema procesando tu solicitud.', r.status);
    }
    return datos as T;
  }

  private get = <T>(area: Area, ruta: string) => this.pedir<T>(area, 'GET', ruta);
  private post = <T>(area: Area, ruta: string, cuerpo: unknown = {}) => this.pedir<T>(area, 'POST', ruta, cuerpo);

  private async sesion<T>(area: 'cliente' | 'empleado'): Promise<T | null> {
    if (!leer(CLAVE[area])) return null;
    try {
      const p = await this.get<PerfilCliente | PerfilEmpleado>(area, '/auth/sesion');
      return p.tipo === area ? (p as T) : null;
    } catch {
      return null;
    }
  }

  sesionCliente = () => this.sesion<PerfilCliente>('cliente');
  sesionEmpleado = () => this.sesion<PerfilEmpleado>('empleado');

  ingresarCliente = async (documento: string, email: string) => {
    const s = await this.post<Sesion>(null, '/auth/ingreso', { documento, email });
    escribir(CLAVE.cliente, s.token);
    return s.perfil as PerfilCliente;
  };
  registrar: ClienteDatos['registrar'] = async (r) => {
    const s = await this.post<Sesion>(null, '/auth/registro', r);
    escribir(CLAVE.cliente, s.token);
    return s.perfil as PerfilCliente;
  };
  ingresarEmpleado = async (documento: string) => {
    const s = await this.post<Sesion>(null, '/auth/empleados/ingreso', { documento });
    escribir(CLAVE.empleado, s.token);
    return s.perfil as PerfilEmpleado;
  };
  salirCliente = async () => escribir(CLAVE.cliente, null);
  salirEmpleado = async () => escribir(CLAVE.empleado, null);

  aeropuertos: ClienteDatos['aeropuertos'] = () => this.get(null, '/aeropuertos');
  buscarVuelos: ClienteDatos['buscarVuelos'] = (b) =>
    this.get(null, `/vuelos/buscar?${new URLSearchParams({ ...b, pasajeros: String(b.pasajeros) })}`);
  vuelo: ClienteDatos['vuelo'] = (id, clase) => this.get(null, `/vuelos/${id}?clase=${encodeURIComponent(clase)}`);

  crearReserva: ClienteDatos['crearReserva'] = (n) => this.post('cliente', '/reservas', n);
  misReservas: ClienteDatos['misReservas'] = () => this.get('cliente', '/reservas');
  reserva: ClienteDatos['reserva'] = (id) => this.get('cliente', `/reservas/${id}`);
  pagar: ClienteDatos['pagar'] = (id, t) => this.post('cliente', `/reservas/${id}/pago`, t);
  checkin: ClienteDatos['checkin'] = (id) => this.get('cliente', `/tiquetes/${id}/checkin`);
  hacerCheckin: ClienteDatos['hacerCheckin'] = (id, d) => this.post('cliente', `/tiquetes/${id}/checkin`, d);
  pase: ClienteDatos['pase'] = (id) => this.get('cliente', `/tiquetes/${id}/pase`);
  misMaletas: ClienteDatos['misMaletas'] = () => this.get('cliente', '/equipaje');
  rastrearMaleta: ClienteDatos['rastrearMaleta'] = (e) => this.get('cliente', `/equipaje/${encodeURIComponent(e)}`);
  skymiles: ClienteDatos['skymiles'] = () => this.get('cliente', '/millas');
  afiliarSkymiles: ClienteDatos['afiliarSkymiles'] = () => this.post('cliente', '/millas/afiliacion');
  misCasos: ClienteDatos['misCasos'] = () => this.get('cliente', '/casos');
  abrirCaso: ClienteDatos['abrirCaso'] = (n) => this.post('cliente', '/casos', n);

  tablero: ClienteDatos['tablero'] = () => this.get('empleado', '/ops/vuelos');
  vueloOperacion: ClienteDatos['vueloOperacion'] = (id) => this.get('empleado', `/ops/vuelos/${id}`);
  registrarEtapa: ClienteDatos['registrarEtapa'] = (id) => this.post('empleado', `/ops/vuelos/${id}/etapas`);
  casos: ClienteDatos['casos'] = (estado) => this.get('empleado', `/ops/casos${estado ? `?estado=${encodeURIComponent(estado)}` : ''}`);
  atenderCaso: ClienteDatos['atenderCaso'] = (id) => this.post('empleado', `/ops/casos/${id}/atender`);
  cerrarCaso: ClienteDatos['cerrarCaso'] = (id) => this.post('empleado', `/ops/casos/${id}/cerrar`);
  flota: ClienteDatos['flota'] = () => this.get('empleado', '/ops/flota');
  mantenimientos: ClienteDatos['mantenimientos'] = () => this.get('empleado', '/ops/mantenimientos');
  restablecerDatos = async () => {
    await this.post('empleado', '/ops/restablecer');
    escribir(CLAVE.cliente, null);
  };

  estadoDw: ClienteDatos['estadoDw'] = () => this.get('empleado', '/analitica/estado');
  ejecutarEtl: ClienteDatos['ejecutarEtl'] = () => this.post('empleado', '/analitica/etl');
  reporteIngresos: ClienteDatos['reporteIngresos'] = (anio, ciudad) => this.get('empleado', `/analitica/ingresos?anio=${anio}&ciudad=${ciudad}`);
  reporteReservas: ClienteDatos['reporteReservas'] = (anio, ciudad) => this.get('empleado', `/analitica/reservas?anio=${anio}&ciudad=${ciudad}`);
  reporteMillas: ClienteDatos['reporteMillas'] = (anio, q) =>
    this.get('empleado', `/analitica/millas-nacionales?anio=${anio}${q ? `&q=${encodeURIComponent(q)}` : ''}`);
}
