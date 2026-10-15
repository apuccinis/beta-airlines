import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useDatos } from '../datos';
import { Logo } from '../ui/Logo';
import { Icono } from '../ui/Icono';
import { BotonTema } from '../ui/comunes';
import { numero } from '../ui/formato';

export const iniciales = (n: string, a: string) => `${n[0] ?? ''}${a[0] ?? ''}`.toUpperCase();

function MenuCuenta() {
  const { cliente, datos, setCliente } = useDatos();
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navegar = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => setAbierto(false), [pathname]);
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setAbierto(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAbierto(false);
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', esc);
    };
  }, [abierto]);

  if (!cliente) {
    return (
      <Link to="/ingresar" className="boton boton-secundario boton-chico">
        <Icono nombre="persona" tam={18} />
        <span className="texto-boton">Iniciar sesión</span>
      </Link>
    );
  }
  return (
    <div className="cuenta" ref={ref}>
      <button className="cuenta-boton" type="button" aria-expanded={abierto} aria-haspopup="menu" onClick={() => setAbierto(!abierto)}>
        <span className="avatar">{iniciales(cliente.nombres, cliente.apellidos)}</span>
        <span className="cuenta-nombre">{cliente.nombres}</span>
      </button>
      {abierto && (
        <div className="menu" role="menu">
          <div className="menu-cabeza">
            <strong>
              {cliente.nombres} {cliente.apellidos}
            </strong>
            <div className="chico texto-3">
              {cliente.socio ? `Skymiles ${cliente.socio.nivel}, ${numero(cliente.socio.saldo)} millas` : cliente.email}
            </div>
          </div>
          <Link role="menuitem" to="/mis-viajes">
            Mis viajes
          </Link>
          <Link role="menuitem" to="/skymiles">
            Skymiles
          </Link>
          <Link role="menuitem" to="/ayuda">
            Mis solicitudes
          </Link>
          <button
            role="menuitem"
            type="button"
            onClick={async () => {
              await datos.salirCliente();
              setCliente(null);
              navegar('/');
            }}
          >
            <Icono nombre="salir" tam={18} />
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}

export function LayoutSitio() {
  const [navAbierta, setNavAbierta] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => {
    setNavAbierta(false);
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="sitio">
      <a href="#contenido" className="sr-solo">
        Ir al contenido
      </a>
      <header className="cabecera">
        <div className="contenedor cabecera-fila">
          <Link to="/" className="logo" aria-label="Beta Airlines, inicio">
            <Logo />
          </Link>
          <nav className="nav" data-abierto={navAbierta} aria-label="Principal">
            <NavLink to="/" end>
              Reservar
            </NavLink>
            <NavLink to="/mis-viajes">Mis viajes</NavLink>
            <NavLink to="/checkin">Check-in</NavLink>
            <NavLink to="/maletas">Equipaje</NavLink>
            <NavLink to="/skymiles">Skymiles</NavLink>
            <NavLink to="/ayuda">Ayuda</NavLink>
          </nav>
          <div className="cabecera-acciones">
            <BotonTema />
            <MenuCuenta />
            <button
              className="boton-icono menu-boton"
              type="button"
              aria-label="Menú"
              aria-expanded={navAbierta}
              onClick={() => setNavAbierta(!navAbierta)}
            >
              <Icono nombre={navAbierta ? 'cerrar' : 'menu'} />
            </button>
          </div>
        </div>
      </header>
      <main id="contenido" className="sitio-principal">
        <Outlet />
      </main>
      <footer className="pie">
        <div className="contenedor fila-entre">
          <span>© {new Date().getFullYear()} Beta Airlines. Todos los derechos reservados.</span>
          <span className="fila">
            <Link to="/ayuda">Centro de ayuda</Link>
            <Link to="/operaciones">Portal de empleados</Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
