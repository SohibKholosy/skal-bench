function downsampleEvenIndices(length, maxPoints) {
  if (length <= maxPoints) return Array.from({ length }, (_, index) => index);
  const step = length / maxPoints;
  return Array.from({ length: maxPoints }, (_, index) => Math.floor(index * step));
}

export function expDec3ModelValue(time, fit) {
  return fit.comps.reduce((value, component) => value + component.A * Math.exp(-time / component.T2), fit.y0);
}

export function prepareExpDec3PlotData(preparedSignal, fit, { maxMeasuredPoints = 400, fittedPointCount = 151 } = {}) {
  if (!preparedSignal || !Array.isArray(preparedSignal.time) || !Array.isArray(preparedSignal.values)) {
    throw new Error("Prepared LF-NMR signal is required for plot preparation.");
  }
  if (!fit || !Array.isArray(fit.comps) || !Number.isFinite(fit.y0)) {
    throw new Error("A valid ExpDec3 fit is required for plot preparation.");
  }
  if (preparedSignal.time.length !== preparedSignal.values.length || preparedSignal.time.length < 2) {
    throw new Error("Prepared LF-NMR time and signal arrays must have matching length of at least two.");
  }

  const indices = downsampleEvenIndices(preparedSignal.time.length, maxMeasuredPoints);
  let excludedMeasuredNonPositive = 0, excludedMeasuredNonFinite = 0;
  const measured = [];
  for (const index of indices) {
    const x = preparedSignal.time[index], y = preparedSignal.values[index];
    if (!Number.isFinite(x) || !Number.isFinite(y)) { excludedMeasuredNonFinite++; continue; }
    if (y <= 0) { excludedMeasuredNonPositive++; continue; }
    measured.push({ x, y });
  }

  const firstTime = preparedSignal.time[0], lastTime = preparedSignal.time.at(-1);
  let excludedFittedNonPositive = 0, excludedFittedNonFinite = 0;
  const fitted = [];
  for (let index = 0; index < fittedPointCount; index++) {
    const x = firstTime + ((lastTime - firstTime) * index) / (fittedPointCount - 1);
    const y = expDec3ModelValue(x, fit);
    if (!Number.isFinite(x) || !Number.isFinite(y)) { excludedFittedNonFinite++; continue; }
    if (y <= 0) { excludedFittedNonPositive++; continue; }
    fitted.push({ x, y });
  }

  return {
    measured,
    fitted,
    diagnostics: {
      measuredSampleCount: indices.length,
      displayedMeasuredCount: measured.length,
      excludedMeasuredNonPositive,
      excludedMeasuredNonFinite,
      displayedFittedCount: fitted.length,
      excludedFittedNonPositive,
      excludedFittedNonFinite,
      logDisplaySuitable: fitted.length > 0,
    },
  };
}
