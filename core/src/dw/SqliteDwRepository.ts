import type { Db } from '../db/Db';
import type { DimensionCiudad } from '../api/tipos';
import { insertar } from '../dominio/ids';
import { TABLAS_DW, type CargaDw, type DwRepository, type FilaMesCiudad, type FilaMesPasajero, type TablaDw } from './DwRepository';

const columnaCiudad = (d: DimensionCiudad) => (d === 'destino' ? 'f.IdCiudadDestino' : 'f.IdCiudadOrigen');

/** Consultas de db/consultas_requerimientos_dw.sql, adaptadas a parámetros (año y ciudad de origen/destino). */
export const SQL_DW = {
  '4a': (d: DimensionCiudad) => `SELECT t.Anio, t.Mes, t.NombreMes, c.Ciudad,
       SUM(f.ValorVenta)       AS Ingresos,
       SUM(f.CantidadTiquetes) AS TiquetesVendidos
FROM FactVentaTiquetes f
JOIN DimTiempo t ON t.IdTiempo   = f.IdTiempo
JOIN DimCiudad c ON c.IdCiudadDW = ${columnaCiudad(d)}
WHERE t.Anio = ?
GROUP BY t.Anio, t.Mes, t.NombreMes, c.Ciudad
ORDER BY t.Anio, t.Mes, Ingresos DESC`,
  '4b': (d: DimensionCiudad) => `SELECT t.Anio, t.Mes, t.NombreMes, c.Ciudad,
       SUM(f.CantidadReservas) AS Reservas,
       SUM(f.NumeroPasajeros)  AS Pasajeros
FROM FactReservas f
JOIN DimTiempo t ON t.IdTiempo   = f.IdTiempo
JOIN DimCiudad c ON c.IdCiudadDW = ${columnaCiudad(d)}
WHERE t.Anio = ?
GROUP BY t.Anio, t.Mes, t.NombreMes, c.Ciudad
ORDER BY t.Anio, t.Mes, Reservas DESC`,
  '4c': (filtro: boolean) => `SELECT t.Anio, t.Mes, t.NombreMes, cl.IdClienteDW, cl.NombreCompleto, cl.NivelSocio,
       SUM(f.MillasAcumuladas) AS MillasNacionales,
       SUM(f.CantidadVuelos)   AS VuelosNacionales
FROM FactMillasPasajero f
JOIN DimTiempo  t  ON t.IdTiempo     = f.IdTiempo
JOIN DimCliente cl ON cl.IdClienteDW = f.IdClienteDW
JOIN DimRuta    r  ON r.IdRutaDW     = f.IdRutaDW
WHERE r.TipoRuta = 'Nacional' AND t.Anio = ?${filtro ? `\n  AND cl.NombreCompleto LIKE ?` : ''}
GROUP BY t.Anio, t.Mes, t.NombreMes, cl.IdClienteDW, cl.NombreCompleto, cl.NivelSocio
ORDER BY t.Anio, t.Mes, MillasNacionales DESC`,
};

/** Data warehouse sobre SQLite (archivo en modo completo, sql.js en el navegador). */
export class SqliteDwRepository implements DwRepository {
  constructor(private readonly dw: Db) {}

  reemplazarTodo(carga: CargaDw): void {
    this.dw.transaction(() => {
      // primero los hechos (tienen FK hacia las dimensiones)
      for (const t of [...TABLAS_DW].reverse()) this.dw.run(`DELETE FROM ${t}`);
      for (const t of TABLAS_DW) for (const fila of carga[t]) insertar(this.dw, t, fila as Record<string, string | number>);
    });
  }

  conteos() {
    return TABLAS_DW.map((tabla) => ({ tabla, filas: this.dw.get<{ n: number }>(`SELECT COUNT(*) AS n FROM ${tabla}`)!.n }));
  }

  anios(): number[] {
    return this.dw
      .all<{ Anio: number }>(
        `SELECT DISTINCT t.Anio FROM DimTiempo t
         WHERE EXISTS (SELECT 1 FROM FactVentaTiquetes f WHERE f.IdTiempo = t.IdTiempo)
            OR EXISTS (SELECT 1 FROM FactReservas f WHERE f.IdTiempo = t.IdTiempo)
         ORDER BY t.Anio DESC`,
      )
      .map((x) => x.Anio);
  }

  primerasFilas(tabla: TablaDw, n: number) {
    if (!TABLAS_DW.includes(tabla)) return [];
    return this.dw.all(`SELECT * FROM ${tabla} LIMIT ${Math.max(1, n | 0)}`);
  }

  ingresosPorMesYCiudad(anio: number, d: DimensionCiudad): FilaMesCiudad[] {
    return this.dw
      .all<any>(SQL_DW['4a'](d), [anio])
      .map((x) => ({ Mes: x.Mes, Ciudad: x.Ciudad, Valor: x.Ingresos, Valor2: x.TiquetesVendidos }));
  }

  reservasPorMesYCiudad(anio: number, d: DimensionCiudad): FilaMesCiudad[] {
    return this.dw
      .all<any>(SQL_DW['4b'](d), [anio])
      .map((x) => ({ Mes: x.Mes, Ciudad: x.Ciudad, Valor: x.Reservas, Valor2: x.Pasajeros }));
  }

  millasNacionalesPorMes(anio: number, busqueda?: string): FilaMesPasajero[] {
    const q = busqueda?.trim();
    return this.dw.all<any>(SQL_DW['4c'](!!q), q ? [anio, `%${q}%`] : [anio]).map((x) => ({
      Mes: x.Mes,
      IdClienteDW: x.IdClienteDW,
      NombreCompleto: x.NombreCompleto,
      NivelSocio: x.NivelSocio,
      Millas: x.MillasNacionales,
      Vuelos: x.VuelosNacionales,
    }));
  }

  sql(reporte: '4a' | '4b' | '4c', d: DimensionCiudad = 'origen') {
    return reporte === '4c' ? SQL_DW['4c'](false) : SQL_DW[reporte](d);
  }
}
