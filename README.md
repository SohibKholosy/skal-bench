[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.21763629.svg)](https://doi.org/10.5281/zenodo.21763629)

# SKAL Bench

**Routine & Special Core Analysis** — a browser-based console for petroleum core analysis.

Enter laboratory measurements and get the result together with the equation evaluated and the
published source behind it. Every calculation runs in the browser; nothing is uploaded and no
account is required.

**Live site:** https://sohibkholosy.github.io/skal-bench/

---

## What it covers

22 tests across seven categories:

| Category | Tests |
|---|---|
| Permeability | Steady-state gas (Klinkenberg), single-point gas, pulse decay, liquid coreflood, stress dependence, measurement uncertainty |
| Porosity & volumetrics | Gravimetric (Archimedes), helium porosimetry (Boyle's law) |
| Capillary pressure & wettability | Mercury injection (MICP) with Thomeer and Brooks–Corey, centrifuge with Hassler–Brunner and Forbes inversion, Amott/USBM, contact angle, penetrometer selection |
| Relative permeability | Steady-state, unsteady-state (JBN), Brooks–Corey fit and prediction |
| Electrical properties | Formation factor (a, m), resistivity index (n), Waxman–Smits shaly sand |
| NMR petrophysics | T2 inversion, SDR and Timur–Coates permeability, core-calibrated cutoffs |
| Correlations & trends | Porosity–permeability, rock typing (Winland r35, RQI/FZI) |

Plus a unit converter, a calculator, batch spreadsheet processing, figure export at publication
resolution, and CSV export of both plotted points and full result tables.

## Documentation

- In-app: **How to use** and **Documentation** links in the footer
- Standalone: [`docs/skal-bench-v1.0.0-documentation.pdf`](docs/) and the HTML equivalent — every
  module with its equation, symbol definitions with units, and citations
- [`docs/VALIDATION_PROTOCOL.md`](docs/VALIDATION_PROTOCOL.md) — how to verify each module against
  the literature

## Running locally

Requires Node.js 18 or newer.

```bash
npm install
npm run dev
```

Then open the address printed in the terminal (usually http://localhost:5173).

## Building and deploying

```bash
npm run build      # produces dist/
npm run preview    # serve the production build locally to check it
```

Deployment to GitHub Pages happens automatically on every push to `main` via
`.github/workflows/deploy.yml`. To deploy manually instead, run `npm run deploy`.

## Built with

React, Recharts, SheetJS (xlsx), Lucide icons, Vite.

## Citation

If this software contributed to published work, please cite the version you used — see
`CITATION.cff`, or the **How to cite** page in the app, which provides APA and BibTeX forms.

## Licence

MIT — see [`LICENSE`](LICENSE). Provided as is, without warranty. Results are engineering estimates
that depend on your input data and local calibration; confirm important values against your own core
measurements before relying on them.

## Author

**Sohaib Kholosy** — Principal Research Technician, Special Core Analysis
Kuwait Institute for Scientific Research (KISR), Petroleum Research Center

Questions, corrections and bug reports: skalbench@gmail.com
