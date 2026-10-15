import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useCarga, useDatos } from '../datos';
import { Aviso, Boton, Campo, Cargando, Encabezado } from '../ui/comunes';
import { Icono } from '../ui/Icono';
import { dinero } from '../ui/formato';
import { Pasos, ResumenCompra } from './compra';

const marca = (n: string) =>
  /^4/.test(n) ? 'VISA' : /^(5[1-5]|2[2-7])/.test(n) ? 'MASTERCARD' : /^3[47]/.test(n) ? 'AMEX' : '';

const agrupar = (v: string) =>
  v
    .replace(/\D/g, '')
    .slice(0, 19)
    .replace(/(\d{4})(?=\d)/g, '$1 ');

const vencimiento = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};

export function Pago() {
  const { id = '' } = useParams();
  const { datos } = useDatos();
  const navegar = useNavigate();
  const reserva = useCarga((d) => d.reserva(id), [id]);
  const [t, setT] = useState({ numero: '', titular: '', vencimiento: '', cvv: '' });
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (reserva.cargando) return <Cargando />;
  const r = reserva.datos;
  if (!r) {
    return (
      <div className="contenedor pagina">
        <Aviso>{reserva.error ?? 'No encontramos la reserva.'}</Aviso>
      </div>
    );
  }
  if (r.estado === 'Confirmada' || r.estado === 'Completada') return <Navigate to={`/reserva/${id}/confirmacion`} replace />;

  const pagar = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      await datos.pagar(id, t);
      navegar(`/reserva/${id}/confirmacion`, { replace: true });
    } catch (err) {
      setError((err as Error).message);
      setEnviando(false);
      reserva.recargar(true);
    }
  };

  return (
    <div className="contenedor pagina">
      <Pasos actual={2} />
      <Encabezado titulo="Paga tu reserva">
        Reserva para {r.numeroPasajeros} {r.numeroPasajeros === 1 ? 'pasajero' : 'pasajeros'}. Tus sillas quedan apartadas mientras completas el pago.
      </Encabezado>
      {r.estado !== 'Pendiente de pago' || !r.liquidacion ? (
        <Aviso titulo="Esta reserva ya no se puede pagar">
          El tiempo para pagarla terminó. Haz una nueva búsqueda para reservar tu vuelo.
        </Aviso>
      ) : (
        <div className="compra">
          <form className="panel panel-cuerpo pila" onSubmit={pagar} aria-label="Datos de la tarjeta">
            <div className="fila-entre">
              <h2>Tarjeta de crédito o débito</h2>
              <Icono nombre="tarjeta" tam={26} className="texto-3" />
            </div>
            <div className="tarjeta-campo">
              <Campo
                etiqueta="Número de la tarjeta"
                name="numero"
                inputMode="numeric"
                autoComplete="cc-number"
                placeholder="0000 0000 0000 0000"
                required
                value={t.numero}
                onChange={(e) => setT({ ...t, numero: agrupar(e.target.value) })}
              />
              <span className="tarjeta-marca">{marca(t.numero.replace(/\s/g, ''))}</span>
            </div>
            <Campo
              etiqueta="Nombre del titular"
              name="titular"
              autoComplete="cc-name"
              placeholder="Como aparece en la tarjeta"
              required
              value={t.titular}
              onChange={(e) => setT({ ...t, titular: e.target.value.toUpperCase() })}
            />
            <div className="rejilla-2">
              <Campo
                etiqueta="Vencimiento"
                name="vencimiento"
                inputMode="numeric"
                autoComplete="cc-exp"
                placeholder="MM/AA"
                required
                value={t.vencimiento}
                onChange={(e) => setT({ ...t, vencimiento: vencimiento(e.target.value) })}
              />
              <Campo
                etiqueta="Código de seguridad"
                name="cvv"
                inputMode="numeric"
                autoComplete="cc-csc"
                placeholder="CVV"
                maxLength={4}
                required
                value={t.cvv}
                onChange={(e) => setT({ ...t, cvv: e.target.value.replace(/\D/g, '') })}
                ayuda="Los 3 o 4 dígitos al respaldo de la tarjeta."
              />
            </div>
            {error && <Aviso titulo="No pudimos procesar el pago">{error}</Aviso>}
            <Boton type="submit" cargando={enviando}>
              <Icono nombre="candado" tam={18} />
              Pagar {dinero(r.liquidacion.total)}
            </Boton>
            <p className="seguro">
              <Icono nombre="candado" tam={16} />
              Tu pago se procesa en una conexión cifrada. No guardamos los datos de tu tarjeta.
            </p>
          </form>
          <ResumenCompra vuelo={r.vuelo} clase={r.clase ?? 'Económica'} pasajeros={r.numeroPasajeros} liquidacion={r.liquidacion} />
        </div>
      )}
    </div>
  );
}
