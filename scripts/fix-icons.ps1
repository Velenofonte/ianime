Add-Type -AssemblyName System.Drawing
$iconsDir = Join-Path $PSScriptRoot "..\client\public\icons" | Resolve-Path
$backupDir = Join-Path $iconsDir "backup"
$cleanAsset = "C:\Users\DAVIDE_RS\.cursor\projects\c-Users-DAVIDE-RS-workspace-assistente-test\assets\ianime-logo-maskable-clean.png"
$stamp = "20260607"

function Get-SquareCrop([System.Drawing.Image]$img) {
  $size = [Math]::Min($img.Width, $img.Height)
  $x = [int](($img.Width - $size) / 2)
  $y = [int](($img.Height - $size) / 2)
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.DrawImage($img, 0, 0, (New-Object System.Drawing.Rectangle $x, $y, $size, $size), [System.Drawing.GraphicsUnit]::Pixel)
  $g.Dispose()
  $bmp
}

function Get-EdgeBg([System.Drawing.Bitmap]$bmp) {
  $pts = @(
    [System.Drawing.Point]::new(0, 0),
    [System.Drawing.Point]::new($bmp.Width - 1, 0),
    [System.Drawing.Point]::new(0, $bmp.Height - 1),
    [System.Drawing.Point]::new($bmp.Width - 1, $bmp.Height - 1),
    [System.Drawing.Point]::new([int]($bmp.Width / 2), 0)
  )
  $r = 0; $g = 0; $b = 0
  foreach ($p in $pts) {
    $c = $bmp.GetPixel($p.X, $p.Y)
    $r += $c.R; $g += $c.G; $b += $c.B
  }
  [System.Drawing.Color]::FromArgb(255, [int]($r / $pts.Count), [int]($g / $pts.Count), [int]($b / $pts.Count))
}

function Remove-BrightEdgePixels([System.Drawing.Bitmap]$bmp, [System.Drawing.Color]$bg, [int]$border) {
  $w = $bmp.Width; $h = $bmp.Height
  for ($y = 0; $y -lt $h; $y++) {
    for ($x = 0; $x -lt $w; $x++) {
      $onEdge = ($x -lt $border -or $y -lt $border -or $x -ge ($w - $border) -or $y -ge ($h - $border))
      if (-not $onEdge) { continue }
      $c = $bmp.GetPixel($x, $y)
      if (($c.R + $c.G + $c.B) -gt 680 -or ($c.R -gt 230 -and $c.G -gt 230 -and $c.B -gt 230)) {
        $bmp.SetPixel($x, $y, $bg)
      }
    }
  }
}

function Save-Scaled([System.Drawing.Bitmap]$art, [System.Drawing.Color]$bg, [string]$outPath, [int]$size, [double]$scale) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear($bg)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $inner = [int]($size * $scale)
  $x = [int](($size - $inner) / 2)
  $y = [int](($size - $inner) / 2)
  $g.DrawImage($art, $x, $y, $inner, $inner)
  $g.Dispose()
  $border = [Math]::Max(6, [int]($size * 0.025))
  Remove-BrightEdgePixels $bmp $bg $border
  $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

Write-Host "Ripristino icone standard dal backup..."
Copy-Item (Join-Path $backupDir "icon_backup_$stamp.png") (Join-Path $iconsDir "icon.png") -Force
Copy-Item (Join-Path $backupDir "icon-512_backup_$stamp.png") (Join-Path $iconsDir "icon-512.png") -Force
Copy-Item (Join-Path $backupDir "icon-192_backup_$stamp.png") (Join-Path $iconsDir "icon-192.png") -Force

Write-Host "Generazione icone maskable full-bleed..."
$loaded = [System.Drawing.Image]::FromFile($cleanAsset)
$square = Get-SquareCrop $loaded
$loaded.Dispose()
$bg = Get-EdgeBg $square
Write-Host "Background maskable: $($bg.R),$($bg.G),$($bg.B)"

Save-Scaled $square $bg (Join-Path $iconsDir "icon-512-maskable.png") 512 0.90
Save-Scaled $square $bg (Join-Path $iconsDir "icon-192-maskable.png") 192 0.90
$square.Dispose()
Write-Host "Fatto."
