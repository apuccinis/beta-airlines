import { describe, expect, it } from 'vitest';
import { adaptarEsquema, cargarEsquema, ErrorNegocio, insertar } from '../src';
import { ADAPTADORES, SQL_BD, SQL_DW } from './ayudas';

describe('adaptación de los scripts de Enterprise Architect', () => {
  it('reconoce las 22 tablas operacionales y las 8 del DW sin sentencias sin adaptar', () => {
    expect(adaptarEsquema(SQL_BD).tablas).toHaveLength(22);
    expect(adaptarEsquema(SQL_DW).tablas).toHaveLength(8);
  });

  it('incorpora las FK y los UNIQUE dentro del CREATE TABLE con su nombre original', () => {
    const { sentencias } = adaptarEsquema(SQL_BD);
    const checkin = sentencias.find((s) => s.startsWith('CREATE TABLE `Checkin`'))!;
    expect(checkin).toContain('CONSTRAINT `UQ_Checkin_IdTiquete` UNIQUE (`IdTiquete` ASC)');
    expect(checkin).toContain('CONSTRAINT `FK_Checkin_Tiquete` FOREIGN KEY (`IdTiquete`) REFERENCES `Tiquete` (`IdTiquete`)');
    expect(checkin).not.toMatch(/No Action/i);
    expect(sentencias.filter((s) => s.startsWith('CREATE INDEX'))).toHaveLength(SQL_BD.match(/ADD INDEX/g)!.length);
  });
});

describe.each(ADAPTADORES)('esquema con $nombre', (adaptador) => {
  it('crea 22 + 8 tablas, sus índices y deja las FK activas', async () => {
    const db = await adaptador.crear();
    const dw = await adaptador.crear();
    cargarEsquema(db, SQL_BD);
    cargarEsquema(dw, SQL_DW);

    const tablas = (d: typeof db) => d.all<{ name: string }>(`SELECT name FROM sqlite_master WHERE type = 'table'`).map((t) => t.name);
    expect(tablas(db)).toHaveLength(22);
    expect(tablas(dw).sort()).toEqual(
      ['DimCanal', 'DimCiudad', 'DimCliente', 'DimRuta', 'DimTiempo', 'FactMillasPasajero', 'FactReservas', 'FactVentaTiquetes'].sort(),
    );
    expect(db.get<{ foreign_keys: number }>('PRAGMA foreign_keys')!.foreign_keys).toBe(1);
    expect(dw.get<{ foreign_keys: number }>('PRAGMA foreign_keys')!.foreign_keys).toBe(1);

    const fks = db.all(`SELECT * FROM pragma_foreign_key_list('Ruta')`);
    expect(fks).toHaveLength(2);
    const fkDw = dw.all(`SELECT * FROM pragma_foreign_key_list('FactVentaTiquetes')`);
    expect(fkDw).toHaveLength(5);
  });

  it('rechaza una FK inexistente con un error de negocio 409', async () => {
    const db = await adaptador.crear();
    cargarEsquema(db, SQL_BD);
    let error: unknown;
    try {
      insertar(db, 'Aeropuerto', { IdAeropuerto: 'AP00000001', CodigoIATA: 'XXX', Nombre: 'Prueba', IdCiudad: 'CI99999999' });
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(ErrorNegocio);
    expect((error as ErrorNegocio).codigo).toBe(409);
  });

  it('respeta los UNIQUE del modelo y deshace la transacción completa si algo falla', async () => {
    const db = await adaptador.crear();
    cargarEsquema(db, SQL_BD);
    insertar(db, 'Departamento', { IdDepartamento: 'DP00000001', Nombre: 'Reservas' });
    expect(() =>
      db.transaction(() => {
        insertar(db, 'Departamento', { IdDepartamento: 'DP00000002', Nombre: 'Pagos' });
        insertar(db, 'Departamento', { IdDepartamento: 'DP00000001', Nombre: 'Duplicado' });
      }),
    ).toThrow(ErrorNegocio);
    expect(db.get<{ n: number }>('SELECT COUNT(*) AS n FROM Departamento')!.n).toBe(1);
  });
});
