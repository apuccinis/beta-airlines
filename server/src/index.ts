import express, { type NextFunction, type Request, type Response } from 'express';
import { ErrorNegocio } from '@beta/core';
import { abrirAplicacion, claveValorEnArchivo, crearBases, type Aplicacion } from './bases';
import { Sesiones } from './sesion';
import { crearRutas } from './rutas';

const PUERTO = Number(process.env.PORT ?? 3001);

let aplicacion: Aplicacion = abrirAplicacion();
const sesiones = new Sesiones(claveValorEnArchivo());

/** Vuelve a crear las bases con los datos iniciales (opción "Restablecer datos" del portal interno). */
function restablecer() {
  aplicacion.cerrar();
  crearBases();
  aplicacion = abrirAplicacion();
}

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));
app.use('/api', crearRutas(() => aplicacion.api, sesiones, restablecer));
app.use('/api', (_req, res) => void res.status(404).json({ error: 'Recurso no encontrado.' }));

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ErrorNegocio) return void res.status(err.codigo).json({ error: err.message });
  if (err instanceof SyntaxError) return void res.status(400).json({ error: 'La solicitud no tiene un formato válido.' });
  console.error(err);
  res.status(500).json({ error: 'Tuvimos un problema procesando tu solicitud. Intenta de nuevo en unos minutos.' });
});

const servidor = app.listen(PUERTO, () => console.log(`API de Beta Airlines en http://localhost:${PUERTO}/api`));

for (const senal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(senal, () => {
    servidor.close();
    aplicacion.cerrar();
    process.exit(0);
  });
}
