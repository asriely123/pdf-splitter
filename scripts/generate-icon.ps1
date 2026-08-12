# 从高分辨率母版生成 PDF分页器 的多尺寸 PNG 与 ICO
# 用法：powershell -ExecutionPolicy Bypass -File scripts\generate-icon.ps1

Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$assetDir = Join-Path $root 'assets'
$sourcePath = Join-Path $assetDir 'icon-master.png'
$sizes = @(16, 24, 32, 48, 64, 128, 256)

if (-not (Test-Path -LiteralPath $sourcePath)) {
    throw "找不到图标母版：$sourcePath"
}

New-Item -ItemType Directory -Force -Path $assetDir | Out-Null
$source = [System.Drawing.Bitmap]::FromFile($sourcePath)
$pngBytes = @()

try {
    foreach ($size in $sizes) {
        $bitmap = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)

        try {
            $graphics.Clear([System.Drawing.Color]::Transparent)
            $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
            $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
            $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
            $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
            $graphics.DrawImage($source, 0, 0, $size, $size)

            $memory = New-Object System.IO.MemoryStream
            try {
                $bitmap.Save($memory, [System.Drawing.Imaging.ImageFormat]::Png)
                $pngBytes += , $memory.ToArray()
            }
            finally {
                $memory.Dispose()
            }

            $pngPath = Join-Path $assetDir ("icon-{0}.png" -f $size)
            $bitmap.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)
        }
        finally {
            $graphics.Dispose()
            $bitmap.Dispose()
        }
    }
}
finally {
    $source.Dispose()
}

# ICO 目录项内嵌 PNG，兼容 Windows Vista 及以上版本。
$icoBytes = @()
$icoBytes += [System.BitConverter]::GetBytes([uint16]0)
$icoBytes += [System.BitConverter]::GetBytes([uint16]1)
$icoBytes += [System.BitConverter]::GetBytes([uint16]$pngBytes.Count)

$offset = 6 + 16 * $pngBytes.Count
for ($index = 0; $index -lt $pngBytes.Count; $index++) {
    $size = $sizes[$index]
    $dimension = if ($size -ge 256) { 0 } else { $size }
    $bytes = $pngBytes[$index]

    $icoBytes += [byte]$dimension
    $icoBytes += [byte]$dimension
    $icoBytes += [byte]0
    $icoBytes += [byte]0
    $icoBytes += [System.BitConverter]::GetBytes([uint16]1)
    $icoBytes += [System.BitConverter]::GetBytes([uint16]32)
    $icoBytes += [System.BitConverter]::GetBytes([uint32]$bytes.Length)
    $icoBytes += [System.BitConverter]::GetBytes([uint32]$offset)
    $offset += $bytes.Length
}

foreach ($bytes in $pngBytes) {
    $icoBytes += $bytes
}

$icoPath = Join-Path $assetDir 'icon.ico'
[System.IO.File]::WriteAllBytes($icoPath, [byte[]]$icoBytes)

Write-Output "icons generated from $sourcePath"
