import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useCarga, useDatos } from '../datos';
import { Aviso, Boton, Cargando, Chip, Codigo } from '../ui/comunes';
import { Icono } from '../ui/Icono';
import { fechaHora, fechaLarga, hora } from '../ui/formato';

export function DetalleVuelo() {
  const { id = '' } = useParams();
  const { datos } = useDatos();
  const op = useCarga((d) => d.vueloOperacion(id), [id]);
  const [registrando, setRegistrando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (op.cargando) return <Cargando />;
  if (!op.datos) return <Aviso>{op.error ?? 'No encontramos el vuelo.'}</Aviso>;
  const { vuelo: v, etapas, siguiente, tripulacion, pasajeros, eventos } = op.datos;
  document.title = `Vuelo ${v.numero} | Operaciones Beta Airlines`;

  const registrar = async () => {
    setRegistrando(true);
    setError(null);
    try {
      op.setDatos(await datos.registrarEtapa(id));
    } catch (e) {
      setError((e as Error).message);
    }
    setRegistrando(false);
  };

  const maletas = pasajeros.reduce((s, p) => s + p.maletas, 0);

  return (
    <>
      <div className="migas">
        <Link to="/operaciones/vuelos">
          <Icono nombre="atras" tam={16} /> Tablero de vuelos
        </Link>
      </div>
      <header className="vuelo-cabeza">
        <span className="vuelo-numero">{v.numero}</span>
        <div>
          <div className="vuelo-cabeza-ruta">
            {v.origen.codigo} <Icono nombre="avion" /> {v.destino.codigo}
          </div>
          <span className="texto-2">
            {v.origen.ciudad} a {v.destino.ciudad}, {fechaLarga(v.salida).toLowerCase()}
          </span>
        </div>
        <Chip estado={v.estado} />
      </header>

      <dl className="datos-vuelo">
        <div>
          <dt>Salida programada</dt>
          <dd>{hora(v.salida)}</dd>
        </div>
        <div>
          <dt>Salida real</dt>
          <dd>{hora(v.salidaReal)}</dd>
        </div>
        <div>
          <dt>Llegada programada</dt>
          <dd>{hora(v.llegada)}</dd>
        </div>
        <div>
          <dt>Llegada real</dt>
          <dd>{hora(v.llegadaReal)}</dd>
        </div>
        <div>
          <dt>Puerta</dt>
          <dd>{v.puerta ?? 'Sin asignar'}</dd>
        </div>
        <div>
          <dt>Aeronave</dt>
          <dd>
            {v.aeronave.matricula}, {v.aeronave.modelo}
          </dd>
        </div>
      </dl>

      <section className="panel">
        <div className="panel-titulo">
          <div>
            <h2>Etapas del vuelo</h2>
            <span className="chico texto-3">Cada etapa queda registrada como un evento del vuelo con la hora y el despachador.</span>
          </div>
          {siguiente !== null ? (
            <Boton onClick={registrar} cargando={registrando}>
              Registrar etapa: {etapas[siguiente].tipo}
            </Boton>
          ) : (
            <Chip estado="Finalizado">Todas las etapas completadas</Chip>
          )}
        </div>
        <div className="panel-cuerpo pila">
          {error && <Aviso>{error}</Aviso>}
          <ol className="etapas">
            {etapas.map((e, i) => (
              <li key={e.n} className="etapa" data-estado={e.hecho ? 'hecho' : i === siguiente ? 'siguiente' : 'pendiente'}>
                <div className="etapa-marca">
                  <span className="etapa-num">{e.hecho ? <Icono nombre="check" tam={15} /> : e.n}</span>
                </div>
                <strong>{e.tipo}</strong>
                <small>{e.diagrama}</small>
                <small>{e.hecho ? `${hora(e.fechaHora)}, ${e.empleado ?? ''}` : `Deja el vuelo: ${e.estado.toLowerCase()}`}</small>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <div className="detalle-rejilla">
        <section className="panel">
          <div className="panel-titulo">
            <h2>Pasajeros</h2>
            <span className="chico texto-2">
              {v.pasajeros} con tiquete, {v.checkins} con check-in, {maletas} maletas. Capacidad {v.aeronave.capacidad}.
            </span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="tabla">
              <thead>
                <tr>
                  <th>Silla</th>
                  <th>Pasajero</th>
                  <th>Reserva</th>
                  <th>Clase</th>
                  <th>Check-in</th>
                  <th>Maletas</th>
                  <th>Skymiles</th>
                  <th>Tiquete</th>
                </tr>
              </thead>
              <tbody>
                {pasajeros.map((p) => (
                  <tr key={p.numeroTiquete}>
                    <td>{p.asiento ? <Codigo>{p.asiento}</Codigo> : '—'}</td>
                    <td>{p.nombre}</td>
                    <td>
                      <Codigo>{p.codigoReserva}</Codigo>
                    </td>
                    <td>{p.clase}</td>
                    <td>{p.checkin ? hora(p.checkin) + (p.checkin.slice(0, 10) !== v.salida.slice(0, 10) ? ' (día anterior)' : '') : 'Pendiente'}</td>
                    <td>{p.maletas}</td>
                    <td>{p.socio ?? '—'}</td>
                    <td>
                      <Chip estado={p.estado} />
                    </td>
                  </tr>
                ))}
                {pasajeros.length === 0 && (
                  <tr>
                    <td colSpan={8} className="texto-3">
                      Este vuelo todavía no tiene pasajeros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <div className="pila">
          <section className="panel">
            <div className="panel-titulo">
              <h2>Tripulación</h2>
            </div>
            <div className="panel-cuerpo">
              {tripulacion.length ? (
                <ul className="tripulacion">
                  {tripulacion.map((t) => (
                    <li key={t.idEmpleado}>
                      <strong>{t.nombre}</strong>
                      <span>{t.rol}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="texto-3 chico">Se asigna en la etapa Asignar recursos.</p>
              )}
            </div>
          </section>
          <section className="panel">
            <div className="panel-titulo">
              <h2>Eventos</h2>
            </div>
            <div className="panel-cuerpo">
              {eventos.length ? (
                <ol className="eventos">
                  {eventos.map((e, i) => (
                    <li key={i}>
                      <time dateTime={e.fechaHora} title={fechaHora(e.fechaHora)}>
                        {hora(e.fechaHora)}
                      </time>
                      <div>
                        <strong>{e.tipo}</strong>
                        {e.descripcion && <p>{e.descripcion}</p>}
                        {e.empleado && <p className="texto-3">{e.empleado}</p>}
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="texto-3 chico">Todavía no hay eventos registrados.</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
