import { DbBase, type Param, type Row } from './Db';
import { traducirErrorSqlite } from '../errores';

/** Forma mínima de DatabaseSync (node:sqlite). Se tipa de forma estructural para no depender de Node en core/. */
export interface DatabaseSyncLike {
  exec(sql: string): void;
  prepare(sql: string): {
    run(...params: any[]): { changes: number | bigint };
    all(...params: any[]): unknown[];
    get(...params: any[]): unknown;
  };
  close(): void;
}

/** Adaptador del servidor: envuelve una conexión de node:sqlite ya abierta. */
export class NodeSqliteDb extends DbBase {
  private cache = new Map<string, ReturnType<DatabaseSyncLike['prepare']>>();

  constructor(private readonly conexion: DatabaseSyncLike) {
    super();
    conexion.exec('PRAGMA foreign_keys = ON');
  }

  private stmt(sql: string) {
    let s = this.cache.get(sql);
    if (!s) {
      s = this.conexion.prepare(sql);
      this.cache.set(sql, s);
    }
    return s;
  }

  run(sql: string, params: Param[] = []) {
    try {
      const r = this.stmt(sql).run(...params);
      return { changes: Number(r.changes) };
    } catch (e) {
      throw traducirErrorSqlite(e);
    }
  }

  all<T = Row>(sql: string, params: Param[] = []): T[] {
    try {
      return this.stmt(sql).all(...params).map((r) => ({ ...(r as object) })) as T[];
    } catch (e) {
      throw traducirErrorSqlite(e);
    }
  }

  get<T = Row>(sql: string, params: Param[] = []): T | undefined {
    try {
      const r = this.stmt(sql).get(...params);
      return r ? ({ ...(r as object) } as T) : undefined;
    } catch (e) {
      throw traducirErrorSqlite(e);
    }
  }

  exec(sql: string) {
    try {
      this.conexion.exec(sql);
    } catch (e) {
      throw traducirErrorSqlite(e);
    }
  }

  close() {
    this.cache.clear();
    this.conexion.close();
  }
}
