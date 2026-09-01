import assert from "node:assert/strict";
import test from "node:test";
import { calculationFunctions } from "../src/calculations/index.js";

const fit = {
  comps: [{ A: 10, T2: 5 }, { A: 4, T2: 40 }, { A: 1, T2: 250 }],
  y0: 0.5,
};

const closeTo = (actual, expected, tolerance = 1e-12) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${actual} to be within ${tolerance} of ${expected}`);

const prepared = (length, valueAt) => ({
  time: Array.from({ length }, (_, index) => index * 0.108),
  values: Array.from({ length }, (_, index) => valueAt(index * 0.108, index)),
});

test("ExpDec3 plotting preserves a positive decay and independently reconstructs the model", () => {
  const signal = prepared(100, (time) => 15 * Math.exp(-time / 30) + 0.1);
  const before = JSON.stringify(signal);
  const result = calculationFunctions.nmrPrepareExpDec3PlotData(signal, fit);

  assert.ok(result.measured.length > 0);
  assert.ok(result.fitted.length > 0);
  result.measured.forEach(({ x, y }) => { assert.ok(Number.isFinite(x) && y > 0); });
  result.fitted.forEach(({ x, y }) => closeTo(y, fit.comps.reduce((sum, c) => sum + c.A * Math.exp(-x / c.T2), fit.y0)));
  assert.equal(JSON.stringify(signal), before);
});

test("non-positive late-time prepared values are omitted only from logarithmic display", () => {
  const signal = prepared(20, (_, index) => index < 12 ? 10 - index : -0.5 * index);
  const before = JSON.stringify(signal.values);
  const result = calculationFunctions.nmrPrepareExpDec3PlotData(signal, fit);

  assert.equal(JSON.stringify(signal.values), before);
  assert.ok(result.diagnostics.excludedMeasuredNonPositive > 0);
  assert.ok(result.measured.length > 0);
  assert.ok(result.measured.every((point) => point.y > 0));
  assert.ok(result.fitted.length > 0);
});

test("mixed positive, zero, and negative data retains every valid log-display observation", () => {
  const signal = { time: [0, 1, 2, 3, 4, 5], values: [4, 0, -2, 3, -1, 2] };
  const result = calculationFunctions.nmrPrepareExpDec3PlotData(signal, fit, { maxMeasuredPoints: 10 });

  assert.deepEqual(result.measured, [{ x: 0, y: 4 }, { x: 3, y: 3 }, { x: 5, y: 2 }]);
  assert.equal(result.diagnostics.excludedMeasuredNonPositive, 3);
  assert.ok(result.fitted.length > 0);
});

test("deterministic plot preparation handles representative short, medium, and long acquisitions", () => {
  for (const length of [6944, 23148, 55556]) {
    const signal = prepared(length, (time, index) => index > length * 0.9 ? -0.01 : 20 * Math.exp(-time / 100));
    const first = calculationFunctions.nmrPrepareExpDec3PlotData(signal, fit);
    const second = calculationFunctions.nmrPrepareExpDec3PlotData(signal, fit);
    assert.deepEqual(first, second);
    assert.ok(first.measured.length > 0);
    assert.ok(first.fitted.length > 0);
    assert.ok(first.measured.length <= 400);
    assert.equal(first.fitted.length, 151);
  }
});

test("fitted plotting series does not depend on measured display eligibility", () => {
  const signal = prepared(50, () => -1);
  const result = calculationFunctions.nmrPrepareExpDec3PlotData(signal, fit);

  assert.equal(result.measured.length, 0);
  assert.equal(result.diagnostics.excludedMeasuredNonPositive, 50);
  assert.ok(result.fitted.length > 0);
});
