# Deterministic PWA icon generation for TravelGhana.
#
# Source of truth: apps/web/public/"Travel Ghana Logo.png" (1394x1128, PNG with
# transparency). This script NEVER modifies the source file - it verifies its
# SHA256 before and after - and draws each requested icon as the artwork
# proportionally centered on the brand Warm Ivory background (#FFFDF7).
# Squares are required by the manifest spec; no crop, recolor or distortion.
#
# Outputs (run from the repo root):
#   apps/web/public/icons/icon-192.png           (any,  192x192)
#   apps/web/public/icons/icon-512.png           (any,  512x512)
#   apps/web/public/icons/icon-maskable-512.png  (maskable, logo inside the 80% safe circle)
#   apps/web/src/app/icon.png                    (favicon, 64x64)
#   apps/web/src/app/apple-icon.png              (Apple touch, 180x180)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$webDir = (Get-Item "$PSScriptRoot\..").FullName
$source = (Get-Item "$webDir\public\Travel Ghana Logo.png").FullName
$hashIn = (Get-FileHash -Algorithm SHA256 $source).Hash

function New-BrandIcon {
  param(
    [Parameter(Mandatory)] [System.Drawing.Bitmap] $Source,
    [Parameter(Mandatory)] [string] $OutPath,
    [Parameter(Mandatory)] [int] $Canvas,
    [Parameter(Mandatory)] [int] $LogoBoxWidth
  )
  $icon = New-Object System.Drawing.Bitmap($Canvas, $Canvas)
  $g = [System.Drawing.Graphics]::FromImage($icon)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality

  # Brand background (Warm Ivory, --tg-background): opaque, so dark launchers /
  # iOS home screens never render the transparent PNG areas as black.
  $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 0xFF, 0xFD, 0xF7))
  $g.FillRectangle($brush, 0, 0, $Canvas, $Canvas)
  $brush.Dispose()

  # Proportional fit: height follows the source aspect ratio, no crop or stretch.
  $h = [double] $LogoBoxWidth * $Source.Height / $Source.Width
  $x = (($Canvas - $LogoBoxWidth) / 2.0)
  $y = (($Canvas - $h) / 2.0)
  $g.DrawImage($Source, [single] $x, [single] $y, [single] $LogoBoxWidth, [single] $h)
  $g.Dispose()

  New-Item -ItemType Directory -Force -Path (Split-Path $OutPath) | Out-Null
  $icon.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $icon.Dispose()
  Write-Output "wrote $OutPath ($Canvas x $Canvas, logo box ${LogoBoxWidth}px)"
}

$src = New-Object System.Drawing.Bitmap($source)
try {
  New-BrandIcon -Source $src -OutPath "$webDir\public\icons\icon-192.png" -Canvas 192 -LogoBoxWidth 150
  New-BrandIcon -Source $src -OutPath "$webDir\public\icons\icon-512.png" -Canvas 512 -LogoBoxWidth 400
  New-BrandIcon -Source $src -OutPath "$webDir\public\icons\icon-maskable-512.png" -Canvas 512 -LogoBoxWidth 300
  New-BrandIcon -Source $src -OutPath "$webDir\src\app\icon.png" -Canvas 64 -LogoBoxWidth 52
  New-BrandIcon -Source $src -OutPath "$webDir\src\app\apple-icon.png" -Canvas 180 -LogoBoxWidth 140
}
finally {
  $src.Dispose()
}

$hashOut = (Get-FileHash -Algorithm SHA256 $source).Hash
if ($hashIn -ne $hashOut) { throw "SOURCE FILE WAS MODIFIED - refusing to keep the generated icons!" }
Write-Output "source unchanged (sha256 $hashOut)"
