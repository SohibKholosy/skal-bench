# Phase 5A.1 — ExpDec3 plotting fix

## Root cause

The prepared LF-NMR signal is intentionally allowed to contain non-positive late-time observations. The NMR chart used a logarithmic Y axis but passed the complete prepared display series to Recharts. For acquisitions such as MG-512D-178, those values prevented the measured series from rendering and could leave the chart visually blank despite a valid numerical ExpDec3 result.

## Fix

`prepareExpDec3PlotData` is a display-only layer. It:

- deterministically downsamples the prepared signal;
- retains finite, strictly positive observations for the logarithmic measured display;
- counts but never transforms non-positive/non-finite display exclusions;
- evaluates the fitted ExpDec3 curve directly from the fit components and baseline on the acquisition time extent;
- filters fitted display values independently when they cannot be displayed on a log axis.

No absolute value, magnitude, clamping, signal-preparation, ExpDec3, ILT, calibration, or rock-interpretation behavior was changed. The UI reports omitted non-positive observations. No automatic linear-scale fallback was added: a usable fitted curve and positive measured observations remain on the clearly labelled logarithmic display.

## Private-file verification

The private files were not committed. With the automatic prepared signal:

| File | Displayed measured points | Omitted non-positive points | Fitted points |
|---|---:|---:|---:|
| MG-512D-37A_T2.txt | 400 | 0 | 151 |
| MG-512D-178_T2.txt | 384 | 16 | 151 |
| BG-1594D-63_T2.txt | 400 | 0 | 151 |

The fitted curve uses the same first/last acquisition time as the prepared signal.

## Regression coverage

Tests cover positive decays, mixed positive/zero/negative data, negative late-time noise, model reconstruction, no mutation, independent fitted rendering, and representative 6,944-, 23,148-, and 55,556-point acquisitions.
