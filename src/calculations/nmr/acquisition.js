const SECTION_KEYS = {
  "Parameters": "parameters",
  "Additional Results": "additionalResults",
  "Results": "results",
  "Calibration": "calibration",
  "Scanner": "scanner",
  "Sample State": "sampleState",
  "Non-Wetting Fluid": "nonWettingFluid",
  "Wetting Fluid": "wettingFluid",
  "Sample": "sample",
};

const finiteNumber = (value) => {
  const trimmed = String(value ?? "").trim();
  if (!trimmed || !/^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i.test(trimmed)) return null;
  const number = Number(trimmed);
  return Number.isFinite(number) ? number : null;
};

const createMetadata = () => ({
  root: {}, parameters: {}, additionalResults: {}, results: {}, calibration: {},
  scanner: {}, sampleState: {}, nonWettingFluid: {}, wettingFluid: {}, sample: {},
  otherSections: {},
});

const metadataTarget = (metadata, section) => {
  if (!section) return metadata.root;
  const key = SECTION_KEYS[section];
  if (key) return metadata[key];
  if (!metadata.otherSections[section]) metadata.otherSections[section] = {};
  return metadata.otherSections[section];
};

const instrumentReferenceResults = (results) => Object.fromEntries(
  ["Total NMR Porosity", "T2 Log Mean", "T2 at 99%", "Signal", "Noise", "Calibration", "AcqNSA", "Dimensions"]
    .filter((key) => Object.hasOwn(results, key))
    .map((key) => [key, results[key]]),
);

const diagnostic = (warnings, level, message) => warnings.push({ level, message });

function validateTimeVector(time, warnings) {
  if (time.length < 3) throw new Error("Acquisition must contain at least three data rows.");
  for (let i = 0; i < time.length; i++) {
    if (!Number.isFinite(time[i])) throw new Error(`Non-finite X value at data row ${i + 1}.`);
    if (i > 0) {
      if (time[i] === time[i - 1]) throw new Error(`Duplicate X value at data row ${i + 1}.`);
      if (time[i] < time[i - 1]) throw new Error(`Decreasing X value at data row ${i + 1}; imported order was not changed.`);
    }
  }
  const spacings = time.slice(1).map((value, index) => value - time[index]);
  if (!spacings.some((spacing) => spacing > 0)) throw new Error("Acquisition has no meaningful positive X spacing.");
  return spacings;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function buildAcquisition({ filename = "acquisition.txt", format, testType, softwareVersion, metadata, time, real, imaginary, warnings = [] }) {
  const calibrationRaw = metadata.results.Calibration;
  const calibrationConstant = calibrationRaw === undefined ? null : finiteNumber(calibrationRaw);
  if (calibrationRaw === undefined) diagnostic(warnings, "warning", "Calibration unavailable in acquisition.");
  else if (calibrationConstant === null) diagnostic(warnings, "error", `Invalid [Results].Calibration value: ${calibrationRaw}`);

  const spacings = validateTimeVector(time, warnings);
  const parameterEchoes = finiteNumber(metadata.parameters.NumOfEchoes);
  const dimensions = finiteNumber(metadata.results.Dimensions);
  if (parameterEchoes !== null && parameterEchoes !== time.length) diagnostic(warnings, "warning", `NumOfEchoes is ${parameterEchoes}, but parsed data rows are ${time.length}.`);
  if (dimensions !== null && dimensions !== time.length) diagnostic(warnings, "warning", `Dimensions is ${dimensions}, but parsed data rows are ${time.length}.`);

  if (format === "geospec-maran-gitdata-t2") {
    const tau = finiteNumber(metadata.parameters.Tau);
    if (tau !== null) {
      const ratio = median(spacings) / (2 * tau);
      if (Math.abs(ratio - 1) > 0.05) diagnostic(warnings, "warning", `Median ΔX is ${median(spacings)} ms; expected approximately 2 × Tau (${2 * tau} ms).`);
    }
    const t2Max = finiteNumber(metadata.parameters.T2Max);
    if (t2Max !== null) {
      const ratio = time.at(-1) / t2Max;
      if (Math.abs(ratio - 5) > 0.1) diagnostic(warnings, "warning", `Xmax/T2Max is ${ratio}; approximately 5 is typical for the supplied machine exports.`);
    }
  }

  return {
    filename, format, testType, softwareVersion, timeUnit: format === "geospec-maran-gitdata-t2" ? "ms" : "acquisition X unit",
    rawTime: Object.freeze([...time]), rawReal: Object.freeze([...real]), rawImaginary: Object.freeze([...imaginary]),
    pointCount: time.length, calibrationConstant, metadata, instrumentReferenceResults: instrumentReferenceResults(metadata.results),
    diagnostics: { parsedRows: time.length, numOfEchoes: parameterEchoes, dimensions, medianSpacing: median(spacings) },
    warnings,
  };
}

export function detectGeoSpecMaranT2(text) {
  const indicators = {
    gitData: /^\s*\[GITData\]\s*$/mi.test(text),
    testType: /^\s*TestType\s*=\s*3\s*$/mi.test(text),
    parameters: /^\s*\[Parameters\]\s*$/mi.test(text),
    data: /^\s*\[Data\]\s*$/mi.test(text),
    columns: /^\s*X\tReal\tImaginary\s*$/mi.test(text),
  };
  return { recognized: Object.values(indicators).every(Boolean), indicators };
}

export function parseGeoSpecMaranT2(text, { filename = "acquisition.txt" } = {}) {
  const detected = detectGeoSpecMaranT2(text);
  const declaredTestType = text.match(/^\s*TestType\s*=\s*(.+?)\s*$/mi)?.[1]?.trim();
  if (declaredTestType && declaredTestType !== "3") throw new Error(`This GeoSpec/MARAN export has TestType=${declaredTestType}; only TestType=3 (T2 NMR) may be analyzed as a T2 acquisition.`);
  if (!detected.recognized) throw new Error("Not a recognized GeoSpec/MARAN GITData T2 export: required GITData, TestType=3, Parameters, Data, and X/Real/Imaginary indicators were not all found.");

  const metadata = createMetadata();
  let section = "";
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  let dataHeaderAt = -1;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trimEnd();
    if (!line.trim() || line.trimStart().startsWith(";")) continue;
    const sectionMatch = line.match(/^\s*\[(.+?)\]\s*$/);
    if (sectionMatch) { section = sectionMatch[1]; continue; }
    if (section === "Data" && /^\s*X\tReal\tImaginary\s*$/i.test(line)) { dataHeaderAt = index; break; }
    const equals = line.indexOf("=");
    if (equals >= 0) {
      const key = line.slice(0, equals).trim();
      const value = line.slice(equals + 1).trim();
      if (key) metadataTarget(metadata, section)[key] = value;
    }
  }
  if (dataHeaderAt < 0) throw new Error("Recognized machine file is missing the tab-delimited X/Real/Imaginary data header.");

  const time = [], real = [], imaginary = [];
  for (let index = dataHeaderAt + 1; index < lines.length; index++) {
    const raw = lines[index];
    if (!raw.trim() || raw.trimStart().startsWith(";")) continue;
    const columns = raw.split("\t");
    if (columns.length !== 3) throw new Error(`Invalid acquisition column count at file line ${index + 1}; expected X, Real, Imaginary tab-delimited columns.`);
    const values = columns.map(finiteNumber);
    if (values.some((value) => value === null)) throw new Error(`Non-numeric or non-finite acquisition value at file line ${index + 1}.`);
    time.push(values[0]); real.push(values[1]); imaginary.push(values[2]);
  }
  return buildAcquisition({ filename, format: "geospec-maran-gitdata-t2", testType: 3, softwareVersion: metadata.root["Software Version"] ?? null, metadata, time, real, imaginary });
}

export function parseSpreadsheetT2(aoa, { filename = "acquisition.xlsx" } = {}) {
  let headerRow = -1, mapping = null;
  for (let rowIndex = 0; rowIndex < aoa.length; rowIndex++) {
    const normalized = aoa[rowIndex].map((value) => String(value ?? "").trim().toLowerCase());
    const x = normalized.findIndex((value) => value === "x" || value === "time");
    const real = normalized.findIndex((value) => value === "real");
    const imaginary = normalized.findIndex((value) => value === "imaginary" || value === "imag");
    if (x >= 0 && real >= 0 && imaginary >= 0) { headerRow = rowIndex; mapping = { x, real, imaginary }; break; }
  }
  if (!mapping) throw new Error("Spreadsheet import requires unambiguous Time/X, Real, and Imaginary column headers.");
  const time = [], real = [], imaginary = [];
  for (let rowIndex = headerRow + 1; rowIndex < aoa.length; rowIndex++) {
    const row = aoa[rowIndex];
    if (row.every((value) => String(value ?? "").trim() === "")) continue;
    const values = [row[mapping.x], row[mapping.real], row[mapping.imaginary]].map(finiteNumber);
    if (values.some((value) => value === null)) throw new Error(`Non-numeric or non-finite spreadsheet acquisition value at row ${rowIndex + 1}.`);
    time.push(values[0]); real.push(values[1]); imaginary.push(values[2]);
  }
  return buildAcquisition({ filename, format: "spreadsheet-t2-columns", testType: null, softwareVersion: null, metadata: createMetadata(), time, real, imaginary });
}
