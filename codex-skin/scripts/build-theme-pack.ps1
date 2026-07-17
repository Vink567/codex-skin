[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$ThemePath,

    [string]$OutputDirectory = (Get-Location).Path,

    [switch]$Force
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$script:BuilderVersion = '0.3.4'
$script:PackageFormat = 'codex-skin-studio-theme'
$script:AllowedAreas = @(
    'main-background',
    'header',
    'sidebar',
    'sidebar-icons',
    'suggestion-cards',
    'composer',
    'project-bar',
    'top-fade'
)
$script:AllowedRuntimeKeys = @(
    'overlayColor',
    'baseColor',
    'mainSelector',
    'composerScrim',
    'headerSurface',
    'headerSelector',
    'headerBackground',
    'headerBorder',
    'sidebarSurface',
    'sidebarSelector',
    'sidebarBackground',
    'removeTopFade',
    'homeSuggestionCards',
    'composerChrome',
    'projectBarChrome',
    'sidebarIcons',
    'sidebarIconColor',
    'folderIconColor',
    'folderIconFill'
)
$script:StudioColorKeys = @(
    'overlay', 'header', 'headerBorder', 'sidebar', 'navIcon', 'folder',
    'card1', 'card2', 'card3', 'card4', 'composer', 'composerBorder',
    'add', 'permission', 'model', 'mic', 'send', 'projectBar', 'projectControl'
)
$script:StudioFeatureKeys = @(
    'headerSurface', 'sidebarSurface', 'sidebarIcons', 'homeSuggestionCards',
    'composerChrome', 'projectBarChrome', 'removeTopFade'
)
$script:IconFiles = [ordered]@{
    newTask = 'new-task.svg'
    scheduled = 'scheduled.svg'
    plugins = 'plugins.svg'
    sites = 'sites.svg'
    pullRequests = 'pull-requests.svg'
    chats = 'chats.svg'
    folderPaw = 'folder-paw.svg'
    attachment = 'attachment.svg'
    permission = 'permission.svg'
    model = 'model.svg'
    microphone = 'microphone.svg'
    send = 'send.svg'
}
$script:DefaultIconRoot = Join-Path (Split-Path -Parent $PSScriptRoot) 'assets\theme-template\icons'

function Write-Utf8NoBom {
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][string]$Value
    )
    [System.IO.File]::WriteAllText($Path, $Value, [System.Text.UTF8Encoding]::new($false))
}

function Get-RequiredValue {
    param(
        [Parameter(Mandatory)]$Object,
        [Parameter(Mandatory)][string]$Name
    )
    $property = $Object.PSObject.Properties[$Name]
    if ($null -eq $property -or $null -eq $property.Value) {
        throw "Missing required property: $Name"
    }
    if ($property.Value -is [string] -and [string]::IsNullOrWhiteSpace($property.Value)) {
        throw "Required property is empty: $Name"
    }
    return $property.Value
}

function Get-OptionalValue {
    param(
        [Parameter(Mandatory)]$Object,
        [Parameter(Mandatory)][string]$Name
    )
    $property = $Object.PSObject.Properties[$Name]
    if ($null -eq $property) { return $null }
    return $property.Value
}

function ConvertTo-Slug {
    param(
        [Parameter(Mandatory)][string]$Value,
        [Parameter(Mandatory)][string]$FieldName
    )
    $slug = ($Value.ToLowerInvariant() -replace '[^a-z0-9]+', '-').Trim('-')
    if ([string]::IsNullOrWhiteSpace($slug) -or $slug.Length -gt 48) {
        throw "$FieldName must produce a non-empty ASCII slug no longer than 48 characters."
    }
    return $slug
}

function Resolve-ThemeSource {
    param(
        [Parameter(Mandatory)][string]$Root,
        [Parameter(Mandatory)][string]$RelativePath,
        [Parameter(Mandatory)][string]$Label
    )
    if ([System.IO.Path]::IsPathRooted($RelativePath)) {
        throw "$Label must be relative to the theme source directory."
    }
    $rootFull = [System.IO.Path]::GetFullPath($Root).TrimEnd('\')
    $resolved = [System.IO.Path]::GetFullPath((Join-Path $rootFull $RelativePath))
    if (-not $resolved.StartsWith("$rootFull\", [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "$Label resolves outside the theme source directory: $RelativePath"
    }
    if (-not (Test-Path -LiteralPath $resolved -PathType Leaf)) {
        throw "$Label not found: $resolved"
    }
    return $resolved
}

function Remove-PackageOutput {
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][string]$OutputRoot
    )
    $rootFull = [System.IO.Path]::GetFullPath($OutputRoot).TrimEnd('\')
    $targetFull = [System.IO.Path]::GetFullPath($Path)
    if (-not $targetFull.StartsWith("$rootFull\", [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to remove a path outside the output directory: $targetFull"
    }
    Remove-Item -LiteralPath $targetFull -Recurse -Force
}

function Test-SafeSvg {
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][string]$Label
    )
    $markup = Get-Content -Raw -Encoding UTF8 -LiteralPath $Path
    if ($markup -notmatch '(?is)^\s*<svg\b') {
        throw "$Label must begin with an SVG root element."
    }
    $unsafePatterns = @(
        '(?i)<\s*(script|foreignObject|iframe|object|embed)\b',
        '(?i)\son[a-z]+\s*=',
        '(?i)(javascript:|data:|https?:|url\s*\()'
    )
    foreach ($pattern in $unsafePatterns) {
        if ($markup -match $pattern) { throw "$Label contains an unsafe SVG construct." }
    }
}

$resolvedThemePath = (Resolve-Path -LiteralPath $ThemePath).Path
$themeRoot = Split-Path -Parent $resolvedThemePath
$theme = Get-Content -Raw -Encoding UTF8 -LiteralPath $resolvedThemePath | ConvertFrom-Json

$schemaVersion = [int](Get-RequiredValue -Object $theme -Name 'schemaVersion')
if ($schemaVersion -ne 1) { throw "Unsupported schemaVersion: $schemaVersion" }

$themeIdRaw = [string](Get-RequiredValue -Object $theme -Name 'id')
$themeId = ConvertTo-Slug -Value $themeIdRaw -FieldName 'id'
if ($themeIdRaw -cne $themeId) { throw "id must already be a lowercase ASCII slug: $themeId" }

$themeName = [string](Get-RequiredValue -Object $theme -Name 'name')
$version = [string](Get-RequiredValue -Object $theme -Name 'version')
if ($version -notmatch '^\d+\.\d+\.\d+$') { throw 'version must use major.minor.patch.' }

[void](Get-RequiredValue -Object $theme -Name 'description')
$scopeRaw = [string](Get-RequiredValue -Object $theme -Name 'scopeSlug')
$scopeSlug = ConvertTo-Slug -Value $scopeRaw -FieldName 'scopeSlug'
if ($scopeRaw -cne $scopeSlug) { throw "scopeSlug must already be a lowercase ASCII slug: $scopeSlug" }

$previewType = [string](Get-RequiredValue -Object $theme -Name 'previewType')
if ($previewType -notin @('live-codex', 'background-artwork')) {
    throw 'previewType must be live-codex or background-artwork.'
}

$modifiedAreas = @((Get-RequiredValue -Object $theme -Name 'modifiedAreas'))
if ($modifiedAreas.Count -eq 0) { throw 'modifiedAreas must contain at least one area.' }
foreach ($area in $modifiedAreas) {
    if ([string]$area -notin $script:AllowedAreas) { throw "Unsupported modified area: $area" }
}

$background = Get-RequiredValue -Object $theme -Name 'background'
$backgroundRelative = [string](Get-RequiredValue -Object $background -Name 'file')
$backgroundSource = Resolve-ThemeSource -Root $themeRoot -RelativePath $backgroundRelative -Label 'Background'
$backgroundExtension = [System.IO.Path]::GetExtension($backgroundSource).ToLowerInvariant()
if ($backgroundExtension -notin @('.png', '.jpg', '.jpeg', '.webp', '.gif')) {
    throw "Unsupported background format: $backgroundExtension"
}
$fit = [string](Get-RequiredValue -Object $background -Name 'fit')
if ($fit -notin @('cover', 'contain', 'fill')) { throw "Unsupported background fit: $fit" }
[void](Get-RequiredValue -Object $background -Name 'position')
$overlayOpacity = [double](Get-RequiredValue -Object $background -Name 'overlayOpacity')
if ($overlayOpacity -lt 0 -or $overlayOpacity -gt 0.9) {
    throw 'background.overlayOpacity must be between 0 and 0.9.'
}

$runtimeConfig = Get-RequiredValue -Object $theme -Name 'runtimeConfig'
foreach ($property in $runtimeConfig.PSObject.Properties) {
    if ($property.Name -notin $script:AllowedRuntimeKeys) {
        throw "Unsupported runtimeConfig key: $($property.Name)"
    }
}

$studioTheme = Get-RequiredValue -Object $theme -Name 'studioTheme'
$allowedStudioKeys = @($script:StudioColorKeys) + @($script:StudioFeatureKeys)
foreach ($property in $studioTheme.PSObject.Properties) {
    if ($property.Name -notin $allowedStudioKeys) {
        throw "Unsupported studioTheme key: $($property.Name)"
    }
}
foreach ($key in $script:StudioColorKeys) {
    $value = [string](Get-RequiredValue -Object $studioTheme -Name $key)
    if ($value -notmatch '^#[0-9a-fA-F]{6}$') { throw "studioTheme.$key must be a six-digit hex color." }
}
foreach ($key in $script:StudioFeatureKeys) {
    $value = Get-RequiredValue -Object $studioTheme -Name $key
    if ($value -isnot [bool]) { throw "studioTheme.$key must be true or false." }
}

$resources = Get-RequiredValue -Object $theme -Name 'resources'
$previewRelative = [string](Get-RequiredValue -Object $resources -Name 'preview')
$previewSource = Resolve-ThemeSource -Root $themeRoot -RelativePath $previewRelative -Label 'Preview'
if ([System.IO.Path]::GetExtension($previewSource).ToLowerInvariant() -ne '.png') {
    throw 'The preview resource must be a PNG file.'
}

$customCssRelative = Get-OptionalValue -Object $resources -Name 'customCss'
$customCssSource = $null
if ($null -ne $customCssRelative -and -not [string]::IsNullOrWhiteSpace([string]$customCssRelative)) {
    $customCssSource = Resolve-ThemeSource -Root $themeRoot -RelativePath ([string]$customCssRelative) -Label 'Custom CSS'
    if ([System.IO.Path]::GetExtension($customCssSource).ToLowerInvariant() -ne '.css') {
        throw 'The customCss resource must be a CSS file.'
    }
}

$iconResources = Get-OptionalValue -Object $resources -Name 'icons'
$iconSources = [ordered]@{}
if ($null -ne $iconResources) {
    foreach ($property in $iconResources.PSObject.Properties) {
        if ($property.Name -notin $script:IconFiles.Keys) {
            throw "Unsupported icon key: $($property.Name)"
        }
        $iconRelative = [string]$property.Value
        $iconSource = Resolve-ThemeSource -Root $themeRoot -RelativePath $iconRelative -Label "Icon $($property.Name)"
        if ([System.IO.Path]::GetExtension($iconSource).ToLowerInvariant() -ne '.svg') {
            throw "Icon $($property.Name) must be an SVG file."
        }
        Test-SafeSvg -Path $iconSource -Label "Icon $($property.Name)"
        $iconSources[$property.Name] = $iconSource
    }
}
$isBackgroundOnly = $modifiedAreas.Count -eq 1 -and [string]$modifiedAreas[0] -eq 'main-background'
if (-not $isBackgroundOnly) {
    foreach ($key in $script:IconFiles.Keys) {
        if ($iconSources.Contains($key)) { continue }
        $defaultIcon = Join-Path $script:DefaultIconRoot $script:IconFiles[$key]
        if (-not (Test-Path -LiteralPath $defaultIcon -PathType Leaf)) {
            throw "Default SVG template not found: $defaultIcon"
        }
        Test-SafeSvg -Path $defaultIcon -Label "Default icon $key"
        $iconSources[$key] = $defaultIcon
    }
}

$outputRoot = [System.IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Force -Path $outputRoot | Out-Null
$packageName = "codex-skin-$themeId"
$packageRoot = Join-Path $outputRoot $packageName
$zipPath = Join-Path $outputRoot "$packageName.zip"

foreach ($existing in @($packageRoot, $zipPath)) {
    if (Test-Path -LiteralPath $existing) {
        if (-not $Force) { throw "Output already exists: $existing. Use -Force to replace it." }
        Remove-PackageOutput -Path $existing -OutputRoot $outputRoot
    }
}

$packageAssets = Join-Path $packageRoot 'assets'
New-Item -ItemType Directory -Force -Path $packageAssets | Out-Null
$packageIcons = Join-Path $packageAssets 'icons'

$packagedBackgroundRelative = "assets/background$backgroundExtension"
Copy-Item -LiteralPath $backgroundSource -Destination (Join-Path $packageRoot $packagedBackgroundRelative) -Force
Copy-Item -LiteralPath $previewSource -Destination (Join-Path $packageRoot 'preview.png') -Force

$background.file = $packagedBackgroundRelative.Replace('\', '/')
$resources.preview = 'preview.png'
if ($customCssSource) {
    Copy-Item -LiteralPath $customCssSource -Destination (Join-Path $packageAssets 'theme.css') -Force
    $resources | Add-Member -NotePropertyName customCss -NotePropertyValue 'assets/theme.css' -Force
} elseif ($null -ne $resources.PSObject.Properties['customCss']) {
    $resources.PSObject.Properties.Remove('customCss')
}
if ($iconSources.Count) {
    New-Item -ItemType Directory -Force -Path $packageIcons | Out-Null
    $packagedIcons = [ordered]@{}
    foreach ($key in $script:IconFiles.Keys) {
        if (-not $iconSources.Contains($key)) { continue }
        $filename = $script:IconFiles[$key]
        Copy-Item -LiteralPath $iconSources[$key] -Destination (Join-Path $packageIcons $filename) -Force
        $packagedIcons[$key] = "assets/icons/$filename"
    }
    $resources | Add-Member -NotePropertyName icons -NotePropertyValue ([pscustomobject]$packagedIcons) -Force
} elseif ($null -ne $resources.PSObject.Properties['icons']) {
    $resources.PSObject.Properties.Remove('icons')
}

$packageMetadata = [ordered]@{
    format = $script:PackageFormat
    formatVersion = 1
    name = $packageName
    builderVersion = $script:BuilderVersion
    builtAt = [DateTime]::UtcNow.ToString('o')
}
$theme | Add-Member -NotePropertyName package -NotePropertyValue $packageMetadata -Force
$themeJson = $theme | ConvertTo-Json -Depth 12
Write-Utf8NoBom -Path (Join-Path $packageRoot 'theme.json') -Value "$themeJson`n"

$checksumLines = Get-ChildItem -LiteralPath $packageRoot -Recurse -File |
    Where-Object { $_.Name -ne 'SHA256SUMS.txt' } |
    Sort-Object FullName |
    ForEach-Object {
        $relative = $_.FullName.Substring($packageRoot.Length + 1).Replace('\', '/')
        $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $_.FullName).Hash.ToUpperInvariant()
        "$hash  $relative"
    }
Write-Utf8NoBom -Path (Join-Path $packageRoot 'SHA256SUMS.txt') -Value (($checksumLines -join "`n") + "`n")

Compress-Archive -LiteralPath $packageRoot -DestinationPath $zipPath -CompressionLevel Optimal

[pscustomobject]@{
    BuilderVersion = $script:BuilderVersion
    PackageFormat = $script:PackageFormat
    Theme = $themeName
    Version = $version
    ModifiedAreas = $modifiedAreas
    PackageDirectory = $packageRoot
    Zip = $zipPath
    Preview = Join-Path $packageRoot 'preview.png'
    PreviewType = $previewType
    ResourceFiles = $checksumLines.Count
}
