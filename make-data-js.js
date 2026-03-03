// Wraps each GeoJSON data file as a JS variable so it can be loaded
// via <script> tag instead of XHR — required for IE11 local file access.
// Run once after fetch-boundaries.js or whenever GeoJSON files change:
//   node make-data-js.js
var fs   = require('fs');
var path = require('path');

var files = [
  { json: 'public/data/land.geojson',      js: 'public/data/land.js',      varName: 'LAND_DATA' },
  { json: 'public/data/provinces.geojson', js: 'public/data/provinces.js', varName: 'PROVINCES_DATA' },
  { json: 'public/data/countries.geojson', js: 'public/data/countries.js', varName: 'COUNTRIES_DATA' },
  { json: 'public/data/pipeline.geojson',  js: 'public/data/pipeline.js',  varName: 'PIPELINE_DATA' }
];

files.forEach(function (f) {
  var jsonPath = path.join(__dirname, f.json);
  if (!fs.existsSync(jsonPath)) {
    console.log('Skipping ' + f.json + ' (not found)');
    return;
  }
  var json = fs.readFileSync(jsonPath, 'utf8');
  var js = 'var ' + f.varName + ' = ' + json + ';';
  fs.writeFileSync(path.join(__dirname, f.js), js);
  console.log('Wrote ' + f.js + ' (' + Math.round(js.length / 1024) + 'KB)');
});
