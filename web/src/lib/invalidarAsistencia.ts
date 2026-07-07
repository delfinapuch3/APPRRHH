import type { QueryClient } from "@tanstack/react-query";

const KEYS_ASISTENCIA_RELACIONADA = [
  "asistencia-resumen",
  "asistencia-dia",
  "asistencia-empleado",
  "faltas-sin-clasificar",
  "vacaciones-balance",
  "francos-list",
  "francos",
  "ausencias",
  "dashboard-resumen-hoy",
  "dashboard-top-ausencias",
  "dashboard-horas-sector",
  "dashboard-horas-extra-sector",
];

/**
 * Asistencia, el Dashboard y la ficha de cada empleado muestran números que
 * salen del mismo cálculo diario (DailyCalculation). Cuando algo lo puede
 * cambiar (cargar una ausencia, una vacación, corregir una fichada, validar
 * horas extra, tomar un franco) hay que invalidar todas estas pantallas
 * juntas para que se actualicen solas, sin depender de a qué pantalla se
 * entró primero.
 */
export function invalidarAsistenciaRelacionada(queryClient: QueryClient) {
  for (const key of KEYS_ASISTENCIA_RELACIONADA) {
    queryClient.invalidateQueries({ queryKey: [key] });
  }
}
