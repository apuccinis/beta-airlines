import { Link, useParams } from 'react-router-dom';
import type { PaseAbordar } from '@beta/core';
import { useCarga } from '../datos';
import { Aviso, Boton, Cargando, Codigo, Encabezado } from '../ui/comunes';
import { Icono } from '../ui/Icono';
import { Logo } from '../ui/Logo';
import { fechaCorta, hora } from '../ui/formato';

/** Código de barras del pase generado a partir del número de tiquete. */
function Barras({ valor }: { valor: string }) {
  const barras: { x: number; w: number }[] = [];
  let x = 0;
  for (const ch of (valor + valor.split('').reverse().join('')).split('')) {
    const n = ch.charCodeAt(0);
    const w = 1 + (n % 3);
    barras.push({ x, w });
    x += w + 1 + ((n >> 2) % 2);
  }
  return (
    <svg className="barras" viewBox={`0 0 ${x} 40`} preserveAspectRatio="none" role="img" aria-label={`Código de barras del tiquete ${valor}`}>
      {barras.map((b, i) => (
        <rect key={i} x={b.x} y="0" width={b.w} height="40" fill="currentColor" />
      ))}
    </svg>
  );
}

export function Pase({ p }: { p: PaseAbordar }) {
  return (
    <article className="pase" aria-label={`Pase de abordar de ${p.pasajero}`}>
      <div>
        <div className="pase-banda">
          <Logo tam={26} sub="Pase de abordar" />
          <span className="pase-clase">{p.clase}</span>
        </div>
        <div className="pase-cuerpo">
          <div className="pase-ruta">
            <div>
              <div className="pase-iata">{p.vuelo.origen.codigo}</div>
              <div className="pase-ciudad">{p.vuelo.origen.ciudad}</div>
            </div>
            <div className="pase-arco" aria-hidden="true">
              <Icono nombre="avion" tam={26} />
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="pase-iata">{p.vuelo.destino.codigo}</div>
              <div className="pase-ciudad">{p.vuelo.destino.ciudad}</div>
            </div>
          </div>
          <dl className="pase-datos">
            <div style={{ gridColumn: 'span 2' }}>
              <dt>Pasajero</dt>
              <dd>{p.pasajero.toUpperCase()}</dd>
            </div>
            <div>
              <dt>Vuelo</dt>
              <dd className="codigo">{p.vuelo.numero}</dd>
            </div>
            <div>
              <dt>Fecha</dt>
              <dd>{fechaCorta(p.vuelo.salida)}</dd>
            </div>
            <div className="destacado">
              <dt>Embarque</dt>
              <dd>{hora(p.embarque)}</dd>
            </div>
            <div className="destacado">
              <dt>Puerta</dt>
              <dd>{p.puerta ?? '—'}</dd>
            </div>
            <div className="destacado">
              <dt>Silla</dt>
              <dd>{p.asiento}</dd>
            </div>
            <div className="destacado">
              <dt>Zona</dt>
              <dd>{p.zona}</dd>
            </div>
            <div>
              <dt>Salida</dt>
              <dd>{hora(p.vuelo.salida)}</dd>
            </div>
            <div>
              <dt>Reserva</dt>
              <dd className="codigo">{p.codigoReserva}</dd>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <dt>Skymiles</dt>
              <dd>{p.socio ? `${p.socio.numero}, ${p.socio.nivel}` : 'No es socio'}</dd>
            </div>
          </dl>
        </div>
      </div>
      <div className="pase-talon">
        <div>
          <span className="texto-3 chico">Pasajero</span>
          <strong style={{ display: 'block' }}>{p.pasajero}</strong>
        </div>
        <div className="resumen-iatas" style={{ fontSize: 22 }}>
          {p.vuelo.origen.codigo} <Icono nombre="avion" tam={18} /> {p.vuelo.destino.codigo}
        </div>
        <dl className="pase-datos" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div>
            <dt>Vuelo</dt>
            <dd className="codigo">{p.vuelo.numero}</dd>
          </div>
          <div>
            <dt>Silla</dt>
            <dd>{p.asiento}</dd>
          </div>
          <div>
            <dt>Puerta</dt>
            <dd>{p.puerta ?? '—'}</dd>
          </div>
          <div>
            <dt>Embarque</dt>
            <dd>{hora(p.embarque)}</dd>
          </div>
        </dl>
        <Barras valor={p.numeroTiquete} />
        <Codigo>{p.numeroTiquete}</Codigo>
      </div>
    </article>
  );
}

export function PaseAbordarPagina() {
  const { id = '' } = useParams();
  const pase = useCarga((d) => d.pase(id), [id]);
  if (pase.cargando) return <Cargando />;
  const p = pase.datos;
  if (!p) {
    return (
      <div className="contenedor pagina">
        <Aviso>{pase.error ?? 'No encontramos el pase de abordar.'}</Aviso>
      </div>
    );
  }
  return (
    <div className="contenedor pagina pila">
      <Encabezado
        titulo="Tu pase de abordar"
        acciones={
          <Boton variante="secundario" onClick={() => window.print()}>
            Imprimir
          </Boton>
        }
      >
        Llega a la puerta antes de las {hora(p.embarque)}. {p.puerta ? `Tu vuelo sale por la puerta ${p.puerta}.` : 'La puerta se anuncia en las pantallas del aeropuerto.'}
      </Encabezado>
      <Pase p={p} />
      {p.maletas.length > 0 && (
        <section className="pila-chica" style={{ marginTop: 12 }}>
          <h2>Maletas documentadas</h2>
          <div className="etiquetas">
            {p.maletas.map((m) => (
              <Link key={m.etiqueta} to={`/maletas/${m.etiqueta}`} className="etiqueta-maleta" style={{ textDecoration: 'none', color: 'inherit' }}>
                <Codigo>{m.etiqueta}</Codigo>
                <span className="chico texto-2">
                  {m.pesoKg.toLocaleString('es-CO')} kg, {p.vuelo.origen.codigo} a {p.vuelo.destino.codigo}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
