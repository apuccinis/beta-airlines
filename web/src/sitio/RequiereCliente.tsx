import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useDatos } from '../datos';

/** Las páginas de la cuenta piden iniciar sesión y vuelven a donde iba el pasajero. */
export function RequiereCliente() {
  const { cliente } = useDatos();
  const { pathname, search } = useLocation();
  if (!cliente) return <Navigate to={`/ingresar?volver=${encodeURIComponent(pathname + search)}`} replace />;
  return <Outlet />;
}
