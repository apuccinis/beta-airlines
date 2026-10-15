import type { SVGProps } from 'react';

/** Silueta del avión de la marca (vista superior, apuntando a la derecha). */
export const RUTA_AVION =
  'M20.2 12c0-.75-.62-1.35-1.38-1.35H14.6L10.2 4.3H8.5l2.15 6.35H6.1L4.7 8.85H3.5l.9 3.15-.9 3.15h1.2l1.4-1.8h4.55L8.5 19.7h1.7l4.4-6.35h4.22c.76 0 1.38-.6 1.38-1.35z';

const trazos: Record<string, JSX.Element> = {
  intercambiar: <path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" />,
  maleta: (
    <>
      <rect x="5" y="7" width="14" height="13" rx="2" />
      <path d="M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7M9 11v5M15 11v5" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  alerta: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5M12 16.5v.01" />
    </>
  ),
  persona: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20.5c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5" />
    </>
  ),
  salir: <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 8l-4 4 4 4M6 12h11" />,
  buscar: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  cerrar: <path d="M6 6l12 12M18 6 6 18" />,
  reloj: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  tablero: <path d="M4 5h16v14H4zM4 10h16M9 10v9" />,
  auricular: <path d="M4 14v-2a8 8 0 0 1 16 0v2M4 14h3v6H5a1 1 0 0 1-1-1zM20 14h-3v6h2a1 1 0 0 0 1-1z" />,
  llave: <path d="M14.5 9.5a4.5 4.5 0 1 0-1.3 3.2L20 19.5l1.5-1.5-1.5-1.5 1.5-1.5-1.5-1.5-1.5 1.5-4.4-4.3" />,
  grafica: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  descargar: <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />,
  actualizar: <path d="M20 11a8 8 0 0 0-14.6-4.5M4 4v4h4M4 13a8 8 0 0 0 14.6 4.5M20 20v-4h-4" />,
  sol: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  luna: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />,
  flecha: <path d="M5 12h14M13 6l6 6-6 6" />,
  atras: <path d="M19 12H5M11 6l-6 6 6 6" />,
  tarjeta: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="M3 10h18M7 15h3" />
    </>
  ),
  candado: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </>
  ),
  copa: <path d="M8 3h8l-1 7a3 3 0 0 1-6 0zM12 13v5M8.5 21h7" />,
  mas: <path d="M12 5v14M5 12h14" />,
  menos: <path d="M5 12h14" />,
};

export type NombreIcono = keyof typeof trazos | 'avion';

export function Icono({ nombre, tam = 20, ...p }: { nombre: NombreIcono; tam?: number } & SVGProps<SVGSVGElement>) {
  if (nombre === 'avion') {
    return (
      <svg width={tam} height={tam} viewBox="0 0 24 24" aria-hidden="true" {...p}>
        <path d={RUTA_AVION} fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg
      width={tam}
      height={tam}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...p}
    >
      {trazos[nombre]}
    </svg>
  );
}
