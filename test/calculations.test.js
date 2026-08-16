import assert from "node:assert/strict";
import test from "node:test";
import { calculationFunctions } from "../src/calculations.js";

const closeTo = (actual, expected, tolerance = 1e-10) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${actual} to be within ${tolerance} of ${expected}`);
};
const unitAreaDiameter = Math.sqrt(4 / Math.PI);

test("gasSingle returns the analytic mean and production standard deviation", () => {
  const result = calculationFunctions.gasSingle(
    { L: 10, D: unitAreaDiameter, mu: 0.02 },
    [{ P1: 3, P2: 1, Q: 0.1 }, { P1: 3, P2: 1, Q: 0.2 }],
  );
  closeTo(result.headline.value, 7.5);
  closeTo(result.alt.value, 2.5);
  closeTo(result.rows[0].ka, 5);
  closeTo(result.rows[1].ka, 10);
});

test("gasSteady recovers a known Klinkenberg intercept and slope", () => {
  const sample = { L: 10, D: unitAreaDiameter, mu: 0.02 };
  const rows = [3, 5, 7].map((P1) => {
    const P2 = 1;
    const Pm = (P1 + P2) / 2;
    const ka = 10 + 20 / Pm;
    return { P1, P2, Q: ka * (P1 ** 2 - P2 ** 2) / 400 };
  });
  const result = calculationFunctions.gasSteady(sample, rows);
  closeTo(result.headline.value, 10);
  closeTo(result.fit.slope, 20);
  closeTo(result.r2, 1);
});

test("pulseDecay recovers an exponential decay constant and permeability", () => {
  const rows = [0, 10, 20, 30].map((t) => ({ t, dP: 10 * Math.exp(-0.1 * t) }));
  const result = calculationFunctions.pulseDecay(
    { L: 10, D: unitAreaDiameter, mu: 1, cf: 0.01, V1: 1, V2: 1 },
    rows,
  );
  closeTo(result.alt.value, 0.1);
  closeTo(result.headline.value, 5);
  closeTo(result.r2, 1);
});

test("liquidCoreflood recovers Darcy permeability from proportional flow", () => {
  const result = calculationFunctions.liquidCoreflood(
    { L: 10, D: unitAreaDiameter, mu: 1 },
    [{ dP: 1, Q: 0.002 }, { dP: 2, Q: 0.004 }, { dP: 3, Q: 0.006 }],
  );
  closeTo(result.headline.value, 20);
  closeTo(result.alt.value, 20);
  closeTo(result.r2, 1);
});


test("centrifugePc reproduces the Hassler–Brunner short-core pressure and inlet saturation", () => {
  // Hassler–Brunner first approximation: S1 = Sbar + Pc dSbar/dPc.
  // Source: Hassler & Brunner (1945), Trans. AIME 160, 114–123.
  // A linear synthetic Sbar(Pc) makes the finite-difference derivative exact.
  const sample = { drho: 1, r1: 90, r2: 100 };
  const pressureAt = (rpm) => {
    const omega = (2 * Math.PI * rpm) / 60;
    return 0.5 * 1000 * sample.drho * omega ** 2 * ((sample.r2 ** 2 - sample.r1 ** 2) * 1e-4) / 6894.757293168;
  };
  const rows = [1000, 2000, 3000, 4000].map((rpm) => {
    const pc = pressureAt(rpm);
    return { rpm, Sbar: 0.9 - 0.0002 * pc };
  });
  const result = calculationFunctions.centrifugePc(sample, rows);
  assert.match(result.headline.label, /Hassler-Brunner/);
  result.rows.forEach((row) => {
    closeTo(row.Pc, pressureAt(row.rpm), 1e-12);
    closeTo(row.S1, 0.9 - 0.0004 * row.Pc, 1e-12);
  });
});
