import { describe, it, expect } from "vitest";
import { reconciliarMarcaciones } from "./excelImport.js";
import { toUtcDateOnly } from "./dates.js";

function dia(y: number, m: number, d: number) {
  return toUtcDateOnly(y, m - 1, d);
}

describe("reconciliarMarcaciones", () => {
  it("turnos normales sin cruce de medianoche quedan igual", () => {
    const { turnos, avisos } = reconciliarMarcaciones([
      { fecha: dia(2026, 6, 1), raw: "E 08:07 - S 15:56" },
      { fecha: dia(2026, 6, 2), raw: "E 08:01 - S 16:07" },
    ]);
    expect(avisos).toEqual([]);
    expect(turnos).toEqual([
      { fecha: dia(2026, 6, 1), entradaStr: "08:07", salidaStr: "15:56", fechaSalida: dia(2026, 6, 1) },
      { fecha: dia(2026, 6, 2), entradaStr: "08:01", salidaStr: "16:07", fechaSalida: dia(2026, 6, 2) },
    ]);
  });

  it("turno 20 a 4 real (caso PC_002): cierra cruzando medianoche con el primer token del día siguiente", () => {
    const { turnos, avisos } = reconciliarMarcaciones([
      { fecha: dia(2026, 6, 1), raw: " E 19:40" },
      { fecha: dia(2026, 6, 2), raw: " E 03:40 - S 19:37" },
    ]);
    // el turno nocturno queda cerrado cruzando medianoche
    expect(turnos[0]).toEqual({ fecha: dia(2026, 6, 1), entradaStr: "19:40", salidaStr: "03:40", fechaSalida: dia(2026, 6, 2) });
    // lo que queda del día 2 (19:37) arranca un nuevo turno nocturno, sin día 3 en los datos para confirmarlo
    expect(turnos[1]).toEqual({ fecha: dia(2026, 6, 2), entradaStr: "19:37", salidaStr: null, fechaSalida: dia(2026, 6, 2) });
    expect(avisos).toHaveLength(1);
    expect(avisos[0].fecha).toEqual(dia(2026, 6, 2));
  });

  it("marcación realmente faltante (caso PC_002 real: 32hs de diferencia) NO se fuerza a cerrar", () => {
    const { turnos, avisos } = reconciliarMarcaciones([
      { fecha: dia(2026, 6, 7), raw: " E 03:33" },
      { fecha: dia(2026, 6, 8), raw: " E 11:40 - S 19:41" },
    ]);
    expect(avisos).toHaveLength(1);
    expect(avisos[0].fecha).toEqual(dia(2026, 6, 7));
    // el turno del día 7 queda abierto (marcación faltante)
    expect(turnos[0]).toEqual({ fecha: dia(2026, 6, 7), entradaStr: "03:33", salidaStr: null, fechaSalida: dia(2026, 6, 7) });
    // el día 8 se procesa normal, sin robarle el primer token
    expect(turnos[1]).toEqual({ fecha: dia(2026, 6, 8), entradaStr: "11:40", salidaStr: "19:41", fechaSalida: dia(2026, 6, 8) });
  });

  it("día sin marcaciones después de una entrada abierta: se avisa y queda abierta", () => {
    const { turnos, avisos } = reconciliarMarcaciones([
      { fecha: dia(2026, 6, 1), raw: "E 20:00" },
      { fecha: dia(2026, 6, 2), raw: "" },
    ]);
    expect(avisos).toHaveLength(1);
    expect(turnos).toEqual([{ fecha: dia(2026, 6, 1), entradaStr: "20:00", salidaStr: null, fechaSalida: dia(2026, 6, 1) }]);
  });

  it("entrada abierta al final de los datos importados se avisa", () => {
    const { turnos, avisos } = reconciliarMarcaciones([{ fecha: dia(2026, 6, 30), raw: "E 20:00" }]);
    expect(avisos).toHaveLength(1);
    expect(turnos).toEqual([{ fecha: dia(2026, 6, 30), entradaStr: "20:00", salidaStr: null, fechaSalida: dia(2026, 6, 30) }]);
  });

  it("corte de almuerzo se mantiene igual (varios pares en un mismo día)", () => {
    const { turnos } = reconciliarMarcaciones([{ fecha: dia(2026, 6, 1), raw: "E 08:00 - S 12:00  E 13:00 - S 17:00" }]);
    expect(turnos).toEqual([
      { fecha: dia(2026, 6, 1), entradaStr: "08:00", salidaStr: "12:00", fechaSalida: dia(2026, 6, 1) },
      { fecha: dia(2026, 6, 1), entradaStr: "13:00", salidaStr: "17:00", fechaSalida: dia(2026, 6, 1) },
    ]);
  });
});
