import { Router, type Request } from 'express';
import { ErrorNegocio, esClase, type Actor, type BetaApi, type Perfil } from '@beta/core';
import type { Sesiones } from './sesion';

/** Validación de entrada: las rutas solo validan tipos y formas, y delegan en los servicios de core/. */
const texto = (v: unknown, campo: string, max = 200): string => {
  if (typeof v !== 'string' || !v.trim()) throw new ErrorNegocio(`Falta el campo ${campo}.`, 400);
  if (v.length > max) throw new ErrorNegocio(`El campo ${campo} es demasiado largo.`, 400);
  return v;
};
const opcional = (v: unknown, max = 200) => (typeof v === 'string' && v.length <= max ? v : undefined);
const entero = (v: unknown, campo: string): number => {
  const n = Number(v);
  if (!Number.isInteger(n)) throw new ErrorNegocio(`El campo ${campo} debe ser un número entero.`, 400);
  return n;
};
const id = (v: unknown) => {
  if (typeof v !== 'string' || !/^[A-Z]{2}\d{8}$/.test(v)) throw new ErrorNegocio('Identificador no válido.', 400);
  return v;
};
const objeto = (v: unknown): Record<string, any> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, any>) : {});

export function crearRutas(api: () => BetaApi, sesiones: Sesiones, restablecer: () => void): Router {
  const r = Router();
  const actor = (req: Request): Actor | null => sesiones.deSolicitud(req);
  const conToken = (perfil: Perfil) => ({ token: sesiones.firmar({ tipo: perfil.tipo, id: perfil.id }), perfil });

  // ---------- público ----------
  r.get('/aeropuertos', (_req, res) => void res.json(api().aeropuertos()));
  r.get('/vuelos/buscar', (req, res) => {
    const q = req.query;
    res.json(
      api().buscarVuelos({
        origen: texto(q.origen, 'origen', 3),
        destino: texto(q.destino, 'destino', 3),
        fecha: texto(q.fecha, 'fecha', 10),
        pasajeros: entero(q.pasajeros ?? 1, 'pasajeros'),
        clase: esClase(q.clase) ? q.clase : 'Económica',
      }),
    );
  });
  r.get('/vuelos/:id', (req, res) => void res.json(api().vuelo(id(req.params.id), String(req.query.clase ?? ''))));

  // ---------- sesión ----------
  r.post('/auth/ingreso', (req, res) => {
    const b = objeto(req.body);
    res.json(conToken(api().ingresarCliente(texto(b.documento, 'documento', 20), texto(b.email, 'correo', 80))));
  });
  r.post('/auth/registro', (req, res) => {
    const b = objeto(req.body);
    const perfil = api().registrar({
      documento: texto(b.documento, 'documento', 20),
      nombres: texto(b.nombres, 'nombres', 40),
      apellidos: texto(b.apellidos, 'apellidos', 40),
      email: texto(b.email, 'correo', 80),
      telefono: opcional(b.telefono, 20),
      fechaNacimiento: opcional(b.fechaNacimiento, 10),
      ciudad: texto(b.ciudad, 'ciudad', 3),
      afiliarSkymiles: b.afiliarSkymiles === true,
    });
    res.status(201).json(conToken(perfil));
  });
  r.post('/auth/empleados/ingreso', (req, res) => {
    res.json(conToken(api().ingresarEmpleado(texto(objeto(req.body).documento, 'documento', 20))));
  });
  r.get('/auth/sesion', (req, res) => {
    const a = actor(req);
    if (!a) throw new ErrorNegocio('No hay una sesión activa.', 401);
    res.json(api().perfil(a));
  });

  // ---------- pasajeros ----------
  r.post('/reservas', (req, res) => {
    const b = objeto(req.body);
    const acompanantes = Array.isArray(b.acompanantes) ? b.acompanantes.slice(0, 4).map(objeto) : [];
    res.status(201).json(
      api().crearReserva(actor(req), {
        idVuelo: id(b.idVuelo),
        clase: esClase(b.clase) ? b.clase : (() => { throw new ErrorNegocio('Elige una clase válida.', 400); })(),
        acompanantes: acompanantes.map((p) => ({
          nombres: texto(p.nombres, 'nombres', 40),
          apellidos: texto(p.apellidos, 'apellidos', 40),
          documento: texto(p.documento, 'documento', 20),
        })),
      }),
    );
  });
  r.get('/reservas', (req, res) => void res.json(api().misReservas(actor(req))));
  r.get('/reservas/:id', (req, res) => void res.json(api().reserva(actor(req), id(req.params.id))));
  r.post('/reservas/:id/pago', (req, res) => {
    const b = objeto(req.body);
    res.json(
      api().pagar(actor(req), id(req.params.id), {
        numero: texto(b.numero, 'número de tarjeta', 25),
        titular: texto(b.titular, 'titular', 60),
        vencimiento: texto(b.vencimiento, 'vencimiento', 7),
        cvv: texto(b.cvv, 'CVV', 4),
      }),
    );
  });
  r.get('/tiquetes/:id/checkin', (req, res) => void res.json(api().checkin(actor(req), id(req.params.id))));
  r.post('/tiquetes/:id/checkin', (req, res) => {
    const b = objeto(req.body);
    const maletas = Array.isArray(b.maletas) ? b.maletas.map((m: unknown) => Number(m)) : [];
    res.status(201).json(api().hacerCheckin(actor(req), id(req.params.id), { asiento: texto(b.asiento, 'silla', 4), maletas }));
  });
  r.get('/tiquetes/:id/pase', (req, res) => void res.json(api().pase(actor(req), id(req.params.id))));
  r.get('/equipaje', (req, res) => void res.json(api().misMaletas(actor(req))));
  r.get('/equipaje/:etiqueta', (req, res) => void res.json(api().rastrearMaleta(actor(req), texto(req.params.etiqueta, 'etiqueta', 12))));
  r.get('/millas', (req, res) => void res.json(api().skymiles(actor(req))));
  r.post('/millas/afiliacion', (req, res) => void res.status(201).json(api().afiliarSkymiles(actor(req))));
  r.get('/casos', (req, res) => void res.json(api().misCasos(actor(req))));
  r.post('/casos', (req, res) => {
    const b = objeto(req.body);
    res.status(201).json(api().abrirCaso(actor(req), { tipo: texto(b.tipo, 'tipo', 30), descripcion: texto(b.descripcion, 'descripción', 400) }));
  });

  // ---------- portal interno ----------
  r.get('/ops/vuelos', (req, res) => void res.json(api().tablero(actor(req))));
  r.get('/ops/vuelos/:id', (req, res) => void res.json(api().vueloOperacion(actor(req), id(req.params.id))));
  r.post('/ops/vuelos/:id/etapas', (req, res) => void res.status(201).json(api().registrarEtapa(actor(req), id(req.params.id))));
  r.get('/ops/casos', (req, res) => void res.json(api().casos(actor(req), opcional(req.query.estado, 20))));
  r.post('/ops/casos/:id/atender', (req, res) => void res.json(api().atenderCaso(actor(req), id(req.params.id))));
  r.post('/ops/casos/:id/cerrar', (req, res) => void res.json(api().cerrarCaso(actor(req), id(req.params.id))));
  r.get('/ops/flota', (req, res) => void res.json(api().flota(actor(req))));
  r.get('/ops/mantenimientos', (req, res) => void res.json(api().mantenimientos(actor(req))));
  r.post('/ops/restablecer', (req, res) => {
    api().s.auth.exigirEmpleado(actor(req));
    restablecer();
    res.json({ ok: true });
  });

  // ---------- analítica ----------
  r.get('/analitica/estado', (req, res) => void res.json(api().estadoDw(actor(req))));
  r.post('/analitica/etl', (req, res) => void res.json(api().ejecutarEtl(actor(req))));
  r.get('/analitica/ingresos', (req, res) =>
    void res.json(api().reporteIngresos(actor(req), entero(req.query.anio, 'año'), opcional(req.query.ciudad, 10))),
  );
  r.get('/analitica/reservas', (req, res) =>
    void res.json(api().reporteReservas(actor(req), entero(req.query.anio, 'año'), opcional(req.query.ciudad, 10))),
  );
  r.get('/analitica/millas-nacionales', (req, res) =>
    void res.json(api().reporteMillas(actor(req), entero(req.query.anio, 'año'), opcional(req.query.q, 60))),
  );

  return r;
}
