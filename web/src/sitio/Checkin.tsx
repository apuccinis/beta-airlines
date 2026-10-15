import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { CheckinInfo } from '@beta/core';
import { useCarga, useDatos } from '../datos';
import { Aviso, Boton, Cargando, Chip, Codigo, Encabezado, Vacio } from '../ui/comunes';
import { Icono } from '../ui/Icono';
import { cuando, fechaLarga, hora } from '../ui/formato';

/** Lista de tiquetes de los próximos viajes con su estado de check-in. */
export function CheckinInicio() {
  const viajes = useCarga((d) => d.misReservas(), []);
  const reservas = viajes.datos?.proximas.filter((r) => r.estado === 'Confirmada') ?? [];

  return (
    <div className="contenedor pagina">
      <Encabezado titulo="Check-in en línea">
        Elige tu silla, registra hasta 2 maletas por pasajero y obtén tu pase de abordar. El check-in cierra cuando empieza el abordaje.
      </Encabezado>
      {viajes.cargando && <Cargando />}
      {viajes.error && <Aviso>{viajes.error}</Aviso>}
      {viajes.datos && reservas.length === 0 && (
        <Vacio
          titulo="No tienes vuelos con check-in disponible"
          accion={
            <Link to="/" className="boton boton-primario">
              Buscar vuelos
            </Link>
          }
        >
          Cuando tengas una reserva confirmada, podrás hacer el check-in desde aquí.
        </Vacio>
      )}
      <div className="pila">
        {reservas.map((r) => (
          <section key={r.idReserva} className="panel">
            <div className="panel-titulo">
              <div>
                <div className="viaje-iatas">
                  {r.vuelo.origen.codigo} <Icono nombre="avion" /> {r.vuelo.destino.codigo}
                </div>
                <span className="chico texto-2">
                  {cuando(r.vuelo.salida)}, {hora(r.vuelo.salida)}. Vuelo <Codigo>{r.vuelo.numero}</Codigo>. Reserva <Codigo>{r.codigo}</Codigo>
                </span>
              </div>
              <Chip estado={r.vuelo.estado} />
            </div>
            <div className="panel-cuerpo" style={{ overflowX: 'auto' }}>
              <table className="tabla-simple">
                <tbody>
                  {r.tiquetes.map((t) => (
                    <tr key={t.idTiquete}>
                      <td>
                        <strong>{t.pasajero}</strong>
                        <div className="chico texto-3">
                          Clase {t.clase}, tiquete <Codigo>{t.numero}</Codigo>
                        </div>
                      </td>
                      <td>{t.checkin ? <Chip estado="Confirmada">Check-in hecho, silla {t.asiento}</Chip> : <Chip estado="Pendiente de pago">Sin check-in</Chip>}</td>
                      <td className="num">
                        {t.checkin ? (
                          <Link to={`/pase/${t.idTiquete}`} className="boton boton-secundario boton-chico">
                            Ver pase de abordar
                          </Link>
                        ) : (
                          <Link to={`/checkin/${t.idTiquete}`} className="boton boton-primario boton-chico">
                            Hacer check-in
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function MapaSillas({ info, valor, onElegir }: { info: CheckinInfo; valor: string; onElegir: (s: string) => void }) {
  const ocupadas = useMemo(() => new Set(info.mapa.ocupadas), [info.mapa.ocupadas]);
  const filas = Array.from({ length: info.mapa.filas }, (_, i) => i + 1);
  const [izq, der] = [info.mapa.letras.slice(0, 3), info.mapa.letras.slice(3)];
  const total = info.vuelo.aeronave.capacidad;
  const cabina = useRef<HTMLDivElement>(null);
  // Abre el mapa en la cabina del tiquete
  useEffect(() => {
    const zona = cabina.current?.querySelector<HTMLElement>(`[data-zona="${info.tiquete.clase}"]`);
    if (cabina.current && zona) cabina.current.scrollTop = zona.offsetTop - 70;
  }, [info.tiquete.clase]);

  const silla = (fila: number, l: string) => {
    const id = `${fila}${l}`;
    const indice = (fila - 1) * info.mapa.letras.length + info.mapa.letras.indexOf(l);
    if (indice >= total) return <span key={id} />;
    const ocupada = ocupadas.has(id);
    const otraClase = info.mapa.claseDeFila[fila] !== info.tiquete.clase;
    return (
      <button
        key={id}
        type="button"
        className={`silla ${ocupada ? 'silla-ocupada' : ''} ${otraClase && !ocupada ? 'silla-otra' : ''}`}
        disabled={ocupada || otraClase}
        aria-pressed={valor === id}
        aria-label={`Silla ${id}${ocupada ? ', ocupada' : otraClase ? `, cabina ${info.mapa.claseDeFila[fila]}` : ', disponible'}`}
        onClick={() => onElegir(id)}
      >
        {id}
      </button>
    );
  };

  return (
    <div className="cabina" role="group" aria-label="Mapa de sillas" ref={cabina}>
      <div className="cabina-letras" aria-hidden="true">
        <span />
        {izq.map((l) => (
          <span key={l}>{l}</span>
        ))}
        <span />
        {der.map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>
      {filas.map((f) => (
        <Fragment key={f}>
          {(f === 1 || info.mapa.claseDeFila[f] !== info.mapa.claseDeFila[f - 1]) && <div className="cabina-zona" data-zona={info.mapa.claseDeFila[f]}>
              {info.mapa.claseDeFila[f]}
            </div>}
          <div className="cabina-fila">
            <span className="fila-num">{f}</span>
            {izq.map((l) => silla(f, l))}
            <span />
            {der.map((l) => silla(f, l))}
          </div>
        </Fragment>
      ))}
    </div>
  );
}

export function CheckinTiquete() {
  const { id = '' } = useParams();
  const { datos } = useDatos();
  const navegar = useNavigate();
  const info = useCarga((d) => d.checkin(id), [id]);
  const [asiento, setAsiento] = useState('');
  const [maletas, setMaletas] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (info.cargando) return <Cargando />;
  const c = info.datos;
  if (!c) {
    return (
      <div className="contenedor pagina">
        <Aviso>{info.error ?? 'No encontramos el tiquete.'}</Aviso>
      </div>
    );
  }

  const confirmar = async () => {
    setError(null);
    if (!asiento) return setError('Elige una silla en el mapa.');
    setEnviando(true);
    try {
      await datos.hacerCheckin(id, { asiento, maletas: maletas.map((m) => Number(m.replace(',', '.'))) });
      navegar(`/pase/${id}`, { replace: true });
    } catch (err) {
      setError((err as Error).message);
      setEnviando(false);
      info.recargar(true);
    }
  };

  return (
    <div className="contenedor pagina">
      <div className="migas">
        <Link to="/checkin">
          <Icono nombre="atras" tam={16} /> Check-in
        </Link>
      </div>
      <Encabezado titulo={`Check-in de ${c.tiquete.pasajero}`}>
        Vuelo <Codigo>{c.vuelo.numero}</Codigo> de {c.vuelo.origen.ciudad} a {c.vuelo.destino.ciudad},{' '}
        {fechaLarga(c.vuelo.salida).toLowerCase()} a las {hora(c.vuelo.salida)}.
      </Encabezado>

      {!c.abierto ? (
        <Aviso tipo="info" titulo={c.motivoCerrado ?? 'El check-in no está disponible.'}>
          {c.tiquete.checkin ? <Link to={`/pase/${id}`}>Ver tu pase de abordar</Link> : 'Acércate al mostrador del aeropuerto si necesitas ayuda.'}
        </Aviso>
      ) : (
        <div className="checkin">
          <section className="pila">
            <div className="fila-entre">
              <h2>Elige tu silla</h2>
              <div className="leyenda" aria-hidden="true">
                <span>
                  <i style={{ border: '1.5px solid var(--primario)' }} />
                  Disponible
                </span>
                <span>
                  <i style={{ background: 'var(--primario)' }} />
                  Tu silla
                </span>
                <span>
                  <i style={{ background: 'var(--apagado-fondo)' }} />
                  Ocupada
                </span>
                <span>
                  <i style={{ border: '1.5px dashed var(--linea)' }} />
                  Otra cabina
                </span>
              </div>
            </div>
            <p className="texto-2 chico">Tu tiquete es de clase {c.tiquete.clase}: puedes elegir cualquier silla libre de esa cabina.</p>
            <MapaSillas info={c} valor={asiento} onElegir={setAsiento} />
          </section>

          <aside className="panel resumen-compra">
            <div className="panel-cuerpo pila">
              <div>
                <span className="texto-3 chico">Silla elegida</span>
                <div className="pase-iata" style={{ fontSize: 44, color: asiento ? 'var(--primario)' : 'var(--tinta-3)' }}>
                  {asiento || '—'}
                </div>
              </div>
              <div className="pila-chica">
                <div className="fila-entre">
                  <strong>Maletas para bodega</strong>
                  <div className="contador">
                    <button type="button" aria-label="Quitar una maleta" disabled={maletas.length === 0} onClick={() => setMaletas(maletas.slice(0, -1))}>
                      <Icono nombre="menos" tam={16} />
                    </button>
                    <output aria-live="polite">{maletas.length}</output>
                    <button type="button" aria-label="Agregar una maleta" disabled={maletas.length >= 2} onClick={() => setMaletas([...maletas, '20'])}>
                      <Icono nombre="mas" tam={16} />
                    </button>
                  </div>
                </div>
                <span className="chico texto-3">Hasta 2 maletas de máximo {c.pesoMaximoKg} kg cada una.</span>
                {maletas.map((m, i) => (
                  <div className="campo" key={i}>
                    <label htmlFor={`maleta-${i}`}>Peso de la maleta {i + 1} (kg)</label>
                    <input
                      id={`maleta-${i}`}
                      inputMode="decimal"
                      value={m}
                      onChange={(e) => setMaletas(maletas.map((x, j) => (j === i ? e.target.value.replace(/[^\d.,]/g, '') : x)))}
                    />
                  </div>
                ))}
              </div>
              {error && <Aviso>{error}</Aviso>}
              <Boton type="button" onClick={confirmar} cargando={enviando} disabled={!asiento}>
                Confirmar check-in
              </Boton>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
