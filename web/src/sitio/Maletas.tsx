import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useCarga } from '../datos';
import { Aviso, Boton, Campo, Cargando, Chip, Codigo, Encabezado, Vacio } from '../ui/comunes';
import { Icono } from '../ui/Icono';
import { aDate, fechaCorta, fechaHora } from '../ui/formato';

export function MisMaletas() {
  const maletas = useCarga((d) => d.misMaletas(), []);
  const navegar = useNavigate();
  const [etiqueta, setEtiqueta] = useState('');

  const buscar = (e: FormEvent) => {
    e.preventDefault();
    if (etiqueta.trim()) navegar(`/maletas/${etiqueta.trim().toUpperCase()}`);
  };

  return (
    <div className="contenedor pagina">
      <Encabezado titulo="Mi equipaje">Sigue cada maleta desde que la documentas hasta la banda de entrega en tu destino.</Encabezado>
      <form className="panel panel-cuerpo fila" onSubmit={buscar} style={{ alignItems: 'end', marginBottom: 24 }}>
        <Campo
          etiqueta="Número de etiqueta"
          placeholder="BA00000000"
          ayuda="Está impreso en el talón que te entregan al documentar."
          value={etiqueta}
          onChange={(e) => setEtiqueta(e.target.value)}
          style={{ fontFamily: 'var(--mono)' }}
          className="crece"
        />
        <Boton type="submit" style={{ marginBottom: 26 }}>
          <Icono nombre="buscar" tam={18} />
          Rastrear
        </Boton>
      </form>
      {maletas.cargando && <Cargando />}
      {maletas.error && <Aviso>{maletas.error}</Aviso>}
      {maletas.datos && maletas.datos.length === 0 && (
        <Vacio titulo="No tienes maletas documentadas">Cuando registres maletas en el check-in, aparecerán aquí con su ubicación.</Vacio>
      )}
      {maletas.datos && maletas.datos.length > 0 && (
        <div className="tabla-envoltura">
          <table className="tabla">
            <thead>
              <tr>
                <th>Etiqueta</th>
                <th>Pasajero</th>
                <th>Vuelo</th>
                <th>Peso</th>
                <th>Último punto</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {maletas.datos.map((m) => (
                <tr key={m.etiqueta}>
                  <td>
                    <Link to={`/maletas/${m.etiqueta}`}>
                      <Codigo>{m.etiqueta}</Codigo>
                    </Link>
                  </td>
                  <td>{m.pasajero}</td>
                  <td>
                    <Codigo>{m.vuelo.numero}</Codigo> {m.vuelo.origen} a {m.vuelo.destino}, <span>{fechaCorta(m.vuelo.salida)}</span>
                  </td>
                  <td>{m.pesoKg.toLocaleString('es-CO')} kg</td>
                  <td>{m.ultimo ? `${m.ultimo.punto} (${m.ultimo.aeropuerto})` : '—'}</td>
                  <td>
                    <Chip estado={m.estado} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function RastreoMaleta() {
  const { etiqueta = '' } = useParams();
  const m = useCarga((d) => d.rastrearMaleta(etiqueta), [etiqueta]);

  return (
    <div className="contenedor pagina">
      <div className="migas">
        <Link to="/maletas">
          <Icono nombre="atras" tam={16} /> Mi equipaje
        </Link>
      </div>
      {m.cargando && <Cargando />}
      {m.error && <Aviso>{m.error}</Aviso>}
      {m.datos && (
        <>
          <Encabezado titulo={`Maleta ${m.datos.etiqueta}`} acciones={<Chip estado={m.datos.estado} />}>
            {m.datos.pasajero}, vuelo {m.datos.vuelo.numero} de {m.datos.vuelo.origen} a {m.datos.vuelo.destino}. Peso registrado:{' '}
            {m.datos.pesoKg.toLocaleString('es-CO')} kg.
          </Encabezado>
          <div className="compra">
            <section className="panel panel-cuerpo">
              <h2 style={{ marginBottom: 20 }}>Recorrido</h2>
              <ol className="linea-tiempo">
                {m.datos.rastreo.map((r, i) => (
                  <li key={i}>
                    <span className="punto" aria-hidden="true" />
                    <div>
                      <strong>{r.punto}</strong>
                      <span className="chico texto-2">
                        {r.ciudad} <Codigo>{r.aeropuerto}</Codigo>
                      </span>
                    </div>
                    <time dateTime={r.fechaHora.replace(' ', 'T')}>{fechaHora(r.fechaHora)}</time>
                  </li>
                ))}
              </ol>
            </section>
            <aside className="panel panel-cuerpo pila-chica resumen-compra">
              <span className="texto-3 chico">Dónde está ahora</span>
              <div className="resumen-iatas">{m.datos.ultimo?.aeropuerto ?? '—'}</div>
              <span>{m.datos.ultimo?.punto}</span>
              <span className="chico texto-3">{m.datos.ultimo && fechaHora(m.datos.ultimo.fechaHora)}</span>
              {m.datos.estado !== 'Entregada' && m.datos.estado !== 'En banda' && aDate(m.datos.vuelo.salida) < new Date() && (
                <p className="chico texto-2" style={{ marginTop: 8 }}>
                  ¿Tu maleta no llegó? <Link to="/ayuda">Abre una solicitud de equipaje demorado</Link>.
                </p>
              )}
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
