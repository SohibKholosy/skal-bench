const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const robustTailCenter = (values) => {
  const tailStart = Math.max(0, Math.floor(values.length * 0.8));
  return median(values.slice(tailStart));
};

const robustScale = (values) => {
  const centre = median(values);
  const mad = median(values.map((value) => Math.abs(value - centre)));
  return 1.4826 * mad;
};

function orientGlobally(values) {
  const early = median(values.slice(0, Math.max(1, Math.ceil(values.length * 0.1))));
  const late = median(values.slice(Math.max(0, Math.floor(values.length * 0.8))));
  const globallyInverted = early - late < 0;
  const oriented = globallyInverted ? values.map((value) => -value) : [...values];
  return { values: oriented, globallyInverted, earlyLevel: early, lateLevel: late };
}

function automaticPhase(real, imaginary) {
  const realTail = robustTailCenter(real);
  const imaginaryTail = robustTailCenter(imaginary);
  let xx = 0, xy = 0, yy = 0;
  for (let index = 0; index < real.length; index++) {
    const x = real[index] - realTail, y = imaginary[index] - imaginaryTail;
    xx += x * x; xy += x * y; yy += y * y;
  }
  const angle = 0.5 * Math.atan2(2 * xy, xx - yy);
  const cos = Math.cos(angle), sin = Math.sin(angle);
  // Real component of S·exp(-iφ): Re·cosφ + Im·sinφ.
  return { values: real.map((value, index) => value * cos + imaginary[index] * sin), phaseAngle: angle };
}

export function prepareNmrSignal(rawAcquisition, mode = "automatic") {
  if (!rawAcquisition || !Array.isArray(rawAcquisition.rawTime)) throw new Error("A raw LF-NMR acquisition is required.");
  const { rawTime, rawReal, rawImaginary } = rawAcquisition;
  if (rawReal.length !== rawTime.length || rawImaginary.length !== rawTime.length) throw new Error("Raw acquisition channels do not have matching lengths.");

  let selected, phaseAngle = null, phaseAlgorithm = null;
  if (mode === "automatic") {
    const result = automaticPhase(rawReal, rawImaginary);
    selected = result.values; phaseAngle = result.phaseAngle; phaseAlgorithm = "tail-centred-pca-v1";
  } else if (mode === "imaginary") {
    selected = [...rawImaginary];
  } else if (mode === "real") {
    selected = [...rawReal];
  } else {
    throw new Error(`Unknown LF-NMR analysis signal mode: ${mode}.`);
  }

  const orientation = orientGlobally(selected);
  const noiseEstimate = robustScale(orientation.values.slice(Math.max(0, Math.floor(orientation.values.length * 0.8))));
  const decayRange = Math.max(...orientation.values) - Math.min(...orientation.values);
  const snrLikeDiagnostic = noiseEstimate > 0 ? decayRange / noiseEstimate : Infinity;
  const warnings = [];
  const validity = Number.isFinite(decayRange) && decayRange > Math.max(1e-12, 5 * noiseEstimate) ? "valid" : "unsuitable";
  if (validity !== "valid") warnings.push("Selected signal is nearly flat or noise-dominated; analysis results should not be calculated.");

  return {
    sourceFilename: rawAcquisition.filename, mode, time: [...rawTime], values: orientation.values,
    timeUnit: rawAcquisition.timeUnit, phaseAngle, phaseAlgorithm, globallyInverted: orientation.globallyInverted,
    pointCount: rawTime.length, noiseEstimate, decayRange, snrLikeDiagnostic, validity, warnings,
    diagnostics: { earlyLevel: orientation.earlyLevel, lateLevel: orientation.lateLevel },
  };
}
