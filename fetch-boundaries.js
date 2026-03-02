// Downloads Natural Earth boundary GeoJSON and filters to Canada, US, Mexico.
// Run once: node fetch-boundaries.js
var https = require('https');
var fs    = require('fs');
var path  = require('path');

var BASE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/';

function download(filename, cb) {
  console.log('Downloading ' + filename + '...');
  var chunks = [];
  https.get(BASE + filename, function (res) {
    res.on('data', function (c) { chunks.push(c); });
    res.on('end', function () { cb(null, Buffer.concat(chunks).toString()); });
  }).on('error', cb);
}

var COUNTRIES = { 'Canada': true, 'United States of America': true, 'Mexico': true };
var ISO       = { 'CAN': true, 'USA': true, 'MEX': true };

// State/province boundaries — filter by admin (country name)
download('ne_10m_admin_1_states_provinces.geojson', function (err, raw) {
  if (err) { console.error(err); process.exit(1); }
  var geojson = JSON.parse(raw);
  geojson.features = geojson.features.filter(function (f) {
    return COUNTRIES[f.properties.admin] === true;
  });
  // Strip all properties except name to keep the file small
  geojson.features.forEach(function (f) {
    f.properties = { name: f.properties.name };
  });
  var out = path.join(__dirname, 'public', 'data', 'provinces.geojson');
  fs.writeFileSync(out, JSON.stringify(geojson));
  console.log('Wrote provinces.geojson (' + geojson.features.length + ' features)');
});

// National boundaries — filter by ISO_A3
download('ne_10m_admin_0_countries.geojson', function (err, raw) {
  if (err) { console.error(err); process.exit(1); }
  var geojson = JSON.parse(raw);
  geojson.features = geojson.features.filter(function (f) {
    return ISO[f.properties.ISO_A3] === true;
  });
  geojson.features.forEach(function (f) {
    f.properties = { name: f.properties.NAME };
  });
  var out = path.join(__dirname, 'public', 'data', 'countries.geojson');
  fs.writeFileSync(out, JSON.stringify(geojson));
  console.log('Wrote countries.geojson (' + geojson.features.length + ' features)');
});
