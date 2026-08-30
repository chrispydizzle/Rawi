param(
    [Parameter(Mandatory = $false)]
    [string]$OutputPath = (Join-Path $PSScriptRoot '..\MovieDeck\icon.png')
)

Add-Type -AssemblyName System.Drawing

$size = 512
$bitmap = [System.Drawing.Bitmap]::new($size, $size)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$background = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#09131D'))
$accent = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#EFA451'))
$foreground = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#EDF2F5'))
$font = [System.Drawing.Font]::new('Bahnschrift SemiBold Condensed', 178, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)

try {
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $graphics.FillRectangle($background, 0, 0, $size, $size)

    $graphics.FillRectangle($accent, 92, 82, 42, 349)
    $graphics.FillRectangle($accent, 164, 143, 42, 229)
    $graphics.DrawString('R', $font, $foreground, 246, 164)

    $resolvedOutput = [System.IO.Path]::GetFullPath($OutputPath)
    [System.IO.Directory]::CreateDirectory([System.IO.Path]::GetDirectoryName($resolvedOutput)) | Out-Null
    $bitmap.Save($resolvedOutput, [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Output $resolvedOutput
}
finally {
    $font.Dispose()
    $foreground.Dispose()
    $accent.Dispose()
    $background.Dispose()
    $graphics.Dispose()
    $bitmap.Dispose()
}
