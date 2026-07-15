/**
 * Sectores administrativos que trabajan de lunes a viernes (no rotan fines
 * de semana como el resto de la planta): ni sábado ni domingo cuentan como
 * ausencia injustificada si no hay fichada. Es una regla de negocio fija,
 * no configurable desde la app.
 */
export const SECTORES_LUNES_A_VIERNES = [
  "Administración",
  "Calidad",
  "Compras y Pañol",
  "Finanzas",
  "RRHH",
  "Tesorería",
  "Ventas y Despacho",
];
