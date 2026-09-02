param(
    [Parameter(Mandatory = $false)]
    [int]$Port = 4173,

    [Parameter(Mandatory = $false)]
    [switch]$StorybookMock,

    [Parameter(Mandatory = $false)]
    [switch]$Stop
)

$appPath = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\MovieDeck'))
$pidFile = Join-Path $env:TEMP "rawi-preview-$Port.pid"
$stdout = Join-Path $env:TEMP "rawi-preview-$Port.stdout.log"
$stderr = Join-Path $env:TEMP "rawi-preview-$Port.stderr.log"

if ($Stop) {
    if (!(Test-Path $pidFile)) {
        Write-Output "Rawi preview is not running on port $Port."
        exit 0
    }

    $processId = [int](Get-Content $pidFile -Raw)
    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$processId" -ErrorAction SilentlyContinue
    if ($process -and $process.CommandLine -match "http\.server\s+$Port") {
        Stop-Process -Id $processId
    }
    Remove-Item -LiteralPath $pidFile -Force
    Write-Output "Stopped Rawi preview on port $Port."
    exit 0
}

$existing = $null
if (Test-Path $pidFile) {
    $existingId = [int](Get-Content $pidFile -Raw)
    $existing = Get-Process -Id $existingId -ErrorAction SilentlyContinue
}

if (!$existing) {
    Remove-Item $stdout, $stderr -Force -ErrorAction SilentlyContinue
    $arguments = @(
        '-m',
        'http.server',
        $Port,
        '--bind',
        '127.0.0.1',
        '--directory',
        "`"$appPath`""
    )
    $process = Start-Process python -ArgumentList $arguments -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
    Set-Content -LiteralPath $pidFile -Value $process.Id
}

$url = "http://127.0.0.1:$Port/"
if ($StorybookMock) {
    $url += '?preview=storybook'
}
$ready = $false
for ($attempt = 0; $attempt -lt 20; $attempt++) {
    try {
        $response = Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 2
        if ($response.StatusCode -eq 200) {
            $ready = $true
            break
        }
    }
    catch {
        Start-Sleep -Milliseconds 250
    }
}

if (!$ready) {
    throw "Rawi preview did not start. See $stderr."
}

$edge = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
if (!(Test-Path $edge)) {
    $edge = "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
}

if (Test-Path $edge) {
    Start-Process $edge -ArgumentList '--new-window', '--window-size=1920,1080', $url
}

Write-Output "Rawi preview: $url"
Write-Output "Storybook mock: .\tools\Start-RawiPreview.ps1 -StorybookMock"
Write-Output "Press F12 for DevTools and refresh the page after edits."
Write-Output "Stop it with: .\tools\Start-RawiPreview.ps1 -Stop"
