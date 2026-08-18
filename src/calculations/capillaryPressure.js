// Centrifuge drainage reduction: Hassler–Brunner in the short-core limit and
// the existing regularized integral inversion for longer core geometries.
export const centrifugePc = (s, rows, fmtForCentrifuge) => {
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


// Washburn (1921) mercury-intrusion diameter: P [psia], sigma [dyne/cm], theta [degrees], result [um].
export const micpWashburnDiameter = (pressurePsia, sigmaDynePerCm, thetaDegrees) => {
  const psiToPa = 6894.757293168;
  const dynePerCmToNPerM = 1e-3;
  return ((-4 * sigmaDynePerCm * dynePerCmToNPerM * Math.cos((thetaDegrees * Math.PI) / 180)) / (pressurePsia * psiToPa)) * 1e6;
};


