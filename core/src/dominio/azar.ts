/** Generador pseudoaleatorio con semilla (mulberry32). El seed lo usa para ser determinista. */
export type Azar = () => number;

export function azarConSemilla(semilla: number): Azar {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const entero = (azar: Azar, min: number, max: number) => min + Math.floor(azar() * (max - min + 1));
export const elegir = <T>(azar: Azar, arr: readonly T[]): T => arr[Math.floor(azar() * arr.length)];
export function ponderado<T>(azar: Azar, pares: readonly (readonly [T, number])[]): T {
  const total = pares.reduce((s, p) => s + p[1], 0);
  let x = azar() * total;
  for (const [v, w] of pares) if ((x -= w) < 0) return v;
  return pares[0][0];
}
export const digitos = (azar: Azar, n: number) => {
  let s = String(1 + Math.floor(azar() * 9));
  while (s.length < n) s += String(Math.floor(azar() * 10));
  return s;
};
/** Mezcla una copia del arreglo (Fisher–Yates). */
export function barajar<T>(azar: Azar, arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
