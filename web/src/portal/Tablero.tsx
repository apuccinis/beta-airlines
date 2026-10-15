import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCarga } from '../datos';
import { Aviso, Cargando, Encabezado, Pestanas } from '../ui/comunes';
import { fechaISO, fechaLarga, hora, sumarDias } from '../ui/formato';

function Reloj() {
  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <time className="fids-reloj" dateTime={ahora.toISOString()}>
      {ahora.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false })}
    </time>
  );
}

const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

export function Tablero() {
  const tablero = useCarga((d) => d.tablero(), []);
  const navegar = useNavigate();
  const hoy = new Date();
  const dias = [0, 1, 2].map((n) => fechaISO(sumarDias(hoy, n)));
  const [dia, setDia] = useState(dias[0]);
  const [aeropuerto, setAeropuerto] = useState('');
  const [estado, setEstado] = useState('');

  useEffect(() => {
    const t = setInterval(() => void tablero.recargar(true), 30000);
    return () => clearInterval(t);
  }, [tablero.recargar]);

  const aeropuertos = useMemo(() => [...new Set((tablero.datos ?? []).map((v) => v.origen.codigo))].sort(), [tablero.datos]);
  const vuelos = (tablero.datos ?? []).filter(
    (v) =>
      v.salida.startsWith(dia) &&
      (!aeropuerto || v.origen.codigo === aeropuerto || v.destino.codigo === aeropuerto) &&
      (!estado || v.estado === estado),
  );
  const estados = [...new Set((tablero.datos ?? []).map((v) => v.estado))];

  return (
    <>
      <Encabezado titulo="Tablero de vuelos">Vuelos de hoy y de los dos días siguientes. Abre un vuelo para registrar sus etapas.</Encabezado>
      {tablero.error && <Aviso>{tablero.error}</Aviso>}
      <section className="fids" aria-label="Tablero de salidas">
        <div className="fids-cabeza">
          <div className="fila" style={{ gap: 20 }}>
            <span className="fids-titulo">SALIDAS</span>
            <Pestanas
              etiqueta="Día"
              valor={dia}
              onCambio={setDia}
              opciones={dias.map((d, i) => ({ valor: d, texto: ['Hoy', 'Mañana', 'Pasado mañana'][i] }))}
            />
          </div>
          <div className="fila">
            <label className="sr-solo" htmlFor="fids-aeropuerto">
              Aeropuerto
            </label>
            <select id="fids-aeropuerto" value={aeropuerto} onChange={(e) => setAeropuerto(e.target.value)}>
              <option value="">Todos los aeropuertos</option>
              {aeropuertos.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
            <label className="sr-solo" htmlFor="fids-estado">
              Estado
            </label>
            <select id="fids-estado" value={estado} onChange={(e) => setEstado(e.target.value)}>
              <option value="">Todos los estados</option>
              {estados.map((e) => (
                <option key={e}>{e}</option>
              ))}
            </select>
            <Reloj />
          </div>
        </div>
        {tablero.cargando ? (
          <Cargando texto="Cargando vuelos…" />
        ) : (
          <div className="fids-envoltura">
            <table>
              <thead>
                <tr>
                  <th>SALE</th>
                  <th>VUELO</th>
                  <th>ORIGEN</th>
                  <th>DESTINO</th>
                  <th>LLEGA</th>
                  <th>PUERTA</th>
                  <th>PAX</th>
                  <th>ESTADO</th>
                </tr>
              </thead>
              <tbody>
                {vuelos.map((v) => (
                  <tr
                    key={v.idVuelo}
                    tabIndex={0}
                    onClick={() => navegar(`/operaciones/vuelos/${v.idVuelo}`)}
                    onKeyDown={(e) => e.key === 'Enter' && navegar(`/operaciones/vuelos/${v.idVuelo}`)}
                    aria-label={`Vuelo ${v.numero} de ${v.origen.ciudad} a ${v.destino.ciudad}, ${v.estado}`}
                  >
                    <td>{hora(v.salida)}</td>
                    <td>{v.numero}</td>
                    <td>
                      <span className="fids-ciudad">{sinTildes(v.origen.ciudad)}</span> {v.origen.codigo}
                    </td>
                    <td>
                      <span className="fids-ciudad">{sinTildes(v.destino.ciudad)}</span> {v.destino.codigo}
                    </td>
                    <td>{hora(v.llegadaReal ?? v.llegada)}</td>
                    <td>{v.puerta ?? '—'}</td>
                    <td>{v.pasajeros}</td>
                    <td>
                      <span className="estado-fids" data-estado={v.estado}>
                        {sinTildes(v.estado)}
                      </span>
                    </td>
                  </tr>
                ))}
                {vuelos.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', color: '#7f93b5', cursor: 'default' }}>
                      NO HAY VUELOS CON ESTOS FILTROS
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        <div className="fids-pie">
          <span>{fechaLarga(`${dia} 00:00:00`)}</span>. {vuelos.length} vuelos. Se actualiza cada 30 segundos.
        </div>
      </section>
    </>
  );
}
