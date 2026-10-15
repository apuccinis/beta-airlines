/**
 * Interfaz de acceso a SQLite que usan todos los servicios de core/.
 * Hay dos implementaciones: NodeSqliteDb (servidor, node:sqlite) y SqlJsDb (navegador, sql.js).
 */
export type Param = string | number | null;
export type Row = Record<string, any>;

export interface Db {
  run(sql: string, params?: Param[]): { changes: number };
  all<T = Row>(sql: string, params?: Param[]): T[];
  get<T = Row>(sql: string, params?: Param[]): T | undefined;
  /** Ejecuta uno o varios statements sin parámetros (esquema, PRAGMA). */
  exec(sql: string): void;
  /** Ejecuta fn dentro de una transacción. Las llamadas anidadas se unen a la transacción externa. */
  transaction<T>(fn: () => T): T;
}

/** Lógica común de transacciones anidadas y traducción de errores de SQLite. */
export abstract class DbBase implements Db {
  private profundidad = 0;

  abstract run(sql: string, params?: Param[]): { changes: number };
  abstract all<T = Row>(sql: string, params?: Param[]): T[];
  abstract get<T = Row>(sql: string, params?: Param[]): T | undefined;
  abstract exec(sql: string): void;

  transaction<T>(fn: () => T): T {
    if (this.profundidad > 0) {
      this.profundidad++;
      try {
        return fn();
      } finally {
        this.profundidad--;
      }
    }
    this.exec('BEGIN');
    this.profundidad = 1;
    try {
      const r = fn();
      this.exec('COMMIT');
      return r;
    } catch (e) {
      try {
        this.exec('ROLLBACK');
      } catch {
        /* la transacción ya se cerró */
      }
      throw e;
    } finally {
      this.profundidad = 0;
    }
  }
}
