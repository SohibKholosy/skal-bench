import assert from "node:assert/strict";
import test from "node:test";
import { calculationFunctions } from "../src/calculations/index.js";

const synth = (parameters, count = 240, noise = 0) => {
  const time = Array.from({ length: count }, (_, i) => .1 + i * 1.5);
  const values = time.map((t, i) => parameters.C + parameters.components.reduce((sum, c) => sum + c.A * Math.exp(-t / c.T2), 0) + noise * Math.sin(i * 1.7));
  return { time, values, mode: "automatic", phaseAngle: .2, globallyInverted: false, originalPointCount: count };
};

test("constrained ExpDec3 recovers a well-separated synthetic decay deterministically", () => {
  const input = synth({ components:[{A:8,T2:3},{A:15,T2:25},{A:40,T2:130}], C:.7 });
  const first = calculationFunctions.nmrFitExpDec3(input);
  const second = calculationFunctions.nmrFitExpDec3(input);
  assert.equal(first.status, "Converged");
  assert.deepEqual(first, second);
  assert.ok(first.comps[0].T2 < first.comps[1].T2 && first.comps[1].T2 < first.comps[2].T2);
  first.comps.forEach((component) => assert.ok(component.A >= 0));
  assert.ok(first.r2 > .999);
  assert.ok(Math.abs(first.comps[0].T2 - 3) < 1);
  assert.ok(Math.abs(first.comps[1].T2 - 25) < 5);
  assert.ok(Math.abs(first.comps[2].T2 - 130) < 20);
  assert.equal(first.diagnostics.startsAttempted, 8);
  assert.ok(first.diagnostics.validSolutions > 0);
});

test("ExpDec3 reports residual diagnostics and preserves prepared input", () => {
  const input = synth({ components:[{A:2,T2:5},{A:10,T2:30},{A:25,T2:100}], C:1 }, 180, .05);
  const before = JSON.stringify(input);
  const result = calculationFunctions.nmrFitExpDec3(input);
  assert.equal(JSON.stringify(input), before);
  assert.ok(Number.isFinite(result.diagnostics.sse));
  assert.ok(Number.isFinite(result.diagnostics.rmse));
  assert.ok(Number.isFinite(result.diagnostics.adjustedR2));
  assert.equal(result.diagnostics.residuals.length, input.time.length);
  assert.ok(["Stable across tested starts", "Potentially unstable across near-optimal starts"].includes(result.diagnostics.stability));
});

test("ExpDec3 rejects insufficient or invalid prepared signals", () => {
  assert.equal(calculationFunctions.nmrFitExpDec3({time:[1,2],values:[1,2]}).status, "Insufficient signal");
  assert.equal(calculationFunctions.nmrFitExpDec3({time:[1,2,1,4,5,6,7,8,9,10,11,12],values:new Array(12).fill(1)}).status, "Failed");
});
