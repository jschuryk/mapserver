var express = require('express');
var http    = require('http');
var path    = require('path');
var fs      = require('fs');
var spawn   = require('child_process').spawn;

var app  = express();
var PORT = process.env.PORT || 3000;
var TSGL_PORT = 8080;

var MBTILES_PATH = process.env.MBTILES || path.join(__dirname, 'tiles.mbtiles');
if (!fs.existsSync(MBTILES_PATH)) {
  console.error('MBTiles file not found: ' + MBTILES_PATH);
  console.error('Generate it with:');
  console.error('  tilemaker --input country.osm.pbf --output tiles.mbtiles --config tilemaker/config.json --process tilemaker/process.lua');
  process.exit(1);
}

// Start TileServer GL as a child process on port 8080.
// It reads tiles.mbtiles and renders PNG tiles using tileserver/style.json.
var tsgl = spawn(
  'node',
  [
    path.join(__dirname, 'node_modules/tileserver-gl/src/main.js'),
    '--config', 'config.json',
    '--port', String(TSGL_PORT)
  ],
  { cwd: path.join(__dirname, 'tileserver'), stdio: 'inherit' }
);
tsgl.on('error', function (err) {
  console.error('TileServer GL failed to start:', err.message);
});
process.on('exit', function () { tsgl.kill(); });
process.on('SIGINT', function () { tsgl.kill(); process.exit(); });

app.use(function (req, res, next) {
  res.set('Access-Control-Allow-Origin', '*');
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

// In-memory PNG tile cache. Keyed by "z/x/y", values are Buffers.
// FIFO eviction via Map insertion order when cap is reached.
var tileCache = new Map();
var TILE_CACHE_CAP = 10000;

function cachePut(key, buf) {
  if (tileCache.size >= TILE_CACHE_CAP) {
    tileCache.delete(tileCache.keys().next().value);
  }
  tileCache.set(key, buf);
}

// Proxy PNG tile requests to TileServer GL, with in-memory cache.
// Client requests /tiles/{z}/{x}/{y}.png — TileServer GL renders and returns PNG.
app.get('/tiles/:z/:x/:y.png', function (req, res) {
  var key = req.params.z + '/' + req.params.x + '/' + req.params.y;
  var cached = tileCache.get(key);
  if (cached) {
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=86400');
    res.set('Access-Control-Allow-Origin', '*');
    res.set('X-Tile-Cache', 'HIT');
    return res.end(cached);
  }

  var tilePath = '/styles/basic/' + req.params.z + '/' + req.params.x + '/' + req.params.y + '.png';
  var proxyReq = http.get({ hostname: 'localhost', port: TSGL_PORT, path: tilePath }, function (tileRes) {
    if (tileRes.statusCode !== 200) {
      return res.status(204).end();
    }
    var chunks = [];
    tileRes.on('data', function (chunk) { chunks.push(chunk); });
    tileRes.on('end', function () {
      var buf = Buffer.concat(chunks);
      cachePut(key, buf);
      res.set('Content-Type', 'image/png');
      res.set('Cache-Control', 'public, max-age=86400');
      res.set('Access-Control-Allow-Origin', '*');
      res.set('X-Tile-Cache', 'MISS');
      res.end(buf);
    });
  });
  proxyReq.on('error', function () {
    res.status(503).end();
  });
});

app.listen(PORT, function () {
  console.log('Map server running at http://localhost:' + PORT);
  console.log('TileServer GL starting on internal port ' + TSGL_PORT + '...');
});
