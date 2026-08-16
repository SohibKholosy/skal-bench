import { avg, linreg } from "./math.js";
import { gasSteady, gasSingle, liquidCoreflood, pulseDecay } from "./permeability.js";
import { coreyPredict, relPermJBN, relPermSteady } from "./relativePermeability.js";
import { centrifugePc, micpWashburnDiameter } from "./capillaryPressure.js";
import { amottUsbm, CA_SETUPS, caSetup, contactAngle } from "./wettability.js";

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
};

// Waxman–Smits conductive-clay formation-factor implementation extracted from App.jsx for regression testing.
calculationFunctions.waxmanSmits = (s, rows) => {
      const Cw = s.Rw > 0 ? 1 / s.Rw : NaN;
      const pts = rows.map((r) => {
        const Fstar = r.Ro * (Cw + s.B * r.Qv);  // intrinsic, clay-corrected
        const Farchie = s.Rw > 0 ? r.Ro / s.Rw : NaN; // apparent, uncorrected
        return { ...r, Fstar, Farchie, lx: Math.log10(r.phi), ly: Math.log10(Fstar), lyA: Math.log10(Farchie) };
      }).filter((x) => Number.isFinite(x.lx) && Number.isFinite(x.ly));
      const fit = linreg(pts.map((x) => x.lx), pts.map((x) => x.ly));
      const mStar = -fit.slope;
      const aStar = Math.pow(10, fit.intercept);
      const fitA = linreg(pts.map((x) => x.lx), pts.map((x) => x.lyA));
      const mApp = -fitA.slope;
      return {
        rows: pts,
        headline: { label: "Clay-corrected cementation exponent m*", value: mStar, unit: "—" },
        alt: { label: `a* = ${fmtForCentrifuge(aStar, 3)} · uncorrected (clean-Archie) m would be ${fmtForCentrifuge(mApp, 3)}, biased low by clay conductivity · ${pts.length} plugs`, value: aStar, unit: "—" },
        r2: fit.r2,
        chart: { type: "xyfit", points: pts.map((x) => ({ x: x.lx, y: x.ly })), fit, xLabel: "log₁₀ porosity", yLabel: "log₁₀ F* (clay-corrected)" },
      };
    };


// Empirical NMR permeability correlations. Coefficients must be calibrated for the applicable formation and units.
calculationFunctions.nmrSDR = (phi, t2LogMean, coefficients) =>
  coefficients.a * Math.pow(phi, coefficients.m) * Math.pow(t2LogMean, coefficients.n);
calculationFunctions.nmrTimurCoates = (phi, ffi, bvi, coefficients) =>
  Math.pow(phi / coefficients.C, coefficients.p) * Math.pow(ffi / bvi, coefficients.q);


// Archie/Winsauer formation-factor fit; Arps correction expects Celsius temperatures.
calculationFunctions.formationFactorFit = (s, rows) => {
      // Arps (1953): Rw2 = Rw1·(T1 + 21.5)/(T2 + 21.5) with T in °C (the °F form uses 6.77).
      // Brine resistivity is strongly temperature-dependent, so Rw must be stated at the same
      // temperature as Ro before the formation factor is formed.
      const RwT = (Number.isFinite(s.RwTemp) && Number.isFinite(s.testTemp))
        ? s.Rw * (s.RwTemp + 21.5) / (s.testTemp + 21.5) : s.Rw;
      const pts = rows.map((r) => {
        const F = RwT > 0 ? r.Ro / RwT : NaN;
        return { ...r, F, lx: Math.log10(r.phi), ly: Math.log10(F) };
      }).filter((x) => Number.isFinite(x.lx) && Number.isFinite(x.ly));
      const fit = linreg(pts.map((x) => x.lx), pts.map((x) => x.ly));
      const m = -fit.slope;
      const a = Math.pow(10, fit.intercept);
      // Archie's original law fixes a = 1, i.e. the line is forced through (0,0) in log-log space.
      let sxy = 0, sxx = 0;
      for (const x of pts) { sxy += x.lx * x.ly; sxx += x.lx * x.lx; }
      const mArchie = sxx > 0 ? -(sxy / sxx) : NaN;
      const corrNote = Math.abs(RwT - s.Rw) > 1e-9 ? ` · Rw corrected ${fmtForCentrifuge(s.Rw, 4)}→${fmtForCentrifuge(RwT, 4)} Ω·m (Arps)` : "";
      return {
        rows: pts,
        headline: { label: "Cementation exponent m (free a)", value: m, unit: "—" },
        alt: { label: `a = ${fmtForCentrifuge(a, 3)} · Archie-constrained (a=1) m = ${fmtForCentrifuge(mArchie, 3)} · Humble a≈0.62, m≈2.15 · ${pts.length} plugs${corrNote}`, value: a, unit: "—" },
        r2: fit.r2,
        chart: { type: "xyfit", points: pts.map((x) => ({ x: x.lx, y: x.ly })), fit, xLabel: "log₁₀ porosity", yLabel: "log₁₀ formation factor" },
      };
    };


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
