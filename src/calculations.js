const areaFromDiameter = (D) => (Math.PI * D * D) / 4;
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const stdev = (a) => {
  if (a.length < 2) return 0;
  const m = avg(a);
  return Math.sqrt(avg(a.map((x) => (x - m) ** 2)));
};
const linreg = (xs, ys) => {
  const n = xs.length;
  if (n < 2) return { slope: 0, intercept: ys[0] ?? 0, r2: 0 };
  const mx = avg(xs);
  const my = avg(ys);
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = my - slope * mx;
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    const p = slope * xs[i] + intercept;
    ssRes += (ys[i] - p) ** 2;
    ssTot += (ys[i] - my) ** 2;
  }
  return { slope, intercept, r2: ssTot === 0 ? 1 : 1 - ssRes / ssTot };
};
const linregOrigin = (xs, ys) => {
  const n = xs.length;
  let sumXY = 0;
  let sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumXY += xs[i] * ys[i];
    sumXX += xs[i] * xs[i];
  }
  const slope = sumXX === 0 ? 0 : sumXY / sumXX;
  const my = avg(ys);
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    const p = slope * xs[i];
    ssRes += (ys[i] - p) ** 2;
    ssTot += (ys[i] - my) ** 2;
  }
  return { slope, r2: ssTot === 0 ? 1 : 1 - ssRes / ssTot };
};

export const calculationFunctions = {
  gasSteady: (s, rows) => {
    const A = areaFromDiameter(s.D);
    const pts = rows.map((r) => {
      const ka = 1000 * (2 * s.mu * s.L * r.P2 * r.Q) / (A * (r.P1 ** 2 - r.P2 ** 2));
      const Pm = (r.P1 + r.P2) / 2;
      return { ...r, A, ka, Pm, invPm: 1 / Pm };
    });
    const fit = linreg(pts.map((p) => p.invPm), pts.map((p) => p.ka));
    const kL = Math.max(0, fit.intercept);
    return {
      rows: pts,
      headline: { label: "Klinkenberg-corrected permeability (k∞)", value: kL, unit: "mD" },
      alt: { label: "Simple mean of apparent kₐ (uncorrected)", value: avg(pts.map((p) => p.ka)), unit: "mD" },
      fit, r2: fit.r2,
      chart: { type: "klinkenberg", data: pts, fit },
    };
  },
  gasSingle: (s, rows) => {
    const A = areaFromDiameter(s.D);
    const pts = rows.map((r, i) => {
      const ka = 1000 * (2 * s.mu * s.L * r.P2 * r.Q) / (A * (r.P1 ** 2 - r.P2 ** 2));
      return { ...r, A, ka, label: `Reading ${i + 1}` };
    });
    const mean = avg(pts.map((p) => p.ka));
    return {
      rows: pts,
      headline: { label: "Apparent gas permeability (mean)", value: mean, unit: "mD" },
      alt: pts.length > 1 ? { label: "Std. deviation across readings", value: stdev(pts.map((p) => p.ka)), unit: "mD" } : null,
      chart: { type: "bar", data: pts },
    };
  },
  pulseDecay: (s, rows) => {
    const A = areaFromDiameter(s.D);
    const pts = rows.map((r) => ({ ...r, lnDP: Math.log(r.dP) }));
    const fit = linreg(pts.map((p) => p.t), pts.map((p) => p.lnDP));
    const alpha = -fit.slope;
    const k = 1000 * alpha * s.mu * s.cf * s.L / (A * (1 / s.V1 + 1 / s.V2));
    return {
      rows: pts,
      headline: { label: "Pulse-decay permeability", value: k, unit: "mD" },
      alt: { label: "Decay constant α", value: alpha, unit: "1/s" },
      fit, r2: fit.r2,
      chart: { type: "decay", data: pts, fit },
    };
  },
  liquidCoreflood: (s, rows) => {
    const A = areaFromDiameter(s.D);
    const pts = rows.map((r) => ({ ...r, A, k: 1000 * r.Q * s.mu * s.L / (A * r.dP) }));
    const fitO = linregOrigin(pts.map((p) => p.dP), pts.map((p) => p.Q));
    const kFit = 1000 * fitO.slope * s.mu * s.L / A;
    const kMean = avg(pts.map((p) => p.k));
    return {
      rows: pts,
      headline: { label: "Best-fit permeability (origin regression)", value: kFit, unit: "mD" },
      alt: { label: "Simple mean of point permeabilities", value: kMean, unit: "mD" },
      fitOrigin: fitO, r2: fitO.r2,
      chart: { type: "coreflood", data: pts, fitOrigin: fitO, s },
    };
  },
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


// Johnson–Bossler–Naumann unsteady-state relative-permeability reduction.
calculationFunctions.relPermJBN = (s, rows) => {
      const withQi = rows.filter((r) => r.QiD > 0).sort((a, b) => a.QiD - b.QiD);
      const pts0 = withQi.map((r) => {
        const NpD = r.Np / s.Vp;
        const IR = s.dP0 / r.dP;
        return { ...r, NpD, IR, x: 1 / r.QiD, y: 1 / (r.QiD * IR) };
      });
      // Savitzky–Golay quadratic smoother, 5-point window (coefficients [-3,12,17,12,-3]/35).
      // JBN takes two numerical derivatives of the production and pressure data, so raw scatter is
      // strongly amplified — especially just after breakthrough. Smoothing the monotone series NpD
      // and y before differentiating is the standard remedy (Savitzky & Golay, 1964, Anal. Chem.
      // 36(8), 1627–1639); endpoints are left untouched. Set the window to 0 to disable.
      if (s.smooth >= 5 && pts0.length >= 5) {
        const sg = (arr) => {
          const out = arr.slice();
          for (let i = 2; i < arr.length - 2; i++) {
            out[i] = (-3 * arr[i - 2] + 12 * arr[i - 1] + 17 * arr[i] + 12 * arr[i + 1] - 3 * arr[i + 2]) / 35;
          }
          return out;
        };
        const sNpD = sg(pts0.map((p) => p.NpD));
        const sY = sg(pts0.map((p) => p.y));
        pts0.forEach((p, i) => { p.NpD = sNpD[i]; p.y = sY[i]; });
      }
      const n = pts0.length;
      const derived = pts0.map((p, i) => {
        const prev = pts0[Math.max(0, i - 1)];
        const next = pts0[Math.min(n - 1, i + 1)];
        const dNpD = next.NpD - prev.NpD;
        const dQiD = next.QiD - prev.QiD;
        const dx = next.x - prev.x;
        const dy = next.y - prev.y;
        const fo = dQiD !== 0 ? dNpD / dQiD : NaN;
        const slope = dy !== 0 ? dx / dy : NaN;
        const kro = fo * slope;
        const krw = (1 - fo) * slope;
        const Sw2 = s.Swi + p.NpD - p.QiD * fo;
        return { ...p, fo, slope, kro, krw, Sw2 };
      });
      const clean = derived
        .filter((p) => Number.isFinite(p.kro) && Number.isFinite(p.krw) && Number.isFinite(p.Sw2) && p.kro >= 0 && p.krw >= 0 && p.Sw2 >= 0 && p.Sw2 <= 1)
        .sort((a, b) => a.Sw2 - b.Sw2);

      let crossoverSw = NaN;
      for (let i = 0; i < clean.length - 1; i++) {
        const d1 = clean[i].kro - clean[i].krw;
        const d2 = clean[i + 1].kro - clean[i + 1].krw;
        if (d1 === 0) { crossoverSw = clean[i].Sw2; break; }
        if ((d1 > 0) !== (d2 > 0)) {
          const t = d1 / (d1 - d2);
          crossoverSw = clean[i].Sw2 + t * (clean[i + 1].Sw2 - clean[i].Sw2);
          break;
        }
      }
      const krwAtEnd = clean[clean.length - 1]?.krw;

      return {
        rows: clean,
        headline: { label: "Water saturation at kro = krw (crossover)", value: crossoverSw, unit: "fraction" },
        alt: { label: `${clean.length} of ${n} points physically valid; krw at Sw=${fmtForCentrifuge(clean[clean.length - 1]?.Sw2, 3)}`, value: krwAtEnd, unit: "fraction" },
        chart: { type: "relperm", data: clean.map((p) => ({ Sw: p.Sw2, kro: p.kro, krw: p.krw })) },
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


// Corey-type endpoint prediction, retaining the application convention: kro is normalized to Kro@Swi.
calculationFunctions.coreyPredict = (v, colors) => {
  const { Swi, Sor, KroSwi, KrwSor, lambdaKro, lambdaKrw, muo, muw } = v;
  const krwMaxRatioRaw = KrwSor / KroSwi;
  const krwClipped = krwMaxRatioRaw > 1;
  const krwMaxRatio = Math.min(1, krwMaxRatioRaw);
  const span = 1 - Swi - Sor;
  const n = 50;
  const table = [];
  for (let i = 0; i < n; i++) {
    const Se = i / (n - 1);
    const Sw = Swi + Se * span;
    const kro = Math.pow(1 - Se, lambdaKro);
    const krw = krwMaxRatio * Math.pow(Se, lambdaKrw);
    const lw = krw / muw, lo = kro / muo;
    const fw = lw + lo > 0 ? lw / (lw + lo) : 0;
    table.push({ Sw, Se, kro, krw, fw });
  }

  let crossoverSw = NaN, crossoverK = NaN;
  for (let i = 0; i < table.length - 1; i++) {
    const d1 = table[i].kro - table[i].krw, d2 = table[i + 1].kro - table[i + 1].krw;
    if (d1 === 0) { crossoverSw = table[i].Sw; crossoverK = table[i].kro; break; }
    if ((d1 > 0) !== (d2 > 0)) {
      const t = d1 / (d1 - d2);
      crossoverSw = table[i].Sw + t * (table[i + 1].Sw - table[i].Sw);
      crossoverK = table[i].kro + t * (table[i + 1].kro - table[i].kro);
      break;
    }
  }

  let best = { slope: -Infinity, idx: -1 };
  table.forEach((p, i) => { if (p.Sw > Swi) { const m = p.fw / (p.Sw - Swi); if (m > best.slope) best = { slope: m, idx: i }; } });
  const front = table[best.idx] || { Sw: Swi, fw: 0 };
  const swMax = 1 - Sor;
  const swAtFw1 = best.slope > 0 ? Swi + 1 / best.slope : swMax;
  const tangentEndSw = Math.min(swMax, swAtFw1);
  const tangent = [{ Sw: Swi, fw: 0 }, { Sw: tangentEndSw, fw: best.slope * (tangentEndSw - Swi) }];
  const swBreakthrough = Math.min(swMax, swAtFw1);

  // Craig's rule 1: krw at Sor, normalized to kro at Swi (Craig's own reference convention)
  const krwSorNorm = krwMaxRatioRaw;
  let score = 0;
  if (krwSorNorm < 0.3) score += krwSorNorm < 0.15 ? 2 : 1;
  else if (krwSorNorm > 0.5) score -= krwSorNorm > 0.75 ? 2 : 1;
  // Craig's rule 2: crossover saturation vs 50%
  if (Number.isFinite(crossoverSw)) {
    if (crossoverSw > 0.5) score += crossoverSw > 0.65 ? 2 : 1;
    else score -= crossoverSw < 0.35 ? 2 : 1;
  }
  // Craig's rule 3: connate water saturation (half weight — flagged less reliable in the literature)
  if (Swi > 0.20) score += 0.5;
  else if (Swi < 0.15) score -= 0.5;

  let label, color;
  if (score >= 4) { label = "Strongly water-wet"; color = colors.teal; }
  else if (score >= 2) { label = "Moderately water-wet"; color = colors.teal; }
  else if (score >= 0.5) { label = "Weakly water-wet"; color = colors.teal; }
  else if (score > -0.5) { label = "Neutral / mixed-wet signals"; color = colors.amber; }
  else if (score > -2) { label = "Weakly oil-wet"; color = colors.clay; }
  else if (score > -4) { label = "Moderately oil-wet"; color = colors.clay; }
  else { label = "Strongly oil-wet"; color = colors.clay; }

  return {
    table, crossoverSw, crossoverK, front, tangent, swBreakthrough,
    krwSorNorm, score, label, color, krwClipped,
    rule1: krwSorNorm < 0.3 ? "water-wet" : krwSorNorm > 0.5 ? "oil-wet" : "ambiguous",
    rule2: Number.isFinite(crossoverSw) ? (crossoverSw > 0.5 ? "water-wet" : "oil-wet") : "n/a",
    rule3: Swi > 0.20 ? "water-wet" : Swi < 0.15 ? "oil-wet" : "ambiguous",
  };
}


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
