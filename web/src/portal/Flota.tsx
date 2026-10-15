import { useCarga } from '../datos';
import { Aviso, Cargando, Chip, Codigo, Encabezado } from '../ui/comunes';
import { fechaHora, numero } from '../ui/formato';

export function Flota() {
  const flota = useCarga((d) => d.flota(), []);
  const mant = useCarga((d) => d.mantenimientos(), []);

  return (
    <div className="pila">
      <Encabezado titulo="Flota y mantenimiento">Aeronaves en servicio, sus vuelos realizados y el historial de mantenimiento.</Encabezado>
      {flota.error && <Aviso>{flota.error}</Aviso>}
      {flota.cargando ? (
        <Cargando />
      ) : (
        <div className="tabla-envoltura">
          <table className="tabla">
            <thead>
              <tr>
                <th>Matrícula</th>
                <th>Modelo</th>
                <th className="num">Sillas</th>
                <th className="num">Vuelos realizados</th>
                <th className="num">Horas de vuelo</th>
                <th>Último mantenimiento</th>
                <th>Próximo vuelo</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {flota.datos?.map((a) => (
                <tr key={a.idAeronave}>
                  <td>
                    <Codigo>{a.matricula}</Codigo>
                  </td>
                  <td>{a.modelo}</td>
                  <td className="num">{a.capacidad}</td>
                  <td className="num">{numero(a.vuelosRealizados)}</td>
                  <td className="num">{numero(a.horasVuelo)}</td>
                  <td>
                    {a.ultimoMantenimiento ? (
                      <>
                        {a.ultimoMantenimiento.tipo}
                        <div className="chico texto-3">{fechaHora(a.ultimoMantenimiento.fecha)}</div>
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    {a.proximoVuelo ? (
                      <>
                        <Codigo>{a.proximoVuelo.numero}</Codigo> {a.proximoVuelo.ruta}
                        <div className="chico texto-3">{fechaHora(a.proximoVuelo.salida)}</div>
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    <Chip estado={a.estado} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <section className="pila-chica" style={{ marginTop: 12 }}>
        <h2>Historial de mantenimiento</h2>
        {mant.cargando ? (
          <Cargando />
        ) : (
          <div className="tabla-envoltura">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Orden</th>
                  <th>Aeronave</th>
                  <th>Tipo</th>
                  <th>Descripción</th>
                  <th>Inicio</th>
                  <th>Fin</th>
                  <th>Técnico</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {mant.datos?.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <Codigo>{m.id}</Codigo>
                    </td>
                    <td>
                      <Codigo>{m.matricula}</Codigo>
                      <div className="chico texto-3">{m.modelo}</div>
                    </td>
                    <td>{m.tipo}</td>
                    <td className="descripcion">{m.descripcion}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{fechaHora(m.inicio)}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{fechaHora(m.fin)}</td>
                    <td>{m.tecnico}</td>
                    <td>
                      <Chip estado={m.estado} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
