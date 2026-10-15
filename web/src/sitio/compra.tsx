import type { VueloResumen } from '@beta/core';
import { Codigo } from '../ui/comunes';
import { Icono } from '../ui/Icono';
import { dinero, duracion, fechaLarga, hora } from '../ui/formato';

const PASOS = ['Vuelo', 'Pasajeros', 'Pago', 'Confirmación'];

/** Indicador de avance de la compra (es un proceso en orden, por eso va numerado). */
export function Pasos({ actual }: { actual: number }) {
  return (
    <ol className="pasos" aria-label="Pasos de la compra">
      {PASOS.map((p, i) => (
        <li key={p} aria-current={i === actual ? 'step' : undefined} data-hecho={i < actual}>
          <span className="numero">{i < actual ? <Icono nombre="check" tam={14} /> : i + 1}</span>
          {p}
        </li>
      ))}
    </ol>
  );
}

export function ResumenCompra({
  vuelo,
  clase,
  pasajeros,
  liquidacion,
}: {
  vuelo: VueloResumen;
  clase: string;
  pasajeros: number;
  liquidacion: { unitario: number; subtotal: number; impuestos: number; total: number };
}) {
  return (
    <aside className="panel resumen-compra" aria-label="Resumen de tu compra">
      <div className="panel-cuerpo pila">
        <div className="resumen-vuelo">
          <span className="texto-3 chico">Vuelo de ida</span>
          <div className="resumen-iatas">
            {vuelo.origen.codigo} <Icono nombre="avion" /> {vuelo.destino.codigo}
          </div>
          <span>{fechaLarga(vuelo.salida)}</span>
          <span className="texto-2 chico">
            {hora(vuelo.salida)} a {hora(vuelo.llegada)}, {duracion(vuelo.duracionMin)}. Vuelo <Codigo>{vuelo.numero}</Codigo>, {vuelo.aeronave.modelo}
          </span>
        </div>
        <dl className="desglose">
          <div>
            <dt>
              Tarifa {clase}, {pasajeros} × {dinero(liquidacion.unitario)}
            </dt>
            <dd>{dinero(liquidacion.subtotal)}</dd>
          </div>
          <div>
            <dt>Impuestos y tasas (7,5 %)</dt>
            <dd>{dinero(liquidacion.impuestos)}</dd>
          </div>
          <div className="total">
            <dt>Total</dt>
            <dd>{dinero(liquidacion.total)}</dd>
          </div>
        </dl>
        <p className="chico texto-3">Precios en dólares estadounidenses (USD).</p>
      </div>
    </aside>
  );
}
