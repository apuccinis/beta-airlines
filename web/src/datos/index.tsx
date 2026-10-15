import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { PerfilCliente, PerfilEmpleado } from '@beta/core';
import type { ClienteDatos } from './ClienteDatos';
import { ApiClient } from './ApiClient';

export { ErrorDatos } from './ClienteDatos';
export type { ClienteDatos } from './ClienteDatos';

export const MODO_LOCAL = import.meta.env.VITE_MODO_DATOS === 'local';

/** El modo se elige al compilar (VITE_MODO_DATOS). En modo API, LocalClient y sql.js ni siquiera se incluyen. */
export async function crearClienteDatos(): Promise<ClienteDatos> {
  if (MODO_LOCAL) {
    const { LocalClient } = await import('./LocalClient');
    return LocalClient.crear();
  }
  return new ApiClient();
}

interface Ctx {
  datos: ClienteDatos;
  cliente: PerfilCliente | null;
  empleado: PerfilEmpleado | null;
  setCliente(p: PerfilCliente | null): void;
  setEmpleado(p: PerfilEmpleado | null): void;
  refrescarCliente(): Promise<void>;
}

const Contexto = createContext<Ctx | null>(null);

export function ProveedorDatos({ datos, children }: { datos: ClienteDatos; children: ReactNode }) {
  const [cliente, setCliente] = useState<PerfilCliente | null>(null);
  const [empleado, setEmpleado] = useState<PerfilEmpleado | null>(null);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    Promise.all([datos.sesionCliente(), datos.sesionEmpleado()]).then(([c, e]) => {
      setCliente(c);
      setEmpleado(e);
      setListo(true);
    });
  }, [datos]);

  const refrescarCliente = useCallback(async () => setCliente(await datos.sesionCliente()), [datos]);

  if (!listo) return null;
  return (
    <Contexto.Provider value={{ datos, cliente, empleado, setCliente, setEmpleado, refrescarCliente }}>{children}</Contexto.Provider>
  );
}

export function useDatos() {
  const c = useContext(Contexto);
  if (!c) throw new Error('useDatos fuera de ProveedorDatos');
  return c;
}

/** Carga asíncrona con estado de carga, error y recarga. */
export function useCarga<T>(fn: (d: ClienteDatos) => Promise<T>, deps: unknown[]) {
  const { datos } = useDatos();
  const [estado, setEstado] = useState<{ datos: T | null; error: string | null; cargando: boolean }>({
    datos: null,
    error: null,
    cargando: true,
  });
  const ultima = useRef(0);
  const cargar = useCallback(
    (silencioso = false) => {
      const n = ++ultima.current;
      if (!silencioso) setEstado((e) => ({ ...e, cargando: true, error: null }));
      return fn(datos)
        .then((d) => n === ultima.current && setEstado({ datos: d, error: null, cargando: false }))
        .catch((e: Error) => n === ultima.current && setEstado({ datos: null, error: e.message, cargando: false }));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [datos, ...deps],
  );
  useEffect(() => {
    void cargar();
  }, [cargar]);
  return { ...estado, recargar: cargar, setDatos: (d: T) => setEstado({ datos: d, error: null, cargando: false }) };
}
