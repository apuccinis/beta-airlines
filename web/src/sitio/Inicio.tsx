import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CLASES, DIAS_PROGRAMACION, type Aeropuerto } from '@beta/core';
import { useCarga, useDatos } from '../datos';
import { Aviso, Boton, Chip, Codigo, Selector } from '../ui/comunes';
import { Icono, RUTA_AVION } from '../ui/Icono';
import { cuando, fechaISO, hora, sumarDias } from '../ui/formato';

/** Arco de ruta entre los dos códigos IATA del héroe. */
function Arco() {
  return (
    <svg className="arco" viewBox="0 0 400 100" preserveAspectRatio="none" aria-hidden="true">
      <path d="M6 94 Q200 -42 394 94" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="5 7" vectorEffect="non-scaling-stroke" />
      <circle cx="6" cy="94" r="4" fill="currentColor" />
      <circle cx="394" cy="94" r="4" fill="currentColor" />
      <g transform="translate(188 14) scale(1)">
        <path className="arco-avion" d={RUTA_AVION} />
      </g>
    </svg>
  );
}

function PuntoRuta({ a, lado, vacio }: { a?: Aeropuerto; lado: 'origen' | 'destino'; vacio: string }) {
  return (
    <div className={`ruta-punto ${lado === 'destino' ? 'ruta-punto-destino' : ''}`}>
      <span className={`iata-gigante ${a ? '' : 'iata-vacio'}`} aria-hidden="true">
        {a?.codigo ?? '···'}
      </span>
      <span className="ruta-ciudad">{a ? `${a.ciudad}, ${a.pais}` : vacio}</span>
    </div>
  );
}

function ProximoViaje() {
  const { cliente } = useDatos();
  const viajes = useCarga((d) => (cliente ? d.misReservas() : Promise.resolve(null)), [cliente?.id]);
  const r = viajes.datos?.proximas[0];
  if (!cliente) {
    return (
      <section className="panel panel-cuerpo proximo">
        <h2>Todo tu viaje en un solo lugar</h2>
        <ul className="lista-simple">
          <li>
            <Icono nombre="check" />
            <span>
              <strong>Check-in en línea</strong>
              Elige tu silla, registra tus maletas y descarga tu pase de abordar.
            </span>
          </li>
          <li>
            <Icono nombre="maleta" />
            <span>
              <strong>Tus maletas, en cada punto</strong>
              Sigue tu equipaje desde que lo documentas hasta la banda de entrega.
            </span>
          </li>
          <li>
            <Icono nombre="avion" />
            <span>
              <strong>Millas en cada vuelo</strong>
              Como socio Skymiles acumulas millas en cada vuelo y subes de nivel.
            </span>
          </li>
        </ul>
        <Link to="/registro" className="boton boton-secundario">
          Crear mi cuenta
        </Link>
      </section>
    );
  }
  return (
    <section className="panel panel-cuerpo proximo">
      <h2>Hola, {cliente.nombres}</h2>
      {viajes.cargando ? null : r ? (
        <>
          <div className="fila-entre">
            <span className="texto-2">Tu próximo viaje</span>
            <Chip estado={r.vuelo.estado} />
          </div>
          <div className="viaje-iatas">
            {r.vuelo.origen.codigo} <Icono nombre="avion" /> {r.vuelo.destino.codigo}
          </div>
          <p className="texto-2">
            {cuando(r.vuelo.salida)} a las {hora(r.vuelo.salida)}, vuelo <Codigo>{r.vuelo.numero}</Codigo>. Reserva <Codigo>{r.codigo}</Codigo>.
          </p>
          <div className="fila">
            <Link to={`/mis-viajes/${r.idReserva}`} className="boton boton-primario boton-chico">
              Ver mi viaje
            </Link>
            {r.estado === 'Confirmada' && (
              <Link to="/checkin" className="boton boton-secundario boton-chico">
                Hacer check-in
              </Link>
            )}
          </div>
        </>
      ) : (
        <p className="texto-2">No tienes viajes próximos. Elige un destino y reserva tu próximo vuelo.</p>
      )}
    </section>
  );
}

export function Inicio() {
  const navegar = useNavigate();
  const [params] = useSearchParams();
  const { cliente } = useDatos();
  const aeropuertos = useCarga((d) => d.aeropuertos(), []);
  const manana = fechaISO(sumarDias(new Date(), 1));
  const [origen, setOrigen] = useState(params.get('origen') ?? 'ATL');
  const [destino, setDestino] = useState(params.get('destino') ?? '');
  const [fecha, setFecha] = useState(params.get('fecha') ?? manana);
  const [pasajeros, setPasajeros] = useState(params.get('pasajeros') ?? '1');
  const [clase, setClase] = useState(params.get('clase') ?? 'Económica');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Beta Airlines | Vuelos a 12 ciudades';
  }, []);

  const porCodigo = useMemo(() => new Map((aeropuertos.datos ?? []).map((a) => [a.codigo, a])), [aeropuertos.datos]);
  const hoy = fechaISO(new Date());
  const ultimoDia = fechaISO(sumarDias(new Date(), DIAS_PROGRAMACION - 1));

  const buscar = (e: FormEvent) => {
    e.preventDefault();
    if (!origen || !destino) return setError('Elige el origen y el destino de tu viaje.');
    if (origen === destino) return setError('El origen y el destino deben ser distintos.');
    navegar(`/vuelos?${new URLSearchParams({ origen, destino, fecha, pasajeros, clase })}`);
  };

  const elegirDestino = (codigo: string) => {
    setDestino(codigo);
    setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.getElementById('campo-destino')?.focus({ preventScroll: true });
  };

  return (
    <>
      <section className="heroe" aria-labelledby="titulo-heroe">
        <div className="contenedor">
          <h1 id="titulo-heroe" className="heroe-titulo">
            {cliente ? `${cliente.nombres}, ¿a dónde vamos?` : '¿A dónde vamos?'}
          </h1>
          <div className="ruta-heroe" aria-live="polite">
            <PuntoRuta a={porCodigo.get(origen)} lado="origen" vacio="Elige el origen" />
            <Arco />
            <PuntoRuta a={porCodigo.get(destino)} lado="destino" vacio="Elige tu destino" />
          </div>
        </div>
      </section>

      <div className="contenedor">
        <form className="buscador" onSubmit={buscar} aria-label="Buscar vuelos">
          <Selector etiqueta="Desde" name="origen" value={origen} onChange={(e) => setOrigen(e.target.value)}>
            <option value="">Origen</option>
            {aeropuertos.datos?.map((a) => (
              <option key={a.codigo} value={a.codigo}>
                {a.ciudad} ({a.codigo})
              </option>
            ))}
          </Selector>
          <button
            type="button"
            className="intercambiar"
            aria-label="Intercambiar origen y destino"
            onClick={() => {
              setOrigen(destino);
              setDestino(origen);
            }}
          >
            <Icono nombre="intercambiar" tam={18} />
          </button>
          <Selector etiqueta="Hacia" name="destino" id="campo-destino" value={destino} onChange={(e) => setDestino(e.target.value)}>
            <option value="">Destino</option>
            {aeropuertos.datos
              ?.filter((a) => a.codigo !== origen)
              .map((a) => (
                <option key={a.codigo} value={a.codigo}>
                  {a.ciudad} ({a.codigo})
                </option>
              ))}
          </Selector>
          <div className="campo campo-fecha">
            <label htmlFor="campo-fecha">Fecha de ida</label>
            <input id="campo-fecha" name="fecha" type="date" min={hoy} max={ultimoDia} required value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <Selector etiqueta="Pasajeros" name="pasajeros" className="campo-pax" value={pasajeros} onChange={(e) => setPasajeros(e.target.value)}>
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? 'adulto' : 'adultos'}
              </option>
            ))}
          </Selector>
          <Selector etiqueta="Clase" name="clase" className="campo-clase" value={clase} onChange={(e) => setClase(e.target.value)}>
            {CLASES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Selector>
          <Boton type="submit">
            <Icono nombre="buscar" tam={18} />
            Buscar vuelos
          </Boton>
          {error && (
            <div className="buscador-error">
              <Aviso>{error}</Aviso>
            </div>
          )}
        </form>

        <div className="inicio-secciones">
          <section aria-labelledby="titulo-destinos">
            <h2 id="titulo-destinos">Nuestros destinos</h2>
            <p className="texto-2" style={{ marginTop: 6 }}>
              Volamos a {aeropuertos.datos?.length ?? 12} ciudades en Estados Unidos, Latinoamérica y Europa.
            </p>
            <div className="destinos">
              {aeropuertos.datos
                ?.filter((a) => a.codigo !== origen)
                .map((a) => (
                  <button key={a.codigo} type="button" className="destino" onClick={() => elegirDestino(a.codigo)}>
                    <span>
                      <strong>{a.ciudad}</strong>
                      <span>{a.pais}</span>
                    </span>
                    <Codigo>{a.codigo}</Codigo>
                  </button>
                ))}
            </div>
          </section>
          <ProximoViaje />
        </div>
      </div>
    </>
  );
}
