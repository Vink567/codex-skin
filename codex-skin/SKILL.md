---
name: codex-skin
description: Generate validated visual theme resource packages for Codex Skin Studio from a reference image or text description, including the background, component CSS, mandatory navigation, folder, and composer-control SVG icons, manifest, preview, and checksums. Use when a user wants a Codex background or full UI skin ZIP that can be imported into Codex Skin Studio, needs a package named from the theme identity, or wants to inspect an existing Studio theme resource package. Codex Skin Studio, not the resource ZIP, owns applying, listening, disabling, and restoring themes.
---

# Codex Skin Resource Builder

Create resources for Codex Skin Studio. Never place runtime, listener, installer, launcher, disable, or restore scripts inside a theme ZIP.

## Create Theme Resources

1. Inspect a supplied reference image with the local image viewer. Use it directly as the background unless the user asks to transform it.
2. When the user supplies only a visual description, use the `imagegen` skill to generate the final raster background. Prefer a desktop-oriented composition with quiet detail behind text and controls.
3. Map a restrained palette to the requested areas: main background, header, sidebar, sidebar icons, four suggestion cards, composer and controls, project bar, and top-fade removal.
4. Copy `assets/theme-template/theme.json`, `assets/theme-template/theme.css`, and all SVGs in `assets/theme-template/icons/` into a temporary source directory. Fill every placeholder, including the `studioTheme` editor palette, and remove CSS rules outside the requested scope.
5. Treat the SVG bundle as required for every normal full-skin package: six navigation icons, one folder icon, plus attachment, permission, model, microphone, and send controls. If the prompt does not describe one of those icons, retain the matching default template SVG unchanged; do not omit it or ask a follow-up question.
6. Read [references/theme-package-format.md](references/theme-package-format.md) before writing the manifest or naming the ZIP.
7. Produce `preview.png`. Use a verified live Codex capture when available; otherwise use the final background artwork and set `previewType` to `background-artwork`.
8. Build the Studio resource package:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\build-theme-pack.ps1 `
  -ThemePath "<absolute-theme-json>" `
  -OutputDirectory "<absolute-output-directory>" `
  -Force
```

The builder enforces this name, using the manifest `id` as the safe theme slug:

```text
codex-skin-<theme-slug>.zip
```

## Required Package Content

The ZIP may contain only:

```text
theme.json
SHA256SUMS.txt
preview.png
assets/background.<supported-image-extension>
assets/theme.css
assets/icons/new-task.svg
assets/icons/scheduled.svg
assets/icons/plugins.svg
assets/icons/sites.svg
assets/icons/pull-requests.svg
assets/icons/chats.svg
assets/icons/folder-paw.svg
assets/icons/attachment.svg
assets/icons/permission.svg
assets/icons/model.svg
assets/icons/microphone.svg
assets/icons/send.svg
```

Omit `theme.css` and the SVG bundle only for an explicit `main-background`-only package. Every other package must contain all 12 mapped SVGs: navigation (new task, scheduled, plugins, sites, pull requests, chats), folder paw, attachment, permission, model, microphone, and send. Use a theme-specific drawing only when the user described it; otherwise copy the safe default SVG. Keep the four suggestion cards visually distinct. Do not make dialogs, menus, code blocks, or the composer transparent.

## Studio Boundary

- Deliver the ZIP for import through **Codex Skin Studio**.
- Do not run installation, listener, attach, restore, or uninstall commands as part of resource generation.
- Do not package `runtime/`, PowerShell, JavaScript, C#, executables, shortcuts, or README files.
- Let Studio validate checksums, copy resources, apply runtime configuration, manage the listener, and restore the official appearance.

## Required Final Response

Report these fields in order:

```text
Theme: <human name> (v<version>)
Modified areas: <comma-separated area ids>
Resource package: <absolute ZIP path>
Preview: <absolute preview path and preview type>
Studio import: <not imported | imported and verified>
Verification: <manifest, checksums, ZIP root, allowed file list>
```

## Safety Boundaries

- Do not modify the Codex MSIX package, `app.asar`, WindowsApps, Codex configuration, authentication, conversations, or browser data.
- Do not include absolute paths, CDP ports, credentials, conversation text, scripts, or executables in resource packages.
- Use inert SVG markup only. Do not include scripts, event attributes, external URLs, data URLs, `foreignObject`, frames, or embedded objects.
- Keep source descriptions non-sensitive and metadata-only.
