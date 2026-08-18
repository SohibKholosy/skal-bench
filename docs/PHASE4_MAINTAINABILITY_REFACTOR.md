# Phase 4 — Maintainability Refactor

## Scope and guardrails

Phase 4 is a behavior-preserving architecture refactor on `phase4/maintainability-refactor`, created from the Phase 3-merged `main` branch. No scientific formula, constant, unit conversion, default, algorithm, threshold, or calculated output is intentionally changed.

## Baseline

- `src/App.jsx`: 9,347 lines (718,507 characters).
- `src/calculations.js`: 472 lines.
- Regression suite: 14 tests.
- Existing shared calculation functions: gas/permeability baseline functions plus centrifuge, JBN, Waxman–Smits, MICP Washburn, NMR SDR/Timur–Coates, Corey, formation factor, stress dependence, Winland/FZI, and porosity–permeability regression helpers.
- Local build verification is environment-limited when Vite dependencies are unavailable; GitHub Actions remains the clean `npm ci` / `npm test` / `npm run build` verification environment.

## Original architecture

`App.jsx` contains application UI, React state, presentation helpers, calculator configuration, and some in-file scientific implementations. `calculations.js` was introduced in prior phases as a shared test/UI source for selected calculations.

## Target architecture

The existing shared calculation implementation will be moved into domain modules under `src/calculations/`. Both `App.jsx` and regression tests will import from the same `src/calculations/index.js` entrypoint. The legacy monolithic file will become a compatibility-free re-export only if it remains necessary during an incremental transition; it must not retain duplicate implementations.

## Incremental extraction register

| Group | Production source before | Planned target | Regression protection | Status |
|---|---|---|---|---|
| Shared calculation entrypoint (initial move) | calculations.js | calculations/index.js | all 14 tests | Complete — implementation moved intact; legacy file re-exports |
| Relative permeability | calculations.js | calculations/relativePermeability.js | JBN, Corey | Pending |
| Capillary pressure | calculations.js | calculations/capillaryPressure.js | centrifuge, MICP | Pending |
| Electrical | calculations.js | calculations/electrical.js | Waxman–Smits, formation factor | Pending |
| NMR | calculations.js | calculations/nmr.js | SDR, Timur–Coates | Pending |
| Correlations | calculations.js | calculations/correlations.js | stress, Winland, phi–k fits | Pending |

## Deferred scientific matters

The Phase 3 `REVIEW REQUIRED` items remain deferred. A possible scientific discrepancy discovered during this refactor will be documented, not corrected, in this branch.

## Completed increment: shared entrypoint

- Created `src/calculations/index.js` containing the prior `calculations.js` implementation unchanged.
- Changed `src/calculations.js` to a single re-export for temporary compatibility; it contains no scientific calculation implementation.
- Updated `App.jsx` and the regression suite to import `src/calculations/index.js` directly.
- Behavior-preservation check: 14/14 regression tests passed after this move.
- No scientific issues were discovered or addressed in this increment.

## Completed increment: shared math helpers and permeability

- Created `src/calculations/math.js` and moved the unchanged helper bodies for `areaFromDiameter`, `avg`, `stdev`, `linreg`, and `linregOrigin`.
- Created `src/calculations/permeability.js` and moved the unchanged implementations of `gasSteady`, `gasSingle`, `pulseDecay`, and `liquidCoreflood`.
- `src/calculations/index.js` now imports and exposes those four permeability functions through the existing `calculationFunctions` entrypoint.
- The remaining unextracted functions in `index.js` use `avg` and `linreg`; explicit imports from `math.js` preserve that dependency without duplicating helper logic.
- Behavior-preservation check: 14/14 regression tests passed after the extraction. No scientific or user-visible output changed.
- The production dependency direction is one-way: `index.js → math.js`, `index.js → permeability.js`, and `permeability.js → math.js`; no circular import was introduced.
- Current `src/calculations/index.js`: 365 lines. The remaining technical debt is the still-unextracted domain functions in that file; they will be moved only as separately tested increments.

## Completed increment: relative permeability

- Created `src/calculations/relativePermeability.js`.
- Moved the unchanged production logic for steady-state oil/water relative permeability, `relPermJBN`, and `coreyPredict`.
- The steady-state calculator was previously an inline `App.jsx` configuration closure. Its configuration now calls `calculationFunctions.relPermSteady`; JBN and Corey continue through the same entrypoint.
- Shared dependency: `relPermSteady` imports `areaFromDiameter` from `math.js`. The entrypoint supplies the pre-existing fixed-decimal formatter to steady-state and JBN so their displayed labels retain their prior values.
- Duplicate-logic review: the steady-state Darcy calculation occurs once in `relativePermeability.js`; obsolete JBN and Corey definitions were removed from `index.js`.
- Dependency review: `relativePermeability.js → math.js`; `index.js → relativePermeability.js`. Neither module imports the entrypoint, so no circular import or new domain coupling was introduced.
- Behavior-preservation check: 14/14 regression tests passed after extraction. No scientific calculation, calculated output, or user-visible behavior changed.
- Current `src/calculations/index.js`: 235 lines. Remaining technical debt is limited to the unextracted non-relative-permeability domains retained there for later, separately tested increments.

## Completed increment: capillary pressure / MICP / centrifuge

- Created `src/calculations/capillaryPressure.js`.
- Moved the complete `centrifugePc` reduction, including the Hassler–Brunner branch and the existing regularized direct-inversion, monotonicity projection, selection threshold, and all local numerical logic.
- Moved `micpWashburnDiameter`, retaining its existing pressure conversion, surface-tension conversion, contact-angle convention, and diameter result.
- No capillary helper moved separately: all numerical helpers used by centrifuge remain local to its function. The pre-existing `fmtForCentrifuge` helper remains in `index.js` because electrical, stress, rock-typing, and correlation functions also use it; the entrypoint passes it to centrifuge solely to retain the existing labels.
- Duplicate-logic review: one production definition each of `centrifugePc` and `micpWashburnDiameter`, both in `capillaryPressure.js`; no residual assignments remain in `index.js` or `App.jsx`.
- Dependency review: `index.js → capillaryPressure.js`; the capillary module has no imports and no access to UI state. No circular import or hidden UI dependency was introduced.
- Syntax review: no duplicate-comma patterns were found in the edited production files.
- Behavior-preservation check: 14/14 regression tests passed after extraction. No scientific calculation, calculated output, or user-visible behavior changed.
- Current `src/calculations/index.js`: 132 lines. Remaining technical debt is limited to the unextracted electrical, NMR, stress, rock-typing, and correlation domains retained there for later independently tested increments.

## Completed increment: wettability

- Created `src/calculations/wettability.js`.
- Moved the unchanged Amott/Amott–Harvey and USBM reducer as `amottUsbm`, retaining ratios, optional-area treatment, classification bands, labels, and output structure.
- Moved contact-angle numerical interpretation: the seven wettability bands, fluid setup mapping, geometric angle calculation, supplementary-angle conversion, surface classification, and line-intersection helper.
- The React screen retains its image state, point selection, event handlers, and canvas rendering. It now invokes `calculationFunctions.contactAngle(points, mode)` for the numerical result and obtains setup metadata through the shared entrypoint.
- Shared dependency: `amottUsbm` imports `avg` from `math.js`; the entrypoint supplies the existing fixed-decimal formatter for unchanged Amott/USBM result text. Contact-angle logic has no math or UI import.
- Duplicate-logic review: one production definition each of the Amott/USBM reducer, contact-angle reducer, angle helper, and line-intersection helper, all in `wettability.js`.
- Dependency review: `index.js → wettability.js → math.js`; no module imports `index.js`, and no circular import or UI-state dependency was introduced.
- Syntax review: no duplicate-comma patterns were found in the edited production files.
- Behavior-preservation check: 14/14 regression tests passed after extraction. No scientific calculation, calculated output, or user-visible behavior changed.
- Current `src/calculations/index.js`: 137 lines. Remaining technical debt is limited to unextracted electrical, NMR, stress, rock-typing, and correlation domains. The existing 14-test suite has no dedicated Amott/USBM or contact-angle regression case; adding coverage belongs to a future testing scope, not this behavior-preserving extraction.

## Completed increment: wettability regression coverage

- Added two deterministic regression tests in `test/calculations.test.js`, both importing `calculationFunctions` from the shared production entrypoint.
- Amott/USBM coverage verifies the synthetic Amott displacement ratios, Amott–Harvey index, USBM `log₁₀(A1/A2)` value, result selection, and the existing water-wet output label.
- Contact-angle coverage uses a 60° analytic tangent geometry and verifies the current water-drop and oil-drop phase mapping, including the supplementary water-angle result and existing classification/surface labels.
- No production calculation, scientific output, threshold, convention, default, or user-visible behavior changed. The Phase 3 contact-angle classification review status is unchanged.
- Behavior-preservation check: all prior 14 tests remain passing; total regression suite is now 16/16. No duplicate-comma patterns were found in the edited test or wettability files.

## Completed increment: electrical properties

- Created `src/calculations/electrical.js`.
- Moved the unchanged `formationFactorFit`, `resistivityIndexFit`, and `waxmanSmits` reducers. The resistivity-index fit was previously an inline `App.jsx` calculator closure and now calls the shared entrypoint.
- Shared dependency: the electrical module imports `linreg` from `math.js`. The entrypoint supplies the existing fixed-decimal formatter to retain all result labels, including Arps-correction and unconstrained-fit text.
- Direct regression coverage: the pre-existing formation-factor test verifies Winsauer fitting and the Arps Celsius correction; the pre-existing Waxman–Smits test verifies the current conductivity form; a new deterministic `IR = Sw⁻²` case verifies resistivity-index calculation, the constrained saturation exponent, free fit, and origin-forced fit object.
- Duplicate-logic review: one production definition each of `formationFactorFit`, `resistivityIndexFit`, and `waxmanSmits`, all in `electrical.js`. The three `App.jsx` modules call the shared calculation entrypoint.
- Dependency review: `index.js → electrical.js → math.js`; no circular import or UI-state dependency was introduced.
- Syntax review: no duplicate-comma patterns were found in the edited production and test files.
- Behavior-preservation check: 17/17 regression tests passed. No scientific calculation, calculated output, user-visible behavior, or Phase 3 Waxman–Smits review status changed.
- Current `src/calculations/index.js`: 89 lines. Remaining technical debt is limited to the unextracted NMR, stress, rock-typing, and porosity–permeability correlation domains; standalone Quick Calculator UI formulas remain intentionally outside this table-driven reducer extraction.

## Completed increment: NMR

- Created `src/calculations/nmr.js`.
- Moved the unchanged SDR and Timur–Coates functions; tri-exponential fitting, ILT inversion, NMR input parsing, downsampling, lithology defaults, and the BVI stability floor also now reside in this NMR-only module.
- Extracted the shared deterministic cutoff reduction as `nmrT2Metrics`. Both the component-fit and ILT paths call it with their existing cutoffs, retaining inclusive `T2 ≤ cutoff` classification, T2 log-mean behavior, output fields, and the existing zero-total distinction between the two paths.
- The React screen retains file I/O, state, calibration interaction, report generation, and rendering. It invokes all moved NMR calculations and preset data through the shared calculation entrypoint.
- Shared dependency: none; `nmr.js` is self-contained. No math helper is needed.
- Direct regression coverage: the existing test verifies SDR and Timur–Coates forms. A new deterministic synthetic-amplitude case verifies current inclusive CBW/BVI cutoff handling, FFI, BVI fraction, and the T2 log mean. It does not endorse any lithology preset or cutoff as universal.
- Duplicate-logic review: one production definition each of SDR, Timur–Coates, ExpDec3 fitting, ILT inversion, and cutoff metrics, all in `nmr.js`.
- Dependency review: `index.js → nmr.js`; `nmr.js` imports neither the entrypoint nor UI code, so no circular import or UI-state dependency was introduced.
- Syntax review: no duplicate-comma patterns were found in the edited production and test files.
- Behavior-preservation check: 18/18 regression tests passed. No scientific calculation, calculated output, user-visible behavior, NMR coefficient, cutoff, default, unit, or Phase 3 NMR review status changed.
- Current `src/calculations/index.js`: 104 lines. Remaining technical debt is limited to the unextracted stress, rock-typing, and porosity–permeability correlation domains; standalone Quick Calculator UI formulas remain intentionally outside this table-driven reducer extraction.

## Completed increment: stress-dependent permeability

- Created `src/calculations/stress.js`.
- Moved the unchanged `stressDependence` empirical log-linear fit, including stress sorting, `ln(k)` regression, fitted sensitivity, zero-stress extrapolation, reservoir-stress prediction, retained-permeability calculation, units, labels, and output structure.
- Shared dependency: `linreg` from `math.js`. The entrypoint supplies the existing fixed-decimal formatter for unchanged result labels.
- Direct regression coverage already existed: the deterministic exponential-trend test verifies the fitted stress sensitivity, predicted permeability at a specified reservoir stress, and fit quality. No additional test was needed.
- Duplicate-logic review: one production definition of `stressDependence`, in `stress.js`. `App.jsx` continues to call `calculationFunctions.stressDependence`.
- Dependency review: `index.js → stress.js → math.js`; no circular import or UI-state dependency was introduced.
- Syntax review: no duplicate-comma patterns were found in the edited production and test files.
- Behavior-preservation check: 18/18 regression tests passed. No scientific calculation, calculated output, user-visible behavior, model form, parameter, unit, default, extrapolation behavior, or empirical assumption changed.
- Current `src/calculations/index.js`: 85 lines. Remaining technical debt is limited to the unextracted rock-typing and porosity–permeability correlation domains; standalone Quick Calculator UI formulas remain intentionally outside this table-driven reducer extraction.
