import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CLASES, type Clase, type PasajeroEntrada } from '@beta/core';
import { useCarga, useDatos } from '../datos';
import { Aviso, Boton, Campo, Cargando, Encabezado } from '../ui/comunes';
import { Pasos, ResumenCompra } from './compra';

export function DatosPasajeros() {
  const [params] = useSearchParams();
  const navegar = useNavigate();
  const { datos, cliente } = useDatos();
  const idVuelo = params.get('vuelo') ?? '';
  const clase = (CLASES.includes(params.get('clase') as Clase) ? params.get('clase') : 'Económica') as Clase;
  const total = Math.min(4, Math.max(1, Number(params.get('pasajeros') ?? 1)));
  const vuelo = useCarga((d) => d.vuelo(idVuelo, clase), [idVuelo, clase]);
  const [acompanantes, setAcompanantes] = useState<PasajeroEntrada[]>(() =>
    Array.from({ length: total - 1 }, () => ({ nombres: '', apellidos: '', documento: '' })),
  );
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const cambiar = (i: number, k: keyof PasajeroEntrada, v: string) =>
    setAcompanantes(acompanantes.map((p, j) => (j === i ? { ...p, [k]: v } : p)));

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      const r = await datos.crearReserva({ idVuelo, clase, acompanantes });
      navegar(`/reserva/${r.idReserva}/pago`);
    } catch (err) {
      setError((err as Error).message);
      setEnviando(false);
    }
  };

  if (vuelo.cargando) return <Cargando />;
  if (vuelo.error || !vuelo.datos || !cliente) {
    return (
      <div className="contenedor pagina">
        <Aviso>{vuelo.error ?? 'No encontramos el vuelo.'}</Aviso>
      </div>
    );
  }
  const v = vuelo.datos;
  const subtotal = Math.round(v.precio * total * 100) / 100;
  const impuestos = Math.round(subtotal * 0.075 * 100) / 100;

  return (
    <div className="contenedor pagina">
      <Pasos actual={1} />
      <Encabezado titulo="¿Quiénes viajan?">Escribe los datos tal como aparecen en el documento de identidad de cada pasajero.</Encabezado>
      <div className="compra">
        <form className="panel panel-cuerpo pila" onSubmit={enviar}>
          <div className="pasajero-bloque">
            <h3>Pasajero 1 (titular de la reserva)</h3>
            <div className="pasajero-form">
              <Campo etiqueta="Nombres" value={cliente.nombres} readOnly />
              <Campo etiqueta="Apellidos" value={cliente.apellidos} readOnly />
              <Campo etiqueta="Documento" value={cliente.documento} readOnly />
            </div>
          </div>
          {acompanantes.map((p, i) => (
            <fieldset key={i} className="pasajero-bloque" style={{ border: 0, margin: 0, padding: 0 }}>
              <h3 style={{ paddingTop: 20 }}>Pasajero {i + 2}</h3>
              <div className="pasajero-form">
                <Campo etiqueta="Nombres" name={`nombres-${i}`} required value={p.nombres} onChange={(e) => cambiar(i, 'nombres', e.target.value)} />
                <Campo etiqueta="Apellidos" name={`apellidos-${i}`} required value={p.apellidos} onChange={(e) => cambiar(i, 'apellidos', e.target.value)} />
                <Campo
                  etiqueta="Documento"
                  name={`documento-${i}`}
                  required
                  inputMode="numeric"
                  value={p.documento}
                  onChange={(e) => cambiar(i, 'documento', e.target.value)}
                />
              </div>
            </fieldset>
          ))}
          <p className="chico texto-3">Enviaremos la confirmación y los tiquetes a {cliente.email}.</p>
          {error && <Aviso>{error}</Aviso>}
          <div className="fila-entre">
            <Boton type="button" variante="fantasma" onClick={() => navegar(-1)}>
              Volver a los vuelos
            </Boton>
            <Boton type="submit" cargando={enviando}>
              Continuar al pago
            </Boton>
          </div>
        </form>
        <ResumenCompra vuelo={v} clase={clase} pasajeros={total} liquidacion={{ unitario: v.precio, subtotal, impuestos, total: subtotal + impuestos }} />
      </div>
    </div>
  );
}
