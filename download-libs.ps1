$libs = @(
  @{ url = 'https://cdn.jsdelivr.net/npm/es6-promise@4/dist/es6-promise.auto.min.js'; out = 'public\lib\es6-promise.auto.min.js' },
  @{ url = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';                        out = 'public\lib\leaflet.css' },
  @{ url = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';                         out = 'public\lib\leaflet.js' },
  @{ url = 'https://unpkg.com/leaflet.vectorgrid@1.3.0/dist/Leaflet.VectorGrid.bundled.js'; out = 'public\lib\Leaflet.VectorGrid.bundled.js' }
)
foreach ($lib in $libs) {
  $dest = Join-Path 'C:\users\jschu\dev\mapserver' $lib.out
  Invoke-WebRequest -Uri $lib.url -OutFile $dest
  Write-Host "Downloaded $($lib.out) ($([math]::Round((Get-Item $dest).Length/1KB))KB)"
}
