import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ReporteCiudad, ReporteMillas } from '@beta/core';
import { useCarga, useDatos } from '../datos';
import { Aviso, Boton, Cargando, Encabezado, Pestanas, Vacio } from '../ui/comunes';
import { Icono } from '../ui/Icono';
import { dinero, fechaHora, numero } from '../ui/formato';
import { GraficaBarras } from './GraficaBarras';

type Reporte = 'ingresos' | 'reservas' | 'millas';
const MES_CORTO = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function descargarCsv(nombre: string, filas: (string | number)[][]) {
  const texto = filas
    .map((f) => f.map((c) => (typeof c === 'number' ? String(c) : `"${String(c).replace(/"/g, '""')}"`)).join(','))
    .join('\r\n');
  const url = URL.createObjectURL(new Blob(['﻿' + texto], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Consulta({ sql }: { sql: string }) {
  return (
    <details className="consulta">
      <summary>Consulta sobre el data warehouse</summary>
      <pre>{sql}</pre>
    </details>
  );
}

function ReportePorCiudad({ r, tipo }: { r: ReporteCiudad; tipo: 'ingresos' | 'reservas' }) {
  const esDinero = tipo === 'ingresos';
  const f = (v: number) => (esDinero ? dinero(v) : numero(v));
  const fCelda = (v: number) => numero(Math.round(v));
  const lider = r.filas[0];
  const nombre2 = esDinero ? 'tiquetes' : 'pasajeros';
  const dim = r.dimension === 'origen' ? 'origen' : 'destino';

  const exportar = () =>
    descargarCsv(`${esDinero ? 'ingresos' : 'reservas'}_por_ciudad_${dim}_${r.anio}.csv`, [
      [`Ciudad de ${dim}`, ...r.meses, 'Total'],
      ...r.filas.map((x) => [x.ciudad, ...x.valores, x.total]),
      ['Total', ...r.totalesMes, r.total],
    ]);

  if (!r.filas.length) return <Vacio titulo={`No hay datos para ${r.anio}`} />;

  return (
    <div className="pila">
      <dl className="kpis" style={{ margin: 0 }}>
        <div className="kpi">
          <dt>{esDinero ? 'Ingresos por venta de tiquetes' : 'Reservas hechas'}</dt>
          <dd>{f(r.total)}</dd>
        </div>
        <div className="kpi">
          <dt>{esDinero ? 'Tiquetes vendidos' : 'Pasajeros reservados'}</dt>
          <dd>{numero(r.total2)}</dd>
        </div>
        <div className="kpi">
          <dt>Ciudad de {dim} con más {esDinero ? 'ingresos' : 'reservas'}</dt>
          <dd>{lider.ciudad}</dd>
        </div>
      </dl>
      <section className="panel">
        <div className="panel-titulo">
          <h2>
            {esDinero ? 'Ingresos' : 'Reservas'} por mes, {r.anio}
          </h2>
          <span className="chico texto-3">Todas las ciudades de {dim}</span>
        </div>
        <div className="panel-cuerpo">
          <GraficaBarras
            titulo={`${esDinero ? 'Ingresos' : 'Reservas'} por mes en ${r.anio}`}
            etiquetas={MES_CORTO}
            valores={r.totalesMes}
            formato={f}
            detalle={(i) => `${numero(r.totalesMes2[i])} ${nombre2}`}
          />
        </div>
      </section>
      <section className="panel">
        <div className="panel-titulo">
          <div>
            <h2>Por ciudad de {dim} y mes</h2>
            {esDinero && <span className="chico texto-3">Valores en dólares (USD)</span>}
          </div>
          <Boton variante="secundario" className="boton-chico" onClick={exportar}>
            <Icono nombre="descargar" tam={16} />
            Exportar CSV
          </Boton>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="tabla tabla-reporte">
            <thead>
              <tr>
                <th>Ciudad</th>
                {MES_CORTO.map((m) => (
                  <th key={m}>{m}</th>
                ))}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {r.filas.map((x) => (
                <tr key={x.ciudad}>
                  <td>{x.ciudad}</td>
                  {x.valores.map((v, i) => (
                    <td key={i} className={v ? '' : 'celda-cero'}>
                      {v ? fCelda(v) : '—'}
                    </td>
                  ))}
                  <td>
                    <strong>{fCelda(x.total)}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                {r.totalesMes.map((v, i) => (
                  <td key={i}>{v ? fCelda(v) : '—'}</td>
                ))}
                <td>{fCelda(r.total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
      <Consulta sql={r.sql} />
    </div>
  );
}

function ReporteMillasNacionales({ r }: { r: ReporteMillas }) {
  const exportar = () =>
    descargarCsv(`millas_nacionales_por_pasajero_${r.anio}.csv`, [
      ['Pasajero', 'Nivel Skymiles', ...r.meses, 'Total', 'Vuelos nacionales'],
      ...r.filas.map((x) => [x.pasajero, x.nivel, ...x.valores, x.total, x.totalVuelos]),
    ]);
  const max = Math.max(1, ...r.filas.map((x) => x.total));

  return (
    <div className="pila">
      <dl className="kpis" style={{ margin: 0 }}>
        <div className="kpi">
          <dt>Millas acumuladas en vuelos nacionales</dt>
          <dd>{numero(r.total)}</dd>
        </div>
        <div className="kpi">
          <dt>Pasajeros con millas nacionales</dt>
          <dd>{numero(r.totalPasajeros)}</dd>
        </div>
        <div className="kpi">
          <dt>Promedio por pasajero</dt>
          <dd>{numero(Math.round(r.total / Math.max(1, r.totalPasajeros)))}</dd>
        </div>
      </dl>
      <section className="panel">
        <div className="panel-titulo">
          <div>
            <h2>Millas por pasajero y mes, {r.anio}</h2>
            <span className="chico texto-3">
              {r.filas.length < r.totalPasajeros ? `Los ${r.filas.length} pasajeros con más millas` : `${r.filas.length} pasajeros`}, solo vuelos nacionales
            </span>
          </div>
          <Boton variante="secundario" className="boton-chico" onClick={exportar}>
            <Icono nombre="descargar" tam={16} />
            Exportar CSV
          </Boton>
        </div>
        {r.filas.length === 0 ? (
          <Vacio titulo="Ningún pasajero coincide con la búsqueda" />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="tabla tabla-reporte">
              <thead>
                <tr>
                  <th>Pasajero</th>
                  {MES_CORTO.map((m) => (
                    <th key={m}>{m}</th>
                  ))}
                  <th>Total</th>
                  <th style={{ minWidth: 120 }}>
                    <span className="sr-solo">Proporción</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {r.filas.map((x) => (
                  <tr key={x.pasajero}>
                    <td>
                      {x.pasajero}
                      <div className="chico texto-3">{x.nivel === 'Sin afiliar' ? x.nivel : `Skymiles ${x.nivel}`}</div>
                    </td>
                    {x.valores.map((v, i) => (
                      <td key={i} className={v ? '' : 'celda-cero'} title={v ? `${x.vuelos[i]} vuelos` : undefined}>
                        {v ? numero(v) : '—'}
                      </td>
                    ))}
                    <td>
                      <strong>{numero(x.total)}</strong>
                    </td>
                    <td>
                      <div className="barra-celda" aria-hidden="true">
                        <span style={{ width: `${(x.total / max) * 100}%` }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <Consulta sql={r.sql} />
    </div>
  );
}

export function Analitica() {
  const { datos } = useDatos();
  const [params, setParams] = useSearchParams();
  const reporte = (['ingresos', 'reservas', 'millas'].includes(params.get('reporte') ?? '') ? params.get('reporte') : 'ingresos') as Reporte;
  const dimension = params.get('ciudad') === 'destino' ? 'destino' : 'origen';
  const estado = useCarga((d) => d.estadoDw(), []);
  const anioActual = new Date().getFullYear();
  const anio = Number(params.get('anio') ?? estado.datos?.anios[0] ?? anioActual);
  const [busqueda, setBusqueda] = useState(params.get('q') ?? '');
  const [q, setQ] = useState(busqueda);
  const [actualizando, setActualizando] = useState(false);
  const [version, setVersion] = useState(0);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setQ(busqueda), 250);
    return () => clearTimeout(t);
  }, [busqueda]);

  const datosReporte = useCarga<ReporteCiudad | ReporteMillas>(
    (d) =>
      reporte === 'ingresos'
        ? d.reporteIngresos(anio, dimension)
        : reporte === 'reservas'
          ? d.reporteReservas(anio, dimension)
          : d.reporteMillas(anio, q),
    [reporte, anio, dimension, q, version],
  );

  const cambiar = (c: Record<string, string>) => setParams({ ...Object.fromEntries(params), ...c });

  const actualizar = async () => {
    setActualizando(true);
    setAviso(null);
    try {
      estado.setDatos(await datos.ejecutarEtl());
      setVersion((v) => v + 1);
      setAviso('Datos actualizados con las operaciones más recientes.');
    } catch (e) {
      setAviso((e as Error).message);
    }
    setActualizando(false);
  };

  const anios = estado.datos?.anios.length ? estado.datos.anios : [anioActual];

  return (
    <>
      <Encabezado
        titulo="Analítica"
        acciones={
          <div className="fila">
            <span className="chico texto-2">
              {estado.datos?.ultimaCarga ? `Última carga: ${fechaHora(estado.datos.ultimaCarga)}` : 'Sin cargas registradas'}
            </span>
            <Boton variante="secundario" onClick={actualizar} cargando={actualizando}>
              <Icono nombre="actualizar" tam={18} />
              Actualizar datos
            </Boton>
          </div>
        }
      >
        Ventas, reservas y millas desde el data warehouse. Usa «Actualizar datos» para incluir las operaciones más recientes.
      </Encabezado>

      <div className="filtros">
        <Pestanas
          etiqueta="Reporte"
          valor={reporte}
          onCambio={(v) => cambiar({ reporte: v })}
          opciones={[
            { valor: 'ingresos', texto: 'Ingresos por ciudad' },
            { valor: 'reservas', texto: 'Reservas por ciudad' },
            { valor: 'millas', texto: 'Millas en vuelos nacionales' },
          ]}
        />
        <div className="campo">
          <label htmlFor="anio">Año</label>
          <select id="anio" value={anio} onChange={(e) => cambiar({ anio: e.target.value })}>
            {anios.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </div>
        {reporte !== 'millas' ? (
          <div className="campo">
            <label htmlFor="dimension">Ciudad</label>
            <select id="dimension" value={dimension} onChange={(e) => cambiar({ ciudad: e.target.value })}>
              <option value="origen">Ciudad de origen</option>
              <option value="destino">Ciudad de destino</option>
            </select>
          </div>
        ) : (
          <div className="campo">
            <label htmlFor="buscar-pasajero">Buscar pasajero</label>
            <input id="buscar-pasajero" type="search" placeholder="Nombre o apellido" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          </div>
        )}
      </div>

      {aviso && (
        <div style={{ marginBottom: 16 }}>
          <Aviso tipo={aviso.startsWith('Datos actualizados') ? 'ok' : 'error'}>{aviso}</Aviso>
        </div>
      )}
      {datosReporte.error && <Aviso>{datosReporte.error}</Aviso>}
      {datosReporte.cargando && !datosReporte.datos && <Cargando texto="Consultando el data warehouse…" />}
      {datosReporte.datos &&
        (reporte === 'millas' ? (
          'totalPasajeros' in datosReporte.datos && <ReporteMillasNacionales r={datosReporte.datos} />
        ) : (
          'dimension' in datosReporte.datos && <ReportePorCiudad r={datosReporte.datos} tipo={reporte} />
        ))}
    </>
  );
}
