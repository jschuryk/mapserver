# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture

A map tile server that serves vector tiles generated from OpenStreetMap PBF files, with an IE11-compatible browser client.

**Data flow:**
```
country.osm.pbf  →  tilemaker  →  tiles.mbtiles  →  server.js  →  browser (Leaflet + VectorGrid)
```

**Tile format:** Mapbox Vector Tiles (MVT) — gzip-compressed protobuf stored in an MBTiles SQLite file. Not all tiles are guaranteed to be gzip-compressed; `server.js` checks the magic bytes (`0x1f 0x8b`) before setting `Content-Encoding: gzip`.

**Y-coordinate convention:** MBTiles uses TMS y (origin bottom-left). Leaflet uses XYZ y (origin top-left). Conversion in `server.js`: `tmsY = 2^z - 1 - y`.

**Layers defined** (in `tilemaker/config.json` and `tilemaker/process.lua`):
- `place` — named settlements (nodes only)
- `poi` — points of interest (zoom 9+)
- `transportation` — roads and paths
- `transportation_name` — named roads (zoom 8+)
- `water` — lakes, coastline polygons
- `waterway` — rivers, canals only (streams/drains filtered out client-side)

**City/province labels** are hardcoded in `public/index.html` (VectorGrid cannot render text). Province boundary lines are loaded from `/data/provinces.geojson` if present (not included — download from Natural Earth).

**Current zoom config:** minzoom 2, maxzoom 10 (good for country/region scale). For full detail including buildings, use maxzoom 14 but expect much larger mbtiles and higher memory usage during tiling.

## Setup

### 1. Install dependencies
```
npm install
```

### 2. Generate tiles (one-time)
Use tilemaker 3.0.0 in WSL (the Windows .exe crashes consistently). On Windows, run via PowerShell to avoid session timeouts:
```powershell
Start-Process wsl -ArgumentList @(
  'tilemaker',
  '--input',  '/mnt/c/users/.../canada.osm.pbf',
  '--output', '/mnt/c/users/.../tiles.mbtiles',
  '--config', '/mnt/c/users/.../tilemaker/config.json',
  '--process','/mnt/c/users/.../tilemaker/process.lua',
  '--threads','1'
) -RedirectStandardOutput 'C:\...\tilemaker.log' -RedirectStandardError 'C:\...\tilemaker-err.log' -NoNewWindow -PassThru
```
Monitor progress: `tail -1 tilemaker.log`. Wait for **"Filled the tileset"** before doing anything with the output file — tilemaker writes all tiles in a single SQLite transaction and the table will show 0 rows until it fully commits.

OSM PBF files: https://download.geofabrik.de/
To add a second region to existing tiles: add `--merge` flag.

### 3. Run the server
```
npm start        # production
npm run dev      # auto-restart on file changes (nodemon)
```
Open http://localhost:3000

## Configuration

| Env var   | Default          | Purpose                        |
|-----------|------------------|--------------------------------|
| `PORT`    | `3000`           | HTTP port                      |
| `MBTILES` | `./tiles.mbtiles`| Path to the MBTiles file       |

- Zoom range: edit `minzoom`/`maxzoom`/`basezoom` in `tilemaker/config.json`
- Map layers: edit `tilemaker/process.lua` to add/remove OSM features
- Map styling: edit `vectorTileLayerStyles` in `public/index.html`
- Initial map center: edit `setView([lat, lng], zoom)` in `public/index.html`
- City/province labels: hardcoded arrays in `public/index.html`
- Tile cache version: bump `?v=N` in the VectorGrid URL in `public/index.html` to bust browser cache after retiling

## Tilemaker Gotchas

**Tilemaker 3.x API** — `node_keys` must be a global table, not a function:
```lua
node_keys = { "place", "name", "amenity" }   -- correct (3.x)
function node_keys() return {...} end          -- wrong (2.x)
```
`way_keys` is not used in 3.x.

**Windows crashes** — tilemaker.exe crashes immediately on this machine. Always use WSL (Kali Linux, tilemaker 3.0.0 via apt). Use `MSYS_NO_PATHCONV=1` to prevent Git Bash from mangling `/mnt/c/...` paths if running from Git Bash.

**Memory at low basezoom** — basezoom=10 requires ~15GB+ RAM during tile writing. Use `--threads 1` to avoid OOM. Default multi-threaded mode gets SIGKILL'd. Admin boundary relations (large multipolygon geometries) make this worse and are currently disabled in `process.lua`.

**Building layer** — removed from `config.json` at maxzoom=10 (buildings are only meaningful at zoom 13+). If you add it back to config, also re-enable `Layer("building", true)` in `way_function()` in `process.lua` or tilemaker will throw a Lua error on every building way.

**Long runs** — use PowerShell `Start-Process` (not WSL bash background jobs, which die when the session exits, and not the Bash tool which has a 10-minute cap). Monitor via `tail -1 tilemaker.log`.

## Server Performance

**Bottleneck is client-side** (protobuf parsing + Canvas2D rendering), not server-side. Server responds in 1–3ms per tile.

Server-side optimizations in `server.js`:
- SQLite opened read-only with `PRAGMA cache_size = -32768` and `PRAGMA temp_store = memory`
- In-memory tile cache (Map, 10,000 tile cap, LRU-ish eviction)
- Cache pre-warmed at startup with all z2–z8 tiles (~4,000 tiles) so pan/zoom at country scale is served from RAM

Client-side options in `public/index.html`:
- `updateWhenZooming: false` — tiles only fetched after zoom stops, not during
- `keepBuffer: 4` — pre-fetches 4 tile-widths outside the viewport
- Map background color set to `#e8f0d8` so blank areas show a land color while tiles render

## IE11 Constraints

All JavaScript in `public/` must be ES5-compatible:
- No `const` or `let` (use `var`)
- No arrow functions (use `function()`)
- No template literals (use string concatenation)
- No destructuring, spread operator, or `class` syntax
- Closures in loops need IIFE pattern: `(function(x){ ... })(val)`

The `Object.assign` polyfill in `index.html` is required because Leaflet.VectorGrid uses it internally.

Leaflet.VectorGrid renders via Canvas2D (not WebGL), which IE11 supports. Text labels are not supported by VectorGrid — use `L.marker` with `L.divIcon` instead.
