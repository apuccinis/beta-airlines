import { useState } from 'react';
import type { Caso } from '@beta/core';
import { useCarga, useDatos } from '../datos';
import { Aviso, Boton, Cargando, Chip, Codigo, Encabezado, Pestanas, Vacio } from '../ui/comunes';
import { fechaHora } from '../ui/formato';

type Filtro = 'Abierto' | 'En atención' | 'Cerrado' | '';

export function ServicioCliente() {
  const { datos } = useDatos();
  const [filtro, setFiltro] = useState<Filtro>('');
  const casos = useCarga((d) => d.casos(), []);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const accion = async (c: Caso, fn: (id: string) => Promise<Caso>) => {
    setOcupado(c.idCaso);
    setError(null);
    try {
      const nuevo = await fn(c.idCaso);
      casos.setDatos((casos.datos ?? []).map((x) => (x.idCaso === nuevo.idCaso ? nuevo : x)));
    } catch (e) {
      setError((e as Error).message);
    }
    setOcupado(null);
  };

  const todos = casos.datos ?? [];
  const cuenta = (e: string) => todos.filter((c) => c.estado === e).length;
  const lista = filtro ? todos.filter((c) => c.estado === filtro) : todos;

  return (
    <>
      <Encabezado
        titulo="Servicio al cliente"
        acciones={
          <Pestanas
            etiqueta="Estado"
            valor={filtro}
            onCambio={setFiltro}
            opciones={[
              { valor: '', texto: `Todos (${todos.length})` },
              { valor: 'Abierto', texto: `Abiertos (${cuenta('Abierto')})` },
              { valor: 'En atención', texto: `En atención (${cuenta('En atención')})` },
              { valor: 'Cerrado', texto: `Cerrados (${cuenta('Cerrado')})` },
            ]}
          />
        }
      >
        Solicitudes de los pasajeros por web, app, call center y mostrador. Al atender un caso queda asignado a tu nombre.
      </Encabezado>
      {error && <Aviso>{error}</Aviso>}
      {casos.cargando && <Cargando />}
      {casos.datos && lista.length === 0 && <Vacio titulo="No hay casos en este estado" />}
      {lista.length > 0 && (
        <div className="tabla-envoltura">
          <table className="tabla">
            <thead>
              <tr>
                <th>Caso</th>
                <th>Abierto</th>
                <th>Pasajero</th>
                <th>Tipo</th>
                <th>Canal</th>
                <th>Descripción</th>
                <th>Estado</th>
                <th>Agente</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lista.map((c) => (
                <tr key={c.idCaso}>
                  <td>
                    <Codigo>{c.idCaso}</Codigo>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>{fechaHora(c.apertura)}</td>
                  <td>
                    {c.cliente}
                    <div className="chico texto-3">Doc. {c.documentoCliente}</div>
                  </td>
                  <td>{c.tipo}</td>
                  <td>{c.canal}</td>
                  <td className="descripcion">{c.descripcion}</td>
                  <td>
                    <Chip estado={c.estado} />
                    {c.cierre && <div className="chico texto-3">{fechaHora(c.cierre)}</div>}
                  </td>
                  <td>{c.agente ?? '—'}</td>
                  <td className="num">
                    {c.estado === 'Abierto' && (
                      <Boton className="boton-chico" cargando={ocupado === c.idCaso} onClick={() => accion(c, datos.atenderCaso)}>
                        Atender
                      </Boton>
                    )}
                    {c.estado === 'En atención' && (
                      <Boton variante="secundario" className="boton-chico" cargando={ocupado === c.idCaso} onClick={() => accion(c, datos.cerrarCaso)}>
                        Cerrar caso
                      </Boton>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
