const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

export const expDec3Evaluate = (time, components, baseline) =>
  components.reduce((sum, component) => sum + component.A * Math.exp(-time / component.T2), baseline);

const tausFromQ = (q, minimum, maximum) => {
  const t1 = clamp(Math.exp(q[0]), minimum, maximum);
  const t2 = clamp(t1 + Math.exp(q[1]), t1 * (1 + 1e-8), maximum);
  const t3 = clamp(t2 + Math.exp(q[2]), t2 * (1 + 1e-8), maximum);
  return [t1, t2, t3];
};

function solveAmplitudes(time, signal, taus) {
  // Deterministic coordinate-descent NNLS for A1..A3; C is an unconstrained fitted baseline.
  const columns = taus.map((tau) => time.map((t) => Math.exp(-t / tau)));
  const amplitudes = [0, 0, 0];
  let baseline = median(signal.slice(Math.floor(signal.length * 0.8)));
  for (let iteration = 0; iteration < 80; iteration++) {
    for (let component = 0; component < 3; component++) {
      let numerator = 0, denominator = 0;
      for (let i = 0; i < time.length; i++) {
        let other = baseline;
        for (let j = 0; j < 3; j++) if (j !== component) other += amplitudes[j] * columns[j][i];
        numerator += columns[component][i] * (signal[i] - other);
        denominator += columns[component][i] ** 2;
      }
      amplitudes[component] = Math.max(0, denominator ? numerator / denominator : 0);
    }
    baseline = signal.reduce((sum, value, i) =>
      sum + value - amplitudes.reduce((pred, amplitude, j) => pred + amplitude * columns[j][i], 0), 0) / signal.length;
  }
  const residuals = signal.map((value, i) => value - (baseline + amplitudes.reduce((sum, amplitude, j) => sum + amplitude * columns[j][i], 0)));
  return { amplitudes, baseline, residuals, sse: residuals.reduce((sum, value) => sum + value ** 2, 0) };
}

function nelderMead(cost, start, iterations = 220) {
  let simplex = [start, ...start.map((value, index) => start.map((other, j) => other + (j === index ? 0.8 : 0)))];
  let values = simplex.map(cost);
  for (let iteration = 0; iteration < iterations; iteration++) {
    const order = [0, 1, 2, 3].sort((a, b) => values[a] - values[b]);
    simplex = order.map((index) => simplex[index]); values = order.map((index) => values[index]);
    const centroid = [0, 1, 2].map((_, dimension) => (simplex[0][dimension] + simplex[1][dimension] + simplex[2][dimension]) / 3);
    const reflect = centroid.map((value, dimension) => 2 * value - simplex[3][dimension]);
    const reflected = cost(reflect);
    if (reflected < values[0]) {
      const expanded = centroid.map((value, dimension) => value + 2 * (reflect[dimension] - value));
      const expandedValue = cost(expanded);
      simplex[3] = expandedValue < reflected ? expanded : reflect; values[3] = Math.min(expandedValue, reflected);
    } else if (reflected < values[2]) { simplex[3] = reflect; values[3] = reflected; }
    else {
      const contracted = centroid.map((value, dimension) => value + .5 * (simplex[3][dimension] - value));
      const contractedValue = cost(contracted);
      if (contractedValue < values[3]) { simplex[3] = contracted; values[3] = contractedValue; }
      else for (let i = 1; i < 4; i++) { simplex[i] = simplex[0].map((value, d) => value + .5 * (simplex[i][d] - value)); values[i] = cost(simplex[i]); }
    }
  }
  const best = values.indexOf(Math.min(...values));
  return simplex[best];
}

function refineLeastSquares(cost, start) {
  // Deterministic damped pattern refinement of the same ordinary least-squares objective.
  let q = [...start], best = cost(q), step = .25;
  for (let iteration = 0; iteration < 80 && step > 1e-5; iteration++) {
    let improved = false;
    for (let dimension = 0; dimension < 3; dimension++) for (const direction of [-1, 1]) {
      const candidate = [...q]; candidate[dimension] += direction * step;
      const value = cost(candidate);
      if (value < best) { q = candidate; best = value; improved = true; }
    }
    if (!improved) step *= .5;
  }
  return q;
}

const lag1Correlation = (residuals) => {
  if (residuals.length < 3) return null;
  const a = residuals.slice(0, -1), b = residuals.slice(1);
  const ma = a.reduce((sum, value) => sum + value, 0) / a.length;
  const mb = b.reduce((sum, value) => sum + value, 0) / b.length;
  let numerator = 0, da = 0, db = 0;
  for (let i = 0; i < a.length; i++) { numerator += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
  return da && db ? numerator / Math.sqrt(da * db) : null;
};

export function fitExpDec3(preparedSignal) {
  const time = preparedSignal?.time, signal = preparedSignal?.values;
  if (!Array.isArray(time) || !Array.isArray(signal) || time.length !== signal.length || time.length < 12) {
    return { status: "Insufficient signal", comps: [], y0: NaN, diagnostics: { reason: "At least 12 matching prepared points are required." } };
  }
  if (!time.every(Number.isFinite) || !signal.every(Number.isFinite) || time.some((value, i) => i && value <= time[i - 1])) {
    return { status: "Failed", comps: [], y0: NaN, diagnostics: { reason: "Prepared signal contains non-finite or non-increasing values." } };
  }
  const extent = time.at(-1) - time[0], positive = time.filter((value) => value > 0);
  if (!(extent > 0) || !positive.length) return { status: "Insufficient signal", comps: [], y0: NaN, diagnostics: { reason: "Prepared time extent is insufficient." } };
  const minimum = Math.max(positive[0] * .25, 1e-6), maximum = Math.max(minimum * 8, extent * 2);
  const fractions = [[.003,.03,.25],[.008,.08,.55],[.015,.16,.75],[.03,.28,.9],[.005,.12,.65],[.02,.1,.45],[.01,.05,.35],[.04,.35,.85]];
  const starts = fractions.map(([a,b,c]) => [Math.log(Math.max(minimum,a*extent)), Math.log(Math.max(minimum,b*extent-a*extent)), Math.log(Math.max(minimum,c*extent-b*extent))]);
  const evaluate = (q) => { const taus = tausFromQ(q, minimum, maximum); return { taus, ...solveAmplitudes(time, signal, taus) }; };
  const candidates = starts.map((start) => { const explored = nelderMead((q) => evaluate(q).sse, start); const refined = refineLeastSquares((q) => evaluate(q).sse, explored); return { q: refined, ...evaluate(refined) }; })
    .filter((candidate) => candidate.amplitudes.every(Number.isFinite) && candidate.taus[0] < candidate.taus[1] && candidate.taus[1] < candidate.taus[2]);
  if (!candidates.length) return { status: "No valid constrained solution", comps: [], y0: NaN, diagnostics: { startsAttempted: starts.length, validSolutions: 0 } };
  candidates.sort((a, b) => a.sse - b.sse);
  const best = candidates[0], tolerance = best.sse * 1.005 + 1e-12;
  const near = candidates.filter((candidate) => candidate.sse <= tolerance);
  const spread = (index) => { const values = near.map((candidate) => candidate.taus[index]); return { min: Math.min(...values), max: Math.max(...values), relativeSpread: (Math.max(...values) - Math.min(...values)) / Math.max(best.taus[index], 1e-12) }; };
  const t2Spreads = [0,1,2].map(spread);
  const baselineSpread = near.length > 1 ? (Math.max(...near.map(c=>c.baseline)) - Math.min(...near.map(c=>c.baseline))) / Math.max(Math.abs(best.baseline), 1e-12) : 0;
  const unstable = t2Spreads.some((item) => item.relativeSpread > .25) || baselineSpread > .5;
  const n=time.length, mean=signal.reduce((sum,value)=>sum+value,0)/n, sst=signal.reduce((sum,value)=>sum+(value-mean)**2,0);
  const r2=sst ? 1-best.sse/sst : 1, adjustedR2=n>7 ? 1-(1-r2)*(n-1)/(n-7-1) : null;
  const comps=best.taus.map((T2,index)=>({T2,A:best.amplitudes[index]}));
  return { comps, y0:best.baseline, r2, status: unstable ? "Converged with stability warning" : "Converged", diagnostics: {
    modelVersion:"expdec3-constrained-v1", optimizer:"deterministic-nelder-mead-plus-pattern-ls-v1", startsAttempted:starts.length, validSolutions:candidates.length, nearOptimalSolutions:near.length,
    originalPointCount:preparedSignal.originalPointCount ?? n, preparedPointCount:n, fittedPointCount:n, sse:best.sse, rmse:Math.sqrt(best.sse/n), adjustedR2, residuals:best.residuals, residualLag1:lag1Correlation(best.residuals),
    t2Spreads, baselineSpread, stability:unstable ? "Potentially unstable across near-optimal starts" : "Stable across tested starts", selectedSignalMode:preparedSignal.mode ?? null, phaseAngle:preparedSignal.phaseAngle ?? null, globallyInverted:preparedSignal.globallyInverted ?? null,
    dataReduction: preparedSignal.dataReduction ?? null,
  }};
}
