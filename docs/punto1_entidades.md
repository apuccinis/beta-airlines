# Punto 1: entidades de datos (resumen)

Se identificaron 22 entidades a partir del enunciado y del diagrama de arquitectura (pipeline operacional arriba, pipeline de experiencia del cliente abajo y nueve bases de datos núcleo en el centro: Location, Flight, Schedule, Maint., Equip., Employee, Aircraft, Customer, Ticket).

| Grupo | Entidades | Para qué |
| --- | --- | --- |
| Datos generales (ambos pipelines) | Ciudad, Aeropuerto, Departamento, Empleado, Cliente, Ruta, Vuelo | A dónde vuela la aerolínea, quién trabaja en ella, quiénes son sus clientes y qué vuelos ofrece |
| Pipeline operacional | Aeronave, Equipo, Mantenimiento, AsignacionTripulacion, EventoVuelo | Preparar y seguir cada vuelo; cada etapa del pipeline se registra como EventoVuelo |
| Pipeline de experiencia del cliente | Reserva, Tiquete, Factura, Pago, Checkin, Equipaje, RastreoEquipaje, CuentaMillas, MovimientoMillas, CasoServicio | Reservar, pagar, hacer check-in y embarcar, seguir maletas, acumular millas y atender solicitudes |

Correspondencias con el diagrama: Flight → Vuelo, Customer → Cliente, Ticket → Tiquete, Maint. → Mantenimiento, Aircraft → Aeronave, Equip. → Equipo, Employee → Empleado y Departamento, Location → Ciudad y Aeropuerto, Schedule → Ruta. Reservations → Reserva, Skymiles → CuentaMillas y MovimientoMillas, Baggage → Equipaje y RastreoEquipaje, Boarding → Checkin. Los canales y dispositivos (kioscos, sitio web Skylinks, agentes de viaje, escáneres) son valores de los atributos Canal o PuntoControl, no entidades.

Supuestos:
- Una reserva corresponde a un solo vuelo; ida y vuelta son dos reservas.
- Un vuelo es nacional cuando su ruta une dos ciudades del mismo país (Ruta.TipoRuta). Se usa en el requerimiento 4c.
- La "ciudad" de los requerimientos 4a y 4b es la del vuelo, de origen o de destino.

Requerimientos del data warehouse (punto 4):
- 4a. Ingresos por venta de tiquetes durante todos los meses del año y por ciudad.
- 4b. Número de reservaciones hechas por los clientes durante todos los meses del año y por ciudad.
- 4c. Millas acumuladas por pasajero en sus vuelos nacionales, mensuales.
