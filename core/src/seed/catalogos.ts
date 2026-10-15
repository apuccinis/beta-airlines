/** Datos maestros del seed. */

export const CIUDADES = [
  { iata: 'ATL', ciudad: 'Atlanta', region: 'Georgia', pais: 'Estados Unidos', aeropuerto: 'Aeropuerto Internacional Hartsfield-Jackson' },
  { iata: 'JFK', ciudad: 'Nueva York', region: 'Nueva York', pais: 'Estados Unidos', aeropuerto: 'Aeropuerto Internacional John F. Kennedy' },
  { iata: 'LAX', ciudad: 'Los Ángeles', region: 'California', pais: 'Estados Unidos', aeropuerto: 'Aeropuerto Internacional de Los Ángeles' },
  { iata: 'ORD', ciudad: 'Chicago', region: 'Illinois', pais: 'Estados Unidos', aeropuerto: "Aeropuerto Internacional O'Hare" },
  { iata: 'MIA', ciudad: 'Miami', region: 'Florida', pais: 'Estados Unidos', aeropuerto: 'Aeropuerto Internacional de Miami' },
  { iata: 'SEA', ciudad: 'Seattle', region: 'Washington', pais: 'Estados Unidos', aeropuerto: 'Aeropuerto Internacional Seattle-Tacoma' },
  { iata: 'BOS', ciudad: 'Boston', region: 'Massachusetts', pais: 'Estados Unidos', aeropuerto: 'Aeropuerto Internacional Logan' },
  { iata: 'DFW', ciudad: 'Dallas', region: 'Texas', pais: 'Estados Unidos', aeropuerto: 'Aeropuerto Internacional Dallas/Fort Worth' },
  { iata: 'BOG', ciudad: 'Bogotá', region: 'Cundinamarca', pais: 'Colombia', aeropuerto: 'Aeropuerto Internacional El Dorado' },
  { iata: 'MEX', ciudad: 'Ciudad de México', region: 'Ciudad de México', pais: 'México', aeropuerto: 'Aeropuerto Internacional Benito Juárez' },
  { iata: 'LHR', ciudad: 'Londres', region: 'Inglaterra', pais: 'Reino Unido', aeropuerto: 'Aeropuerto de Heathrow' },
  { iata: 'MAD', ciudad: 'Madrid', region: 'Comunidad de Madrid', pais: 'España', aeropuerto: 'Aeropuerto Adolfo Suárez Madrid-Barajas' },
] as const;

/**
 * Pares de rutas (se crean en ambos sentidos): todas las combinaciones de las 12 ciudades.
 * `frecuencias` = salidas diarias por sentido en la programación vigente;
 * `mensual` = vuelos por mes y sentido en la historia del año.
 * Los 14 primeros son las rutas troncales; el resto, rutas con menos tráfico.
 */
export const PARES: { o: string; d: string; millas: number; frecuencias: number; mensual: number }[] = [
  { o: 'ATL', d: 'JFK', millas: 760, frecuencias: 2, mensual: 3 },
  { o: 'ATL', d: 'LAX', millas: 1946, frecuencias: 1, mensual: 3 },
  { o: 'ATL', d: 'ORD', millas: 606, frecuencias: 2, mensual: 3 },
  { o: 'ATL', d: 'MIA', millas: 594, frecuencias: 2, mensual: 3 },
  { o: 'ATL', d: 'SEA', millas: 2182, frecuencias: 1, mensual: 3 },
  { o: 'ATL', d: 'BOS', millas: 946, frecuencias: 1, mensual: 3 },
  { o: 'ATL', d: 'DFW', millas: 731, frecuencias: 1, mensual: 3 },
  { o: 'JFK', d: 'LAX', millas: 2475, frecuencias: 1, mensual: 3 },
  { o: 'ORD', d: 'SEA', millas: 1721, frecuencias: 1, mensual: 3 },
  { o: 'JFK', d: 'MIA', millas: 1089, frecuencias: 1, mensual: 3 },
  { o: 'ATL', d: 'BOG', millas: 2130, frecuencias: 1, mensual: 3 },
  { o: 'ATL', d: 'MEX', millas: 1332, frecuencias: 1, mensual: 3 },
  { o: 'JFK', d: 'LHR', millas: 3451, frecuencias: 1, mensual: 3 },
  { o: 'ATL', d: 'MAD', millas: 4381, frecuencias: 1, mensual: 3 },
  ...(
    [
      ['ATL', 'LHR', 4201], ['JFK', 'ORD', 738], ['JFK', 'SEA', 2415], ['JFK', 'BOS', 186], ['JFK', 'DFW', 1389],
      ['JFK', 'BOG', 2483], ['JFK', 'MEX', 2091], ['JFK', 'MAD', 3579], ['LAX', 'ORD', 1741], ['LAX', 'MIA', 2338],
      ['LAX', 'SEA', 955], ['LAX', 'BOS', 2605], ['LAX', 'DFW', 1232], ['LAX', 'BOG', 3480], ['LAX', 'MEX', 1553],
      ['LAX', 'LHR', 5443], ['LAX', 'MAD', 5832], ['ORD', 'MIA', 1199], ['ORD', 'BOS', 864], ['ORD', 'DFW', 802],
      ['ORD', 'BOG', 2711], ['ORD', 'MEX', 1689], ['ORD', 'LHR', 3942], ['ORD', 'MAD', 4191], ['MIA', 'SEA', 2721],
      ['MIA', 'BOS', 1260], ['MIA', 'DFW', 1120], ['MIA', 'BOG', 1513], ['MIA', 'MEX', 1275], ['MIA', 'LHR', 4417],
      ['MIA', 'MAD', 4415], ['SEA', 'BOS', 2489], ['SEA', 'DFW', 1658], ['SEA', 'BOG', 4100], ['SEA', 'MEX', 2335],
      ['SEA', 'LHR', 4786], ['SEA', 'MAD', 5295], ['BOS', 'DFW', 1559], ['BOS', 'BOG', 2610], ['BOS', 'MEX', 2277],
      ['BOS', 'LHR', 3256], ['BOS', 'MAD', 3401], ['DFW', 'BOG', 2444], ['DFW', 'MEX', 939], ['DFW', 'LHR', 4740],
      ['DFW', 'MAD', 4954], ['BOG', 'MEX', 1963], ['BOG', 'LHR', 5265], ['BOG', 'MAD', 4991], ['MEX', 'LHR', 5533],
      ['MEX', 'MAD', 5633], ['LHR', 'MAD', 772],
    ] as const
  ).map(([o, d, millas]) => ({ o, d, millas, frecuencias: 1, mensual: 1 })),
];

/** Días de programación a la venta, contando hoy. */
export const DIAS_PROGRAMACION = 90;

export const AERONAVES = [
  { matricula: 'N801BA', modelo: 'Boeing 737-800', capacidad: 160 },
  { matricula: 'N802BA', modelo: 'Boeing 737-800', capacidad: 160 },
  { matricula: 'N321BA', modelo: 'Airbus A321neo', capacidad: 196 },
  { matricula: 'N322BA', modelo: 'Airbus A321neo', capacidad: 196 },
  { matricula: 'N757BA', modelo: 'Boeing 757-200', capacidad: 199 },
  { matricula: 'N717BA', modelo: 'Boeing 717-200', capacidad: 110 },
  { matricula: 'N767BA', modelo: 'Boeing 767-300ER', capacidad: 211 },
  { matricula: 'N330BA', modelo: 'Airbus A330-300', capacidad: 293 },
];

export const DEPARTAMENTOS = [
  'Reservas', 'Pagos', 'Facturas', 'Despachos', 'Tripulación',
  'Embarque', 'Servicio al cliente', 'Mantenimiento', 'Operaciones', 'Marketing',
];

/** Empleados: cargo, departamento (1–10) y cantidad. Las cuentas fijas de acceso van aparte. */
export const PLANTA: { cargo: string; depto: number; n: number }[] = [
  { cargo: 'Capitán', depto: 5, n: 5 },
  { cargo: 'Primer oficial', depto: 5, n: 5 },
  { cargo: 'Auxiliar de vuelo', depto: 5, n: 8 },
  { cargo: 'Técnico de mantenimiento', depto: 8, n: 3 },
  { cargo: 'Despachador', depto: 4, n: 3 },
  { cargo: 'Agente de servicio al cliente', depto: 7, n: 2 },
  { cargo: 'Agente de embarque', depto: 6, n: 2 },
  { cargo: 'Agente de reservas', depto: 1, n: 1 },
  { cargo: 'Analista de pagos', depto: 2, n: 1 },
  { cargo: 'Analista de facturación', depto: 3, n: 1 },
];

export const CUENTAS = {
  pasajera: { documento: '1020457813', nombres: 'Laura', apellidos: 'Gómez', email: 'laura.gomez@gmail.com', telefono: '+1 404 555 0142', nacimiento: '1989-04-17' },
  coordinador: { documento: '80114527', nombres: 'Andrés', apellidos: 'Restrepo', cargo: 'Coordinador de operaciones', depto: 9 },
  agente: { documento: '52987341', nombres: 'Paula', apellidos: 'Méndez', cargo: 'Agente de servicio al cliente', depto: 7 },
  analista: { documento: '79635214', nombres: 'Camilo', apellidos: 'Duarte', cargo: 'Analista de datos', depto: 10 },
};

export const NOMBRES = [
  'Daniel', 'Emily', 'Carlos', 'Sofía', 'Michael', 'Valentina', 'James', 'Camila', 'David', 'Mariana',
  'Robert', 'Lucía', 'William', 'Isabella', 'Andrea', 'Olivia', 'Juan', 'Emma', 'Diego', 'Ava',
  'Santiago', 'Mia', 'Mateo', 'Grace', 'Felipe', 'Chloe', 'Tomás', 'Hannah', 'Nicolás', 'Ana',
  'Luis', 'Paola', 'Kevin', 'Sara', 'Brian', 'Natalia', 'Jorge', 'Rachel', 'Pablo', 'Julián',
  'Catalina', 'Ethan', 'Gabriela', 'Samuel', 'Abigail', 'Sebastián', 'Lily', 'Manuel',
];
export const APELLIDOS = [
  'Ortiz', 'Carter', 'Ramírez', 'Hernández', 'Johnson', 'Torres', 'Smith', 'Rojas', 'Miller', 'Castro',
  'Brown', 'Vargas', 'Davis', 'Moreno', 'Wilson', 'Jiménez', 'Taylor', 'Ruiz', 'Anderson', 'Silva',
  'Thomas', 'Mendoza', 'Moore', 'Reyes', 'Cárdenas', 'Clark', 'Salazar', 'Lewis', 'Navarro', 'Walker',
  'Pineda', 'Young', 'Quintero', 'Hall', 'Acosta', 'Allen', 'Herrera', 'Wright', 'Peña', 'Scott',
];

export const DOMINIOS_CORREO = ['gmail.com', 'outlook.com', 'yahoo.com', 'hotmail.com', 'icloud.com'];

/** Residencia de los clientes (código IATA de su ciudad) con su peso. */
export const RESIDENCIAS: [string, number][] = [
  ['ATL', 30], ['JFK', 15], ['LAX', 10], ['ORD', 8], ['MIA', 8], ['SEA', 5],
  ['BOS', 5], ['DFW', 5], ['BOG', 6], ['MEX', 4], ['LHR', 2], ['MAD', 2],
];

export const CANALES_RESERVA_PESO: [string, number][] = [
  ['Web', 38], ['App', 27], ['Agente de viajes', 15], ['Call center', 10], ['Mostrador', 10],
];
export const CANALES_CHECKIN_PESO: [string, number][] = [['Web', 35], ['App', 30], ['Kiosko', 20], ['Mostrador', 15]];
export const CLASES_PESO: [('Económica' | 'Premium' | 'Ejecutiva'), number][] = [
  ['Económica', 78], ['Premium', 15], ['Ejecutiva', 7],
];

export const TIPOS_EQUIPO = ['Escalera de abordaje', 'Tractor de remolque', 'Cinta de equipaje', 'Lector de pases en puerta'];

export const MANTENIMIENTOS: { tipo: string; descripcion: string; horas: [number, number] }[] = [
  { tipo: 'Inspección A', descripcion: 'Inspección general de fuselaje, trenes y sistemas hidráulicos', horas: [6, 10] },
  { tipo: 'Inspección B', descripcion: 'Revisión detallada de motores, frenos y sistemas eléctricos', horas: [18, 30] },
  { tipo: 'Cambio de neumáticos', descripcion: 'Reemplazo de neumáticos del tren principal por desgaste', horas: [3, 5] },
  { tipo: 'Revisión de motor', descripcion: 'Boroscopia y revisión de álabes del motor 2', horas: [8, 14] },
  { tipo: 'Inspección de cabina', descripcion: 'Revisión de sillas, mesas, luces de lectura y equipos de emergencia', horas: [2, 4] },
  { tipo: 'Calibración de instrumentos', descripcion: 'Calibración de altímetros y sistemas de navegación', horas: [4, 6] },
];

export const CASOS: Record<string, string[]> = {
  'Equipaje demorado': [
    'Mi maleta no salió en la banda al llegar a destino. Necesito saber dónde está y cuándo me la entregan.',
    'Llegó solo una de mis dos maletas. La que falta es negra, mediana y tiene una cinta roja en la manija.',
  ],
  'Cambio de vuelo': [
    'Necesito adelantar mi vuelo un día por un cambio en mi agenda de trabajo. ¿Qué opciones tengo?',
    'Quiero mover la fecha de mi viaje a la semana siguiente, en el mismo horario si es posible.',
  ],
  Reembolso: [
    'Cancelé mi reserva con más de 72 horas de anticipación y todavía no veo el reembolso en mi tarjeta.',
    'Me cobraron dos veces la misma reserva en la tarjeta de crédito. Solicito la devolución del cobro duplicado.',
  ],
  'Queja de servicio': [
    'El vuelo salió con más de una hora de retraso y en la sala de espera no nos dieron información.',
    'En el mostrador no me permitieron documentar una maleta que cumplía con el peso permitido.',
  ],
  'Solicitud de asistencia': [
    'Viajo con mi madre de 82 años y necesitamos silla de ruedas desde el mostrador hasta la puerta de embarque.',
    'Mi hijo de 12 años viaja solo y quiero solicitar el servicio de acompañamiento de menores.',
  ],
};
