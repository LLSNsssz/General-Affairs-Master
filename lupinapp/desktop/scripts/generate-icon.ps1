param(
  [string]$OutputDir = (Join-Path $PSScriptRoot "..\assets")
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

function New-BaseBitmap {
  param([int]$Size)

  $bitmap = [System.Drawing.Bitmap]::new($Size, $Size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

  $paper = [System.Drawing.ColorTranslator]::FromHtml("#F1E57A")
  $fold = [System.Drawing.ColorTranslator]::FromHtml("#FFF6B8")
  $ink = [System.Drawing.ColorTranslator]::FromHtml("#231F15")

  $graphics.Clear($paper)

  $scale = $Size / 256.0

  $foldPoints = [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new(198 * $scale, 0 * $scale),
    [System.Drawing.PointF]::new(256 * $scale, 0 * $scale),
    [System.Drawing.PointF]::new(256 * $scale, 58 * $scale)
  )

  $slashPoints = [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new(120 * $scale, 58 * $scale),
    [System.Drawing.PointF]::new(156 * $scale, 58 * $scale),
    [System.Drawing.PointF]::new(208 * $scale, 110 * $scale),
    [System.Drawing.PointF]::new(172 * $scale, 110 * $scale)
  )

  $paperBrush = [System.Drawing.SolidBrush]::new($paper)
  $foldBrush = [System.Drawing.SolidBrush]::new($fold)
  $inkBrush = [System.Drawing.SolidBrush]::new($ink)

  try {
    $graphics.FillRectangle($paperBrush, 0, 0, $Size, $Size)
    $graphics.FillPolygon($foldBrush, $foldPoints)
    $graphics.FillRectangle($inkBrush, 70 * $scale, 52 * $scale, 34 * $scale, 152 * $scale)
    $graphics.FillRectangle($inkBrush, 70 * $scale, 170 * $scale, 112 * $scale, 34 * $scale)
    $graphics.FillPolygon($inkBrush, $slashPoints)
  } finally {
    $paperBrush.Dispose()
    $foldBrush.Dispose()
    $inkBrush.Dispose()
    $graphics.Dispose()
  }

  return $bitmap
}

function Get-PngBytes {
  param([System.Drawing.Bitmap]$Bitmap)

  $stream = [System.IO.MemoryStream]::new()
  try {
    $Bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
    return $stream.ToArray()
  } finally {
    $stream.Dispose()
  }
}

function Write-IcoFile {
  param(
    [string]$Path,
    [byte[][]]$Images,
    [int[]]$Sizes
  )

  $file = [System.IO.File]::Create($Path)
  $writer = [System.IO.BinaryWriter]::new($file)

  try {
    $writer.Write([UInt16]0)
    $writer.Write([UInt16]1)
    $writer.Write([UInt16]$Images.Length)

    $offset = 6 + ($Images.Length * 16)
    for ($index = 0; $index -lt $Images.Length; $index++) {
      $size = $Sizes[$index]
      $imageBytes = $Images[$index]

      $writer.Write([byte]($(if ($size -ge 256) { 0 } else { $size })))
      $writer.Write([byte]($(if ($size -ge 256) { 0 } else { $size })))
      $writer.Write([byte]0)
      $writer.Write([byte]0)
      $writer.Write([UInt16]1)
      $writer.Write([UInt16]32)
      $writer.Write([UInt32]$imageBytes.Length)
      $writer.Write([UInt32]$offset)

      $offset += $imageBytes.Length
    }

    foreach ($imageBytes in $Images) {
      $writer.Write($imageBytes)
    }
  } finally {
    $writer.Dispose()
    $file.Dispose()
  }
}

[System.IO.Directory]::CreateDirectory($OutputDir) | Out-Null

$sizes = @(256, 64, 48, 32, 16)
$images = @()

foreach ($size in $sizes) {
  $bitmap = New-BaseBitmap -Size $size
  try {
    if ($size -eq 256) {
      $pngPath = Join-Path $OutputDir "sticky-lupin.png"
      $bitmap.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)
    }

    $images += ,(Get-PngBytes -Bitmap $bitmap)
  } finally {
    $bitmap.Dispose()
  }
}

$icoPath = Join-Path $OutputDir "sticky-lupin.ico"
Write-IcoFile -Path $icoPath -Images $images -Sizes $sizes
