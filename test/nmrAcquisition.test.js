import assert from "node:assert/strict";
import test from "node:test";
import { calculationFunctions } from "../src/calculations/index.js";

const fixture = (calibration = "6.333043617723386E-5") => [
  "[GITData]",
  "TestType=3",
  "Software Version=8.5",
  "",
  "[Parameters]",
  "Tau=0.05400000140070915",
  "T2Max=1.0",
  "NumOfEchoes=5",
  "",
  "[Additional Results]",
  "Total NMR Porosity=12.34",
  "",
  "[Results]",
  "Signal=100",
  "Noise=2",
  ...(calibration === null ? [] : [`Calibration=${calibration}`]),
  "AcqNSA=256",
  "Dimensions=5",
  "",
  "[Scanner]",
  "Scanner Type=GeoSpec2",
  "",
  "[Sample]",
  "address=",
  "",
  "[Data]",
  "X\tReal\tImaginary",
  "0.108\t-10\t20",
  "0.216\t-8\t16",
  "0.324\t-6\t12",
  "0.432\t-4\t8",
  "0.540\t-2\t4",
].join("\n");

test("GeoSpec/MARAN T2 parser preserves sections, values, variable rows, and calibration precision", () => {
  const result = calculationFunctions.nmrParseGeoSpecMaranT2(fixture(), { filename: "sanitized_t2.txt" });
  assert.equal(result.format, "geospec-maran-gitdata-t2");
  assert.equal(result.testType, 3);
  assert.equal(result.softwareVersion, "8.5");
  assert.equal(result.timeUnit, "ms");
  assert.equal(result.pointCount, 5);
  assert.deepEqual(result.rawTime, [0.108, 0.216, 0.324, 0.432, 0.54]);
  assert.equal(result.metadata.parameters.NumOfEchoes, "5");
  assert.equal(result.metadata.additionalResults["Total NMR Porosity"], "12.34");
  assert.equal(result.metadata.results.Calibration, "6.333043617723386E-5");
  assert.equal(result.calibrationConstant, 6.333043617723386e-5);
  assert.equal(result.instrumentReferenceResults.Noise, "2");
  assert.equal(result.diagnostics.numOfEchoes, 5);
  assert.equal(result.diagnostics.dimensions, 5);
  assert.ok(Math.abs(result.diagnostics.medianSpacing - 2 * 0.05400000140070915) < 1e-6);
});

test("acquisition calibration is authoritative, missing/invalid values are not invented", () => {
  const missing = calculationFunctions.nmrParseGeoSpecMaranT2(fixture(null));
  assert.equal(missing.calibrationConstant, null);
  assert.match(missing.warnings.map((warning) => warning.message).join(" "), /unavailable/i);
  const invalid = calculationFunctions.nmrParseGeoSpecMaranT2(fixture("NaN"));
  assert.equal(invalid.calibrationConstant, null);
  assert.match(invalid.warnings.map((warning) => warning.message).join(" "), /Invalid.*Calibration/i);
  const changed = calculationFunctions.nmrParseGeoSpecMaranT2(fixture("1.25E-4"));
  assert.equal(changed.calibrationConstant, 1.25e-4);
});

test("GeoSpec/MARAN parser rejects a non-T2 TestType and malformed time vector", () => {
  assert.throws(() => calculationFunctions.nmrParseGeoSpecMaranT2(fixture().replace("TestType=3", "TestType=7")), /TestType=7/);
  assert.throws(() => calculationFunctions.nmrParseGeoSpecMaranT2(fixture().replace("0.324\t-6", "0.216\t-6")), /Duplicate X/);
});

test("spreadsheet import requires identified Time/X, Real, and Imaginary columns", () => {
  const parsed = calculationFunctions.nmrParseSpreadsheetT2([
    ["metadata", ""], ["Time", "Real", "Imaginary"], [1, 2, 3], [2, 4, 6], [3, 6, 9],
  ]);
  assert.equal(parsed.format, "spreadsheet-t2-columns");
  assert.deepEqual(parsed.rawImaginary, [3, 6, 9]);
  assert.throws(() => calculationFunctions.nmrParseSpreadsheetT2([["Time", "Real"], [1, 2]]), /unambiguous/);
});

test("signal preparation preserves bitwise raw channels and reports global orientation", () => {
  const raw = calculationFunctions.nmrParseGeoSpecMaranT2(fixture());
  const before = { t: [...raw.rawTime], r: [...raw.rawReal], i: [...raw.rawImaginary] };
  const automatic = calculationFunctions.nmrPrepareSignal(raw, "automatic");
  const real = calculationFunctions.nmrPrepareSignal(raw, "real");
  const imaginary = calculationFunctions.nmrPrepareSignal(raw, "imaginary");
  assert.deepEqual(raw.rawTime, before.t); assert.deepEqual(raw.rawReal, before.r); assert.deepEqual(raw.rawImaginary, before.i);
  assert.equal(automatic.phaseAlgorithm, "tail-centred-pca-v1");
  assert.equal(real.phaseAngle, null); assert.equal(imaginary.phaseAngle, null);
  assert.equal(real.globallyInverted, true);
  assert.deepEqual(imaginary.values, [20, 16, 12, 8, 4]);
});

test("automatic phase correction recovers a known global decay orientation without magnitude processing", () => {
  const phase = 0.7;
  const raw = {
    filename: "synthetic", timeUnit: "ms", rawTime: [0, 1, 2, 3, 4, 5],
    rawReal: [], rawImaginary: [],
  };
  const decay = raw.rawTime.map((time) => 20 * Math.exp(-time / 2) + 1);
  raw.rawReal = decay.map((value) => value * Math.cos(phase));
  raw.rawImaginary = decay.map((value) => value * Math.sin(phase));
  const prepared = calculationFunctions.nmrPrepareSignal(raw, "automatic");
  assert.ok(Math.abs(Math.abs(prepared.phaseAngle) - phase) < 1e-10);
  prepared.values.forEach((value, index) => assert.ok(Math.abs(value - decay[index]) < 1e-9));
});

test("real and imaginary modes do not mix channels or use pointwise absolute value", () => {
  const raw = { filename: "synthetic", timeUnit: "ms", rawTime: [0, 1, 2, 3], rawReal: [1, -2, 3, -4], rawImaginary: [-10, -8, -6, -4] };
  const real = calculationFunctions.nmrPrepareSignal(raw, "real");
  const imaginary = calculationFunctions.nmrPrepareSignal(raw, "imaginary");
  assert.deepEqual(real.values, [1, -2, 3, -4]);
  assert.deepEqual(imaginary.values, [10, 8, 6, 4]);
});

test("noise-only signal is explicitly unsuitable", () => {
  const raw = { filename: "flat", timeUnit: "ms", rawTime: [0, 1, 2, 3, 4], rawReal: [1, 1, 1, 1, 1], rawImaginary: [0, 0, 0, 0, 0] };
  const prepared = calculationFunctions.nmrPrepareSignal(raw, "real");
  assert.equal(prepared.validity, "unsuitable");
  assert.match(prepared.warnings[0], /flat|noise/i);
});
