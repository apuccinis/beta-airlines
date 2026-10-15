import { Link } from 'react-router-dom';
import { Vacio } from '../ui/comunes';

export function NoEncontrado() {
  return (
    <div className="contenedor pagina">
      <Vacio
        titulo="No encontramos esta página"
        accion={
          <Link to="/" className="boton boton-primario">
            Buscar vuelos
          </Link>
        }
      >
        Puede que el enlace haya cambiado. Vuelve al inicio para buscar tu vuelo.
      </Vacio>
    </div>
  );
}
