[CmdletBinding()]
param(
    [string]$Target,
    [string]$SigningProfile,
    [switch]$PackageOnly,
    [switch]$NoVersionIncrement,
    [switch]$Launch
)

$ErrorActionPreference = 'Stop'

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$localConfigPath = Join-Path $repositoryRoot 'rawi.local.json'
if (Test-Path -LiteralPath $localConfigPath) {
    $localConfigText = Get-Content -LiteralPath $localConfigPath -Raw -Encoding UTF8
    if ([string]::IsNullOrWhiteSpace($localConfigText) -or -not $localConfigText.TrimStart().StartsWith('{')) {
        throw "Local configuration '$localConfigPath' must contain a JSON object."
    }
    try {
        $localConfig = $localConfigText | ConvertFrom-Json -ErrorAction Stop
    } catch {
        throw "Invalid JSON in '$localConfigPath': $($_.Exception.Message)"
    }
    foreach ($property in $localConfig.PSObject.Properties) {
        if ($property.Name -notin @('target', 'signingProfile')) {
            throw "Unknown local setting '$($property.Name)' in '$localConfigPath'."
        }
        if ($property.Value -isnot [string]) {
            throw "Local setting '$($property.Name)' must be a string in '$localConfigPath'."
        }
    }
    if (-not $PSBoundParameters.ContainsKey('Target')) {
        $Target = $localConfig.target
    }
    if (-not $PSBoundParameters.ContainsKey('SigningProfile')) {
        $SigningProfile = $localConfig.signingProfile
    }
}

if (-not $PackageOnly -and [string]::IsNullOrWhiteSpace($Target)) {
    throw "Specify -Target or set 'target' in rawi.local.json (for example 192.0.2.10:26101)."
}
if ([string]::IsNullOrWhiteSpace($SigningProfile)) {
    throw "Specify -SigningProfile or set 'signingProfile' in rawi.local.json to a Tizen certificate profile."
}

$projectPath = Join-Path $repositoryRoot 'MovieDeck'
$distPath = Join-Path $repositoryRoot 'dist'
$configPath = Join-Path $projectPath 'config.xml'
$apiPath = Join-Path $projectPath 'js\api.js'
$licensePath = Join-Path $repositoryRoot 'LICENSE'
$noticesPath = Join-Path $repositoryRoot 'THIRD_PARTY_NOTICES.md'
$tizenPath = Join-Path $env:USERPROFILE 'tizen-studio\tools\ide\bin\tizen.bat'
$sdbPath = Join-Path $env:USERPROFILE 'tizen-studio\tools\sdb.exe'
$packageName = 'Rawi.wgt'
$packagePath = Join-Path $distPath $packageName
$applicationId = 'JfMovieTV1.MovieDeck'

function Invoke-NativeCommand {
    param(
        [Parameter(Mandatory)]
        [string]$Executable,

        [Parameter(Mandatory)]
        [string[]]$Arguments
    )

    & $Executable @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "'$Executable' failed with exit code $LASTEXITCODE."
    }
}

function Update-RawiVersion {
    $configContent = [System.IO.File]::ReadAllText($configPath)
    $versionMatch = [regex]::Match($configContent, 'version="(\d+)\.(\d+)\.(\d+)"')
    if (-not $versionMatch.Success) {
        throw "Could not find the widget version in '$configPath'."
    }

    $major = [int]$versionMatch.Groups[1].Value
    $minor = [int]$versionMatch.Groups[2].Value
    $patch = [int]$versionMatch.Groups[3].Value + 1
    $newVersion = "$major.$minor.$patch"

    $configContent = $configContent.Remove(
        $versionMatch.Groups[1].Index,
        $versionMatch.Groups[1].Length + $versionMatch.Groups[2].Length +
            $versionMatch.Groups[3].Length + 2
    ).Insert($versionMatch.Groups[1].Index, $newVersion)

    $apiContent = [System.IO.File]::ReadAllText($apiPath)
    $clientVersionPattern = "var CLIENT_VERSION = '[^']+';"
    if (-not [regex]::IsMatch($apiContent, $clientVersionPattern)) {
        throw "Could not find CLIENT_VERSION in '$apiPath'."
    }

    $apiContent = [regex]::Replace(
        $apiContent,
        $clientVersionPattern,
        "var CLIENT_VERSION = '$newVersion';",
        1
    )

    [System.IO.File]::WriteAllText($configPath, $configContent)
    [System.IO.File]::WriteAllText($apiPath, $apiContent)

    return $newVersion
}

foreach ($requiredPath in @($projectPath, $configPath, $apiPath, $tizenPath, $sdbPath, $licensePath, $noticesPath)) {
    if (-not (Test-Path $requiredPath)) {
        throw "Required path not found: $requiredPath"
    }
}

New-Item -ItemType Directory -Path $distPath -Force | Out-Null

Copy-Item -LiteralPath $licensePath -Destination (Join-Path $projectPath 'LICENSE') -Force
Copy-Item -LiteralPath $noticesPath -Destination (Join-Path $projectPath 'THIRD_PARTY_NOTICES.md') -Force

if ($NoVersionIncrement) {
    $versionMatch = [regex]::Match(
        [System.IO.File]::ReadAllText($configPath),
        '<widget[\s\S]*?\sversion="([^"]+)"'
    )
    if (-not $versionMatch.Success) {
        throw "Could not find the widget version in '$configPath'."
    }

    $version = $versionMatch.Groups[1].Value
} else {
    $version = Update-RawiVersion
}

if (Test-Path $packagePath) {
    Remove-Item $packagePath -Force
}

Write-Host "Packaging Rawi $version..."
Invoke-NativeCommand $tizenPath @(
    'package',
    '-t', 'wgt',
    '-s', $SigningProfile,
    '-o', $distPath,
    '--', $projectPath
)

if (-not (Test-Path $packagePath)) {
    throw "Packaging completed without creating '$packagePath'."
}

if ($PackageOnly) {
    Write-Host "Package ready: $packagePath"
    exit 0
}

$devices = & $sdbPath devices
if ($LASTEXITCODE -ne 0) {
    throw "Could not list Tizen devices."
}

if ($devices -notmatch [regex]::Escape($Target)) {
    Write-Host "Connecting to Samsung TV at $Target..."
    Invoke-NativeCommand $sdbPath @('connect', $Target)
}

Write-Host "Installing Rawi $version on $Target..."
Invoke-NativeCommand $tizenPath @(
    'install',
    '-n', $packageName,
    '-s', $Target,
    '--', $distPath
)

if ($Launch) {
    Write-Host 'Launching Rawi...'
    Invoke-NativeCommand $tizenPath @(
        'run',
        '-p', $applicationId,
        '-s', $Target
    )
    Write-Host "Rawi $version is installed and running."
} else {
    Write-Host "Rawi $version is installed. Open it on the TV or deploy with -Launch."
}
