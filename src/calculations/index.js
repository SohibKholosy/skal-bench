import { avg, linreg } from "./math.js";
import { gasSteady, gasSingle, liquidCoreflood, pulseDecay } from "./permeability.js";
import { coreyPredict, relPermJBN, relPermSteady } from "./relativePermeability.js";

export const calculationFunctions = {
  gasSteady,
  gasSingle,
  pulseDecay,
  liquidCoreflood,
  relPermSteady: (s, rows) => relPermSteady(s, rows, fmtForCentrifuge),
  relPermJBN: (s, rows) => relPermJBN(s, rows, fmtForCentrifuge),
  coreyPredict,
};

// Centrifuge drainage reduction: Hassler–Brunner in the short-core limit and
// the existing regularized integral inversion for longer core geometries.
const fmtForCentrifuge = (n, d = 3) => (Number.isFinite(n) ? n.toFixed(d) : "—");
calculationFunctions.centrifugePc = (s, rows) => {
      const PSI = 6894.757293168;
      const base = rows.map((r) => {
        const omega = (2 * Math.PI * r.rpm) / 60;
        const PcPa = 0.5 * (1000 * s.drho) * omega * omega * ((s.r2 * s.r2 - s.r1 * s.r1) * 1e-4);
        return { ...r, Pc: PcPa / PSI };
      }).filter((x) => Number.isFinite(x.Pc) && x.Pc > 0).sort((a, b) => a.Pc - b.Pc);
      const n = base.length;
      // (a) Hassler-Brunner first approximation: S1 = d(S̄·Pc)/dPc = S̄ + Pc·dS̄/dPc. Exact only in
      //     the limit r1/r2 → 1 (a short plug far from the axis), where Pc is linear across the core.
      const hb = base.map((pt, i) => {
        const lo = base[Math.max(0, i - 1)], hi = base[Math.min(n - 1, i + 1)];
        const dPc = hi.Pc - lo.Pc;
        const dSdPc = dPc !== 0 ? (hi.Sbar - lo.Sbar) / dPc : 0;
        return Math.min(1, Math.max(0, pt.Sbar + pt.Pc * dSdPc));
      });
      // (b) Direct inversion of the centrifuge integral equation (Forbes 1994). Along the plug,
      //     Pc(r) = ½Δρω²(r2²−r²), so with u = Pc/Pc1 the measured average obeys
      //         S̄(Pc1) = ∫₀¹ S(u·Pc1)·g(u) du,   g(u) = ½(r1+r2)/√(r2² − u(r2²−r1²)),
      //     which collapses to the Hassler-Brunner form only when g ≡ 1 (i.e. r1/r2 → 1). Writing
      //     S(Pc) as piecewise linear on the measured pressure grid (S = 1 at Pc = 0) turns this into
      //     a linear system. Solving it by plain back-substitution is unstable on the coarse, widely
      //     spaced pressure grids real centrifuge runs produce (the recovered curve oscillates), so
      //     it is solved here as a regularized least-squares problem with a second-difference penalty
      //     and a monotonicity projection — S(Pc) must be non-increasing for drainage.
      const g = (u) => 0.5 * (s.r1 + s.r2) / Math.sqrt(s.r2 * s.r2 - u * (s.r2 * s.r2 - s.r1 * s.r1));
      const nodesP = [0, ...base.map((x) => x.Pc)];
      const QUAD = 600, LAMBDA = 0.05;
      const Cm = [];
      for (let i = 1; i <= n; i++) {
        const Pi = nodesP[i];
        const c = new Array(n + 1).fill(0);
        for (let q = 0; q < QUAD; q++) {
          const u = (q + 0.5) / QUAD, Pc = Pi * u, w = g(u) / QUAD;
          let k = 1;
          while (k < i && nodesP[k] < Pc) k++;
          const p0 = nodesP[k - 1], p1 = nodesP[k];
          const t = p1 > p0 ? (Pc - p0) / (p1 - p0) : 0;
          c[k - 1] += w * (1 - t);
          c[k] += w * t;
        }
        Cm.push(c);
      }
      const A = Cm.map((c) => c.slice(1));
      const bvec = base.map((x, i) => x.Sbar - Cm[i][0]);
      const N2 = Array.from({ length: n }, () => new Array(n).fill(0));
      const rhs = new Array(n).fill(0);
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) { let acc = 0; for (let k = 0; k < n; k++) acc += A[k][i] * A[k][j]; N2[i][j] = acc; }
        let acc2 = 0; for (let k = 0; k < n; k++) acc2 += A[k][i] * bvec[k]; rhs[i] = acc2;
      }
      for (let i = 1; i < n - 1; i++) {
        const idx = [i - 1, i, i + 1], co = [1, -2, 1];
        for (let a = 0; a < 3; a++) for (let b2 = 0; b2 < 3; b2++) N2[idx[a]][idx[b2]] += LAMBDA * co[a] * co[b2];
      }
      const Mx = N2.map((r, i) => [...r, rhs[i]]);
      for (let i = 0; i < n; i++) {
        let piv = i;
        for (let k = i + 1; k < n; k++) if (Math.abs(Mx[k][i]) > Math.abs(Mx[piv][i])) piv = k;
        const tmp = Mx[i]; Mx[i] = Mx[piv]; Mx[piv] = tmp;
        if (Math.abs(Mx[i][i]) < 1e-14) continue;
        for (let k = i + 1; k < n; k++) { const f = Mx[k][i] / Mx[i][i]; for (let j = i; j <= n; j++) Mx[k][j] -= f * Mx[i][j]; }
      }
      const Sx = new Array(n).fill(NaN);
      for (let i = n - 1; i >= 0; i--) {
        let acc = Mx[i][n];
        for (let j = i + 1; j < n; j++) acc -= Mx[i][j] * Sx[j];
        Sx[i] = Math.abs(Mx[i][i]) > 1e-14 ? acc / Mx[i][i] : (i < n - 1 ? Sx[i + 1] : 0);
      }
      for (let i = 1; i < n; i++) if (Sx[i] > Sx[i - 1]) Sx[i] = Sx[i - 1];
      const Sinv = Sx.map((v) => Math.min(1, Math.max(0, v)));
      // Which estimate to trust: Hassler-Brunner is exact as r1/r2 → 1 and degrades as the plug gets
      // long relative to its distance from the axis. Round-trip tests on synthetic Brooks-Corey
      // curves show HB within ~0.03 saturation units at r1/r2 ≈ 0.9 but in error by ~0.15–0.17 at
      // r1/r2 ≤ 0.625, where the direct inversion is an order of magnitude better. Below the
      // threshold the inversion leads; above it HB leads and the inversion's smoothing is the larger
      // source of error.
      const ratio = s.r2 > 0 ? s.r1 / s.r2 : NaN;
      const useHB = !(ratio < 0.85);
      const corr = base.map((pt, i) => ({ ...pt, S1hb: hb[i], S1inv: Sinv[i], S1: useHB ? hb[i] : Sinv[i] }));
      const Swi = corr.length ? Math.min(...corr.map((x) => x.S1)) : NaN;
      const other = corr.length ? Math.min(...corr.map((x) => (useHB ? x.S1inv : x.S1hb))) : NaN;
      const PcMax = corr.length ? Math.max(...corr.map((x) => x.Pc)) : NaN;
      const method = useHB ? "Hassler-Brunner" : "direct (Forbes) inversion";
      const otherName = useHB ? "direct inversion" : "Hassler-Brunner";
      const note = useHB
        ? `r1/r2 = ${fmtForCentrifuge(ratio, 2)} ≥ 0.85, so the Hassler-Brunner approximation is reliable here`
        : `r1/r2 = ${fmtForCentrifuge(ratio, 2)} < 0.85 — the plug is long relative to its radius, where Hassler-Brunner is known to break down, so the direct inversion is used`;
      return {
        rows: corr,
        headline: { label: `Irreducible saturation (inlet face, ${method})`, value: Swi, unit: "fraction" },
        alt: { label: `${note} · ${otherName} gives ${fmtForCentrifuge(other, 3)} · max Pc = ${fmtForCentrifuge(PcMax, 2)} psi · ${corr.length} speed steps`, value: PcMax, unit: "psi" },
        chart: { type: "xyfit", points: corr.map((x) => ({ x: x.S1, y: x.Pc })).sort((a, b) => a.x - b.x), connect: true, xLabel: "Inlet-face water saturation (fraction)", yLabel: "Capillary pressure (psi)" },
      };
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


// Washburn (1921) mercury-intrusion diameter: P [psia], sigma [dyne/cm], theta [degrees], result [um].
calculationFunctions.micpWashburnDiameter = (pressurePsia, sigmaDynePerCm, thetaDegrees) => {
  const psiToPa = 6894.757293168;
  const dynePerCmToNPerM = 1e-3;
  return ((-4 * sigmaDynePerCm * dynePerCmToNPerM * Math.cos((thetaDegrees * Math.PI) / 180)) / (pressurePsia * psiToPa)) * 1e6;
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
