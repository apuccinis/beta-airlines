import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { ReservaDetalle } from '@beta/core';
import { useCarga } from '../datos';
import { Aviso, Cargando, Chip, Codigo, Encabezado, Pestanas, Vacio } from '../ui/comunes';
import { Icono } from '../ui/Icono';
import { cuando, dinero, duracion, fechaHora, fechaLarga, hora, horaLlegada } from '../ui/formato';

function Viaje({ r }: { r: ReservaDetalle }) {
  const pendientesCheckin = r.estado === 'Confirmada' && r.tiquetes.some((t) => t.estado === 'Emitido' && !t.checkin);
  const conPase = r.tiquetes.find((t) => t.checkin && (t.estado === 'Emitido' || t.estado === 'Abordado'));
  return (
    <article className="viaje">
      <div className="viaje-fecha">
        <strong>{cuando(r.vuelo.salida)}</strong>
        <span className="texto-2">
          {hora(r.vuelo.salida)} a {horaLlegada(r.vuelo.salida, r.vuelo.llegada)}
        </span>
      </div>
      <div className="viaje-ruta">
        <div className="viaje-iatas">
          {r.vuelo.origen.codigo} <Icono nombre="avion" /> {r.vuelo.destino.codigo}
        </div>
        <div className="fila chico texto-2">
          <span>
            Reserva <Codigo>{r.codigo}</Codigo>
          </span>
          <span>
            Vuelo <Codigo>{r.vuelo.numero}</Codigo>
          </span>
          <span>{r.numeroPasajeros === 1 ? '1 pasajero' : `${r.numeroPasajeros} pasajeros`}</span>
          <Chip estado={r.estado} />
          {r.estado !== 'Cancelada' && r.vuelo.estado !== 'Programado' && <Chip estado={r.vuelo.estado}>Vuelo: {r.vuelo.estado.toLowerCase()}</Chip>}
        </div>
      </div>
      <div className="viaje-acciones">
        {r.estado === 'Pendiente de pago' && (
          <Link to={`/reserva/${r.idReserva}/pago`} className="boton boton-primario boton-chico">
            Pagar reserva
          </Link>
        )}
        {pendientesCheckin && (
          <Link to="/checkin" className="boton boton-primario boton-chico">
            Hacer check-in
          </Link>
        )}
        {conPase && (
          <Link to={`/pase/${conPase.idTiquete}`} className="boton boton-secundario boton-chico">
            Pase de abordar
          </Link>
        )}
        <Link to={`/mis-viajes/${r.idReserva}`} className="boton boton-fantasma boton-chico">
          Ver detalle
        </Link>
      </div>
    </article>
  );
}

export function MisViajes() {
  const viajes = useCarga((d) => d.misReservas(), []);
  const [vista, setVista] = useState<'proximos' | 'anteriores'>('proximos');
  const lista = vista === 'proximos' ? viajes.datos?.proximas : viajes.datos?.anteriores;

  return (
    <div className="contenedor pagina">
      <Encabezado
        titulo="Mis viajes"
        acciones={
          <Pestanas
            etiqueta="Viajes"
            valor={vista}
            onCambio={setVista}
            opciones={[
              { valor: 'proximos', texto: `Próximos${viajes.datos ? ` (${viajes.datos.proximas.length})` : ''}` },
              { valor: 'anteriores', texto: `Anteriores${viajes.datos ? ` (${viajes.datos.anteriores.length})` : ''}` },
            ]}
          />
        }
      >
        El estado de cada vuelo se actualiza en tiempo real con la información de operaciones.
      </Encabezado>
      {viajes.cargando && <Cargando />}
      {viajes.error && <Aviso>{viajes.error}</Aviso>}
      {lista && lista.length === 0 && (
        <Vacio
          titulo={vista === 'proximos' ? 'No tienes viajes próximos' : 'Todavía no tienes viajes anteriores'}
          accion={
            <Link to="/" className="boton boton-primario">
              Buscar vuelos
            </Link>
          }
        />
      )}
      <div className="pila-chica">{lista?.map((r) => <Viaje key={r.idReserva} r={r} />)}</div>
    </div>
  );
}

export function DetalleReserva() {
  const { id = '' } = useParams();
  const reserva = useCarga((d) => d.reserva(id), [id]);
  if (reserva.cargando) return <Cargando />;
  const r = reserva.datos;
  if (!r) {
    return (
      <div className="contenedor pagina">
        <Aviso>{reserva.error ?? 'No encontramos la reserva.'}</Aviso>
      </div>
    );
  }
  const checkinAbierto = r.estado === 'Confirmada' && ['Programado', 'Recursos asignados', 'En preparación'].includes(r.vuelo.estado);

  return (
    <div className="contenedor pagina pila">
      <div className="migas">
        <Link to="/mis-viajes">
          <Icono nombre="atras" tam={16} /> Mis viajes
        </Link>
      </div>
      <Encabezado titulo={`${r.vuelo.origen.ciudad} a ${r.vuelo.destino.ciudad}`} acciones={<Chip estado={r.estado} />}>
        Reserva <Codigo>{r.codigo}</Codigo>, hecha el {fechaHora(r.fecha)}.
      </Encabezado>

      <section className="panel panel-cuerpo">
        <div className="fila-entre">
          <div>
            <div className="viaje-iatas">
              {r.vuelo.origen.codigo} <Icono nombre="avion" /> {r.vuelo.destino.codigo}
            </div>
            <p className="texto-2">
              {fechaLarga(r.vuelo.salida)}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <strong>
              {hora(r.vuelo.salida)} a {horaLlegada(r.vuelo.salida, r.vuelo.llegada)}
            </strong>
            <p className="chico texto-2">
              Vuelo <Codigo>{r.vuelo.numero}</Codigo>, {duracion(r.vuelo.duracionMin)}, {r.vuelo.aeronave.modelo}
            </p>
          </div>
          <div className="pila-chica" style={{ justifyItems: 'end' }}>
            <Chip estado={r.vuelo.estado} />
            {r.vuelo.puerta && <span className="chico">Puerta {r.vuelo.puerta}</span>}
          </div>
        </div>
      </section>

      {r.estado === 'Pendiente de pago' && r.liquidacion && (
        <Aviso tipo="aviso" titulo="Tu reserva está pendiente de pago">
          Paga {dinero(r.liquidacion.total)} para emitir los tiquetes.{' '}
          <Link to={`/reserva/${r.idReserva}/pago`}>Pagar ahora</Link>
        </Aviso>
      )}

      {r.tiquetes.length > 0 && (
        <section className="panel">
          <div className="panel-titulo">
            <h2>Pasajeros y tiquetes</h2>
            <span className="chico texto-3">Clase {r.clase}</span>
          </div>
          <div className="panel-cuerpo" style={{ overflowX: 'auto' }}>
            <table className="tabla-simple">
              <thead>
                <tr>
                  <th>Pasajero</th>
                  <th>Tiquete</th>
                  <th>Silla</th>
                  <th>Maletas</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {r.tiquetes.map((t) => (
                  <tr key={t.idTiquete}>
                    <td>{t.pasajero}</td>
                    <td>
                      <Codigo>{t.numero}</Codigo>
                    </td>
                    <td>{t.asiento ? <Codigo>{t.asiento}</Codigo> : '—'}</td>
                    <td>{t.maletas}</td>
                    <td>
                      <Chip estado={t.estado} />
                    </td>
                    <td className="num">
                      {t.checkin ? (
                        t.estado !== 'Volado' && (
                          <Link to={`/pase/${t.idTiquete}`} className="boton boton-secundario boton-chico">
                            Pase de abordar
                          </Link>
                        )
                      ) : checkinAbierto && t.estado === 'Emitido' ? (
                        <Link to={`/checkin/${t.idTiquete}`} className="boton boton-primario boton-chico">
                          Hacer check-in
                        </Link>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {r.factura && (
        <section className="panel">
          <div className="panel-titulo">
            <h2>Pago</h2>
            <span className="chico">
              Factura <Codigo>{r.factura.numero}</Codigo>
            </span>
          </div>
          <div className="panel-cuerpo pila">
            <dl className="desglose">
              <div>
                <dt>Subtotal</dt>
                <dd>{dinero(r.factura.subtotal)}</dd>
              </div>
              <div>
                <dt>Impuestos y tasas</dt>
                <dd>{dinero(r.factura.impuestos)}</dd>
              </div>
              <div className="total">
                <dt>Total</dt>
                <dd>{dinero(r.factura.total)}</dd>
              </div>
            </dl>
            {r.factura.pagos.map((p, i) => (
              <div key={i} className="fila-entre chico">
                <span>
                  {p.medio}, {fechaHora(p.fecha)}
                  {p.referencia && (
                    <>
                      {' '}
                      <Codigo>{p.referencia}</Codigo>
                    </>
                  )}
                </span>
                <Chip estado={p.estado} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
