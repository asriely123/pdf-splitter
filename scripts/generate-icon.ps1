# 生成 PDF分页器 应用图标：多尺寸 PNG + 单文件 ICO
# 用法：powershell -ExecutionPolicy Bypass -File scripts\generate-icon.ps1

Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$assetDir = Join-Path $root 'assets'
New-Item -ItemType Directory -Force -Path $assetDir | Out-Null

$sizes = @(16, 24, 32, 48, 64, 128, 256)
$pngBytes = @()

function Fill-RoundedRect($g, $brush, $x, $y, $w, $h, $r) {
    $d = $r * 2
    $g.FillRectangle($brush, $x, $y + $r, $w, $h - $d)
    $g.FillRectangle($brush, $x + $r, $y, $w - $d, $h)
    $g.FillEllipse($brush, $x, $y, $d, $d)
    $g.FillEllipse($brush, $x + $w - $d, $y, $d, $d)
    $g.FillEllipse($brush, $x, $y + $h - $d, $d, $d)
    $g.FillEllipse($brush, $x + $w - $d, $y + $h - $d, $d, $d)
}

foreach ($s in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap($s, $s)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.Clear([System.Drawing.Color]::Transparent)

    # 粉色圆角方块背景
    $radius = [Math]::Max(2, [Math]::Round($s * 0.22))
    $bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 245, 168, 198))
    Fill-RoundedRect $g $bgBrush 0 0 $s $s $radius

    # 白色书本
    $bx = $s * 0.21
    $by = $s * 0.21
    $bw = $s * 0.58
    $bh = $s * 0.58
    $bookRadius = [Math]::Max(1, [Math]::Round($s * 0.08))
    Fill-RoundedRect $g ([System.Drawing.Brushes]::White) $bx $by $bw $bh $bookRadius

    # 中间书脊（分页线）
    $penWidth = [Math]::Max(1, [Math]::Round($s * 0.05))
    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 239, 143, 187), $penWidth)
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $cx = $s * 0.5
    $g.DrawLine($pen, [single]$cx, [single]($by + $bh * 0.13), [single]$cx, [single]($by + $bh * 0.87))

    # 左右文字行（错开表示切分后的内容）
    $lx1 = $bx + $bw * 0.16
    $lx2 = $cx - $s * 0.05
    $rx1 = $cx + $s * 0.05
    $rx2 = $bx + $bw * 0.84
    $rows = @(
        @($lx1, $lx2, $by + $bh * 0.30),
        @($rx1, $rx2, $by + $bh * 0.44),
        @($lx1, $lx2, $by + $bh * 0.58),
        @($rx1, $rx2, $by + $bh * 0.72)
    )
    foreach ($row in $rows) {
        $g.DrawLine($pen, [single]$row[0], [single]$row[2], [single]$row[1], [single]$row[2])
    }

    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $pngBytes += , $ms.ToArray()

    $pngPath = Join-Path $assetDir ("icon-{0}.png" -f $s)
    $bmp.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)

    $g.Dispose()
    $bmp.Dispose()
    $ms.Dispose()
    $bgBrush.Dispose()
}

# 封装 ICO（Vista+ 支持 PNG 压缩条目）
$count = $pngBytes.Count
$ms = New-Object System.IO.MemoryStream
$bw = New-Object System.IO.BinaryWriter($ms)
$bw.Write([uint16]0)
$bw.Write([uint16]1)
$bw.Write([uint16]$count)

$offset = 6 + 16 * $count
for ($i = 0; $i -lt $count; $i++) {
    $s = $sizes[$i]
    $dim = if ($s -ge 256) { 0 } else { $s }
    $b = $pngBytes[$i]
    $bw.Write([byte]$dim)
    $bw.Write([byte]$dim)
    $bw.Write([byte]0)
    $bw.Write([byte]0)
    $bw.Write([uint16]1)
    $bw.Write([uint16]32)
    $bw.Write([uint32]$b.Length)
    $bw.Write([uint32]$offset)
    $offset += $b.Length
}

foreach ($b in $pngBytes) {
    $bw.Write($b)
}
$bw.Flush()
$icoPath = Join-Path $assetDir 'icon.ico'
[System.IO.File]::WriteAllBytes($icoPath, $ms.ToArray())
$bw.Dispose()
$ms.Dispose()

Write-Output "icons generated: $icoPath"
