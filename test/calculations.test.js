import assert from "node:assert/strict";
import test from "node:test";
import { calculationFunctions } from "../src/calculations/index.js";

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
    return { rpm, Sbar: 0.9 - 0.0001 * pc };
  });
  const result = calculationFunctions.centrifugePc(sample, rows);
  assert.match(result.headline.label, /Hassler-Brunner/);
  result.rows.forEach((row) => {
    closeTo(row.Pc, pressureAt(row.rpm), 1e-12);
    closeTo(row.S1, 0.9 - 0.0002 * row.Pc, 1e-12);
  });
});


test("relPermJBN recovers analytic fractional-flow derivatives and filters nonpositive injection", () => {
  // JBN convention: fo = dNpD/dQiD, kro = fo d(1/QiD)/d[1/(QiD IR)],
  // krw = (1-fo) d(1/QiD)/d[1/(QiD IR)].
  // Source: Johnson, Bossler & Naumann (1959), Trans. AIME 216, 370–372,
  // DOI 10.2118/1023-G. Here NpD = 0.6 QiD - 0.01 QiD² and IR = 0.8.
  const sample = { Vp: 10, dP0: 10, Swi: 0.2, smooth: 0 };
  const rows = [{ QiD: 0, Np: 0, dP: 10 }];
  for (let QiD = 1; QiD <= 5; QiD++) {
    const NpD = 0.6 * QiD - 0.01 * QiD ** 2;
    rows.push({ QiD, Np: NpD * sample.Vp, dP: sample.dP0 / 0.8 });
  }
  const result = calculationFunctions.relPermJBN(sample, rows);
  assert.equal(result.rows.length, 5);
  // Central differences are exact for this quadratic synthetic production curve.
  result.rows.slice(1, 4).forEach((row) => {
    const q = row.QiD;
    const fo = 0.6 - 0.02 * q;
    closeTo(row.fo, fo, 1e-12);
    closeTo(row.kro, 0.8 * fo, 1e-12);
    closeTo(row.krw, 0.8 * (1 - fo), 1e-12);
    closeTo(row.Sw2, sample.Swi + 0.01 * q ** 2, 1e-12);
  });
});


test("waxmanSmits preserves the conductivity-consistent Waxman–Smits formation factor", () => {
  // Waxman & Smits (1968), SPE-1863-A / SPE Journal 8(2), 107–122:
  // F* = Ro (Cw + B Qv).  This SI synthetic case uses Ro [ohm m],
  // Cw [S/m], Qv [eq/m^3], and B [S m^2/eq], so BQv is [S/m].
  const Cw = 10;
  const Qv = 5;
  const B = 0.2;
  const rows = [0.2, 0.25, 0.3].map((phi) => ({
    phi,
    Qv,
    Ro: phi ** -2 / (Cw + B * Qv),
  }));
  const result = calculationFunctions.waxmanSmits({ Rw: 0.1, B, Qv }, rows);
  assert.equal(result.rows.length, 3);
  result.rows.forEach((row) => assert.ok(Math.abs(row.Fstar - row.phi ** -2) < 1e-10));
  assert.ok(Math.abs(result.headline.value - 2) < 1e-10);
  assert.ok(Math.abs(result.alt.value - 1) < 1e-10);
});


test("micp Washburn inversion gives the documented 1 psia pore-throat diameter", () => {
  // Washburn (1921), Physical Review 17(3), 273–283, DOI: 10.1103/PhysRev.17.273.
  // The equation returns diameter; the MICP result layer reports radius as D / 2.
  const diameterUm = calculationFunctions.micpWashburnDiameter(1, 485, 130);
  closeTo(diameterUm, 180.863, 0.001);
  closeTo(diameterUm / 2, 90.432, 0.001);
});


test("NMR SDR and Timur-Coates retain their empirical power-law forms", () => {
  // Kenyon et al. (1988), SPE-15643-PA, establishes k = a phi^m T2LM^n.
  // Timur-Coates has the general form (phi/C)^p (FFI/BVI)^q; coefficients are empirical.
  closeTo(calculationFunctions.nmrSDR(0.25, 10, { a: 4, m: 4, n: 2 }), 1.5625);
  closeTo(calculationFunctions.nmrTimurCoates(0.2, 0.15, 0.05, { C: 0.1, p: 2, q: 2 }), 36);
});


test("coreyPredict recovers endpoint-normalized Corey curves on a synthetic round trip", () => {
  const result = calculationFunctions.coreyPredict(
    { Swi: 0.2, Sor: 0.2, KroSwi: 100, KrwSor: 40, lambdaKro: 2, lambdaKrw: 3, muo: 2, muw: 1 },
    { teal: "teal", amber: "amber", clay: "clay" },
  );
  assert.equal(result.table.length, 50);
  closeTo(result.table[0].Sw, 0.2); closeTo(result.table[0].kro, 1); closeTo(result.table[0].krw, 0);
  const last = result.table.at(-1);
  closeTo(last.Sw, 0.8); closeTo(last.kro, 0); closeTo(last.krw, 0.4);
  const middle = result.table[25];
  closeTo(middle.kro, (1 - middle.Se) ** 2); closeTo(middle.krw, 0.4 * middle.Se ** 3);
});


test("formationFactorFit recovers known Winsauer a and m and the Arps Celsius correction", () => {
  const a = 0.8, m = 2, RwAt20 = 0.1;
  const RwAt70 = RwAt20 * (20 + 21.5) / (70 + 21.5);
  const rows = [0.2, 0.25, 0.3, 0.35].map((phi) => ({ phi, Ro: RwAt70 * a * phi ** -m }));
  const result = calculationFunctions.formationFactorFit({ Rw: RwAt20, RwTemp: 20, testTemp: 70 }, rows);
  closeTo(result.headline.value, 2); closeTo(result.alt.value, 0.8); closeTo(result.r2, 1);
  closeTo(result.rows[0].F, a * rows[0].phi ** -m);
});


test("stressDependence recovers an empirical exponential stress trend", () => {
  const k0=100, c=0.001; const rows=[100,500,1000].map((sigma)=>({sigma,k:k0*Math.exp(-c*sigma)}));
  const result=calculationFunctions.stressDependence({sigmaRes:2000},rows);
  closeTo(result.headline.value,k0*Math.exp(-2)); closeTo(result.alt.value,c); closeTo(result.r2,1);
});


test("rockTyping reproduces Winland r35 and Amaefule RQI/FZI units", () => {
 const phi=.2,k=100; const r=calculationFunctions.rockTyping({},[{phi,k},{phi,k},{phi,k}]); const p=r.rows[0];
 closeTo(p.r35W,Math.pow(10,.732+.588*Math.log10(k)-.864*Math.log10(20)));
 closeTo(p.RQI,.0314*Math.sqrt(k/phi)); closeTo(p.FZI,p.RQI/(phi/(1-phi)));
});


test("porosity-permeability regressions recover deterministic power and exponential trends", () => {
 const power=calculationFunctions.fitPowerLaw([.1,.2,.3,.4].map(phi=>({phi,k:5*phi**2}))); closeTo(power.c0,5); closeTo(power.c1,2); closeTo(power.evalAt(.5),1.25);
 const exp=calculationFunctions.fitExponential([.1,.2,.3,.4].map(phi=>({phi,k:Math.exp(1+3*phi)}))); closeTo(exp.a,1); closeTo(exp.b,3); closeTo(exp.evalAt(.5),Math.exp(2.5));
});
