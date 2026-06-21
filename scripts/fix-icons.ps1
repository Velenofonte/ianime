# Genera le icone PWA a partire dal master definitivo.
# Uso: powershell -ExecutionPolicy Bypass -File scripts/fix-icons.ps1

Add-Type -AssemblyName System.Drawing

$iconsDir = Join-Path $PSScriptRoot "..\client\public\icons" | Resolve-Path
$sourceAsset = Join-Path $iconsDir "source\ianime-logo-approved2.png"

# Maskable Android: contenuto importante nel cerchio centrale (~80% del lato)
$maskableSafeScale = 0.80
# Icone "any" e header: riempimento quasi pieno del quadrato
$anyFillScale = 1.0
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

# Inserisce l'intera immagine su un canvas quadrato (nessun taglio del logo)
function Convert-ToSquareMaster([System.Drawing.Bitmap]$src, [System.Drawing.Color]$bg) {
  $side = [Math]::Max($src.Width, $src.Height)
  $bmp = New-Object System.Drawing.Bitmap $side, $side
  $g = New-Graphics $bmp
  $g.Clear($bg)
  $dx = [int](($side - $src.Width) / 2)
  $dy = [int](($side - $src.Height) / 2)
  $g.DrawImage($src, $dx, $dy, $src.Width, $src.Height)
  $g.Dispose()
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

Write-Host "Generazione icone PWA da master definitivo..."
$loaded = [System.Drawing.Bitmap]::FromFile($sourceAsset)
Write-Host "Master: $($loaded.Width)x$($loaded.Height)"

$bg = Get-BackgroundColor $loaded
Write-Host "Sfondo: RGB($($bg.R),$($bg.G),$($bg.B))"

$master = Convert-ToSquareMaster $loaded $bg
$loaded.Dispose()
Write-Host "Canvas quadrato: $($master.Width)x$($master.Height)"

Clear-EdgeArtifacts $master $bg

$iconPng = Join-Path $iconsDir "icon.png"
Write-ScaledIcon $master $bg $iconPng $headerSize $anyFillScale

Write-ScaledIcon $master $bg (Join-Path $iconsDir "icon-512.png") 512 $anyFillScale
Write-ScaledIcon $master $bg (Join-Path $iconsDir "icon-192.png") 192 $anyFillScale
Write-ScaledIcon $master $bg (Join-Path $iconsDir "icon-512-maskable.png") 512 $maskableSafeScale
Write-ScaledIcon $master $bg (Join-Path $iconsDir "icon-192-maskable.png") 192 $maskableSafeScale

$master.Dispose()

Write-Host "Fatto."
Write-Host "  icon.png              -> header / favicon ($headerSize, fill $anyFillScale)"
Write-Host "  icon-512/192.png      -> PWA purpose=any (fill $anyFillScale)"
Write-Host "  icon-512/192-maskable -> PWA purpose=maskable (safe zone $maskableSafeScale)"
