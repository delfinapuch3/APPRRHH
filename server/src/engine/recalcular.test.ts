import { describe, it, expect } from "vitest";
import { intervalsParaDia } from "./recalcular.js";
import { toUtcDateOnly } from "../lib/dates.js";

function d(y: number, m: number, day: number, h: number, min = 0) {
  return new Date(y, m - 1, day, h, min, 0, 0);
}

describe("intervalsParaDia", () => {
  it("turno normal dentro del mismo día: se asigna entero a ese día", () => {
    const dia = toUtcDateOnly(2026, 5, 5); // 2026-06-05 (junio=5 idx)
    const fichadas = [{ fecha: dia, horaEntrada: d(2026, 6, 5, 8), horaSalida: d(2026, 6, 5, 16) }];
    const intervals = intervalsParaDia(dia, fichadas);
    expect(intervals).toEqual([{ start: d(2026, 6, 5, 8), end: d(2026, 6, 5, 16) }]);
  });

  it("turno 20 a 4: la parte antes de medianoche queda en el día que entró", () => {
    const dia = toUtcDateOnly(2026, 5, 1); // 2026-06-01
    const fichadas = [{ fecha: dia, horaEntrada: d(2026, 6, 1, 19, 40), horaSalida: d(2026, 6, 2, 3, 40) }];
    const intervals = intervalsParaDia(dia, fichadas);
    expect(intervals).toEqual([{ start: d(2026, 6, 1, 19, 40), end: d(2026, 6, 2, 0, 0) }]);
  });

  it("turno 20 a 4: la parte después de medianoche queda en el día siguiente", () => {
    const diaSiguiente = toUtcDateOnly(2026, 5, 2); // 2026-06-02
    const fichadaAnterior = { fecha: toUtcDateOnly(2026, 5, 1), horaEntrada: d(2026, 6, 1, 19, 40), horaSalida: d(2026, 6, 2, 3, 40) };
    const intervals = intervalsParaDia(diaSiguiente, [fichadaAnterior]);
    expect(intervals).toEqual([{ start: d(2026, 6, 2, 0, 0), end: d(2026, 6, 2, 3, 40) }]);
  });

  it("suma las horas totales correctamente entre ambos días (8h repartidas)", () => {
    const dia1 = toUtcDateOnly(2026, 5, 1);
    const dia2 = toUtcDateOnly(2026, 5, 2);
    const fichadas = [{ fecha: dia1, horaEntrada: d(2026, 6, 1, 19, 40), horaSalida: d(2026, 6, 2, 3, 40) }];
    const antesMedianoche = intervalsParaDia(dia1, fichadas)[0];
    const despuesMedianoche = intervalsParaDia(dia2, fichadas)[0];
    const horasDia1 = (antesMedianoche.end.getTime() - antesMedianoche.start.getTime()) / 3_600_000;
    const horasDia2 = (despuesMedianoche.end.getTime() - despuesMedianoche.start.getTime()) / 3_600_000;
    expect(horasDia1 + horasDia2).toBeCloseTo(8);
  });

  it("fichada abierta (sin salida) no aporta intervalo", () => {
    const dia = toUtcDateOnly(2026, 5, 1);
    const fichadas = [{ fecha: dia, horaEntrada: d(2026, 6, 1, 19, 40), horaSalida: null }];
    expect(intervalsParaDia(dia, fichadas)).toEqual([]);
  });
});
