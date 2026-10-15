import { BrowserRouter, HashRouter, Route, Routes } from 'react-router-dom';
import { MODO_LOCAL } from './datos';
import { LayoutSitio } from './sitio/LayoutSitio';
import { Inicio } from './sitio/Inicio';
import { Resultados } from './sitio/Resultados';
import { Ingresar, Registro } from './sitio/Cuenta';
import { DatosPasajeros } from './sitio/DatosPasajeros';
import { Pago } from './sitio/Pago';
import { Confirmacion } from './sitio/Confirmacion';
import { MisViajes, DetalleReserva } from './sitio/MisViajes';
import { CheckinInicio, CheckinTiquete } from './sitio/Checkin';
import { PaseAbordarPagina } from './sitio/PaseAbordar';
import { MisMaletas, RastreoMaleta } from './sitio/Maletas';
import { SkymilesPagina } from './sitio/Skymiles';
import { Ayuda } from './sitio/Ayuda';
import { RequiereCliente } from './sitio/RequiereCliente';
import { LayoutPortal, IngresoPortal, InicioPortal } from './portal/LayoutPortal';
import { Tablero } from './portal/Tablero';
import { DetalleVuelo } from './portal/DetalleVuelo';
import { ServicioCliente } from './portal/ServicioCliente';
import { Flota } from './portal/Flota';
import { Analitica } from './portal/Analitica';
import { NoEncontrado } from './sitio/NoEncontrado';

// GitHub Pages no redirige las rutas internas de una SPA: en modo estático se usa HashRouter.
const Router = MODO_LOCAL ? HashRouter : BrowserRouter;

export function App() {
  return (
    <Router>
      <Routes>
        <Route element={<LayoutSitio />}>
          <Route index element={<Inicio />} />
          <Route path="vuelos" element={<Resultados />} />
          <Route path="ingresar" element={<Ingresar />} />
          <Route path="registro" element={<Registro />} />
          <Route element={<RequiereCliente />}>
            <Route path="reserva/pasajeros" element={<DatosPasajeros />} />
            <Route path="reserva/:id/pago" element={<Pago />} />
            <Route path="reserva/:id/confirmacion" element={<Confirmacion />} />
            <Route path="mis-viajes" element={<MisViajes />} />
            <Route path="mis-viajes/:id" element={<DetalleReserva />} />
            <Route path="checkin" element={<CheckinInicio />} />
            <Route path="checkin/:id" element={<CheckinTiquete />} />
            <Route path="pase/:id" element={<PaseAbordarPagina />} />
            <Route path="maletas" element={<MisMaletas />} />
            <Route path="maletas/:etiqueta" element={<RastreoMaleta />} />
            <Route path="skymiles" element={<SkymilesPagina />} />
            <Route path="ayuda" element={<Ayuda />} />
          </Route>
          <Route path="*" element={<NoEncontrado />} />
        </Route>
        <Route path="operaciones/ingresar" element={<IngresoPortal />} />
        <Route path="operaciones" element={<LayoutPortal />}>
          <Route index element={<InicioPortal />} />
          <Route path="vuelos" element={<Tablero />} />
          <Route path="vuelos/:id" element={<DetalleVuelo />} />
          <Route path="servicio" element={<ServicioCliente />} />
          <Route path="flota" element={<Flota />} />
          <Route path="analitica" element={<Analitica />} />
        </Route>
      </Routes>
    </Router>
  );
}
