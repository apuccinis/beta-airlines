import type { DwRepository, FilaMesCiudad } from '../dw/DwRepository';
import type { DimensionCiudad, EstadoDw, ReporteCiudad, ReporteMillas } from '../api/tipos';
import { MESES } from '../dominio/fechas';
import { ErrorNegocio } from '../errores';
import type { EtlService } from './EtlService';

const ceros = () => Array.from({ length: 12 }, () => 0);
const r2 = (v: number) => Math.round(v * 100) / 100;

/** Reportes de los requerimientos 4a, 4b y 4c sobre el data warehouse. */
export class AnaliticaService {
  constructor(
    private dw: DwRepository,
    private etl: EtlService,
  ) {}

  estado(): EstadoDw {
    return { ultimaCarga: this.etl.ultimaCarga(), anios: this.dw.anios(), conteos: this.dw.conteos() };
  }

  private validar(anio: number, d?: string): { anio: number; dimension: DimensionCiudad } {
    const a = Number(anio);
    if (!Number.isInteger(a) || a < 2000 || a > 2100) throw new ErrorNegocio('Elige un año válido.');
    return { anio: a, dimension: d === 'destino' ? 'destino' : 'origen' };
  }

  private pivotar(filas: FilaMesCiudad[], anio: number, dimension: DimensionCiudad, sql: string, redondearValor: boolean): ReporteCiudad {
    const porCiudad = new Map<string, { valores: number[]; valores2: number[] }>();
    for (const f of filas) {
      const c = porCiudad.get(f.Ciudad) ?? { valores: ceros(), valores2: ceros() };
      c.valores[f.Mes - 1] += f.Valor;
      c.valores2[f.Mes - 1] += f.Valor2;
      porCiudad.set(f.Ciudad, c);
    }
    const fix = (v: number) => (redondearValor ? r2(v) : v);
    const out = [...porCiudad.entries()]
      .map(([ciudad, c]) => ({
        ciudad,
        valores: c.valores.map(fix),
        valores2: c.valores2,
        total: fix(c.valores.reduce((s, v) => s + v, 0)),
        total2: c.valores2.reduce((s, v) => s + v, 0),
      }))
      .sort((a, z) => z.total - a.total);
    const totalesMes = ceros().map((_, i) => fix(out.reduce((s, f) => s + f.valores[i], 0)));
    const totalesMes2 = ceros().map((_, i) => out.reduce((s, f) => s + f.valores2[i], 0));
    return {
      anio,
      dimension,
      meses: MESES,
      filas: out,
      totalesMes,
      totalesMes2,
      total: fix(totalesMes.reduce((s, v) => s + v, 0)),
      total2: totalesMes2.reduce((s, v) => s + v, 0),
      sql,
    };
  }

  /** 4a. Ingresos por venta de tiquetes, por mes y por ciudad. */
  ingresos(anio: number, dimension?: string): ReporteCiudad {
    const p = this.validar(anio, dimension);
    return this.pivotar(this.dw.ingresosPorMesYCiudad(p.anio, p.dimension), p.anio, p.dimension, this.dw.sql('4a', p.dimension), true);
  }

  /** 4b. Número de reservas, por mes y por ciudad. */
  reservas(anio: number, dimension?: string): ReporteCiudad {
    const p = this.validar(anio, dimension);
    return this.pivotar(this.dw.reservasPorMesYCiudad(p.anio, p.dimension), p.anio, p.dimension, this.dw.sql('4b', p.dimension), false);
  }

  /** 4c. Millas acumuladas por pasajero en vuelos nacionales, por mes (top 25). */
  millasNacionales(anio: number, busqueda?: string, limite = 25): ReporteMillas {
    const p = this.validar(anio);
    const porPasajero = new Map<number, { pasajero: string; nivel: string; valores: number[]; vuelos: number[] }>();
    for (const f of this.dw.millasNacionalesPorMes(p.anio, busqueda)) {
      const x = porPasajero.get(f.IdClienteDW) ?? { pasajero: f.NombreCompleto, nivel: f.NivelSocio, valores: ceros(), vuelos: ceros() };
      x.valores[f.Mes - 1] += f.Millas;
      x.vuelos[f.Mes - 1] += f.Vuelos;
      porPasajero.set(f.IdClienteDW, x);
    }
    const todas = [...porPasajero.values()]
      .map((x) => ({ ...x, total: x.valores.reduce((s, v) => s + v, 0), totalVuelos: x.vuelos.reduce((s, v) => s + v, 0) }))
      .sort((a, z) => z.total - a.total || a.pasajero.localeCompare(z.pasajero));
    const totalesMes = ceros().map((_, i) => todas.reduce((s, f) => s + f.valores[i], 0));
    return {
      anio: p.anio,
      meses: MESES,
      filas: todas.slice(0, Math.max(1, limite)),
      totalPasajeros: todas.length,
      totalesMes,
      total: totalesMes.reduce((s, v) => s + v, 0),
      sql: this.dw.sql('4c'),
    };
  }
}
