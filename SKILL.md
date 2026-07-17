---
name: codex-skin
description: Install, change, verify, restore, or remove a persistent background skin for the Windows Codex desktop app without modifying the MSIX package or app.asar. Use when a user provides a background image, asks to skin or theme Codex with an image, wants a silent taskbar launcher that injects CSS over loopback CDP, needs to inspect Codex skin status, or wants to restore the official appearance.
---

# Codex Skin

Use the bundled CLI as the deterministic implementation. Keep Codex package files and `~\.codex\config.toml` unchanged.

## Install Or Change A Background

Run from the skill directory:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\codex-skin.ps1 install "<absolute-image-path>"
```

Use `change` instead of `install` when replacing an existing background. Optional parameters:

```powershell
-Overlay 0.30 -Fit cover -Position "center center"
```

The CLI copies the runtime and image to `%LOCALAPPDATA%\CodexSkin`, creates Start Menu and desktop launchers, and immediately attaches when the running Codex process already exposes a loopback CDP port. The default skin also applies a warm ivory sidebar surface, removes the main-content top fade, and uses warm navigation icons with paw-badged project folders. Ask the user to pin the generated **Codex Skin** shortcut once; do not attempt unsupported automatic taskbar pinning.

## Launch And Verify

Use the generated shortcut for subsequent launches. It starts the official Store package with a random loopback-only CDP port, then starts the hidden skin agent.

Check status:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\codex-skin.ps1 status
```

Capture the live Codex window after injection:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\codex-skin.ps1 capture "<absolute-output-png>"
```

Treat a successful CDP connection, `main.main-surface` match, active style marker, and screenshot as the verification boundary. Never inspect or log conversation text.

## Restore Or Remove

Disable the skin and remove it from the current renderer while keeping the launcher:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\codex-skin.ps1 restore
```

Remove the external runtime, shortcuts, image, and state:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\codex-skin.ps1 uninstall
```

Read [references/troubleshooting.md](references/troubleshooting.md) when launch, CDP discovery, or renderer selection fails.

## Safety Boundaries

- Bind CDP to `127.0.0.1` and use a random port for new launches.
- Do not expose CDP to the LAN or use a fixed public port.
- Do not modify `C:\Program Files\WindowsApps`, `app.asar`, Codex configuration, authentication, conversations, or browser data.
- Do not kill the active Codex process automatically. If Codex is already running without CDP, report that it must be closed before using the generated launcher.
- Keep logs metadata-only: port, target id, selector match, style version, timestamps, and errors.
- Run install or live restart verification from an external PowerShell session if the current Codex session would otherwise terminate.
