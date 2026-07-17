[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateSet('install', 'change', 'launch', 'attach', 'status', 'capture', 'restore', 'uninstall')]
    [string]$Command = 'status',

    [Parameter(Position = 1)]
    [string]$Path,

    [ValidateRange(0.0, 0.9)]
    [double]$Overlay = 0.30,

    [ValidateSet('cover', 'contain', 'fill')]
    [string]$Fit = 'cover',

    [string]$Position = 'center center',

    [switch]$Json
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$script:Version = '0.3.4'
$script:AppRoot = Join-Path $env:LOCALAPPDATA 'CodexSkin'
$script:RuntimeRoot = Join-Path $script:AppRoot 'runtime'
$script:AssetsRoot = Join-Path $script:AppRoot 'assets'
$script:ConfigPath = Join-Path $script:AppRoot 'config.json'
$script:StatePath = Join-Path $script:AppRoot 'agent-state.json'
$script:InstalledCliPath = Join-Path $script:RuntimeRoot 'codex-skin.ps1'
$script:InstalledAgentPath = Join-Path $script:RuntimeRoot 'codex-skin-agent.mjs'
$script:InstalledLauncherSourcePath = Join-Path $script:RuntimeRoot 'CodexSkinLauncher.cs'
$script:LauncherPath = Join-Path $script:AppRoot 'CodexSkinLauncher.exe'
$script:IconPath = Join-Path $script:AppRoot 'codex.ico'
$script:ShortcutName = 'Codex Skin.lnk'
$script:StartMenuShortcut = Join-Path ([Environment]::GetFolderPath('Programs')) $script:ShortcutName
$script:DesktopShortcut = Join-Path ([Environment]::GetFolderPath('Desktop')) $script:ShortcutName

function Write-Result {
    param([Parameter(Mandatory)]$Value)
    if ($Json) {
        $Value | ConvertTo-Json -Depth 8
    } else {
        $Value | Format-List
    }
}

function Get-NodePath {
    $node = Get-Command node -ErrorAction SilentlyContinue
    if (-not $node) {
        throw 'Node.js 22 or newer is required but node.exe was not found in PATH.'
    }
    $versionText = & $node.Source --version
    $major = [int](($versionText -replace '^v', '').Split('.')[0])
    if ($major -lt 22) {
        throw "Node.js 22 or newer is required. Found $versionText."
    }
    return $node.Source
}

function Get-CodexPackage {
    $package = Get-AppxPackage -Name OpenAI.Codex | Select-Object -First 1
    if (-not $package) {
        throw 'The OpenAI.Codex Store package is not installed for the current user.'
    }
    return $package
}

function Get-CodexMainProcess {
    $package = Get-CodexPackage
    $prefix = (Join-Path $package.InstallLocation 'app\ChatGPT.exe')
    return Get-CimInstance Win32_Process -Filter "Name='ChatGPT.exe'" |
        Where-Object {
            $_.ExecutablePath -eq $prefix -and
            $_.CommandLine -notmatch '(?:^|\s)--type='
        } |
        Sort-Object CreationDate |
        Select-Object -First 1
}

function Get-DebugPort {
    param($ProcessInfo)
    if (-not $ProcessInfo -or -not $ProcessInfo.CommandLine) { return $null }
    if ($ProcessInfo.CommandLine -match '--remote-debugging-port(?:=|\s+)(\d+)') {
        return [int]$Matches[1]
    }
    return $null
}

function Test-CdpEndpoint {
    param(
        [Parameter(Mandatory)][int]$Port,
        [int]$TimeoutMilliseconds = 800
    )
    try {
        $request = [System.Net.HttpWebRequest]::Create("http://127.0.0.1:$Port/json/list")
        $request.Timeout = $TimeoutMilliseconds
        $request.ReadWriteTimeout = $TimeoutMilliseconds
        $response = $request.GetResponse()
        try { return $response.StatusCode -eq [System.Net.HttpStatusCode]::OK }
        finally { $response.Dispose() }
    } catch {
        return $false
    }
}

function Get-FreeTcpPort {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
    $listener.Start()
    try { return ([System.Net.IPEndPoint]$listener.LocalEndpoint).Port }
    finally { $listener.Stop() }
}

function Ensure-ActivationType {
    if ('CodexSkin.ApplicationActivation' -as [type]) { return }
    Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

namespace CodexSkin {
    [Flags]
    public enum ActivateOptions : uint {
        None = 0x00000000,
        DesignMode = 0x00000001,
        NoErrorUI = 0x00000002,
        NoSplashScreen = 0x00000004
    }

    [ComImport]
    [Guid("2e941141-7f97-4756-ba1d-9decde894a3d")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IApplicationActivationManager {
        [PreserveSig]
        int ActivateApplication(
            [MarshalAs(UnmanagedType.LPWStr)] string appUserModelId,
            [MarshalAs(UnmanagedType.LPWStr)] string arguments,
            ActivateOptions options,
            out uint processId);

        [PreserveSig]
        int ActivateForFile(
            [MarshalAs(UnmanagedType.LPWStr)] string appUserModelId,
            IntPtr itemArray,
            [MarshalAs(UnmanagedType.LPWStr)] string verb,
            out uint processId);

        [PreserveSig]
        int ActivateForProtocol(
            [MarshalAs(UnmanagedType.LPWStr)] string appUserModelId,
            IntPtr itemArray,
            out uint processId);
    }

    [ComImport]
    [Guid("45BA127D-10A8-46EA-8AB7-56EA9078943C")]
    class ApplicationActivationManagerCom { }

    public static class ApplicationActivation {
        public static uint Activate(string appUserModelId, string arguments) {
            var manager = (IApplicationActivationManager)new ApplicationActivationManagerCom();
            uint processId;
            int hr = manager.ActivateApplication(appUserModelId, arguments ?? "", ActivateOptions.NoErrorUI, out processId);
            if (hr < 0) Marshal.ThrowExceptionForHR(hr);
            return processId;
        }
    }
}
'@
}

function Start-CodexPackage {
    param([string]$Arguments = '')
    $package = Get-CodexPackage
    Ensure-ActivationType
    $aumid = "$($package.PackageFamilyName)!App"
    return [CodexSkin.ApplicationActivation]::Activate($aumid, $Arguments)
}

function Wait-CdpEndpoint {
    param(
        [Parameter(Mandatory)][int]$Port,
        [int]$TimeoutSeconds = 15
    )
    $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
    while ([DateTime]::UtcNow -lt $deadline) {
        if (Test-CdpEndpoint -Port $Port) { return $true }
        Start-Sleep -Milliseconds 250
    }
    return $false
}

function Read-Config {
    if (-not (Test-Path -LiteralPath $script:ConfigPath -PathType Leaf)) { return $null }
    return Get-Content -Encoding UTF8 -Raw -LiteralPath $script:ConfigPath | ConvertFrom-Json
}

function Write-Config {
    param([Parameter(Mandatory)]$Config)
    New-Item -ItemType Directory -Force -Path $script:AppRoot | Out-Null
    $json = $Config | ConvertTo-Json -Depth 8
    [System.IO.File]::WriteAllText($script:ConfigPath, "$json`n", [System.Text.UTF8Encoding]::new($false))
}

function Get-AgentState {
    if (-not (Test-Path -LiteralPath $script:StatePath -PathType Leaf)) { return $null }
    try {
        return Get-Content -Encoding UTF8 -Raw -LiteralPath $script:StatePath | ConvertFrom-Json
    } catch {
        return $null
    }
}

function Test-ProcessId {
    param([int]$ProcessId)
    if ($ProcessId -le 0) { return $false }
    return $null -ne (Get-Process -Id $ProcessId -ErrorAction SilentlyContinue)
}

function Stop-Agent {
    $state = Get-AgentState
    if ($state -and (Test-ProcessId -ProcessId ([int]$state.pid))) {
        Stop-Process -Id ([int]$state.pid) -Force -ErrorAction SilentlyContinue
        Start-Sleep -Milliseconds 150
    }
    Remove-Item -LiteralPath $script:StatePath -Force -ErrorAction SilentlyContinue
}

function Start-Agent {
    param([Parameter(Mandatory)][int]$Port)
    if (-not (Test-Path -LiteralPath $script:ConfigPath -PathType Leaf)) {
        throw 'Skin configuration is not installed.'
    }
    $state = Get-AgentState
    if ($state -and [int]$state.port -eq $Port -and (Test-ProcessId -ProcessId ([int]$state.pid))) {
        return [int]$state.pid
    }
    Stop-Agent
    $nodePath = Get-NodePath
    $agentPath = if (Test-Path -LiteralPath $script:InstalledAgentPath) {
        $script:InstalledAgentPath
    } else {
        Join-Path $PSScriptRoot 'codex-skin-agent.mjs'
    }
    if (-not (Test-Path -LiteralPath $agentPath -PathType Leaf)) {
        throw "Agent script not found: $agentPath"
    }
    $arguments = "`"$agentPath`" --port $Port --config `"$script:ConfigPath`" --state `"$script:StatePath`""
    $process = Start-Process -FilePath $nodePath -ArgumentList $arguments -WindowStyle Hidden -PassThru
    return $process.Id
}

function Invoke-AgentOnce {
    param(
        [Parameter(Mandatory)][int]$Port,
        [Parameter(Mandatory)][string[]]$AgentArguments
    )
    $nodePath = Get-NodePath
    $agentPath = if (Test-Path -LiteralPath $script:InstalledAgentPath) {
        $script:InstalledAgentPath
    } else {
        Join-Path $PSScriptRoot 'codex-skin-agent.mjs'
    }
    $arguments = @(
        $agentPath,
        '--port', $Port,
        '--config', $script:ConfigPath,
        '--state', $script:StatePath
    ) + $AgentArguments
    $output = & $nodePath @arguments 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw ($output -join [Environment]::NewLine)
    }
    return ($output -join [Environment]::NewLine)
}

function Install-Icon {
    $package = Get-CodexPackage
    $exePath = Join-Path $package.InstallLocation 'app\ChatGPT.exe'
    Add-Type -AssemblyName System.Drawing
    $icon = [System.Drawing.Icon]::ExtractAssociatedIcon($exePath)
    if (-not $icon) { return }
    try {
        $stream = [System.IO.File]::Open($script:IconPath, [System.IO.FileMode]::Create)
        try { $icon.Save($stream) }
        finally { $stream.Dispose() }
    } finally {
        $icon.Dispose()
    }
}

function New-LauncherShortcut {
    param([Parameter(Mandatory)][string]$ShortcutPath)
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $ShortcutPath) | Out-Null
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($ShortcutPath)
    $shortcut.TargetPath = $script:LauncherPath
    $shortcut.Arguments = ''
    $shortcut.WorkingDirectory = $script:AppRoot
    $shortcut.Description = 'Launch the official Codex app with the external background skin.'
    if (Test-Path -LiteralPath $script:IconPath) {
        $shortcut.IconLocation = "$script:IconPath,0"
    }
    $shortcut.Save()
    Start-Sleep -Milliseconds 50
    if (-not [System.IO.File]::Exists($ShortcutPath)) {
        $shortcut.Save()
        Start-Sleep -Milliseconds 100
    }
    if (-not [System.IO.File]::Exists($ShortcutPath)) {
        throw "Shortcut was not created: $ShortcutPath"
    }
}

function Build-Launcher {
    $compilerCandidates = @(
        (Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'),
        (Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe')
    )
    $compiler = $compilerCandidates | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
    if (-not $compiler) {
        throw 'The .NET Framework C# compiler was not found.'
    }
    $compilerOutput = & $compiler /nologo /target:winexe "/out:$script:LauncherPath" $script:InstalledLauncherSourcePath 2>&1
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $script:LauncherPath -PathType Leaf)) {
        throw "Failed to build the hidden launcher:`n$($compilerOutput -join [Environment]::NewLine)"
    }
}

function Install-Runtime {
    $sourceAgent = Join-Path $PSScriptRoot 'codex-skin-agent.mjs'
    $sourceLauncher = Join-Path $PSScriptRoot 'CodexSkinLauncher.cs'
    $sourceCli = $PSCommandPath
    if (-not (Test-Path -LiteralPath $sourceAgent -PathType Leaf)) {
        throw "Agent source not found: $sourceAgent"
    }
    if (-not (Test-Path -LiteralPath $sourceLauncher -PathType Leaf)) {
        throw "Launcher source not found: $sourceLauncher"
    }
    New-Item -ItemType Directory -Force -Path $script:RuntimeRoot, $script:AssetsRoot | Out-Null
    if ([System.IO.Path]::GetFullPath($sourceAgent) -ne [System.IO.Path]::GetFullPath($script:InstalledAgentPath)) {
        Copy-Item -LiteralPath $sourceAgent -Destination $script:InstalledAgentPath -Force
    }
    if ([System.IO.Path]::GetFullPath($sourceCli) -ne [System.IO.Path]::GetFullPath($script:InstalledCliPath)) {
        Copy-Item -LiteralPath $sourceCli -Destination $script:InstalledCliPath -Force
    }
    if ([System.IO.Path]::GetFullPath($sourceLauncher) -ne [System.IO.Path]::GetFullPath($script:InstalledLauncherSourcePath)) {
        Copy-Item -LiteralPath $sourceLauncher -Destination $script:InstalledLauncherSourcePath -Force
    }
    Build-Launcher
    Install-Icon
    New-LauncherShortcut -ShortcutPath $script:StartMenuShortcut
    New-LauncherShortcut -ShortcutPath $script:DesktopShortcut
}

function Install-Skin {
    param([Parameter(Mandatory)][string]$ImagePath)
    $resolvedImage = (Resolve-Path -LiteralPath $ImagePath).Path
    $extension = [System.IO.Path]::GetExtension($resolvedImage).ToLowerInvariant()
    if ($extension -notin @('.png', '.jpg', '.jpeg', '.webp', '.gif')) {
        throw "Unsupported image format: $extension"
    }
    Get-NodePath | Out-Null
    Install-Runtime
    Get-ChildItem -LiteralPath $script:AssetsRoot -File -Filter 'background.*' -ErrorAction SilentlyContinue |
        Remove-Item -Force
    $backgroundPath = Join-Path $script:AssetsRoot "background$extension"
    Copy-Item -LiteralPath $resolvedImage -Destination $backgroundPath -Force
    $config = [ordered]@{
        schemaVersion = 1
        toolVersion = $script:Version
        enabled = $true
        backgroundPath = $backgroundPath
        fit = $Fit
        position = $Position
        overlayOpacity = $Overlay
        overlayColor = '255, 249, 238'
        baseColor = '#f4d18f'
        mainSelector = 'main.main-surface'
        composerScrim = $false
        headerSurface = $true
        headerSelector = 'header.app-header-tint'
        headerBackground = 'rgba(255, 248, 235, 0.94)'
        headerBorder = 'rgba(126, 87, 45, 0.18)'
        sidebarSurface = $true
        sidebarSelector = 'aside.app-shell-left-panel'
        sidebarBackground = '#fff8eb'
        removeTopFade = $true
        homeSuggestionCards = $true
        composerChrome = $true
        projectBarChrome = $true
        sidebarIcons = $true
        sidebarIconColor = '#8a5a32'
        folderIconColor = '#75451f'
        folderIconFill = 'rgba(229, 166, 77, 0.34)'
        installedAt = [DateTime]::UtcNow.ToString('o')
        sourceImageSha256 = (Get-FileHash -LiteralPath $resolvedImage -Algorithm SHA256).Hash
    }
    Write-Config -Config $config

    $main = Get-CodexMainProcess
    $port = Get-DebugPort -ProcessInfo $main
    $agentPid = $null
    $liveApplied = $false
    if ($port -and (Test-CdpEndpoint -Port $port)) {
        Stop-Agent
        $agentPid = Start-Agent -Port $port
        Start-Sleep -Milliseconds 500
        $liveApplied = $true
    }

    Write-Result ([pscustomobject]@{
        ToolVersion = $script:Version
        Installed = $true
        Background = $backgroundPath
        Overlay = $Overlay
        Fit = $Fit
        Position = $Position
        StartMenuShortcut = $script:StartMenuShortcut
        DesktopShortcut = $script:DesktopShortcut
        LiveApplied = $liveApplied
        DebugPort = $port
        AgentPid = $agentPid
        PackageFilesModified = $false
    })
}

function Launch-SkinnedCodex {
    $config = Read-Config
    if (-not $config) {
        throw 'Codex Skin is not installed. Run install with an image first.'
    }

    $main = Get-CodexMainProcess
    if ($main) {
        $port = Get-DebugPort -ProcessInfo $main
        if ([bool]$config.enabled -and -not $port) {
            throw 'Codex is already running without a CDP port. Close it, then use the Codex Skin shortcut.'
        }
        if ($port -and (Test-CdpEndpoint -Port $port)) {
            if ([bool]$config.enabled) { Start-Agent -Port $port | Out-Null }
            Start-CodexPackage -Arguments '' | Out-Null
            return
        }
        Start-CodexPackage -Arguments '' | Out-Null
        return
    }

    if (-not [bool]$config.enabled) {
        Start-CodexPackage -Arguments '' | Out-Null
        return
    }

    $port = Get-FreeTcpPort
    $arguments = "--remote-debugging-port=$port --remote-debugging-address=127.0.0.1"
    Start-CodexPackage -Arguments $arguments | Out-Null
    if (-not (Wait-CdpEndpoint -Port $port)) {
        throw "Codex started, but its CDP endpoint did not become available on 127.0.0.1:$port."
    }
    Start-Agent -Port $port | Out-Null
}

function Attach-Skin {
    $main = Get-CodexMainProcess
    if (-not $main) { throw 'Codex is not running.' }
    $port = Get-DebugPort -ProcessInfo $main
    if (-not $port) { throw 'The running Codex process does not expose a CDP port.' }
    if (-not (Test-CdpEndpoint -Port $port)) { throw "CDP endpoint 127.0.0.1:$port is not responding." }
    $pid = Start-Agent -Port $port
    Write-Result ([pscustomobject]@{ Attached = $true; DebugPort = $port; AgentPid = $pid })
}

function Get-SkinStatus {
    $config = Read-Config
    $state = Get-AgentState
    $main = Get-CodexMainProcess
    $port = Get-DebugPort -ProcessInfo $main
    $agentAlive = $false
    if ($state) { $agentAlive = Test-ProcessId -ProcessId ([int]$state.pid) }
    Write-Result ([pscustomobject]@{
        ToolVersion = $script:Version
        Installed = $null -ne $config
        Enabled = if ($config) { [bool]$config.enabled } else { $false }
        Background = if ($config) { $config.backgroundPath } else { $null }
        ConfigPath = $script:ConfigPath
        CodexRunning = $null -ne $main
        CodexProcessId = if ($main) { $main.ProcessId } else { $null }
        DebugPort = $port
        CdpAvailable = if ($port) { Test-CdpEndpoint -Port $port } else { $false }
        AgentRunning = $agentAlive
        AgentProcessId = if ($state) { $state.pid } else { $null }
        AgentStatus = if ($state) { $state.status } else { $null }
        StyleVersion = if ($state) { $state.styleVersion } else { $null }
        LastAppliedAt = if ($state) { $state.lastAppliedAt } else { $null }
        LastError = if ($state) { $state.lastError } else { $null }
        StartMenuShortcut = Test-Path -LiteralPath $script:StartMenuShortcut
        DesktopShortcut = Test-Path -LiteralPath $script:DesktopShortcut
        PackageFilesModified = $false
    })
}

function Capture-Skin {
    param([Parameter(Mandatory)][string]$OutputPath)
    $main = Get-CodexMainProcess
    if (-not $main) { throw 'Codex is not running.' }
    $port = Get-DebugPort -ProcessInfo $main
    if (-not $port) { throw 'The running Codex process does not expose a CDP port.' }
    $resolvedOutput = [System.IO.Path]::GetFullPath($OutputPath)
    $output = Invoke-AgentOnce -Port $port -AgentArguments @('--once', '--screenshot', $resolvedOutput)
    if ($Json) { $output } else { Write-Host $output }
}

function Restore-Skin {
    $config = Read-Config
    if (-not $config) {
        Write-Result ([pscustomobject]@{ Restored = $true; Installed = $false; PackageFilesModified = $false })
        return
    }
    $config.enabled = $false
    Write-Config -Config $config
    $main = Get-CodexMainProcess
    $port = Get-DebugPort -ProcessInfo $main
    if ($port -and (Test-CdpEndpoint -Port $port)) {
        try { Invoke-AgentOnce -Port $port -AgentArguments @('--remove') | Out-Null } catch { }
    }
    Stop-Agent
    Write-Result ([pscustomobject]@{
        Restored = $true
        ShortcutKept = $true
        ConfigPath = $script:ConfigPath
        PackageFilesModified = $false
    })
}

function Uninstall-Skin {
    Restore-Skin | Out-Null
    Remove-Item -LiteralPath $script:StartMenuShortcut -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $script:DesktopShortcut -Force -ErrorAction SilentlyContinue
    $appRootFull = [System.IO.Path]::GetFullPath($script:AppRoot).TrimEnd('\')
    $expectedRoot = [System.IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'CodexSkin')).TrimEnd('\')
    if ($appRootFull -ne $expectedRoot) {
        throw "Refusing to remove unexpected app root: $appRootFull"
    }
    Remove-Item -LiteralPath $appRootFull -Recurse -Force -ErrorAction SilentlyContinue
    Write-Result ([pscustomobject]@{
        Uninstalled = $true
        RemovedPath = $appRootFull
        PackageFilesModified = $false
    })
}

switch ($Command) {
    'install' {
        if (-not $Path) { throw 'Usage: codex-skin.ps1 install <absolute-image-path>' }
        Install-Skin -ImagePath $Path
    }
    'change' {
        if (-not $Path) { throw 'Usage: codex-skin.ps1 change <absolute-image-path>' }
        Install-Skin -ImagePath $Path
    }
    'launch' { Launch-SkinnedCodex }
    'attach' { Attach-Skin }
    'status' { Get-SkinStatus }
    'capture' {
        if (-not $Path) { throw 'Usage: codex-skin.ps1 capture <absolute-output-png>' }
        Capture-Skin -OutputPath $Path
    }
    'restore' { Restore-Skin }
    'uninstall' { Uninstall-Skin }
}
