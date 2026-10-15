import { useState } from 'react';
import { NIVELES } from '@beta/core';
import { useCarga, useDatos } from '../datos';
import { Aviso, Boton, Cargando, Codigo, Encabezado } from '../ui/comunes';
import { Icono } from '../ui/Icono';
import { fechaMedia, numero } from '../ui/formato';

export function SkymilesPagina() {
  const { datos, refrescarCliente } = useDatos();
  const sky = useCarga((d) => d.skymiles(), []);
  const [afiliando, setAfiliando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (sky.cargando) return <Cargando />;
  if (!sky.datos) {
    return (
      <div className="contenedor pagina">
        <Aviso>{sky.error ?? 'No pudimos cargar tu cuenta Skymiles.'}</Aviso>
      </div>
    );
  }
  const { cuenta, movimientos } = sky.datos;

  if (!cuenta) {
    const afiliar = async () => {
      setAfiliando(true);
      setError(null);
      try {
        sky.setDatos(await datos.afiliarSkymiles());
        await refrescarCliente();
      } catch (e) {
        setError((e as Error).message);
      }
      setAfiliando(false);
    };
    return (
      <div className="contenedor pagina">
        <Encabezado titulo="Skymiles">Acumula millas en cada vuelo de Beta Airlines y sube de nivel para obtener más beneficios.</Encabezado>
        <section className="panel panel-cuerpo pila" style={{ maxWidth: 720 }}>
          <h2>Únete a Skymiles sin costo</h2>
          <div className="beneficios">
            {NIVELES.map((n) => (
              <div key={n.nivel} className="beneficio">
                <Icono nombre="avion" />
                <div>
                  <strong>{n.nivel}</strong>
                  <p className="chico texto-2">{n.desde ? `Desde ${numero(n.desde)} millas` : 'Al afiliarte'}</p>
                </div>
              </div>
            ))}
          </div>
          {error && <Aviso>{error}</Aviso>}
          <div>
            <Boton onClick={afiliar} cargando={afiliando}>
              Afiliarme a Skymiles
            </Boton>
          </div>
        </section>
      </div>
    );
  }

  const actual = NIVELES.find((n) => n.nivel === cuenta.nivel) ?? NIVELES[0];
  const sig = cuenta.siguienteNivel;
  const avance = sig ? Math.min(100, ((cuenta.saldo - actual.desde) / (cuenta.saldo + sig.faltan - actual.desde)) * 100) : 100;

  return (
    <div className="contenedor pagina pila">
      <Encabezado titulo="Skymiles" />
      <section className="socio" data-nivel={cuenta.nivel} aria-label="Tu cuenta Skymiles">
        <div className="fila-entre">
          <span className="socio-nivel">SKYMILES {cuenta.nivel.toUpperCase()}</span>
          <Codigo>{cuenta.numeroSocio}</Codigo>
        </div>
        <div>
          <div className="socio-saldo">{numero(cuenta.saldo)}</div>
          <span>millas disponibles</span>
        </div>
        <div className="pila-chica">
          <div className="progreso" role="progressbar" aria-valuenow={Math.round(avance)} aria-valuemin={0} aria-valuemax={100}>
            <span style={{ width: `${avance}%` }} />
          </div>
          <span className="chico">
            {sig ? `Te faltan ${numero(sig.faltan)} millas para el nivel ${sig.nivel}.` : 'Estás en el nivel más alto de Skymiles.'} Socio desde el{' '}
            {fechaMedia(cuenta.fechaAfiliacion)}.
          </span>
        </div>
      </section>

      <dl className="rejilla-3" style={{ margin: 0 }}>
        <div className="kpi">
          <dt>Millas acumuladas este año</dt>
          <dd>{numero(cuenta.millasAnio)}</dd>
        </div>
        <div className="kpi">
          <dt>Vuelos este año</dt>
          <dd>{numero(cuenta.vuelosAnio)}</dd>
        </div>
        <div className="kpi">
          <dt>Nivel actual</dt>
          <dd>{cuenta.nivel}</dd>
        </div>
      </dl>

      <section className="panel panel-cuerpo pila">
        <h2>Tus beneficios</h2>
        <div className="beneficios">
          <div className="beneficio">
            <Icono nombre="avion" />
            <div>
              <strong>Millas en cada vuelo</strong>
              <p className="chico texto-2">Sumas las millas de la ruta cuando el vuelo aterriza.</p>
            </div>
          </div>
          <div className="beneficio">
            <Icono nombre="maleta" />
            <div>
              <strong>Maletas prioritarias</strong>
              <p className="chico texto-2">{cuenta.nivel === 'Azul' ? 'Disponible desde el nivel Plata.' : 'Tus maletas salen primero en la banda.'}</p>
            </div>
          </div>
          <div className="beneficio">
            <Icono nombre="copa" />
            <div>
              <strong>Crown Room</strong>
              <p className="chico texto-2">
                {cuenta.crownRoom ? 'Acceso a las salas Crown Room antes de cada vuelo.' : 'Disponible para socios Oro y Platino.'}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-titulo">
          <h2>Movimientos</h2>
          <span className="chico texto-3">{movimientos.length} registros</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="tabla">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Detalle</th>
                <th className="num">Millas</th>
              </tr>
            </thead>
            <tbody>
              {movimientos.map((m, i) => (
                <tr key={i}>
                  <td>{fechaMedia(m.fecha)}</td>
                  <td>{m.detalle}</td>
                  <td className={`num ${m.millas >= 0 ? 'millas-pos' : 'millas-neg'}`}>
                    {m.millas >= 0 ? '+' : '−'}
                    {numero(Math.abs(m.millas))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
