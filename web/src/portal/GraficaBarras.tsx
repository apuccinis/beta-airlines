import { useEffect, useRef, useState } from 'react';

interface Props {
  etiquetas: string[];
  valores: number[];
  formato: (v: number) => string;
  detalle?: (i: number) => string;
  titulo: string;
}

function escalaBonita(max: number) {
  if (max <= 0) return { tope: 1, paso: 1 };
  const bruto = max / 4;
  const mag = 10 ** Math.floor(Math.log10(bruto));
  const paso = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((p) => p >= bruto)!;
  return { tope: Math.ceil(max / paso) * paso, paso };
}

const compacto = (v: number) =>
  v >= 1e6 ? `${(v / 1e6).toLocaleString('es-CO', { maximumFractionDigits: 1 })} M` : v >= 1e3 ? `${(v / 1e3).toLocaleString('es-CO', { maximumFractionDigits: 0 })} mil` : String(v);

/** Barras verticales de una sola serie: marcas delgadas con extremo redondeado, cuadrícula tenue y tooltip por barra. */
export function GraficaBarras({ etiquetas, valores, formato, detalle, titulo }: Props) {
  const [activa, setActiva] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(760);
  useEffect(() => {
    if (!ref.current) return;
    const o = new ResizeObserver(([e]) => setW(Math.max(320, Math.round(e.contentRect.width))));
    o.observe(ref.current);
    return () => o.disconnect();
  }, []);
  const H = 280;
  const m = { arriba: 22, derecha: 8, abajo: 28, izquierda: 64 };
  const ancho = W - m.izquierda - m.derecha;
  const alto = H - m.arriba - m.abajo;
  const { tope, paso } = escalaBonita(Math.max(...valores, 0));
  const banda = ancho / valores.length;
  const barra = Math.min(40, banda * 0.56);
  const y = (v: number) => m.arriba + alto - (v / tope) * alto;
  const guias = Array.from({ length: Math.round(tope / paso) + 1 }, (_, i) => i * paso);
  const iMax = valores.indexOf(Math.max(...valores));

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <svg className="grafica" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={titulo}>
        {guias.map((g) => (
          <g key={g}>
            <line className={g === 0 ? 'eje' : 'guia'} x1={m.izquierda} x2={W - m.derecha} y1={y(g)} y2={y(g)} />
            <text x={m.izquierda - 10} y={y(g) + 4} textAnchor="end">
              {compacto(g)}
            </text>
          </g>
        ))}
        {valores.map((v, i) => {
          const x = m.izquierda + banda * i + (banda - barra) / 2;
          const h = Math.max(0, y(0) - y(v));
          const r = Math.min(4, h, barra / 2);
          const top = y(0) - h;
          const d = h > 0 ? `M${x},${y(0)} V${top + r} Q${x},${top} ${x + r},${top} H${x + barra - r} Q${x + barra},${top} ${x + barra},${top + r} V${y(0)} Z` : '';
          return (
            <g
              key={i}
              className="barra-grupo"
              tabIndex={0}
              role="img"
              aria-label={`${etiquetas[i]}: ${formato(v)}${detalle ? `, ${detalle(i)}` : ''}`}
              onMouseEnter={() => setActiva(i)}
              onMouseLeave={() => setActiva(null)}
              onFocus={() => setActiva(i)}
              onBlur={() => setActiva(null)}
            >
              {/* zona de toque más grande que la barra */}
              <rect x={m.izquierda + banda * i} y={m.arriba} width={banda} height={alto} fill="transparent" />
              {d && <path className="barra" d={d} />}
              {i === iMax && v > 0 && (
                <text className="barra-valor" x={x + barra / 2} y={top - 6} textAnchor="middle">
                  {compacto(v)}
                </text>
              )}
              <text x={m.izquierda + banda * i + banda / 2} y={H - 8} textAnchor="middle">
                {etiquetas[i]}
              </text>
            </g>
          );
        })}
      </svg>
      {activa !== null && (
        <div
          className="tooltip"
          role="status"
          style={{
            left: `${((m.izquierda + banda * activa + banda / 2) / W) * 100}%`,
            top: `${(Math.max(m.arriba, y(valores[activa])) / H) * 100}%`,
          }}
        >
          <strong>{etiquetas[activa]}</strong>
          <span>{formato(valores[activa])}</span>
          {detalle && <span className="texto-3">{detalle(activa)}</span>}
        </div>
      )}
    </div>
  );
}
