Add-Type -AssemblyName System.Drawing
$iconsDir = Join-Path $PSScriptRoot "..\client\public\icons" | Resolve-Path
$sourceAsset = Join-Path $iconsDir "source\ianime-logo-approved.png"

# Android maskable: contenuto nella safe zone (~80% diametro). Glow incluso → ~74%
$scalePwa = 0.74

function Get-IconBlue([System.Drawing.Bitmap]$bmp) {
  $r = 0; $g = 0; $b = 0; $n = 0
  $w = $bmp.Width; $h = $bmp.Height
  for ($y = 0; $y -lt $h; $y += 3) {
    for ($x = 0; $x -lt $w; $x += 3) {
      $c = $bmp.GetPixel($x, $y)
      $sum = $c.R + $c.G + $c.B
      if ($c.B -gt $c.R + 15 -and $c.B -gt $c.G + 5 -and $c.R -lt 90 -and $sum -lt 420 -and $sum -gt 80) {
        $r += $c.R; $g += $c.G; $b += $c.B; $n++
      }
    }
  }
  if ($n -eq 0) { return [System.Drawing.Color]::FromArgb(255, 39, 84, 142) }
  [System.Drawing.Color]::FromArgb(255, [int]($r / $n), [int]($g / $n), [int]($b / $n))
}

function Test-OuterWhite([System.Drawing.Color]$c) {
  $c.R -gt 245 -and $c.G -gt 245 -and $c.B -gt 245
}

function Remove-OuterWhite([System.Drawing.Bitmap]$bmp, [System.Drawing.Color]$bg) {
  $w = $bmp.Width; $h = $bmp.Height
  $seen = New-Object 'System.Collections.Generic.HashSet[int]'
  $q = [System.Collections.Queue]::new()

  function Enqueue([int]$x, [int]$y) {
    if ($x -lt 0 -or $y -lt 0 -or $x -ge $w -or $y -ge $h) { return }
    $k = $y * $w + $x
    if ($seen.Contains($k)) { return }
    if (-not (Test-OuterWhite ($bmp.GetPixel($x, $y)))) { return }
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

function Get-ContentBounds([System.Drawing.Bitmap]$bmp, [System.Drawing.Color]$bg, [int]$tolerance = 24) {
  $w = $bmp.Width; $h = $bmp.Height
  $minX = -1; $maxX = -1; $minY = $h; $maxY = -1
  $colMin = [Math]::Max(4, [int]($h * 0.02))

  for ($x = 0; $x -lt $w; $x++) {
    $count = 0
    for ($y = 0; $y -lt $h; $y++) {
      if (Test-LeftEdgePixel ($bmp.GetPixel($x, $y))) { $count++ }
    }
    if ($count -ge $colMin) { $minX = $x; break }
  }

  for ($x = $w - 1; $x -ge 0; $x--) {
    $count = 0
    for ($y = 0; $y -lt $h; $y++) {
      if (Test-RightEdgePixel ($bmp.GetPixel($x, $y))) { $count++ }
    }
    if ($count -ge $colMin) { $maxX = $x; break }
  }

  if ($minX -lt 0 -or $maxX -lt 0 -or $minX -gt $maxX) { return $null }

  for ($y = 0; $y -lt $h; $y++) {
    for ($x = $minX; $x -le $maxX; $x++) {
      $c = $bmp.GetPixel($x, $y)
      if (-not ((Test-LeftEdgePixel $c) -or (Test-RightEdgePixel $c))) { continue }
      if ($y -lt $minY) { $minY = $y }
      if ($y -gt $maxY) { $maxY = $y }
    }
  }
  @{ MinX = $minX; MinY = $minY; MaxX = $maxX; MaxY = $maxY }
}

function Test-LeftEdgePixel([System.Drawing.Color]$c) {
  if ($c.R -lt 45 -and $c.G -lt 55 -and $c.B -lt 95) { return $true }
  if ($c.B -gt 130 -and ($c.B - $c.R) -gt 25 -and ($c.B - $c.G) -gt 8) { return $true }
  return $false
}

function Test-RightEdgePixel([System.Drawing.Color]$c) {
  if ($c.R -gt 225 -and $c.G -gt 225 -and $c.B -gt 225) { return $true }
  return $false
}

function Test-ContentPixel([System.Drawing.Color]$c, [System.Drawing.Color]$bg, [int]$tolerance) {
  (Test-LeftEdgePixel $c) -or (Test-RightEdgePixel $c)
}

# Spostamento extra verso destra oltre alla centratura automatica
$pwaShiftExtra = 10

function Test-NearWhite([System.Drawing.Color]$c) {
  $c.R -gt 230 -and $c.G -gt 230 -and $c.B -gt 230
}

function Remove-OuterLight([System.Drawing.Bitmap]$bmp, [System.Drawing.Color]$bg) {
  $w = $bmp.Width; $h = $bmp.Height
  $seen = New-Object 'System.Collections.Generic.HashSet[int]'
  $q = [System.Collections.Queue]::new()

  function EnqueueLight([int]$x, [int]$y) {
    if ($x -lt 0 -or $y -lt 0 -or $x -ge $w -or $y -ge $h) { return }
    $k = $y * $w + $x
    if ($seen.Contains($k)) { return }
    $c = $bmp.GetPixel($x, $y)
    if (-not ((Test-OuterWhite $c) -or (Test-NearWhite $c))) { return }
    $seen.Add($k) | Out-Null
    $q.Enqueue([System.Drawing.Point]::new($x, $y)) | Out-Null
  }

  for ($x = 0; $x -lt $w; $x++) { EnqueueLight $x 0; EnqueueLight $x ($h - 1) }
  for ($y = 0; $y -lt $h; $y++) { EnqueueLight 0 $y; EnqueueLight ($w - 1) $y }

  while ($q.Count -gt 0) {
    $p = $q.Dequeue()
    $bmp.SetPixel($p.X, $p.Y, $bg)
    EnqueueLight ($p.X - 1) $p.Y
    EnqueueLight ($p.X + 1) $p.Y
    EnqueueLight $p.X ($p.Y - 1)
    EnqueueLight $p.X ($p.Y + 1)
  }
}

function Shift-Horizontal([System.Drawing.Bitmap]$src, [int]$shift, [System.Drawing.Color]$bg) {
  $w = $src.Width; $h = $src.Height
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  for ($y = 0; $y -lt $h; $y++) {
    for ($x = 0; $x -lt $w; $x++) {
      $srcX = $x - $shift
      if ($srcX -lt 0 -or $srcX -ge $w) {
        $bmp.SetPixel($x, $y, $bg)
      } else {
        $bmp.SetPixel($x, $y, $src.GetPixel($srcX, $y))
      }
    }
  }
  $bmp
}

function Center-ContentHorizontally([System.Drawing.Bitmap]$src, [System.Drawing.Color]$bg) {
  $bounds = Get-ContentBounds $src $bg
  if ($null -eq $bounds) { return $src }

  $leftMargin = $bounds.MinX
  $rightMargin = ($src.Width - 1) - $bounds.MaxX
  $shift = [int][Math]::Round(($rightMargin - $leftMargin) / 2.0) + $pwaShiftExtra
  if ($shift -le 0) { return $src }

  Write-Host "Centratura orizzontale: shift ${shift}px (auto $([int][Math]::Round(($rightMargin - $leftMargin) / 2.0)) + extra $pwaShiftExtra, contenuto $($bounds.MinX)-$($bounds.MaxX))"
  $bmp = Shift-Horizontal $src $shift $bg
  Remove-OuterWhite $bmp $bg
  Remove-OuterLight $bmp $bg
  $bmp
}

function Get-CenterSquareCrop([System.Drawing.Bitmap]$src) {
  $size = [Math]::Min($src.Width, $src.Height)
  $x = [int](($src.Width - $size) / 2)
  $y = [int](($src.Height - $size) / 2)
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.DrawImage($src, 0, 0, (New-Object System.Drawing.Rectangle $x, $y, $size, $size), [System.Drawing.GraphicsUnit]::Pixel)
  $g.Dispose()
  $bmp
}

function Save-Square([System.Drawing.Bitmap]$src, [string]$outPath, [int]$size) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $ratio = [Math]::Min($size / $src.Width, $size / $src.Height)
  $dw = [int]($src.Width * $ratio)
  $dh = [int]($src.Height * $ratio)
  $dx = [int](($size - $dw) / 2)
  $dy = [int](($size - $dh) / 2)
  $g.DrawImage($src, $dx, $dy, $dw, $dh)
  $g.Dispose()
  $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

function Save-PwaIcon([System.Drawing.Bitmap]$art, [System.Drawing.Color]$bg, [string]$outPath, [int]$size, [double]$scale) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear($bg)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $inner = [int]($size * $scale)
  $x = [int](($size - $inner) / 2)
  $y = [int](($size - $inner) / 2)
  $g.DrawImage($art, $x, $y, $inner, $inner)
  $g.Dispose()
  $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

if (-not (Test-Path $sourceAsset)) {
  Write-Error "Asset sorgente non trovato: $sourceAsset"
  exit 1
}

Write-Host "Generazione icone..."
$loaded = [System.Drawing.Image]::FromFile($sourceAsset)
Write-Host "Sorgente: $($loaded.Width)x$($loaded.Height)"
$square = Get-CenterSquareCrop $loaded
$loaded.Dispose()

$bg = Get-IconBlue $square
Write-Host "Blu sfondo: RGB($($bg.R),$($bg.G),$($bg.B))"
Remove-OuterWhite $square $bg

# Header: composizione piena (Layout.tsx → /icons/icon.png)
Save-Square $square (Join-Path $iconsDir "icon.png") 512

# PWA manifest: logo ridotto nella safe zone Android (mask + glow)
$pwaArt = Center-ContentHorizontally $square $bg
if ($pwaArt -ne $square) {
  $square.Dispose()
  $square = $pwaArt
}

Write-Host "PWA scale: $scalePwa"
Save-PwaIcon $square $bg (Join-Path $iconsDir "icon-512.png") 512 $scalePwa
Save-PwaIcon $square $bg (Join-Path $iconsDir "icon-192.png") 192 $scalePwa
Save-PwaIcon $square $bg (Join-Path $iconsDir "icon-512-maskable.png") 512 $scalePwa
Save-PwaIcon $square $bg (Join-Path $iconsDir "icon-192-maskable.png") 192 $scalePwa

$square.Dispose()
Write-Host "Fatto. Header=icon.png | PWA=icon-* (scale $scalePwa)"
