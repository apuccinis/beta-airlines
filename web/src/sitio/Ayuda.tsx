import { useState, type FormEvent } from 'react';
import { TIPOS_CASO } from '@beta/core';
import { useCarga, useDatos } from '../datos';
import { Aviso, Boton, Cargando, Chip, Codigo, Encabezado, Selector, Vacio } from '../ui/comunes';
import { fechaHora } from '../ui/formato';

export function Ayuda() {
  const { datos } = useDatos();
  const casos = useCarga((d) => d.misCasos(), []);
  const [tipo, setTipo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [creado, setCreado] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    setCreado(null);
    try {
      const c = await datos.abrirCaso({ tipo, descripcion });
      setCreado(c.idCaso);
      setTipo('');
      setDescripcion('');
      await casos.recargar(true);
    } catch (err) {
      setError((err as Error).message);
    }
    setEnviando(false);
  };

  return (
    <div className="contenedor pagina">
      <Encabezado titulo="Centro de ayuda">Cuéntanos qué necesitas. Un agente de servicio al cliente atiende tu solicitud y te escribe al correo.</Encabezado>
      <div className="compra">
        <section className="panel">
          <div className="panel-titulo">
            <h2>Mis solicitudes</h2>
          </div>
          {casos.cargando && <Cargando />}
          {casos.error && <Aviso>{casos.error}</Aviso>}
          {casos.datos && casos.datos.length === 0 && <Vacio titulo="No tienes solicitudes">Las solicitudes que abras aparecerán aquí con su estado.</Vacio>}
          {casos.datos && casos.datos.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Solicitud</th>
                    <th>Tipo</th>
                    <th>Abierta</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {casos.datos.map((c) => (
                    <tr key={c.idCaso}>
                      <td>
                        <Codigo>{c.idCaso}</Codigo>
                        <div className="chico texto-2 descripcion">{c.descripcion}</div>
                      </td>
                      <td>{c.tipo}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{fechaHora(c.apertura)}</td>
                      <td>
                        <Chip estado={c.estado} />
                        {c.agente && <div className="chico texto-3">{c.agente}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <form className="panel panel-cuerpo pila resumen-compra" onSubmit={enviar}>
          <h2>Nueva solicitud</h2>
          <Selector etiqueta="¿En qué te ayudamos?" required value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="">Elige un tema</option>
            {TIPOS_CASO.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Selector>
          <div className="campo">
            <label htmlFor="descripcion">Describe tu caso</label>
            <textarea
              id="descripcion"
              required
              maxLength={200}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Incluye el código de reserva, el número de vuelo o la etiqueta de la maleta si los tienes."
            />
            <span className="campo-ayuda">{descripcion.length} de 200 caracteres</span>
          </div>
          {error && <Aviso>{error}</Aviso>}
          {creado && (
            <Aviso tipo="ok">
              Recibimos tu solicitud <Codigo>{creado}</Codigo>. Te enviamos una copia a tu correo.
            </Aviso>
          )}
          <Boton type="submit" cargando={enviando}>
            Enviar solicitud
          </Boton>
        </form>
      </div>
    </div>
  );
}
