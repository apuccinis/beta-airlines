import { Link, Navigate, useParams } from 'react-router-dom';
import { useCarga } from '../datos';
import { Aviso, Cargando, Chip, Codigo, Encabezado } from '../ui/comunes';
import { Icono } from '../ui/Icono';
import { dinero, duracion, fechaHora, fechaLarga, hora } from '../ui/formato';
import { Pasos } from './compra';

export function Confirmacion() {
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
  if (r.estado === 'Pendiente de pago') return <Navigate to={`/reserva/${id}/pago`} replace />;
  const pago = r.factura?.pagos.find((p) => p.estado === 'Aprobado');

  return (
    <div className="contenedor pagina">
      <div className="confirmacion">
        <Pasos actual={3} />
        <div className="confirmacion-cabeza">
          <span className="sello">
            <Icono nombre="check" tam={28} />
          </span>
          <Encabezado titulo="¡Tu reserva está confirmada!">Te enviamos la confirmación y tus tiquetes a {r.email}.</Encabezado>
        </div>

        <section className="panel panel-cuerpo pila">
          <div className="codigo-reserva">
            <span className="texto-2">Código de reserva</span>
            <Codigo grande>{r.codigo}</Codigo>
          </div>
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
                {hora(r.vuelo.salida)} a {hora(r.vuelo.llegada)}
              </strong>
              <p className="texto-2 chico">
                Vuelo <Codigo>{r.vuelo.numero}</Codigo>, {duracion(r.vuelo.duracionMin)}
              </p>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-titulo">
            <h2>Tiquetes</h2>
            <span className="texto-3 chico">Clase {r.clase}</span>
          </div>
          <div className="panel-cuerpo" style={{ overflowX: 'auto' }}>
            <table className="tabla-simple">
              <thead>
                <tr>
                  <th>Pasajero</th>
                  <th>Número de tiquete</th>
                  <th>Estado</th>
                  <th className="num">Valor</th>
                </tr>
              </thead>
              <tbody>
                {r.tiquetes.map((t) => (
                  <tr key={t.idTiquete}>
                    <td>{t.pasajero}</td>
                    <td>
                      <Codigo>{t.numero}</Codigo>
                    </td>
                    <td>
                      <Chip estado={t.estado} />
                    </td>
                    <td className="num">{dinero(t.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {r.factura && (
          <section className="panel">
            <div className="panel-titulo">
              <h2>Factura electrónica</h2>
              <Codigo>{r.factura.numero}</Codigo>
            </div>
            <div className="panel-cuerpo">
              <dl className="desglose">
                <div>
                  <dt>Subtotal</dt>
                  <dd>{dinero(r.factura.subtotal)}</dd>
                </div>
                <div>
                  <dt>Impuestos y tasas (7,5 %)</dt>
                  <dd>{dinero(r.factura.impuestos)}</dd>
                </div>
                <div className="total">
                  <dt>Total pagado</dt>
                  <dd>{dinero(r.factura.total)}</dd>
                </div>
              </dl>
              {pago && (
                <p className="chico texto-3" style={{ marginTop: 14 }}>
                  Pago aprobado con {pago.medio} el {fechaHora(pago.fecha)}. Referencia de la transacción <Codigo>{pago.referencia}</Codigo>.
                </p>
              )}
            </div>
          </section>
        )}

        <div className="fila">
          <Link to="/checkin" className="boton boton-primario">
            Hacer check-in
          </Link>
          <Link to="/mis-viajes" className="boton boton-secundario">
            Ver mis viajes
          </Link>
        </div>
      </div>
    </div>
  );
}
