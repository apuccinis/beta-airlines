-- Consultas que responden los requerimientos del punto 4 sobre el data warehouse

-- 4a. Ingresos por venta de tiquetes, por mes del año y por ciudad (origen del vuelo)
SELECT t.Anio, t.Mes, t.NombreMes, c.Ciudad,
       SUM(f.ValorVenta)       AS Ingresos,
       SUM(f.CantidadTiquetes) AS TiquetesVendidos
FROM FactVentaTiquetes f
JOIN DimTiempo t ON t.IdTiempo   = f.IdTiempo
JOIN DimCiudad c ON c.IdCiudadDW = f.IdCiudadOrigen
GROUP BY t.Anio, t.Mes, t.NombreMes, c.Ciudad
ORDER BY t.Anio, t.Mes, Ingresos DESC;

-- 4b. Número de reservas hechas por los clientes, por mes del año y por ciudad (origen del vuelo)
SELECT t.Anio, t.Mes, t.NombreMes, c.Ciudad,
       SUM(f.CantidadReservas) AS Reservas,
       SUM(f.NumeroPasajeros)  AS Pasajeros
FROM FactReservas f
JOIN DimTiempo t ON t.IdTiempo   = f.IdTiempo
JOIN DimCiudad c ON c.IdCiudadDW = f.IdCiudadOrigen
GROUP BY t.Anio, t.Mes, t.NombreMes, c.Ciudad
ORDER BY t.Anio, t.Mes, Reservas DESC;

-- 4c. Millas acumuladas por pasajero en vuelos nacionales, por mes
SELECT t.Anio, t.Mes, t.NombreMes, cl.NombreCompleto,
       SUM(f.MillasAcumuladas) AS MillasNacionales,
       SUM(f.CantidadVuelos)   AS VuelosNacionales
FROM FactMillasPasajero f
JOIN DimTiempo  t  ON t.IdTiempo     = f.IdTiempo
JOIN DimCliente cl ON cl.IdClienteDW = f.IdClienteDW
JOIN DimRuta    r  ON r.IdRutaDW     = f.IdRutaDW
WHERE r.TipoRuta = 'Nacional'
GROUP BY t.Anio, t.Mes, t.NombreMes, cl.NombreCompleto
ORDER BY t.Anio, t.Mes, MillasNacionales DESC;
