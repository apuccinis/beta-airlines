import { useEffect, useId, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { Icono } from './Icono';

export function Boton({
  variante = 'primario',
  cargando,
  children,
  className = '',
  ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: 'primario' | 'secundario' | 'fantasma' | 'peligro'; cargando?: boolean }) {
  return (
    <button {...p} className={`boton boton-${variante} ${className}`} disabled={p.disabled || cargando} aria-busy={cargando || undefined}>
      {cargando && <span className="giro" aria-hidden="true" />}
      {children}
    </button>
  );
}

export function Campo({
  etiqueta,
  ayuda,
  error,
  className = '',
  ...p
}: InputHTMLAttributes<HTMLInputElement> & { etiqueta: string; ayuda?: ReactNode; error?: string | null }) {
  const id = useId();
  return (
    <div className={`campo ${error ? 'campo-error' : ''} ${className}`}>
      <label htmlFor={p.id ?? id}>{etiqueta}</label>
      <input id={p.id ?? id} aria-invalid={error ? true : undefined} aria-describedby={ayuda || error ? `${id}-a` : undefined} {...p} />
      {(error || ayuda) && (
        <span className="campo-ayuda" id={`${id}-a`}>
          {error ?? ayuda}
        </span>
      )}
    </div>
  );
}

export function Selector({
  etiqueta,
  children,
  className = '',
  ...p
}: SelectHTMLAttributes<HTMLSelectElement> & { etiqueta: string }) {
  const id = useId();
  return (
    <div className={`campo ${className}`}>
      <label htmlFor={p.id ?? id}>{etiqueta}</label>
      <select id={p.id ?? id} {...p}>
        {children}
      </select>
    </div>
  );
}

const TONOS: Record<string, string> = {
  // vuelo
  Programado: 'neutro',
  'Recursos asignados': 'info',
  'En preparación': 'info',
  Abordando: 'aviso',
  'En vuelo': 'azul',
  Aterrizado: 'ok',
  Descargando: 'ok',
  Finalizado: 'apagado',
  // reserva / tiquete / pago
  'Pendiente de pago': 'aviso',
  Confirmada: 'ok',
  Completada: 'apagado',
  Cancelada: 'error',
  Emitido: 'info',
  Abordado: 'azul',
  Volado: 'apagado',
  Anulado: 'error',
  Aprobado: 'ok',
  Rechazado: 'error',
  // casos
  Abierto: 'aviso',
  'En atención': 'azul',
  Cerrado: 'apagado',
  // equipaje
  Documentada: 'info',
  'En bodega': 'azul',
  Descargada: 'azul',
  'En banda': 'ok',
  Entregada: 'apagado',
  // aeronaves / mantenimiento
  'En servicio': 'ok',
  Completado: 'apagado',
};

export function Chip({ estado, children }: { estado: string; children?: ReactNode }) {
  return <span className={`chip chip-${TONOS[estado] ?? 'neutro'}`}>{children ?? estado}</span>;
}

export function Aviso({ tipo = 'error', children, titulo }: { tipo?: 'error' | 'info' | 'ok' | 'aviso'; titulo?: string; children: ReactNode }) {
  return (
    <div className={`aviso aviso-${tipo}`} role={tipo === 'error' ? 'alert' : 'status'}>
      <Icono nombre={tipo === 'ok' ? 'check' : 'alerta'} tam={18} />
      <div>
        {titulo && <strong>{titulo}</strong>}
        <div>{children}</div>
      </div>
    </div>
  );
}

export function Cargando({ texto = 'Cargando…', alto }: { texto?: string; alto?: number }) {
  return (
    <div className="cargando" style={alto ? { minHeight: alto } : undefined} role="status">
      <span className="giro" aria-hidden="true" />
      <span>{texto}</span>
    </div>
  );
}

export function Vacio({ titulo, children, accion }: { titulo: string; children?: ReactNode; accion?: ReactNode }) {
  return (
    <div className="vacio">
      <h3>{titulo}</h3>
      {children && <p>{children}</p>}
      {accion}
    </div>
  );
}

export function Codigo({ children, grande }: { children: ReactNode; grande?: boolean }) {
  return <span className={`codigo ${grande ? 'codigo-grande' : ''}`}>{children}</span>;
}

/** Título de página con texto de apoyo opcional y acciones a la derecha. */
export function Encabezado({ titulo, children, acciones }: { titulo: string; children?: ReactNode; acciones?: ReactNode }) {
  useEffect(() => {
    document.title = `${titulo} | Beta Airlines`;
  }, [titulo]);
  return (
    <header className="encabezado">
      <div>
        <h1>{titulo}</h1>
        {children && <p className="encabezado-texto">{children}</p>}
      </div>
      {acciones && <div className="encabezado-acciones">{acciones}</div>}
    </header>
  );
}

/** Pestañas accesibles simples. */
export function Pestanas<T extends string>({
  opciones,
  valor,
  onCambio,
  etiqueta,
}: {
  opciones: { valor: T; texto: ReactNode }[];
  valor: T;
  onCambio: (v: T) => void;
  etiqueta: string;
}) {
  return (
    <div className="pestanas" role="tablist" aria-label={etiqueta}>
      {opciones.map((o) => (
        <button key={o.valor} role="tab" type="button" aria-selected={o.valor === valor} className="pestana" onClick={() => onCambio(o.valor)}>
          {o.texto}
        </button>
      ))}
    </div>
  );
}

/** Tema claro/oscuro: sigue al sistema hasta que la persona elige uno. */
export function useTema() {
  const [tema, setTema] = useState<'claro' | 'oscuro'>(() => {
    const t = document.documentElement.dataset.tema;
    if (t === 'claro' || t === 'oscuro') return t;
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro';
  });
  const alternar = () => {
    const nuevo = tema === 'claro' ? 'oscuro' : 'claro';
    document.documentElement.dataset.tema = nuevo;
    try {
      localStorage.setItem('beta.tema', nuevo);
    } catch {
      /* sin almacenamiento */
    }
    setTema(nuevo);
  };
  return { tema, alternar };
}

export function BotonTema() {
  const { tema, alternar } = useTema();
  return (
    <button className="boton-icono" type="button" onClick={alternar} aria-label={tema === 'claro' ? 'Usar modo oscuro' : 'Usar modo claro'} title={tema === 'claro' ? 'Modo oscuro' : 'Modo claro'}>
      <Icono nombre={tema === 'claro' ? 'luna' : 'sol'} tam={18} />
    </button>
  );
}
