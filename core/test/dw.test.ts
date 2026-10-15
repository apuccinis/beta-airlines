import { beforeAll, describe, expect, it } from 'vitest';
import { CUENTAS, type Actor } from '../src';
import { ADAPTADORES, AHORA, entorno } from './ayudas';

describe.each(ADAPTADORES)('ETL y reportes 4a, 4b y 4c con $nombre', (adaptador) => {
  let e: Awaited<ReturnType<typeof entorno>>;
  let analista: Actor;
  const anio = AHORA.getFullYear();

  beforeAll(async () => {
    e = await entorno(adaptador);
    analista = { tipo: 'empleado', id: e.api.ingresarEmpleado(CUENTAS.analista.documento).id };
  }, 120_000);

  it('carga dimensiones y hechos coherentes con la base operacional', () => {
    const estado = e.api.estadoDw(analista);
    const filas = Object.fromEntries(estado.conteos.map((c) => [c.tabla, c.filas]));
    const n = (sql: string) => e.db.get<{ n: number }>(sql)!.n;
    expect(filas.DimCiudad).toBe(12);
    expect(filas.DimRuta).toBe(132);
    expect(filas.DimCliente).toBe(n('SELECT COUNT(*) AS n FROM Cliente'));
    expect(filas.DimCanal).toBe(n('SELECT COUNT(DISTINCT Canal) AS n FROM Reserva'));
    expect(filas.FactVentaTiquetes).toBe(n(`SELECT COUNT(*) AS n FROM Tiquete WHERE Estado <> 'Anulado'`));
    expect(filas.FactReservas).toBe(n('SELECT COUNT(*) AS n FROM Reserva'));
    expect(filas.FactMillasPasajero).toBe(n(`SELECT COUNT(*) AS n FROM MovimientoMillas WHERE Tipo = 'Acumulacion'`));
    expect(estado.anios).toContain(anio);
    expect(estado.ultimaCarga).toBeTruthy();
    const t = e.dw.get<any>(`SELECT * FROM DimTiempo WHERE IdTiempo = ?`, [anio * 10000 + 101]);
    expect(t).toMatchObject({ Anio: anio, Mes: 1, Dia: 1, Trimestre: 1, NombreMes: 'Enero' });
    // las reservas se distribuyen en el año, no se acumulan en enero
    const porMes = e.dw.all<{ Mes: number; n: number }>(
      `SELECT t.Mes, COUNT(*) AS n FROM FactReservas f JOIN DimTiempo t ON t.IdTiempo = f.IdTiempo GROUP BY t.Mes`,
    );
    const enero = porMes.find((m) => m.Mes === 1)!.n;
    const promedio = porMes.filter((m) => m.Mes > 1 && m.Mes < 10).reduce((s, m) => s + m.n, 0) / 8;
    expect(enero).toBeLessThan(promedio * 1.3);
  });

  it('4a: ingresos por mes y ciudad cuadran con la venta de tiquetes', () => {
    const r = e.api.reporteIngresos(analista, anio, 'origen');
    const esperado = e.db.get<{ s: number }>(
      `SELECT ROUND(SUM(Valor), 2) AS s FROM Tiquete WHERE Estado <> 'Anulado' AND substr(FechaEmision, 1, 4) = ?`,
      [String(anio)],
    )!.s;
    expect(r.total).toBeCloseTo(esperado, 2);
    expect(r.filas.length).toBeGreaterThan(5);
    expect(r.filas[0].valores).toHaveLength(12);
    const destino = e.api.reporteIngresos(analista, anio, 'destino');
    expect(destino.total).toBeCloseTo(r.total, 2);
    expect(destino.filas[0].ciudad).not.toBe('') ;
    expect(r.sql).toContain('FROM FactVentaTiquetes f');
  });

  it('4b: número de reservas por mes y ciudad', () => {
    const r = e.api.reporteReservas(analista, anio, 'origen');
    const esperado = e.db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM Reserva WHERE substr(FechaReserva, 1, 4) = ?`, [String(anio)])!.n;
    expect(r.total).toBe(esperado);
    expect(r.filas.find((f) => f.ciudad === 'Atlanta')!.total).toBeGreaterThan(0);
  });

  it('4c: millas por pasajero solo en vuelos nacionales', () => {
    const r = e.api.reporteMillas(analista, anio);
    const esperado = e.db.get<{ s: number }>(
      `SELECT SUM(m.Millas) AS s FROM MovimientoMillas m
       JOIN Tiquete t ON t.IdTiquete = m.IdTiquete JOIN Reserva r ON r.IdReserva = t.IdReserva
       JOIN Vuelo v ON v.IdVuelo = r.IdVuelo JOIN Ruta ru ON ru.IdRuta = v.IdRuta
       WHERE m.Tipo = 'Acumulacion' AND ru.TipoRuta = 'Nacional' AND substr(m.Fecha, 1, 4) = ?`,
      [String(anio)],
    )!.s;
    expect(r.total).toBe(esperado);
    expect(r.filas.length).toBeLessThanOrEqual(25);
    expect(r.filas.length).toBeGreaterThan(0);
    const laura = e.api.reporteMillas(analista, anio, 'Laura');
    expect(laura.filas).toHaveLength(1);
    expect(laura.filas[0].pasajero).toBe('Laura Gómez');
    // ninguna ruta internacional suma: ATL–BOG no aparece en los totales de Laura
    const nacionalesLaura = e.db.get<{ s: number }>(
      `SELECT SUM(m.Millas) AS s FROM MovimientoMillas m JOIN CuentaMillas cm ON cm.IdCuentaMillas = m.IdCuentaMillas
       JOIN Cliente c ON c.IdCliente = cm.IdCliente
       JOIN Tiquete t ON t.IdTiquete = m.IdTiquete JOIN Reserva r ON r.IdReserva = t.IdReserva
       JOIN Vuelo v ON v.IdVuelo = r.IdVuelo JOIN Ruta ru ON ru.IdRuta = v.IdRuta
       WHERE c.Documento = ? AND ru.TipoRuta = 'Nacional' AND m.Tipo = 'Acumulacion'`,
      [CUENTAS.pasajera.documento],
    )!.s;
    expect(laura.filas[0].total).toBe(nacionalesLaura);
  });

  it('el ETL se puede volver a correr y refleja las operaciones nuevas', () => {
    const antes = e.api.reporteReservas(analista, anio).total;
    const laura = { tipo: 'cliente' as const, id: e.api.ingresarCliente(CUENTAS.pasajera.documento, CUENTAS.pasajera.email).id };
    const v = e.api.buscarVuelos({ origen: 'ATL', destino: 'MIA', fecha: '2026-10-18', pasajeros: 1, clase: 'Premium' }).vuelos[0];
    e.api.crearReserva(laura, { idVuelo: v.idVuelo, clase: 'Premium', acompanantes: [] });
    e.api.ejecutarEtl(analista);
    expect(e.api.reporteReservas(analista, anio).total).toBe(antes + 1);
  });

  it('el seed es determinista', async () => {
    const otro = await entorno(adaptador);
    const codigos = (db: typeof e.db) => db.all<{ c: string }>(`SELECT CodigoReserva AS c FROM Reserva ORDER BY IdReserva LIMIT 50`).map((x) => x.c);
    expect(codigos(otro.db)).toEqual(codigos(e.db));
    expect(otro.resultado.seed.filas).toEqual(e.resultado.seed.filas);
  }, 120_000);
});
