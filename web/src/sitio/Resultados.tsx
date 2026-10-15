import { useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CLASES, type Clase, type ResultadoVuelo } from '@beta/core';
import { useCarga } from '../datos';
import { Aviso, Boton, Cargando, Codigo, Pestanas, Vacio } from '../ui/comunes';
import { Icono } from '../ui/Icono';
import { dinero, duracion, fechaLarga, fechaCorta, hora, plural } from '../ui/formato';

function FilaVuelo({ v, pasajeros, onElegir }: { v: ResultadoVuelo; pasajeros: number; onElegir: () => void }) {
  const agotado = v.sillasDisponibles < pasajeros;
  return (
    <article className="vuelo-fila" data-agotado={agotado} aria-label={`Vuelo ${v.numero}, sale a las ${hora(v.salida)}`}>
      <div className="vuelo-tramo">
        <div className="tramo">
          <div>
            <div className="tramo-hora">{hora(v.salida)}</div>
            <div className="tramo-iata">{v.origen.codigo}</div>
          </div>
          <div className="tramo-linea">
            <span>{duracion(v.duracionMin)}</span>
            <Icono nombre="avion" tam={18} />
            <span>Directo</span>
          </div>
          <div className="tramo-destino">
            <div className="tramo-hora">{hora(v.llegada)}</div>
            <div className="tramo-iata">{v.destino.codigo}</div>
          </div>
        </div>
        <div className="vuelo-meta">
          <span>
            Vuelo <Codigo>{v.numero}</Codigo>
          </span>
          <span>{v.aeronave.modelo}</span>
          <span>{v.distancia.toLocaleString('es-CO')} millas</span>
          {v.sillasDisponibles < 20 && !agotado && <span className="sillas-pocas">Quedan {v.sillasDisponibles} sillas</span>}
        </div>
      </div>
      <div className="vuelo-precio">
        <div>
          <div className="precio">{dinero(v.precio)}</div>
          <div className="precio-nota">por pasajero, sin impuestos</div>
          {pasajeros > 1 && <div className="precio-nota">{dinero(v.precio * pasajeros)} por {pasajeros} pasajeros</div>}
        </div>
        <Boton onClick={onElegir} disabled={agotado}>
          {agotado ? 'Sin sillas' : 'Elegir vuelo'}
        </Boton>
      </div>
    </article>
  );
}

export function Resultados() {
  const [params, setParams] = useSearchParams();
  const navegar = useNavigate();
  const origen = params.get('origen') ?? '';
  const destino = params.get('destino') ?? '';
  const fecha = params.get('fecha') ?? '';
  const pasajeros = Number(params.get('pasajeros') ?? 1);
  const clase = (CLASES.includes(params.get('clase') as Clase) ? params.get('clase') : 'Económica') as Clase;

  const aeropuertos = useCarga((d) => d.aeropuertos(), []);
  const r = useCarga((d) => d.buscarVuelos({ origen, destino, fecha, pasajeros, clase }), [origen, destino, fecha, pasajeros, clase]);
  const ciudad = (c: string) => aeropuertos.datos?.find((a) => a.codigo === c)?.ciudad ?? c;

  useEffect(() => {
    document.title = `Vuelos ${origen} a ${destino} | Beta Airlines`;
  }, [origen, destino]);

  const cambiar = (cambios: Record<string, string>) => setParams({ ...Object.fromEntries(params), ...cambios });

  return (
    <>
      <section className="resumen-busqueda">
        <div className="contenedor fila-entre">
          <div>
            <h1 className="resumen-ruta">
              {origen} <Icono nombre="avion" tam={26} /> {destino}
            </h1>
            <p className="resumen-detalle">
              {ciudad(origen)} a {ciudad(destino)}, {fecha && fechaLarga(fecha).toLowerCase()}, {plural(pasajeros, 'pasajero', 'pasajeros')}
            </p>
          </div>
          <Link className="boton boton-secundario" to={`/?${params}`}>
            Cambiar búsqueda
          </Link>
        </div>
      </section>
      <div className="contenedor pagina">
        <div className="fila-entre" style={{ marginBottom: 18 }}>
          <h2>Elige tu vuelo de ida</h2>
          <Pestanas etiqueta="Clase" opciones={CLASES.map((c) => ({ valor: c, texto: c }))} valor={clase} onCambio={(c) => cambiar({ clase: c })} />
        </div>

        {r.cargando && <Cargando texto="Buscando vuelos…" />}
        {r.error && <Aviso>{r.error}</Aviso>}
        {r.datos && !r.datos.rutaExiste && (
          <Vacio
            titulo={`No volamos directo entre ${ciudad(origen)} y ${ciudad(destino)}`}
            accion={
              <Link to="/" className="boton boton-primario">
                Hacer otra búsqueda
              </Link>
            }
          >
            Prueba con otra ciudad de origen o de destino.
          </Vacio>
        )}
        {r.datos && r.datos.rutaExiste && (
          <>
            {r.datos.vuelos.length > 0 && (
              <div className="vuelos">
                {r.datos.vuelos.map((v) => (
                  <FilaVuelo
                    key={v.idVuelo}
                    v={v}
                    pasajeros={pasajeros}
                    onElegir={() => navegar(`/reserva/pasajeros?${new URLSearchParams({ vuelo: v.idVuelo, clase, pasajeros: String(pasajeros) })}`)}
                  />
                ))}
              </div>
            )}
            {r.datos.vuelos.length === 0 && (
              <Vacio titulo={`No hay vuelos disponibles el ${fecha ? fechaCorta(fecha).toLowerCase() : ''}`}>
                {r.datos.fechasCercanas.length ? 'Estas son las fechas más cercanas con sillas disponibles:' : 'Prueba con otra fecha.'}
              </Vacio>
            )}
            {r.datos.fechasCercanas.length > 0 && (
              <div className="fechas-cercanas" style={{ marginTop: r.datos.vuelos.length ? 24 : 0 }}>
                {r.datos.fechasCercanas.map((f) => (
                  <button key={f.fecha} type="button" className="fecha-alternativa" onClick={() => cambiar({ fecha: f.fecha })}>
                    <strong>{fechaCorta(f.fecha)}</strong>
                    <span>
                      {plural(f.vuelos, 'vuelo', 'vuelos')}, desde {dinero(f.desde)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
