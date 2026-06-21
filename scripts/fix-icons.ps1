# Genera le icone PWA dal master definitivo (ritaglio stretto sul logo).
# Uso: powershell -ExecutionPolicy Bypass -File scripts/fix-icons.ps1

Add-Type -AssemblyName System.Drawing

$iconsDir = Join-Path $PSScriptRoot "..\client\public\icons" | Resolve-Path
$sourceAsset = Join-Path $iconsDir "source\ianime-logo-approved2.png"

# Margine attorno al logo nel master quadrato (~3.5% del lato)
$contentPaddingRatio = 0.035
# Maskable: leggero inset per le maschere OS (il master e gia ritagliato stretto)
$maskableScale = 0.90
$headerSize = 512

function New-Graphics([System.Drawing.Bitmap]$bmp) {
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $g
}

function Get-BackgroundColor([System.Drawing.Bitmap]$bmp) {
  $samples = @(
    $bmp.GetPixel(0, 0),
    $bmp.GetPixel($bmp.Width - 1, 0),
    $bmp.GetPixel(0, $bmp.Height - 1),
    $bmp.GetPixel($bmp.Width - 1, $bmp.Height - 1)
  )
  $r = 0; $g = 0; $b = 0
  foreach ($c in $samples) { $r += $c.R; $g += $c.G; $b += $c.B }
  [System.Drawing.Color]::FromArgb(255, [int]($r / 4), [int]($g / 4), [int]($b / 4))
}

function Test-ContentPixel([System.Drawing.Color]$c, [System.Drawing.Color]$bg) {
  $delta = [Math]::Abs($c.R - $bg.R) + [Math]::Abs($c.G - $bg.G) + [Math]::Abs($c.B - $bg.B)
  $delta -gt 28
}

function Test-NearWhite([System.Drawing.Color]$c) {
  $c.R -gt 238 -and $c.G -gt 238 -and $c.B -gt 238
}

function Clear-EdgeArtifacts([System.Drawing.Bitmap]$bmp, [System.Drawing.Color]$bg) {
  $w = $bmp.Width; $h = $bmp.Height
  $seen = New-Object 'System.Collections.Generic.HashSet[int]'
  $q = [System.Collections.Queue]::new()

  function Enqueue([int]$x, [int]$y) {
    if ($x -lt 0 -or $y -lt 0 -or $x -ge $w -or $y -ge $h) { return }
    $k = $y * $w + $x
    if ($seen.Contains($k)) { return }
    if (-not (Test-NearWhite ($bmp.GetPixel($x, $y)))) { return }
    $seen.Add($k) | Out-Null
    $q.Enqueue([System.Drawing.Point]::new($x, $y)) | Out-Null
  }

  for ($x = 0; $x -lt $w; $x++) { Enqueue $x 0; Enqueue $x ($h - 1) }
  for ($y = 0; $y -lt $h; $y++) { Enqueue 0 $y; Enqueue ($w - 1) $y }

  while ($q.Count -gt 0) {
    $p = $q.Dequeue()
    $bmp.SetPixel($p.X, $p.Y, $bg)
    Enqueue ($p.X - 1) $p.Y
    Enqueue ($p.X + 1) $p.Y
    Enqueue $p.X ($p.Y - 1)
    Enqueue $p.X ($p.Y + 1)
  }
}

function Get-ContentBounds([System.Drawing.Bitmap]$bmp, [System.Drawing.Color]$bg) {
  $w = $bmp.Width; $h = $bmp.Height
  $minX = $w; $minY = $h; $maxX = -1; $maxY = -1
  for ($y = 0; $y -lt $h; $y++) {
    for ($x = 0; $x -lt $w; $x++) {
      if (-not (Test-ContentPixel ($bmp.GetPixel($x, $y)) $bg)) { continue }
      if ($x -lt $minX) { $minX = $x }
      if ($y -lt $minY) { $minY = $y }
      if ($x -gt $maxX) { $maxX = $x }
      if ($y -gt $maxY) { $maxY = $y }
    }
  }
  if ($maxX -lt 0) { return $null }
  @{ MinX = $minX; MinY = $minY; MaxX = $maxX; MaxY = $maxY }
}

# Ritaglia stretto sul logo e produce un quadrato con poco sfondo
function Convert-ToTightSquare([System.Drawing.Bitmap]$src, [System.Drawing.Color]$bg, [double]$paddingRatio) {
  $bounds = Get-ContentBounds $src $bg
  if ($null -eq $bounds) { throw "Nessun contenuto rilevato nel master" }

  $cw = $bounds.MaxX - $bounds.MinX + 1
  $ch = $bounds.MaxY - $bounds.MinY + 1
  $pad = [int][Math]::Ceiling([Math]::Max($cw, $ch) * $paddingRatio)
  $side = [Math]::Max($cw, $ch) + (2 * $pad)

  $cx = ($bounds.MinX + $bounds.MaxX) / 2.0
  $cy = ($bounds.MinY + $bounds.MaxY) / 2.0
  $srcX = [int][Math]::Floor($cx - $side / 2.0)
  $srcY = [int][Math]::Floor($cy - $side / 2.0)

  $bmp = New-Object System.Drawing.Bitmap $side, $side
  $g = New-Graphics $bmp
  $g.Clear($bg)

  $destRect = New-Object System.Drawing.Rectangle 0, 0, $side, $side
  $srcRect = New-Object System.Drawing.Rectangle $srcX, $srcY, $side, $side
  $g.DrawImage($src, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
  $g.Dispose()

  Write-Host "Contenuto $($bounds.MinX)-$($bounds.MaxX) x $($bounds.MinY)-$($bounds.MaxY), pad ${pad}px, quadrato ${side}x${side}"
  $bmp
}

function Write-ScaledIcon([System.Drawing.Bitmap]$art, [System.Drawing.Color]$bg, [string]$outPath, [int]$size, [double]$scale) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = New-Graphics $bmp
  $g.Clear($bg)
  $inner = [Math]::Max(1, [int][Math]::Round($size * $scale))
  $x = [int](($size - $inner) / 2)
  $y = [int](($size - $inner) / 2)
  $g.DrawImage($art, $x, $y, $inner, $inner)
  $g.Dispose()
  $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

if (-not (Test-Path $sourceAsset)) {
  Write-Error "Master non trovato: $sourceAsset"
  exit 1
}

Write-Host "Generazione icone PWA..."
$loaded = [System.Drawing.Bitmap]::FromFile($sourceAsset)
Write-Host "Master: $($loaded.Width)x$($loaded.Height)"

$bg = Get-BackgroundColor $loaded
Write-Host "Sfondo: RGB($($bg.R),$($bg.G),$($bg.B))"

Clear-EdgeArtifacts $loaded $bg
$master = Convert-ToTightSquare $loaded $bg $contentPaddingRatio
$loaded.Dispose()

Clear-EdgeArtifacts $master $bg

Write-ScaledIcon $master $bg (Join-Path $iconsDir "icon.png") $headerSize 1.0
Write-ScaledIcon $master $bg (Join-Path $iconsDir "icon-512.png") 512 1.0
Write-ScaledIcon $master $bg (Join-Path $iconsDir "icon-192.png") 192 1.0
Write-ScaledIcon $master $bg (Join-Path $iconsDir "icon-512-maskable.png") 512 $maskableScale
Write-ScaledIcon $master $bg (Join-Path $iconsDir "icon-192-maskable.png") 192 $maskableScale

$master.Dispose()

Write-Host "Fatto."
Write-Host "  icon.png / icon-512/192.png      -> fill 100%"
Write-Host "  icon-512/192-maskable.png         -> scale $maskableScale"
