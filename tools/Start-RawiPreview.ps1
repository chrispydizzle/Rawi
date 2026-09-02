param(
    [Parameter(Mandatory = $false)]
    [int]$Port = 4173,

    [Parameter(Mandatory = $false)]
    [switch]$StorybookMock,

    [Parameter(Mandatory = $false)]
    [ValidateSet('home', 'library', 'details', 'ending')]
    [string]$StorybookScreen = 'home',

    [Parameter(Mandatory = $false)]
    [string]$StorybookLibraryId,

    [Parameter(Mandatory = $false)]
    [string]$StorybookItemId,

    [Parameter(Mandatory = $false)]
    [switch]$Stop
)

$appPath = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\MovieDeck'))
$pidFile = Join-Path $env:TEMP "rawi-preview-$Port.pid"
$stdout = Join-Path $env:TEMP "rawi-preview-$Port.stdout.log"
$stderr = Join-Path $env:TEMP "rawi-preview-$Port.stderr.log"

function Get-RawiPreviewListener {
    param(
        [Parameter(Mandatory = $true)]
        [int]$Port,

        [Parameter(Mandatory = $true)]
        [string]$AppPath,

        [int[]]$ExcludeProcessIds = @()
    )

    $connections = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue
    foreach ($connection in $connections) {
        if ($ExcludeProcessIds -contains $connection.OwningProcess) {
            continue
        }

        $process = Get-CimInstance Win32_Process -Filter "ProcessId=$($connection.OwningProcess)" -ErrorAction SilentlyContinue
        if (
            $process -and
            $process.CommandLine -match "http\.server\s+$Port" -and
            $process.CommandLine -like "*$AppPath*"
        ) {
            return $process
        }
    }

    return $null
}

if ($Stop) {
    if (!(Test-Path $pidFile)) {
        Write-Output "Rawi preview is not running on port $Port."
        exit 0
    }

    $processId = [int](Get-Content $pidFile -Raw)
    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$processId" -ErrorAction SilentlyContinue
    if (!($process -and $process.CommandLine -match "http\.server\s+$Port")) {
        $process = Get-RawiPreviewListener -Port $Port -AppPath $appPath
        if ($process) {
            $processId = $process.ProcessId
        }
    }
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

$preExistingListenerIds = @(
    Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique
)
if (!$existing -and $preExistingListenerIds.Count -gt 0) {
    throw "Port $Port is already in use. Stop the existing listener or choose another port."
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
}

$url = "http://127.0.0.1:$Port/"
if ($StorybookMock) {
    $query = @('preview=storybook')
    if ($StorybookScreen -and $StorybookScreen -ne 'home') {
        $query += 'storybookScreen=' + [uri]::EscapeDataString($StorybookScreen)
    }
    if ($StorybookLibraryId) {
        $query += 'storybookLibraryId=' + [uri]::EscapeDataString($StorybookLibraryId)
    }
    if ($StorybookItemId) {
        $query += 'storybookItemId=' + [uri]::EscapeDataString($StorybookItemId)
    }
    $url += '?' + ($query -join '&')
}
$ready = $false
for ($attempt = 0; $attempt -lt 20; $attempt++) {
    try {
        $listener = Get-RawiPreviewListener -Port $Port -AppPath $appPath -ExcludeProcessIds $preExistingListenerIds
        $response = Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 2
        if ($response.StatusCode -eq 200 -and $listener) {
            $ready = $true
            Set-Content -LiteralPath $pidFile -Value $listener.ProcessId
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
