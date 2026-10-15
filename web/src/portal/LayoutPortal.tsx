import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useDatos } from '../datos';
import { Logo, Marca } from '../ui/Logo';
import { Icono, type NombreIcono } from '../ui/Icono';
import { Aviso, Boton, Campo, useTema } from '../ui/comunes';
import { iniciales } from '../sitio/LayoutSitio';

export const SECCIONES: { id: string; ruta: string; texto: string; icono: NombreIcono }[] = [
  { id: 'tablero', ruta: '/operaciones/vuelos', texto: 'Tablero de vuelos', icono: 'tablero' },
  { id: 'servicio', ruta: '/operaciones/servicio', texto: 'Servicio al cliente', icono: 'auricular' },
  { id: 'flota', ruta: '/operaciones/flota', texto: 'Flota y mantenimiento', icono: 'llave' },
  { id: 'analitica', ruta: '/operaciones/analitica', texto: 'Analítica', icono: 'grafica' },
];

export function InicioPortal() {
  const { empleado } = useDatos();
  const primera = SECCIONES.find((s) => empleado?.secciones.includes(s.id));
  return <Navigate to={primera?.ruta ?? '/operaciones/ingresar'} replace />;
}

function MenuEmpleado() {
  const { empleado, datos, setEmpleado } = useDatos();
  const { tema, alternar } = useTema();
  const [abierto, setAbierto] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [restableciendo, setRestableciendo] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navegar = useNavigate();

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && (setAbierto(false), setConfirmar(false));
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, [abierto]);

  if (!empleado) return null;
  return (
    <div className="lateral-usuario" ref={ref}>
      {abierto && (
        <div className="menu" role="menu">
          {confirmar ? (
            <div className="pila-chica" style={{ padding: 8 }}>
              <strong>¿Restablecer los datos?</strong>
              <p className="chico texto-2">Se borran los cambios y se cargan de nuevo los vuelos, reservas y clientes iniciales.</p>
              <div className="fila">
                <Boton
                  variante="peligro"
                  className="boton-chico"
                  cargando={restableciendo}
                  onClick={async () => {
                    setRestableciendo(true);
                    await datos.restablecerDatos();
                    window.location.reload();
                  }}
                >
                  Restablecer
                </Boton>
                <Boton variante="fantasma" className="boton-chico" onClick={() => setConfirmar(false)}>
                  Cancelar
                </Boton>
              </div>
            </div>
          ) : (
            <>
              <button role="menuitem" type="button" onClick={alternar}>
                <Icono nombre={tema === 'claro' ? 'luna' : 'sol'} tam={18} />
                {tema === 'claro' ? 'Modo oscuro' : 'Modo claro'}
              </button>
              <Link role="menuitem" to="/">
                <Icono nombre="avion" tam={18} />
                Ir al sitio de pasajeros
              </Link>
              <button role="menuitem" type="button" onClick={() => setConfirmar(true)}>
                <Icono nombre="actualizar" tam={18} />
                Restablecer datos
              </button>
              <button
                role="menuitem"
                type="button"
                onClick={async () => {
                  await datos.salirEmpleado();
                  setEmpleado(null);
                  navegar('/operaciones/ingresar');
                }}
              >
                <Icono nombre="salir" tam={18} />
                Cerrar sesión
              </button>
            </>
          )}
        </div>
      )}
      <button type="button" aria-haspopup="menu" aria-expanded={abierto} onClick={() => setAbierto(!abierto)}>
        <span className="avatar">{iniciales(empleado.nombres, empleado.apellidos)}</span>
        <span>
          {empleado.nombres} {empleado.apellidos}
          <small>{empleado.cargo}</small>
        </span>
      </button>
    </div>
  );
}

export function LayoutPortal() {
  const { empleado } = useDatos();
  const { pathname } = useLocation();
  const [menu, setMenu] = useState(false);
  useEffect(() => setMenu(false), [pathname]);

  if (!empleado) return <Navigate to={`/operaciones/ingresar?volver=${encodeURIComponent(pathname)}`} replace />;
  const permitida = SECCIONES.find((s) => pathname.startsWith(s.ruta));
  if (permitida && !empleado.secciones.includes(permitida.id)) return <InicioPortal />;

  return (
    <div className="portal">
      <div className="portal-barra">
        <button className="boton-icono" type="button" aria-label="Abrir menú" onClick={() => setMenu(true)}>
          <Icono nombre="menu" />
        </button>
        <Marca tam={26} />
        <strong>Operaciones</strong>
      </div>
      <aside className="lateral" data-abierto={menu} aria-label="Portal de operaciones">
        <div className="fila-entre" style={{ alignItems: 'flex-start' }}>
          <Logo tam={30} sub="Operaciones" />
          {menu && (
            <button className="boton-icono" type="button" aria-label="Cerrar menú" onClick={() => setMenu(false)}>
              <Icono nombre="cerrar" />
            </button>
          )}
        </div>
        <nav className="lateral-nav">
          {SECCIONES.filter((s) => empleado.secciones.includes(s.id)).map((s) => (
            <NavLink key={s.id} to={s.ruta}>
              <Icono nombre={s.icono} />
              {s.texto}
            </NavLink>
          ))}
        </nav>
        <MenuEmpleado />
      </aside>
      <main className="portal-principal">
        <Outlet />
      </main>
    </div>
  );
}

export function IngresoPortal() {
  const { datos, empleado, setEmpleado } = useDatos();
  const navegar = useNavigate();
  const { search } = useLocation();
  const [documento, setDocumento] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    document.title = 'Portal de operaciones | Beta Airlines';
  }, []);

  if (empleado) return <InicioPortal />;
  const volver = new URLSearchParams(search).get('volver');

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      const p = await datos.ingresarEmpleado(documento);
      setEmpleado(p);
      const destino = volver && SECCIONES.some((s) => volver.startsWith(s.ruta) && p.secciones.includes(s.id)) ? volver : null;
      navegar(destino ?? SECCIONES.find((s) => p.secciones.includes(s.id))!.ruta, { replace: true });
    } catch (err) {
      setError((err as Error).message);
      setEnviando(false);
    }
  };

  return (
    <div className="ingreso-portal">
      <section className="ingreso-portal-marca">
        <Logo tam={34} sub="Portal de operaciones" />
        <div>
          <h1>Cada vuelo, de la puerta a la banda.</h1>
          <p>Tablero de vuelos, etapas de operación, servicio al cliente, flota y reportes en un solo lugar.</p>
        </div>
        <Link to="/" style={{ color: '#b7c3dc' }}>
          Ir al sitio de pasajeros
        </Link>
      </section>
      <section className="ingreso-portal-form">
        <form className="pila" onSubmit={enviar}>
          <div>
            <h2>Ingresa con tu documento</h2>
            <p className="texto-2" style={{ marginTop: 6 }}>
              Acceso para operaciones, despachos, servicio al cliente, mantenimiento y analítica.
            </p>
          </div>
          {error && <Aviso>{error}</Aviso>}
          <Campo
            etiqueta="Número de documento"
            name="documento"
            inputMode="numeric"
            autoComplete="username"
            required
            value={documento}
            onChange={(e) => setDocumento(e.target.value)}
          />
          <Boton type="submit" cargando={enviando}>
            Ingresar
          </Boton>
        </form>
      </section>
    </div>
  );
}
