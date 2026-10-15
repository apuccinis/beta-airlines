/** Formatos de presentación (es-CO, precios en USD). */
const USD = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const USD0 = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const NUM = new Intl.NumberFormat('es-CO');

export const dinero = (v: number) => USD.format(v || 0);
export const dineroRedondo = (v: number) => USD0.format(v || 0);
export const numero = (v: number) => NUM.format(v || 0);

export const aDate = (s: string) => {
  const [f, h = '00:00:00'] = s.split(' ');
  const [y, m, d] = f.split('-').map(Number);
  const [hh, mm] = h.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm);
};

export const hora = (s: string | null | undefined) => (s ? s.slice(11, 16) : '—');
/** Días calendario entre la salida y la llegada (0 si llega el mismo día). */
export const diasDeLlegada = (salida: string, llegada: string) =>
  Math.round((Date.parse(llegada.slice(0, 10)) - Date.parse(salida.slice(0, 10))) / 86_400_000);
/** Hora de llegada con "(+1)" si llega al día siguiente. */
export const horaLlegada = (salida: string, llegada: string) => {
  const dias = diasDeLlegada(salida, llegada);
  return dias > 0 ? `${hora(llegada)} (+${dias})` : hora(llegada);
};
export const capitalizar = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export const fechaCorta = (s: string) =>
  capitalizar(aDate(s).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, ''));
export const fechaLarga = (s: string) =>
  capitalizar(aDate(s).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
export const fechaMedia = (s: string) => aDate(s).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }).replace(/\./g, '');
export const fechaHora = (s: string | null | undefined) => (s ? `${fechaMedia(s)}, ${hora(s)}` : '—');

export const duracion = (min: number) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`;
};

/** Días de diferencia entre la fecha de un vuelo y hoy (0 = hoy). */
export function diasHasta(s: string) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const d = aDate(s);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - hoy.getTime()) / 864e5);
}

export function cuando(s: string) {
  const n = diasHasta(s);
  if (n === 0) return 'Hoy';
  if (n === 1) return 'Mañana';
  if (n === -1) return 'Ayer';
  return fechaCorta(s);
}

export const fechaISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const sumarDias = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

export const plural = (n: number, uno: string, varios: string) => `${numero(n)} ${n === 1 ? uno : varios}`;
