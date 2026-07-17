# Codex Skin Studio Theme Resource Package

Read this reference before creating or validating an importable theme resource ZIP.

## Responsibility Boundary

The ZIP contains theme resources only. Codex Skin Studio owns importing, applying, launching the listener, disabling the theme, and restoring the official appearance.

Never include these files in a theme resource ZIP:

```text
runtime/
install-theme.ps1
restore-theme.ps1
codex-skin.ps1
codex-skin-agent.mjs
CodexSkinLauncher.cs
README.md
```

## Package Name

Use this exact pattern:

```text
codex-skin-<theme-slug>.zip
```

Use the manifest `id` as `<theme-slug>`. Keep scope and version inside `theme.json`; do not place them in the filename.

Examples:

```text
codex-skin-cozy-cat-room.zip
codex-skin-cyberpunk-neon.zip
```

## Required Layout

```text
codex-skin-<theme>/
|-- theme.json
|-- SHA256SUMS.txt
|-- preview.png
`-- assets/
    |-- background.<png|jpg|jpeg|webp|gif>
    `-- theme.css
    `-- icons/
        |-- new-task.svg
        |-- scheduled.svg
        |-- plugins.svg
        |-- sites.svg
        |-- pull-requests.svg
        |-- chats.svg
        |-- folder-paw.svg
        |-- attachment.svg
        |-- permission.svg
        |-- model.svg
        |-- microphone.svg
        `-- send.svg
```

`assets/theme.css` and `assets/icons/` are optional only for an explicit `main-background`-only package. Every other package must include all 12 SVGs. The ZIP must contain exactly one root directory named like the ZIP without `.zip`.

## Manifest Contract

Start from `assets/theme-template.json`. The builder adds this required block:

```json
{
  "package": {
    "format": "codex-skin-studio-theme",
    "formatVersion": 1,
    "name": "codex-skin-example",
    "builderVersion": "0.3.4",
    "builtAt": "UTC timestamp"
  }
}
```

Codex Skin Studio rejects a package with a different format, an unsupported schema, unsafe paths, missing resources, or mismatched SHA-256 values.

Required source fields:

- `schemaVersion`: integer `1`
- `id`: lowercase ASCII theme slug
- `name`: human-facing name
- `version`: `major.minor.patch`
- `description`: one-sentence visual summary
- `scopeSlug`: lowercase scope slug
- `previewType`: `live-codex` or `background-artwork`
- `source`: non-sensitive source description
- `modifiedAreas`: supported area ids
- `background`: file, fit, position, and overlay opacity
- `runtimeConfig`: supported runtime values consumed by Studio
- `studioTheme`: Studio editor palette and feature-toggle defaults
- `resources.preview`: relative PNG path
- `resources.customCss`: optional relative CSS path
- `resources.icons`: required SVG mapping for normal full-skin packages; optional only for `main-background`-only packages

Supported `modifiedAreas` values:

| Area | Resource or configuration |
| --- | --- |
| `main-background` | Background image and placement settings |
| `header` | Header surface values and optional CSS |
| `sidebar` | Sidebar surface values and optional CSS |
| `sidebar-icons` | Navigation colors and paw-folder CSS |
| `suggestion-cards` | Four independent card palettes |
| `composer` | Composer surface and control states |
| `project-bar` | Project bar surface and controls |
| `top-fade` | Top fade removal setting |

Allowed `runtimeConfig` keys:

```text
overlayColor, baseColor, mainSelector, composerScrim,
headerSurface, headerSelector, headerBackground, headerBorder,
sidebarSurface, sidebarSelector, sidebarBackground, removeTopFade,
homeSuggestionCards, composerChrome, projectBarChrome, sidebarIcons,
sidebarIconColor, folderIconColor, folderIconFill
```

Do not include absolute user paths, CDP ports, authentication data, conversation text, scripts, or executables.

## SVG Icon Contract

Every normal full-skin package must provide all of these keys in `resources.icons`:

```text
newTask, scheduled, plugins, sites, pullRequests, chats, folderPaw,
attachment, permission, model, microphone, send
```

Navigation comprises `newTask`, `scheduled`, `plugins`, `sites`, `pullRequests`, and `chats`; `folderPaw` is the folder icon; the remaining five keys target the composer controls. Use the matching files from `assets/icon-template/` as a starting point, then replace a file only when the user described a distinct icon treatment. If the prompt is silent about an icon, keep its default SVG. The builder automatically supplies a default for any omitted normal-theme mapping. SVGs must start with an `<svg>` element and may not contain scripts, event attributes, external URLs, data URLs, `url(...)`, `foreignObject`, frames, or embedded objects. Studio verifies these rules and SHA-256 before importing.

## Build

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\build-theme-pack.ps1 `
  -ThemePath "<absolute-theme-json>" `
  -OutputDirectory "<absolute-output-directory>" `
  -Force
```

The builder creates the expanded resource folder and the Studio-importable ZIP. Do not hand-create the ZIP.
