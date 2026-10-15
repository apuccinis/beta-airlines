import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ProveedorDatos, crearClienteDatos } from './datos';
import { App } from './App';
import { Marca } from './ui/Logo';
import './ui/estilos.css';

function Bienvenida() {
  return (
    <div className="bienvenida" role="status" aria-label="Cargando Beta Airlines">
      <Marca tam={64} />
      <span className="bienvenida-nombre">BETA AIRLINES</span>
      <span className="bienvenida-linea" aria-hidden="true" />
    </div>
  );
}

const raiz = createRoot(document.getElementById('raiz')!);
raiz.render(<Bienvenida />);

crearClienteDatos()
  .then((datos) =>
    raiz.render(
      <StrictMode>
        <ProveedorDatos datos={datos}>
          <App />
        </ProveedorDatos>
      </StrictMode>,
    ),
  )
  .catch((e) => {
    console.error(e);
    raiz.render(
      <div className="bienvenida">
        <Marca tam={64} />
        <p className="bienvenida-error">No pudimos cargar el sitio. Recarga la página para intentarlo de nuevo.</p>
      </div>,
    );
  });
