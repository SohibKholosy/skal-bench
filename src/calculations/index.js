import { gasSteady, gasSingle, liquidCoreflood, pulseDecay } from "./permeability.js";
import { coreyPredict, relPermJBN, relPermSteady } from "./relativePermeability.js";
import { centrifugePc, micpWashburnDiameter } from "./capillaryPressure.js";
import { amottUsbm, CA_SETUPS, caSetup, contactAngle } from "./wettability.js";
import { formationFactorFit, resistivityIndexFit, waxmanSmits } from "./electrical.js";
import {
  NMR_LITHOLOGY_DEFAULTS,
  NMR_MIN_BVI_FRACTION,
  nmrComputeT2DistributionILT,
  nmrDownsampleEven,
  nmrDownsampleLog,
  nmrFitExpDec3,
  nmrParseDecayTable,
  detectGeoSpecMaranT2,
  parseGeoSpecMaranT2,
  parseSpreadsheetT2,
  prepareNmrSignal,
  nmrSDR,
  nmrT2Metrics,
  nmrTimurCoates,
} from "./nmr.js";
import { stressDependence } from "./stress.js";
import { fitExponential, fitPowerLaw, rockTyping } from "./correlations.js";

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
  nmrSDR,
  nmrTimurCoates,
  nmrFitExpDec3,
  nmrComputeT2DistributionILT,
  nmrParseDecayTable,
  nmrParseGeoSpecMaranT2: parseGeoSpecMaranT2,
  nmrParseSpreadsheetT2: parseSpreadsheetT2,
  nmrDetectGeoSpecMaranT2: detectGeoSpecMaranT2,
  nmrPrepareSignal: prepareNmrSignal,
  nmrDownsampleEven,
  nmrDownsampleLog,
  nmrT2Metrics,
  nmrLithologyDefaults: NMR_LITHOLOGY_DEFAULTS,
  nmrMinBviFraction: NMR_MIN_BVI_FRACTION,
  stressDependence: (s, rows) => stressDependence(s, rows, fmtForCentrifuge),
  rockTyping: (s, rows) => rockTyping(s, rows, fmtForCentrifuge),
  fitPowerLaw: (pts) => fitPowerLaw(pts, fmtForCentrifuge),
  fitExponential: (pts) => fitExponential(pts, fmtForCentrifuge),
};

