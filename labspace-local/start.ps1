# Starts the lab as a Labspace whose terminal runs on this machine (Windows, PowerShell 5.1+):
#   - the bridge (bridge/) on http://localhost:8085, natively, with PowerShell
#   - the Labspace interface in a container on http://localhost:3030
# Ctrl-C stops both. Needs Docker only: the bridge is a binary downloaded from the repository's
# releases, and checked against bridge\release.lock (or, without a release, built in a container).
# The same as start.sh, for Windows.
#
#   labspace-local\start.cmd
#
# start.cmd runs this script with -ExecutionPolicy Bypass: Windows doesn't run unsigned scripts by
# default ("running scripts is disabled on this system"). Or, by hand:
#   powershell -ExecutionPolicy Bypass -File labspace-local\start.ps1
#
# Running it again while the Labspace runs is safe: it reuses the running bridge, makes sure the
# interface is up, opens the browser and returns.
#
# Environment: LABSPACE_BRIDGE (a bridge binary to use instead, e.g. one you built),
# LABSPACE_NO_OPEN (don't open the browser), LABSPACE_INTERFACE_IMAGE, BRIDGE_PORT.
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue" # Invoke-WebRequest is much slower with its progress bar

$here = $PSScriptRoot
if (-not $env:BRIDGE_PORT) { $env:BRIDGE_PORT = "8085" }
if (-not $env:LABSPACE_INTERFACE_IMAGE) { $env:LABSPACE_INTERFACE_IMAGE = "dockersamples/labspace-interface:latest" }
$port = [int]$env:BRIDGE_PORT
$url = "http://localhost:3030"
$composeFile = Join-Path $here "compose.yaml"
# The image that builds the bridge when bridge\release.lock names no release
$goImage = "golang:1.25-alpine"

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Write-Error "Docker is required for the Labspace interface."
}

function Invoke-Compose {
  & docker compose -f $composeFile @args
  if ($LASTEXITCODE -ne 0) { throw "docker compose $args failed" }
}

# The token the interface sends to the bridge with every Run and Save. It is kept in a file, so
# that the bridge and the interface of every start agree on it.
$tokenFile = Join-Path $here ".token"
if (-not (Test-Path $tokenFile) -or (Get-Item $tokenFile).Length -eq 0) {
  $bytes = New-Object byte[] 24
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $hex = -join ($bytes | ForEach-Object { $_.ToString("x2") })
  [System.IO.File]::WriteAllText($tokenFile, $hex)
}
$env:LABSPACE_TOKEN = ([System.IO.File]::ReadAllText($tokenFile)).Trim()

# Created here, so that Docker doesn't create index.html as a folder
New-Item -ItemType Directory -Force -Path (Join-Path $here ".content"), (Join-Path $here ".ui") | Out-Null
$index = Join-Path $here ".ui\index.html"
if (-not (Test-Path $index)) { New-Item -ItemType File -Path $index | Out-Null }

function Open-Browser {
  if (-not $env:LABSPACE_NO_OPEN) { Start-Process $url }
}

# Already running? Then the bridge answers its health check: keep it and its shells, make sure the
# interface is up (Compose leaves it alone when nothing changed), and leave the running start in
# charge of stopping everything.
$running = $false
try {
  Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 "http://127.0.0.1:$port/healthz" | Out-Null
  $running = $true
} catch { }
if ($running) {
  Invoke-Compose up -d --pull missing --wait interface content
  Write-Host ""
  Write-Host "Labspace already running: $url"
  Write-Host "Stop it with Ctrl-C where it was started."
  Open-Browser
  exit 0
}
$client = New-Object System.Net.Sockets.TcpClient
try {
  $client.Connect("127.0.0.1", $port)
  Write-Error "Port $port is used by another program: stop it, or start with BRIDGE_PORT set to a free port."
} catch [System.Net.Sockets.SocketException] {
  # free
} finally {
  $client.Dispose()
}

# ---------------------------------------------------------------- the bridge binary

function Get-Bridge {
  if ($env:LABSPACE_BRIDGE) { return $env:LABSPACE_BRIDGE }

  $arch = $null
  try { $arch = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString() } catch { }
  if (-not $arch) { $arch = if ($env:PROCESSOR_ARCHITEW6432) { $env:PROCESSOR_ARCHITEW6432 } else { $env:PROCESSOR_ARCHITECTURE } }
  switch -Regex ($arch) {
    "^(X64|AMD64)$" { $arch = "amd64" }
    "^ARM64$" { $arch = "arm64" }
    default { throw "No bridge for $arch." }
  }
  $name = "labspace-bridge-windows-$arch.exe"

  $lock = @{}
  $sums = @{}
  foreach ($line in Get-Content (Join-Path $here "bridge\release.lock")) {
    if ($line -match "^\s*#" -or -not $line.Trim()) { continue }
    $parts = $line.Trim() -split "\s+", 2
    if ($parts[0] -eq "repo" -or $parts[0] -eq "version") { $lock[$parts[0]] = if ($parts.Count -gt 1) { $parts[1] } else { "" } }
    elseif ($parts.Count -eq 2) { $sums[$parts[1]] = $parts[0].ToLower() }
  }

  if (-not $lock["version"]) {
    # No release yet: build it from source, in the Go image (Go isn't needed on your machine).
    # The Go caches are kept in a volume, so later builds take seconds.
    Write-Host "Building the bridge..."
    $out = Join-Path $here ".bin"
    New-Item -ItemType Directory -Force -Path $out | Out-Null
    # No double quotes: PowerShell 5.1 mangles them in the arguments of a program
    $script = 'go generate ./... && GOOS=${TARGET%/*} GOARCH=${TARGET#*/} go build -trimpath -o /out/$BIN .'
    & docker run --rm `
      -v "$(Join-Path $here 'bridge'):/src" -v "${out}:/out" -v labspace-bridge-go-cache:/cache -w /src `
      -e GOCACHE=/cache/build -e GOMODCACHE=/cache/mod -e CGO_ENABLED=0 -e "TARGET=windows/$arch" `
      -e BIN=labspace-bridge-dev.exe `
      $goImage sh -c $script
    if ($LASTEXITCODE -ne 0) { throw "building the bridge failed" }
    return (Join-Path $out "labspace-bridge-dev.exe")
  }
  $expected = $sums[$name]
  if (-not $expected) { throw "bridge\release.lock has no checksum for $name." }

  $version = $lock["version"]
  $bin = Join-Path $here ".bin\$version\$name"
  $current = if (Test-Path $bin) { (Get-FileHash -Algorithm SHA256 $bin).Hash.ToLower() } else { "" }
  if ($current -ne $expected) {
    Write-Host "Downloading the bridge $version ($name)..."
    New-Item -ItemType Directory -Force -Path (Split-Path $bin) | Out-Null
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
    $part = "$bin.part"
    Invoke-WebRequest -UseBasicParsing -OutFile $part "https://github.com/$($lock['repo'])/releases/download/$version/$name"
    if ((Get-FileHash -Algorithm SHA256 $part).Hash.ToLower() -ne $expected) {
      Remove-Item -Force $part
      throw "The downloaded bridge doesn't match its checksum in bridge\release.lock: not using it."
    }
    Move-Item -Force $part $bin
  }
  return $bin
}

$bridgeBin = Get-Bridge

# The shells start in the root of the repository
if (-not $env:LABSPACE_WORKSPACE) { $env:LABSPACE_WORKSPACE = (Resolve-Path (Join-Path $here "..")).Path }

$bridge = $null
try {
  # In this console: its output shows here, and Ctrl-C reaches it too
  $bridge = Start-Process -FilePath $bridgeBin -NoNewWindow -PassThru
  Invoke-Compose up -d --pull missing --wait interface content

  Write-Host ""
  Write-Host "Labspace ready: $url"
  Write-Host "The right panel is a terminal on this machine. Ctrl-C to stop."
  Open-Browser

  # A loop, not WaitForExit(): Ctrl-C interrupts Start-Sleep
  while (-not $bridge.HasExited) { Start-Sleep -Milliseconds 500 }
} finally {
  Write-Host ""
  Write-Host "Stopping..."
  # Compose writes its progress to stderr, which "Stop" would turn into an error in PowerShell 5.1
  $ErrorActionPreference = "Continue"
  & docker compose -f $composeFile down --remove-orphans 2>&1 | Out-Null
  if ($bridge -and -not $bridge.HasExited) { Stop-Process -Id $bridge.Id -Force -ErrorAction SilentlyContinue }
}
