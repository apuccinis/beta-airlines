import { RUTA_AVION } from './Icono';

/** Logo de Beta Airlines: el avión en ascenso dentro de una placa azul, más el nombre. */
export function Marca({ tam = 32 }: { tam?: number }) {
  return (
    <svg width={tam} height={tam} viewBox="0 0 24 24" aria-hidden="true" className="marca">
      <rect width="24" height="24" rx="5.5" className="marca-placa" />
      <path d={RUTA_AVION} transform="rotate(-35 12 12) translate(0.6 0)" className="marca-avion" />
    </svg>
  );
}

export function Logo({ tam = 30, sub }: { tam?: number; sub?: string }) {
  return (
    <span className="logo">
      <Marca tam={tam} />
      <span className="logo-texto">
        <span className="logo-nombre">BETA AIRLINES</span>
        {sub && <span className="logo-sub">{sub}</span>}
      </span>
    </span>
  );
}
