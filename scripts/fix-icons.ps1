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
Write-Host "PWA scale: $scalePwa"
Save-PwaIcon $square $bg (Join-Path $iconsDir "icon-512.png") 512 $scalePwa
Save-PwaIcon $square $bg (Join-Path $iconsDir "icon-192.png") 192 $scalePwa
Save-PwaIcon $square $bg (Join-Path $iconsDir "icon-512-maskable.png") 512 $scalePwa
Save-PwaIcon $square $bg (Join-Path $iconsDir "icon-192-maskable.png") 192 $scalePwa

$square.Dispose()
Write-Host "Fatto. Header=icon.png | PWA=icon-* (scale $scalePwa)"
