import { avg, linreg } from "./math.js";
import { gasSteady, gasSingle, liquidCoreflood, pulseDecay } from "./permeability.js";
import { coreyPredict, relPermJBN, relPermSteady } from "./relativePermeability.js";
import { centrifugePc, micpWashburnDiameter } from "./capillaryPressure.js";
import { amottUsbm, CA_SETUPS, caSetup, contactAngle } from "./wettability.js";
import { formationFactorFit, resistivityIndexFit, waxmanSmits } from "./electrical.js";

const fmtForCentrifuge = (n, d = 3) => (Number.isFinite(n) ? n.toFixed(d) : "—");

export const calculationFunctions = {
  gasSteady,
  gasSingle,
  pulseDecay,
  liquidCoreflood,
  relPermSteady: (s, rows) => relPermSteady(s, rows, fmtForCentrifuge),
  relPermJBN: (s, rows) => relPermJBN(s, rows, fmtForCentrifuge),
  coreyPredict,
  centrifugePc: (s, rows) => centrifugePc(s, rows, fmtForCentrifuge),
  micpWashburnDiameter,
  amottUsbm: (s, rows) => amottUsbm(s, rows, fmtForCentrifuge),
  contactAngle,
  contactAngleSetups: CA_SETUPS,
  contactAngleSetup: caSetup,
  formationFactorFit: (s, rows) => formationFactorFit(s, rows, fmtForCentrifuge),
  resistivityIndexFit: (s, rows) => resistivityIndexFit(s, rows, fmtForCentrifuge),
  waxmanSmits: (s, rows) => waxmanSmits(s, rows, fmtForCentrifuge),
};

// Empirical NMR permeability correlations. Coefficients must be calibrated for the applicable formation and units.
calculationFunctions.nmrSDR = (phi, t2LogMean, coefficients) =>
  coefficients.a * Math.pow(phi, coefficients.m) * Math.pow(t2LogMean, coefficients.n);
calculationFunctions.nmrTimurCoates = (phi, ffi, bvi, coefficients) =>
  Math.pow(phi / coefficients.C, coefficients.p) * Math.pow(ffi / bvi, coefficients.q);


// Empirical log-linear stress-sensitivity fit: c has inverse units of the supplied stress.
calculationFunctions.stressDependence = (s, rows) => {
      const pts = rows.map((r) => ({ ...r, lk: Math.log(r.k) }))
        .filter((x) => Number.isFinite(x.lk) && Number.isFinite(x.sigma))
        .sort((a, b) => a.sigma - b.sigma);
      const fit = linreg(pts.map((x) => x.sigma), pts.map((x) => x.lk));
      const c = -fit.slope;                 // 1/psi
      const k0 = Math.exp(fit.intercept);   // extrapolated to zero net stress
      const kRes = k0 * Math.exp(-c * s.sigmaRes);
      const kAmb = pts.length ? pts[0].k : NaN;
      const retained = Number.isFinite(kAmb) && kAmb > 0 ? (kRes / kAmb) * 100 : NaN;
      return {
        rows: pts,
        headline: { label: `Permeability at ${fmtForCentrifuge(s.sigmaRes, 0)} psi net stress`, value: kRes, unit: "mD" },
        alt: { label: `Stress sensitivity c = ${(c * 1000).toFixed(4)} per 1000 psi · k₀ (zero stress) = ${fmtForCentrifuge(k0, 2)} mD · retains ${fmtForCentrifuge(retained, 1)}% of the lowest-stress value · ${pts.length} steps`, value: c, unit: "1/psi" },
        r2: fit.r2,
        chart: { type: "xyfit", points: pts.map((x) => ({ x: x.sigma, y: x.lk })), fit, xLabel: "Net confining stress (psi)", yLabel: "ln k (mD)" },
      };
    };


// Winland r35 (base-10, k in mD, porosity in percent, r35 in um) and Amaefule RQI/FZI.
calculationFunctions.rockTyping = (s, rows) => {
      const cls = (r) => (r > 10 ? "megaport" : r > 2 ? "macroport" : r > 0.5 ? "mesoport" : r > 0.1 ? "microport" : "nanoport");
      const pts = rows.map((r, i) => {
        const phiPct = r.phi * 100;
        const r35W = Math.pow(10, 0.732 + 0.588 * Math.log10(r.k) - 0.864 * Math.log10(phiPct));
        const r35P = Math.pow(10, 0.255 + 0.565 * Math.log10(r.k) - 0.523 * Math.log10(phiPct));
        const RQI = 0.0314 * Math.sqrt(r.k / r.phi);
        const phiz = r.phi / (1 - r.phi);
        const FZI = phiz > 0 ? RQI / phiz : NaN;
        return { ...r, plug: i + 1, r35W, r35P, RQI, phiz, FZI, port: cls(r35W) };
      }).filter((x) => Number.isFinite(x.r35W) && Number.isFinite(x.FZI));
      const meanR35 = avg(pts.map((x) => x.r35W));
      const meanFZI = avg(pts.map((x) => x.FZI));
      // A single hydraulic flow unit plots as a straight line of unit slope on log RQI vs log phiz.
      const fit = linreg(pts.map((x) => Math.log10(x.phiz)), pts.map((x) => Math.log10(x.RQI)));
      const counts = {};
      pts.forEach((x) => { counts[x.port] = (counts[x.port] || 0) + 1; });
      const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
      return {
        rows: pts,
        headline: { label: "Mean Winland r35 pore-throat radius", value: meanR35, unit: "µm" },
        alt: { label: `Mean FZI = ${fmtForCentrifuge(meanFZI, 3)} µm · dominant port class: ${dominant ? dominant[0] : "—"} (${dominant ? dominant[1] : 0}/${pts.length}) · RQI–φz slope ${fmtForCentrifuge(fit.slope, 2)} (≈1 means a single flow unit; scatter means several)`, value: meanFZI, unit: "µm" },
        r2: fit.r2,
        chart: { type: "xyfit", points: pts.map((x) => ({ x: Math.log10(x.phiz), y: Math.log10(x.RQI) })), fit, xLabel: "log₁₀ φz  (normalised porosity)", yLabel: "log₁₀ RQI (µm)" },
      };
    };


// Dataset-specific porosity-permeability regressions; coefficients are not transferable outside the fitted data.
calculationFunctions.fitPowerLaw = (pts) => { const xs=pts.map(p=>Math.log(p.phi)), ys=pts.map(p=>Math.log(p.k)); const {slope,intercept,r2}=linreg(xs,ys); return {c1:slope,c0:Math.exp(intercept),r2,evalAt:(phi)=>Math.exp(intercept)*Math.pow(phi,slope),eq:`k = ${fmtForCentrifuge(Math.exp(intercept),3)} · phi^${fmtForCentrifuge(slope,3)}`}; };
calculationFunctions.fitExponential = (pts) => { const xs=pts.map(p=>p.phi), ys=pts.map(p=>Math.log(p.k)); const {slope,intercept,r2}=linreg(xs,ys); return {a:intercept,b:slope,r2,evalAt:(phi)=>Math.exp(intercept+slope*phi),eq:`k = exp(${fmtForCentrifuge(intercept,3)} + ${fmtForCentrifuge(slope,3)}·phi)`}; };
