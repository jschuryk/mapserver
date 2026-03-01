var express = require('express');
var DatabaseSync = require('node:sqlite').DatabaseSync;
var path = require('path');
var fs = require('fs');

var app = express();
var PORT = process.env.PORT || 3000;
var MBTILES_PATH = process.env.MBTILES || path.join(__dirname, 'tiles.mbtiles');

if (!fs.existsSync(MBTILES_PATH)) {
  console.error('MBTiles file not found: ' + MBTILES_PATH);
  console.error('Generate it with:');
  console.error('  tilemaker --input country.osm.pbf --output tiles.mbtiles --config tilemaker/config.json --process tilemaker/process.lua');
  process.exit(1);
}

var db = new DatabaseSync(MBTILES_PATH, { readOnly: true });
// Increase SQLite page cache to 32MB to speed up repeated reads.
db.exec('PRAGMA cache_size = -32768');
db.exec('PRAGMA temp_store = memory');

var getTile = db.prepare(
  'SELECT tile_data FROM tiles WHERE zoom_level = ? AND tile_column = ? AND tile_row = ?'
);

// In-memory tile cache — avoids hitting SQLite for frequently requested tiles.
var tileCache = new Map();
var CACHE_MAX = 10000;

// Pre-warm cache with all tiles at z2–z8 so pan/zoom at country scale is instant.
(function prewarm() {
  var rows = db.prepare(
    'SELECT zoom_level AS z, tile_column AS x, tile_row AS y, tile_data FROM tiles WHERE zoom_level <= 8'
  ).all();
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    tileCache.set(r.z + '/' + r.x + '/' + r.y, Buffer.from(r.tile_data));
  }
  console.log('Pre-warmed ' + tileCache.size + ' tiles (z2–z8) into cache.');
}());

function cachePut(key, buf) {
  if (tileCache.size >= CACHE_MAX) {
    tileCache.delete(tileCache.keys().next().value);
  }
  tileCache.set(key, buf);
}

app.use(express.static(path.join(__dirname, 'public')));

// Serve vector tiles from MBTiles.
// MBTiles uses TMS y-coordinates (origin at bottom-left).
// Leaflet uses XYZ/slippy map y-coordinates (origin at top-left).
// Conversion: tmsY = 2^z - 1 - y
app.get('/tiles/:z/:x/:y.pbf', function (req, res) {
  var z = parseInt(req.params.z, 10);
  var x = parseInt(req.params.x, 10);
  var y = parseInt(req.params.y, 10);
  var tmsY = Math.pow(2, z) - 1 - y;
  var key = z + '/' + x + '/' + tmsY;

  var buf = tileCache.get(key);
  if (!buf) {
    var row = getTile.get(z, x, tmsY);
    if (!row) {
      return res.status(204).end();
    }
    buf = Buffer.from(row.tile_data);
    cachePut(key, buf);
  }

  res.set('Content-Type', 'application/x-protobuf');
  if (buf[0] === 0x1f && buf[1] === 0x8b) {
    res.set('Content-Encoding', 'gzip');
  }
  res.set('Cache-Control', 'public, max-age=86400');
  res.set('Access-Control-Allow-Origin', '*');
  res.send(buf);
});

app.listen(PORT, function () {
  console.log('Map server running at http://localhost:' + PORT);
});
