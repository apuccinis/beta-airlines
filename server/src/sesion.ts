import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import type { Actor, AlmacenClaveValor } from '@beta/core';

const DURACION_SEG = 60 * 60 * 12;
const b64 = (x: Buffer | string) => Buffer.from(x).toString('base64url');

/** Sesiones con JWT firmado (HS256). El secreto se genera una vez y se guarda en data/estado.json. */
export class Sesiones {
  private secreto: Buffer;

  constructor(kv: AlmacenClaveValor) {
    let s = process.env.BETA_SECRETO ?? kv.leer('sesion.secreto');
    if (!s) {
      s = randomBytes(32).toString('hex');
      kv.guardar('sesion.secreto', s);
    }
    this.secreto = Buffer.from(s);
  }

  private firma(datos: string) {
    return createHmac('sha256', this.secreto).update(datos).digest('base64url');
  }

  firmar(actor: Actor): string {
    const cabecera = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const ahora = Math.floor(Date.now() / 1000);
    const cuerpo = b64(JSON.stringify({ sub: actor.id, tipo: actor.tipo, iat: ahora, exp: ahora + DURACION_SEG }));
    return `${cabecera}.${cuerpo}.${this.firma(`${cabecera}.${cuerpo}`)}`;
  }

  verificar(token: string | undefined): Actor | null {
    if (!token) return null;
    const [cabecera, cuerpo, firma] = token.split('.');
    if (!cabecera || !cuerpo || !firma) return null;
    const esperada = Buffer.from(this.firma(`${cabecera}.${cuerpo}`));
    const recibida = Buffer.from(firma);
    if (esperada.length !== recibida.length || !timingSafeEqual(esperada, recibida)) return null;
    try {
      const p = JSON.parse(Buffer.from(cuerpo, 'base64url').toString());
      if (typeof p.exp !== 'number' || p.exp < Date.now() / 1000) return null;
      if (p.tipo !== 'cliente' && p.tipo !== 'empleado') return null;
      return { tipo: p.tipo, id: String(p.sub) };
    } catch {
      return null;
    }
  }

  deSolicitud(req: Request): Actor | null {
    const h = req.headers.authorization;
    return this.verificar(h?.startsWith('Bearer ') ? h.slice(7) : undefined);
  }
}
