# Codex Skin Troubleshooting

## Contents

- CDP endpoint unavailable
- Renderer target missing
- Background hidden
- Shortcut behavior
- Restore behavior

## CDP Endpoint Unavailable

Confirm the Electron main process command line contains both `--remote-debugging-port=<port>` and `--remote-debugging-address=127.0.0.1`. A normally running process cannot gain a CDP port after startup. Close Codex and use the generated **Codex Skin** shortcut. Do not terminate an active Codex session automatically.

Query a known endpoint without retrieving page content:

```powershell
Invoke-RestMethod "http://127.0.0.1:<port>/json/list"
```

## Renderer Target Missing

Select the page target whose URL is `app://-/index.html` and title is `Codex`. Ignore worker targets. Store updates may change the title; prefer the URL when it remains available.

## Background Hidden

The primary selector is `main.main-surface`. Verify its bounding box covers the main pane and that its computed `background-image` contains the injected data URL. Keep composer surfaces opaque enough for readability. Avoid broad rules that make dialogs, menus, or code blocks transparent.

## Shortcut Behavior

Windows does not provide a stable supported API for silently pinning arbitrary desktop shortcuts on every Windows 11 build. Create Start Menu and desktop shortcuts, then ask the user to pin **Codex Skin** once. The shortcut launches the official package through `IApplicationActivationManager`; it does not copy or replace the package executable.

## Restore Behavior

`restore` sets the external configuration to disabled, removes the injected style from a reachable renderer, and stops the agent. It intentionally keeps the shortcut. `uninstall` additionally removes the shortcuts and `%LOCALAPPDATA%\CodexSkin`.
