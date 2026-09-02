param(
    [Parameter(Mandatory = $false)]
    [int]$Port = 4173,

    [Parameter(Mandatory = $false)]
    [switch]$StorybookMock,

    [Parameter(Mandatory = $false)]
    [ValidateSet('home', 'library', 'category', 'details', 'magic', 'settings', 'ending')]
    [string]$StorybookScreen = 'home',

    [Parameter(Mandatory = $false)]
    [string]$StorybookCategoryKey,

    [Parameter(Mandatory = $false)]
    [string]$StorybookLibraryId,

    [Parameter(Mandatory = $false)]
    [string]$StorybookItemId,

    [Parameter(Mandatory = $false)]
    [switch]$NoBrowser,

    [Parameter(Mandatory = $false)]
    [switch]$Stop
)

$ErrorActionPreference = 'Stop'
$appPath = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\MovieDeck'))
$previewPaths = $null

function Get-RawiPreviewTempRoot {
    $basePath = $env:TEMP
    if ([string]::IsNullOrWhiteSpace($basePath)) {
        $basePath = $env:TMP
    }
    if ([string]::IsNullOrWhiteSpace($basePath)) {
        $basePath = [System.IO.Path]::GetTempPath()
    }

    return [System.IO.Path]::GetFullPath((Join-Path $basePath 'rawi-preview'))
}

function Get-RawiPreviewOwnerToken {
    param(
        [Parameter(Mandatory = $true)]
        [string]$AppPath,

        [Parameter(Mandatory = $true)]
        [int]$Port
    )

    $hashInput = ($AppPath + '|' + $Port).ToLowerInvariant()
    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($hashInput)
        $hash = $sha256.ComputeHash($bytes)
    }
    finally {
        $sha256.Dispose()
    }

    return ([BitConverter]::ToString($hash)).Replace('-', '').Substring(0, 16).ToLowerInvariant()
}

function Get-RawiPreviewPaths {
    param(
        [Parameter(Mandatory = $true)]
        [string]$AppPath,

        [Parameter(Mandatory = $true)]
        [int]$Port
    )

    $root = Get-RawiPreviewTempRoot
    $ownerToken = Get-RawiPreviewOwnerToken -AppPath $AppPath -Port $Port

    if (!(Test-Path $root)) {
        New-Item -ItemType Directory -Path $root -Force | Out-Null
    }

    return [pscustomobject]@{
        Metadata = Join-Path $root ("rawi-preview-$ownerToken.json")
        OwnerToken = $ownerToken
        Root = $root
        StdErr = Join-Path $root ("rawi-preview-$ownerToken.stderr.log")
        StdOut = Join-Path $root ("rawi-preview-$ownerToken.stdout.log")
    }
}

function Get-RawiPreviewProcess {
    param(
        [Parameter(Mandatory = $true)]
        [int]$ProcessId
    )

    return Get-CimInstance Win32_Process -Filter "ProcessId=$ProcessId" -ErrorAction SilentlyContinue
}

function Get-RawiPreviewCommandDetails {
    param(
        [Parameter(Mandatory = $false)]
        [string]$CommandLine
    )

    $details = [ordered]@{
        AppPath = ''
        CommandLine = $CommandLine
        IsHttpServer = $false
        Port = $null
    }
    $pathMatch = $null
    $rawPath = ''
    $portMatch = $null

    if (![string]::IsNullOrWhiteSpace($CommandLine)) {
        $portMatch = [regex]::Match($CommandLine, '(?i)http\.server\s+(\d+)')
        if ($portMatch.Success) {
            $details.Port = [int]$portMatch.Groups[1].Value
            $details.IsHttpServer = $true
        }

        $pathMatch = [regex]::Match($CommandLine, '(?i)--directory\s+(?:"([^"]+)"|(\S+))')
        if ($pathMatch.Success) {
            $rawPath = $pathMatch.Groups[1].Value
            if ([string]::IsNullOrWhiteSpace($rawPath)) {
                $rawPath = $pathMatch.Groups[2].Value
            }
            if (![string]::IsNullOrWhiteSpace($rawPath)) {
                $details.AppPath = [System.IO.Path]::GetFullPath($rawPath)
            }
        }
    }

    return [pscustomobject]$details
}

function Test-RawiPreviewProcessOwnership {
    param(
        [Parameter(Mandatory = $true)]
        [object]$Process,

        [Parameter(Mandatory = $true)]
        [string]$AppPath,

        [Parameter(Mandatory = $true)]
        [int]$Port,

        [Parameter(Mandatory = $false)]
        [object]$State
    )

    $commandDetails = $null

    if (!$Process) {
        return $false
    }

    $commandDetails = Get-RawiPreviewCommandDetails -CommandLine $Process.CommandLine
    if (!$commandDetails.IsHttpServer) {
        return $false
    }
    if ($commandDetails.Port -ne $Port) {
        return $false
    }
    if (!$commandDetails.AppPath -or $commandDetails.AppPath -ne $AppPath) {
        return $false
    }

    if ($State) {
        if ([int]$State.ProcessId -ne [int]$Process.ProcessId) {
            return $false
        }
        if ([int]$State.Port -ne $Port) {
            return $false
        }
        if ([string]$State.AppPath -ne $AppPath) {
            return $false
        }
        if ([string]$State.CommandLine -ne [string]$Process.CommandLine) {
            return $false
        }
    }

    return $true
}

function Get-RawiPreviewListeners {
    param(
        [Parameter(Mandatory = $true)]
        [int]$Port
    )

    $connections = @(
        Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue |
            Select-Object -ExpandProperty OwningProcess -Unique
    )
    $listeners = @()
    $process = $null

    foreach ($processId in $connections) {
        $process = Get-RawiPreviewProcess -ProcessId $processId
        if ($process) {
            $listeners += $process
        }
    }

    return $listeners
}

function Get-RawiPreviewOwnedListener {
    param(
        [Parameter(Mandatory = $true)]
        [int]$Port,

        [Parameter(Mandatory = $true)]
        [string]$AppPath
    )

    foreach ($listener in (Get-RawiPreviewListeners -Port $Port)) {
        if (Test-RawiPreviewProcessOwnership -Process $listener -AppPath $AppPath -Port $Port) {
            return $listener
        }
    }

    return $null
}

function Get-RawiPreviewState {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    if (!(Test-Path $Path)) {
        return $null
    }

    try {
        return (Get-Content -LiteralPath $Path -Raw) | ConvertFrom-Json
    }
    catch {
        return $null
    }
}

function Remove-RawiPreviewState {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    Remove-Item -LiteralPath $Path -Force -ErrorAction SilentlyContinue
}

function Write-RawiPreviewState {
    param(
        [Parameter(Mandatory = $true)]
        [object]$Paths,

        [Parameter(Mandatory = $true)]
        [object]$Process,

        [Parameter(Mandatory = $true)]
        [string]$AppPath,

        [Parameter(Mandatory = $true)]
        [int]$Port
    )

    $launcher = Get-RawiPreviewLauncherProcess -Process $Process -AppPath $AppPath -Port $Port
    $state = [ordered]@{
        AppPath = $AppPath
        CommandLine = $Process.CommandLine
        LauncherCommandLine = $launcher.CommandLine
        LauncherProcessId = [int]$launcher.ProcessId
        OwnerToken = $Paths.OwnerToken
        Port = $Port
        ProcessId = [int]$Process.ProcessId
        StdErrPath = $Paths.StdErr
        StdOutPath = $Paths.StdOut
    }

    Set-Content -LiteralPath $Paths.Metadata -Value ($state | ConvertTo-Json -Depth 3)
    return [pscustomobject]$state
}

function Format-RawiPreviewProcessOwner {
    param(
        [Parameter(Mandatory = $true)]
        [object]$Process
    )

    $details = Get-RawiPreviewCommandDetails -CommandLine $Process.CommandLine

    if ($details.AppPath) {
        return "PID $($Process.ProcessId) for '$($details.AppPath)'"
    }

    return "PID $($Process.ProcessId)"
}

$previewPaths = Get-RawiPreviewPaths -AppPath $appPath -Port $Port

function Get-RawiPreviewLauncherProcess {
    param(
        [Parameter(Mandatory = $true)]
        [object]$Process,

        [Parameter(Mandatory = $true)]
        [string]$AppPath,

        [Parameter(Mandatory = $true)]
        [int]$Port
    )

    $current = $Process
    $launcher = $Process
    $parent = $null

    while ($current -and [int]$current.ParentProcessId -gt 0) {
        $parent = Get-RawiPreviewProcess -ProcessId ([int]$current.ParentProcessId)
        if (!$parent) {
            break
        }
        if (!(Test-RawiPreviewProcessOwnership -Process $parent -AppPath $AppPath -Port $Port)) {
            break
        }

        $launcher = $parent
        $current = $parent
    }

    return $launcher
}

function Get-RawiPreviewValidState {
    param(
        [Parameter(Mandatory = $true)]
        [object]$Paths,

        [Parameter(Mandatory = $true)]
        [string]$AppPath,

        [Parameter(Mandatory = $true)]
        [int]$Port
    )

    $state = Get-RawiPreviewState -Path $Paths.Metadata

    if (!$state) {
        Remove-RawiPreviewState -Path $Paths.Metadata
        return $null
    }

    if (
        [string]$state.OwnerToken -ne $Paths.OwnerToken -or
        [string]$state.AppPath -ne $AppPath -or
        [int]$state.Port -ne $Port
    ) {
        Remove-RawiPreviewState -Path $Paths.Metadata
        return $null
    }

    return $state
}

if ($Stop) {
    $state = Get-RawiPreviewValidState -Paths $previewPaths -AppPath $appPath -Port $Port
    $listeners = @(Get-RawiPreviewListeners -Port $Port)
    $ownedListener = $null
    $process = $null

    foreach ($listener in $listeners) {
        if (Test-RawiPreviewProcessOwnership -Process $listener -AppPath $appPath -Port $Port) {
            $ownedListener = $listener
            break
        }
    }

    if (!$state) {
        if ($ownedListener) {
            throw "Rawi preview on port $Port for '$appPath' is missing matching ownership metadata. Refusing to stop PID $($ownedListener.ProcessId)."
        }
        if ($listeners.Count -gt 0) {
            throw "Port $Port is already in use by $(Format-RawiPreviewProcessOwner -Process $listeners[0]). Rawi preview will not stop or reuse a different AppPath."
        }

        Write-Output "Rawi preview is not running on port $Port."
        exit 0
    }

    $process = Get-RawiPreviewProcess -ProcessId ([int]$state.ProcessId)
    if (
        $process -and
        ($listeners | Where-Object { $_.ProcessId -eq $process.ProcessId }) -and
        (Test-RawiPreviewProcessOwnership -Process $process -AppPath $appPath -Port $Port -State $state)
    ) {
        $launcher = $null

        if ($state.LauncherProcessId) {
            $launcher = Get-RawiPreviewProcess -ProcessId ([int]$state.LauncherProcessId)
        }

        if (
            $launcher -and
            [int]$launcher.ProcessId -ne [int]$process.ProcessId -and
            (Test-RawiPreviewProcessOwnership -Process $launcher -AppPath $appPath -Port $Port) -and
            [string]$state.LauncherCommandLine -eq [string]$launcher.CommandLine
        ) {
            Stop-Process -Id ([int]$launcher.ProcessId) -Force
            Start-Sleep -Milliseconds 100
            $process = Get-RawiPreviewProcess -ProcessId ([int]$state.ProcessId)
        }

        if ($process) {
            Stop-Process -Id ([int]$process.ProcessId) -Force
        }

        Remove-RawiPreviewState -Path $previewPaths.Metadata
        Write-Output "Stopped Rawi preview on port $Port."
        exit 0
    }

    Remove-RawiPreviewState -Path $previewPaths.Metadata
    if ($listeners.Count -gt 0) {
        throw "Recorded preview state for '$appPath' on port $Port did not match the running listener and was cleaned. No process was stopped; port $Port is still owned by $(Format-RawiPreviewProcessOwner -Process $listeners[0])."
    }

    Write-Output "Rawi preview is not running on port $Port."
    exit 0
}

$state = Get-RawiPreviewValidState -Paths $previewPaths -AppPath $appPath -Port $Port
$listeners = @(Get-RawiPreviewListeners -Port $Port)
$listener = $null
$ready = $false
$response = $null

if ($state) {
    $candidate = Get-RawiPreviewProcess -ProcessId ([int]$state.ProcessId)
    if (
        $candidate -and
        ($listeners | Where-Object { $_.ProcessId -eq $candidate.ProcessId }) -and
        (Test-RawiPreviewProcessOwnership -Process $candidate -AppPath $appPath -Port $Port -State $state)
    ) {
        $listener = $candidate
    }
    else {
        Remove-RawiPreviewState -Path $previewPaths.Metadata
        $state = $null
    }
}

if (!$listener) {
    foreach ($candidate in $listeners) {
        if (Test-RawiPreviewProcessOwnership -Process $candidate -AppPath $appPath -Port $Port) {
            $listener = $candidate
            Write-RawiPreviewState -Paths $previewPaths -Process $listener -AppPath $appPath -Port $Port | Out-Null
            break
        }
    }
}

if (!$listener -and $listeners.Count -gt 0) {
    throw "Port $Port is already in use by $(Format-RawiPreviewProcessOwner -Process $listeners[0]). Rawi preview will not stop or reuse a different AppPath."
}

if (!$listener) {
    Remove-Item -LiteralPath $previewPaths.StdOut, $previewPaths.StdErr -Force -ErrorAction SilentlyContinue
    $arguments = @(
        '-m',
        'http.server',
        $Port,
        '--bind',
        '127.0.0.1',
        '--directory',
        "`"$appPath`""
    )
    Start-Process python -ArgumentList $arguments -WindowStyle Hidden -RedirectStandardOutput $previewPaths.StdOut -RedirectStandardError $previewPaths.StdErr -PassThru | Out-Null
}

$url = "http://127.0.0.1:$Port/"
if ($StorybookMock) {
    $query = @('preview=storybook')
    if ($StorybookScreen -and $StorybookScreen -ne 'home') {
        $query += 'storybookScreen=' + [uri]::EscapeDataString($StorybookScreen)
    }
    if ($StorybookCategoryKey) {
        $query += 'storybookCategoryKey=' + [uri]::EscapeDataString($StorybookCategoryKey)
    }
    if ($StorybookLibraryId) {
        $query += 'storybookLibraryId=' + [uri]::EscapeDataString($StorybookLibraryId)
    }
    if ($StorybookItemId) {
        $query += 'storybookItemId=' + [uri]::EscapeDataString($StorybookItemId)
    }
    $url += '?' + ($query -join '&')
}

for ($attempt = 0; $attempt -lt 20; $attempt++) {
    try {
        $listener = Get-RawiPreviewOwnedListener -Port $Port -AppPath $appPath
        $response = Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 2
        if ($response.StatusCode -eq 200 -and $listener) {
            $ready = $true
            Write-RawiPreviewState -Paths $previewPaths -Process $listener -AppPath $appPath -Port $Port | Out-Null
            break
        }
    }
    catch {
        Start-Sleep -Milliseconds 250
    }
}

if (!$ready) {
    throw "Rawi preview did not start. See $($previewPaths.StdErr)."
}

if (!$NoBrowser) {
    $edge = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
    if (!(Test-Path $edge)) {
        $edge = "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
    }

    if (Test-Path $edge) {
        Start-Process $edge -ArgumentList '--new-window', '--window-size=1920,1080', $url
    }
}

Write-Output "Rawi preview: $url"
Write-Output "Storybook mock: .\tools\Start-RawiPreview.ps1 -StorybookMock"
Write-Output "Press F12 for DevTools and refresh the page after edits."
Write-Output "Stop it with: .\tools\Start-RawiPreview.ps1 -Stop"
