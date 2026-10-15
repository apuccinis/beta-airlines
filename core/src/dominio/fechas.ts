/** Fechas y horas como texto 'YYYY-MM-DD HH:MM:SS' (DATETIME) o 'YYYY-MM-DD' (DATE), en hora local. */
const p2 = (n: number) => String(n).padStart(2, '0');

export const aFecha = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
export const aFechaHora = (d: Date) => `${aFecha(d)} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
export const deTexto = (s: string) => {
  const [f, h = '00:00:00'] = s.split(' ');
  const [y, m, d] = f.split('-').map(Number);
  const [hh, mm, ss = 0] = h.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm, ss);
};
export const sumarMinutos = (d: Date, m: number) => new Date(d.getTime() + m * 60000);
export const sumarDias = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
export const inicioDelDia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const diasEntre = (a: Date, b: Date) => Math.round((inicioDelDia(b).getTime() - inicioDelDia(a).getTime()) / 864e5);

export const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/** Reloj inyectable: el servidor y el navegador usan la hora real; el seed y las pruebas la fijan. */
export interface Reloj {
  ahora(): Date;
}
export const relojDelSistema: Reloj = { ahora: () => new Date() };
export class RelojFijo implements Reloj {
  private t: Date;
  constructor(t: Date) {
    this.t = new Date(t);
  }
  ahora() {
    return new Date(this.t);
  }
  fijar(t: Date) {
    this.t = new Date(t);
  }
  avanzar(min: number) {
    this.t = sumarMinutos(this.t, min);
  }
}
