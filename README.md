# South Signal Operations

A lightweight, offline-friendly dashboard for browsing the Qatar South traffic-signal junction register and preventive-maintenance route assignments.

## Run locally

From this directory, start Python's built-in static web server:

```powershell
python -m http.server 8000
```

Open <http://localhost:8000> in a browser. The app has no package installation or external runtime dependencies.

## Data

The bundled `data/app-data.js` is a curated snapshot derived from:

- `RF003 Qatar South-Junction Inventory of Assets (TS 316 Junctions) as of 15.07.2026.xlsx`
- `Traffic Signal PM update with Route Description_Version_1(TTG)_v2.xlsx`

The app includes junction number, location, zone, municipality, junction type, a normalized register-status category, and PM routine assignments. It intentionally excludes network addresses and infrastructure connection details. The PM source lists planned route assignments, not work-completion events; the app labels them accordingly.

To refresh the snapshot, regenerate `data/app-data.js` from the source workbooks, retaining the current field allowlist and omitting network and connection fields.
