import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useCarga, useDatos } from '../datos';
import { Aviso, Boton, Campo, Encabezado, Selector } from '../ui/comunes';

function useVolver() {
  const [params] = useSearchParams();
  const volver = params.get('volver');
  return volver && volver.startsWith('/') ? volver : '/mis-viajes';
}

export function Ingresar() {
  const { datos, setCliente } = useDatos();
  const navegar = useNavigate();
  const volver = useVolver();
  const [documento, setDocumento] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      setCliente(await datos.ingresarCliente(documento, email));
      navegar(volver, { replace: true });
    } catch (err) {
      setError((err as Error).message);
      setEnviando(false);
    }
  };

  return (
    <div className="contenedor pagina">
      <div className="ingreso">
        <Encabezado titulo="Inicia sesión">Usa tu número de documento y el correo con el que te registraste.</Encabezado>
        <form className="panel panel-cuerpo pila" onSubmit={enviar}>
          {error && <Aviso>{error}</Aviso>}
          <Campo
            etiqueta="Número de documento"
            name="documento"
            autoComplete="username"
            inputMode="numeric"
            required
            value={documento}
            onChange={(e) => setDocumento(e.target.value)}
          />
          <Campo
            etiqueta="Correo electrónico"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Boton type="submit" cargando={enviando}>
            Iniciar sesión
          </Boton>
          <p className="chico texto-2">
            ¿Primera vez con nosotros? <Link to={`/registro?volver=${encodeURIComponent(volver)}`}>Crea tu cuenta</Link>
          </p>
        </form>
      </div>
    </div>
  );
}

export function Registro() {
  const { datos, setCliente } = useDatos();
  const navegar = useNavigate();
  const volver = useVolver();
  const aeropuertos = useCarga((d) => d.aeropuertos(), []);
  const [f, setF] = useState({
    documento: '',
    nombres: '',
    apellidos: '',
    email: '',
    telefono: '',
    fechaNacimiento: '',
    ciudad: '',
    afiliarSkymiles: true,
  });
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const cambiar = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      setCliente(await datos.registrar(f));
      navegar(volver, { replace: true });
    } catch (err) {
      setError((err as Error).message);
      setEnviando(false);
    }
  };

  return (
    <div className="contenedor pagina">
      <div className="ingreso" style={{ maxWidth: 620 }}>
        <Encabezado titulo="Crea tu cuenta">Con tu cuenta reservas más rápido, haces check-in en línea y sigues tus maletas.</Encabezado>
        <form className="panel panel-cuerpo pila" onSubmit={enviar}>
          {error && <Aviso>{error}</Aviso>}
          <div className="rejilla-2">
            <Campo etiqueta="Nombres" required value={f.nombres} onChange={cambiar('nombres')} autoComplete="given-name" />
            <Campo etiqueta="Apellidos" required value={f.apellidos} onChange={cambiar('apellidos')} autoComplete="family-name" />
            <Campo etiqueta="Número de documento" required value={f.documento} onChange={cambiar('documento')} inputMode="numeric" ayuda="Cédula o pasaporte, sin puntos." />
            <Campo etiqueta="Fecha de nacimiento" type="date" value={f.fechaNacimiento} onChange={cambiar('fechaNacimiento')} />
            <Campo etiqueta="Correo electrónico" type="email" required value={f.email} onChange={cambiar('email')} autoComplete="email" />
            <Campo etiqueta="Celular" type="tel" value={f.telefono} onChange={cambiar('telefono')} autoComplete="tel" />
          </div>
          <Selector etiqueta="Ciudad de residencia" required value={f.ciudad} onChange={cambiar('ciudad')}>
            <option value="">Elige tu ciudad</option>
            {aeropuertos.datos?.map((a) => (
              <option key={a.codigo} value={a.codigo}>
                {a.ciudad}, {a.pais}
              </option>
            ))}
          </Selector>
          <label className="fila" style={{ gap: 10, alignItems: 'flex-start' }}>
            <input type="checkbox" checked={f.afiliarSkymiles} onChange={(e) => setF({ ...f, afiliarSkymiles: e.target.checked })} style={{ marginTop: 4 }} />
            <span>
              Quiero ser socio Skymiles y acumular millas en cada vuelo.
              <span className="chico texto-3" style={{ display: 'block' }}>
                La afiliación no tiene costo.
              </span>
            </span>
          </label>
          <Boton type="submit" cargando={enviando}>
            Crear cuenta
          </Boton>
          <p className="chico texto-2">
            ¿Ya tienes cuenta? <Link to={`/ingresar?volver=${encodeURIComponent(volver)}`}>Inicia sesión</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
