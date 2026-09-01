# Phase 5A — LF-NMR acquisition import and signal preparation

## Scope

Phase 5A implements only the first two LF-NMR layers:

1. **Acquisition:** import, identification, metadata preservation, calibration extraction, and integrity diagnostics.
2. **Signal preparation:** one traceable analysis signal for the existing ExpDec3 and ILT engines.

The existing ExpDec3 implementation and ILT kernel/grid/solver/regularization have not been changed. Rock interpretation, universal cutoffs, pore-size conversion, fluid typing, and petroleum-property correlations are deliberately deferred.

## Validated format

The primary supported machine format is the supplied GeoSpec/MARAN GITData T2 export. It is recognized only when all of these indicators are present:

- `[GITData]`
- `TestType=3`
- `[Parameters]`
- `[Data]`
- the tab-delimited `X Real Imaginary` header

A declared TestType other than 3 is rejected for T2 analysis. The parser does not identify a file from its `.txt` suffix alone.

The supplied private reference exports were used only to establish format behavior. They are not included in the repository. Their verified structural properties include GeoSpec/MARAN software version 8.5, TestType 3, tab-delimited X/Real/Imaginary data, calibration from `[Results].Calibration`, and variable lengths from 6,944 through 55,556 rows.

## Acquisition model

`parseGeoSpecMaranT2` returns a raw-acquisition object containing the filename, format, test type, software version, time unit, frozen raw X/Real/Imaginary arrays, point count, parsed calibration, metadata grouped by source section, machine-produced reference results, diagnostics, and warnings.

The raw arrays are copied and frozen at import. Signal preparation, plotting, downsampling, fitting, and inversion consume derived arrays. No operation overwrites an imported raw channel.

Known metadata sections are retained separately: root/GITData, Parameters, Additional Results, Results, Calibration, Scanner, Sample State, Non-Wetting Fluid, Wetting Fluid, Sample, and other dynamically detected sections. Machine results are preserved as reference metadata only; they do not tune ExpDec3 or ILT.

## Calibration

For recognized GeoSpec/MARAN T2 exports, only `[Results].Calibration` is the source of `calibrationConstant`. It is parsed at full JavaScript floating-point precision and retained verbatim in metadata. P90, P180, gain, signal, noise, and scanner parameters are never substituted.

The UI places a valid imported calibration constant into the existing calibration-constant input and marks its source as **imported**. A user edit marks it **manual**. Missing or malformed calibration clears the active value and exposes an unavailable/invalid warning, preventing a prior import's calibration from being silently reused.

## Diagnostics

For recognized machine exports:

- raw X is preserved in milliseconds; no raw time conversion is made;
- parsed row count is compared with Parameters.NumOfEchoes and Results.Dimensions;
- median ΔX is compared diagnostically with 2 × Tau;
- Xmax/T2Max is reported diagnostically relative to the approximately-five relationship seen in the supplied exports;
- finite values, increasing order, duplicate X values, minimum length, and positive spacing are checked.

Diagnostics never reconstruct, sort, truncate, pad, or otherwise modify the acquisition.

## Spreadsheet import

`.xls` and `.xlsx` input is supported only when a sheet has unambiguous Time/X, Real, and Imaginary headers. Ambiguous or incomplete sheets return an explicit import error. No spreadsheet machine format is inferred.

## Signal preparation

The UI offers exactly three choices:

- **Automatic phase-corrected** (default)
- **Imaginary**
- **Real**

Automatic mode uses one global phase: robust tail centres are removed for PCA orientation estimation, a 2×2 scatter matrix determines the principal direction, and every complex point is rotated by the single resulting angle. The prepared decay is the rotated real projection. Real and Imaginary modes copy only their selected raw channel and do not phase-correct or mix channels.

A deterministic early-versus-late robust-level check may apply one whole-vector sign inversion. Pointwise absolute values, magnitude `sqrt(Real² + Imaginary²)`, pointwise signs, and per-point phase rotations are not used.

The prepared-signal object stores mode, time, values, phase angle/algorithm, global-inversion state, noise estimate, range, signal-to-noise-like diagnostic, validity state, and warnings. Flat/noise-dominated selections are explicitly unsuitable rather than silently switched to another signal.

Changing acquisition or signal mode clears the displayed ExpDec3 and ILT results before recomputation.

## UI

The NMR screen now provides:

- import for `.txt`, `.xls`, and `.xlsx`;
- compact acquisition provenance and calibration source;
- signal-mode selection and preparation diagnostics;
- an unmodified raw Real/Imaginary graph;
- a separately identified prepared-analysis-signal/ExpDec3 graph.

## Tests

Phase 5A adds deterministic coverage for:

- GeoSpec/MARAN recognition, sections, variable lengths, exact X values, calibration precision, and Tau spacing;
- missing and malformed calibration;
- wrong TestType and duplicate X failure;
- spreadsheet header requirements;
- raw-array integrity across automatic, Real, and Imaginary preparation;
- synthetic known-phase recovery;
- global inversion, channel isolation, no pointwise absolute-value behavior, and flat-signal rejection.

The existing 18 Phase 1–4 regressions remain unchanged. The local calculation-layer validation ran **26 tests: 26 passed, 0 failed**.

## Limitations and Phase 5B/5C boundary

Signal preparation can affect subsequent relaxation estimates; it is preprocessing rather than rock interpretation. Real/Imaginary orientation depends on acquisition conditions. Multi-exponential fitting is non-unique, and ILT remains an ill-conditioned inverse problem. Machine T2LM/noise/porosity results remain reference metadata only; later SKAL Bench analysis must stay mathematically independent.

Phase 5B may address the ExpDec3 engine. Phase 5C may address ILT. Neither is implemented here.
