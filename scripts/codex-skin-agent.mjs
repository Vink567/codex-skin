import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import crypto from "node:crypto";

const STYLE_ID = "codex-skin-runtime-style";
const TARGET_URL = "app://-/index.html";
const SKIN_REVISION = "0.2.1";
const SIDEBAR_ICONS = Object.freeze({
  newTask: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.4 2.6a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>`,
  scheduled: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/></svg>`,
  plugins: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 3H5a2 2 0 0 0-2 2v3.5a3.5 3.5 0 1 1 0 7V19a2 2 0 0 0 2 2h3.5a3.5 3.5 0 1 1 7 0H19a2 2 0 0 0 2-2v-3.5a3.5 3.5 0 1 1 0-7V5a2 2 0 0 0-2-2h-3.5a3.5 3.5 0 1 1-7 0Z"/></svg>`,
  sites: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>`,
  pullRequests: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="5" r="2"/><circle cx="18" cy="19" r="2"/><path d="M6 7v10a2 2 0 0 0 2 2h3M18 17V8a3 3 0 0 0-3-3h-3"/><path d="m9 2 3 3-3 3"/></svg>`,
  chats: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a8 8 0 0 1-8 8H7l-4 2 1.4-4A9 9 0 1 1 21 12Z"/><path d="M9 12h6M12 9v6"/></svg>`,
  folderPaw: `<svg viewBox="0 0 24 24" aria-hidden="true"><path class="codex-skin-folder-shape" d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><circle class="codex-skin-paw-fill" cx="14.2" cy="12.2" r="1"/><circle class="codex-skin-paw-fill" cx="17.2" cy="12.2" r="1"/><circle class="codex-skin-paw-fill" cx="12.8" cy="14.3" r="1"/><circle class="codex-skin-paw-fill" cx="18.6" cy="14.3" r="1"/><path class="codex-skin-paw-fill" d="M13.6 17.1c0-1.3 1.1-2.3 2.2-2.3s2.2 1 2.2 2.3c0 1-1 1.5-2.2 1.5s-2.2-.5-2.2-1.5Z"/></svg>`,
});

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) continue;
    const key = item.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      args[key] = next;
      index += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function requireArg(args, name) {
  if (!args[name]) throw new Error(`Missing --${name}`);
  return args[name];
}

function ensureParent(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function writeJson(filePath, value) {
  ensureParent(filePath);
  const tempPath = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  fs.renameSync(tempPath, filePath);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function appendLog(logPath, level, message, fields = {}) {
  try {
    ensureParent(logPath);
    if (fs.existsSync(logPath) && fs.statSync(logPath).size > 1024 * 1024) {
      fs.renameSync(logPath, `${logPath}.1`);
    }
    fs.appendFileSync(
      logPath,
      `${JSON.stringify({ time: new Date().toISOString(), level, message, ...fields })}\n`,
      "utf8",
    );
  } catch {
    // Logging must never stop the injector.
  }
}

function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function imageMime(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const known = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
  };
  const mime = known[extension];
  if (!mime) throw new Error(`Unsupported background format: ${extension || "none"}`);
  return mime;
}

function normalizeConfig(raw) {
  const overlay = Number(raw.overlayOpacity ?? 0.3);
  if (!Number.isFinite(overlay) || overlay < 0 || overlay > 0.9) {
    throw new Error("overlayOpacity must be between 0 and 0.9");
  }
  const fit = ["cover", "contain", "fill"].includes(raw.fit) ? raw.fit : "cover";
  return {
    schemaVersion: 1,
    enabled: raw.enabled !== false,
    backgroundPath: path.resolve(String(raw.backgroundPath || "")),
    fit,
    position: String(raw.position || "center center"),
    overlayOpacity: overlay,
    overlayColor: String(raw.overlayColor || "255, 249, 238"),
    baseColor: String(raw.baseColor || "#f4d18f"),
    mainSelector: String(raw.mainSelector || "main.main-surface"),
    composerScrim: raw.composerScrim === true,
    headerSurface: raw.headerSurface !== false,
    headerSelector: String(raw.headerSelector || "header.app-header-tint"),
    headerBackground: String(raw.headerBackground || "rgba(255, 248, 235, 0.94)"),
    headerBorder: String(raw.headerBorder || "rgba(126, 87, 45, 0.18)"),
    sidebarSurface: raw.sidebarSurface !== false,
    sidebarSelector: String(raw.sidebarSelector || "aside.app-shell-left-panel"),
    sidebarBackground: String(raw.sidebarBackground || "#fff8eb"),
    removeTopFade: raw.removeTopFade !== false,
    sidebarIcons: raw.sidebarIcons !== false,
    sidebarIconColor: String(raw.sidebarIconColor || "#8a5a32"),
    folderIconColor: String(raw.folderIconColor || "#75451f"),
    folderIconFill: String(raw.folderIconFill || "rgba(229, 166, 77, 0.34)"),
  };
}

function buildSkin(config) {
  if (!fs.existsSync(config.backgroundPath)) {
    throw new Error(`Background image not found: ${config.backgroundPath}`);
  }
  const imageBytes = fs.readFileSync(config.backgroundPath);
  const mime = imageMime(config.backgroundPath);
  const dataUrl = `data:${mime};base64,${imageBytes.toString("base64")}`;
  const fingerprint = crypto
    .createHash("sha256")
    .update(SKIN_REVISION)
    .update(JSON.stringify(config))
    .update(imageBytes)
    .digest("hex")
    .slice(0, 16);

  const scrimRule = config.composerScrim
    ? `
${config.mainSelector} [class*="bg-gradient-to-t"][class*="from-token-main-surface-primary"] {
  background-image: linear-gradient(to top, rgba(255, 253, 249, 0.94), rgba(255, 253, 249, 0.60) 56%, rgba(255, 253, 249, 0)) !important;
}`
    : `
${config.mainSelector} [class*="bg-gradient-to-t"][class*="from-token-main-surface-primary"] {
  background-image: none !important;
}`;

  const headerRule = config.headerSurface
    ? `
${config.mainSelector} ${config.headerSelector} {
  background-color: ${config.headerBackground} !important;
  background-image: none !important;
  border-bottom: 1px solid ${config.headerBorder} !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72), 0 1px 8px rgba(112, 73, 32, 0.06) !important;
  backdrop-filter: blur(16px) saturate(1.08) !important;
}`
    : "";

  const sidebarRule = config.sidebarIcons
    ? `
[data-codex-skin-icon] {
  align-items: center;
  color: ${config.sidebarIconColor};
  display: inline-flex;
  flex: 0 0 16px;
  height: 16px;
  justify-content: center;
  width: 16px;
}
[data-codex-skin-icon] > svg {
  display: block;
  fill: none;
  height: 16px;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.7;
  width: 16px;
}
[data-codex-skin-icon="folderPaw"] {
  color: ${config.folderIconColor};
  --codex-skin-folder-fill: ${config.folderIconFill};
}
[data-codex-skin-icon="folderPaw"] .codex-skin-folder-shape {
  fill: var(--codex-skin-folder-fill);
  stroke: currentColor;
}
[data-codex-skin-icon="folderPaw"] .codex-skin-paw-fill {
  fill: currentColor;
  stroke: none;
}`
    : "";

  const sidebarSurfaceRule = config.sidebarSurface
    ? `
html,
body,
#root,
${config.sidebarSelector} {
  background-color: ${config.sidebarBackground} !important;
}
${config.sidebarSelector} {
  background-image: none !important;
}`
    : "";

  const topFadeRule = config.removeTopFade
    ? `
.app-shell-main-content-top-fade {
  display: none !important;
  opacity: 0 !important;
  background-color: transparent !important;
  background-image: none !important;
}`
    : "";

  const css = `
${config.mainSelector} {
  background-color: ${config.baseColor} !important;
  background-image: linear-gradient(rgba(${config.overlayColor}, ${config.overlayOpacity}), rgba(${config.overlayColor}, ${config.overlayOpacity})), url("${dataUrl}") !important;
  background-position: ${config.position} !important;
  background-repeat: no-repeat !important;
  background-size: ${config.fit} !important;
}${scrimRule}${headerRule}${sidebarSurfaceRule}${topFadeRule}${sidebarRule}
`;

  return {
    css,
    fingerprint,
    sidebarIcons: config.sidebarIcons ? SIDEBAR_ICONS : {},
  };
}

async function fetchJson(url, timeoutMs = 2000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

class CdpClient {
  constructor(webSocketUrl) {
    this.webSocketUrl = webSocketUrl;
    this.socket = null;
    this.nextId = 1;
    this.pending = new Map();
    this.closed = false;
  }

  async connect() {
    this.socket = new WebSocket(this.webSocketUrl);
    this.socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(JSON.stringify(message.error)));
      else pending.resolve(message.result);
    };
    this.socket.onclose = () => {
      this.closed = true;
      for (const pending of this.pending.values()) {
        pending.reject(new Error("CDP connection closed"));
      }
      this.pending.clear();
    };
    await new Promise((resolve, reject) => {
      this.socket.onopen = resolve;
      this.socket.onerror = () => reject(new Error("Unable to open CDP WebSocket"));
    });
  }

  request(method, params = {}) {
    if (this.closed || !this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("CDP connection is not open"));
    }
    const id = this.nextId;
    this.nextId += 1;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    if (this.socket && this.socket.readyState < WebSocket.CLOSING) this.socket.close();
  }
}

async function findPageTarget(port) {
  const targets = await fetchJson(`http://127.0.0.1:${port}/json/list`);
  return targets.find((item) => item.type === "page" && item.url === TARGET_URL)
    || targets.find((item) => item.type === "page" && item.title === "Codex")
    || null;
}

async function evaluate(client, expression) {
  const response = await client.request("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (response.exceptionDetails) {
    throw new Error(response.exceptionDetails.text || "Runtime.evaluate failed");
  }
  return response.result?.value;
}

async function getAppliedVersion(client) {
  return evaluate(
    client,
    `document.getElementById(${JSON.stringify(STYLE_ID)})?.dataset.codexSkinVersion || null`,
  );
}

async function applySkin(client, config, skin) {
  const expression = `(() => {
    const styleId = ${JSON.stringify(STYLE_ID)};
    const selector = ${JSON.stringify(config.mainSelector)};
    let style = document.getElementById(styleId);
    if (!style) {
      style = document.createElement("style");
      style.id = styleId;
      document.head.appendChild(style);
    }
    style.textContent = ${JSON.stringify(skin.css)};
    style.dataset.codexSkinVersion = ${JSON.stringify(skin.fingerprint)};
    document.documentElement.dataset.codexSkin = "active";
    const main = document.querySelector(selector);
    if (main) main.dataset.codexSkinTarget = "true";
    const icons = ${JSON.stringify(skin.sidebarIcons)};
    const clearSidebarIcons = () => {
      window.__codexSkinSidebarObserver?.disconnect();
      delete window.__codexSkinSidebarObserver;
      document.querySelectorAll("[data-codex-skin-icon]").forEach((node) => node.remove());
      document.querySelectorAll("svg[data-codex-skin-original]").forEach((node) => {
        node.style.removeProperty("display");
        node.removeAttribute("data-codex-skin-original");
      });
    };
    const applyIcon = (row, key) => {
      const markup = icons[key];
      if (!markup) return false;
      const original = [...row.querySelectorAll("svg")].find((svg) => !svg.closest("[data-codex-skin-icon]"));
      if (!original?.parentElement) return false;
      const host = original.parentElement;
      original.dataset.codexSkinOriginal = "true";
      original.style.setProperty("display", "none", "important");
      let replacement = host.querySelector(":scope > [data-codex-skin-icon]");
      if (!replacement) {
        replacement = document.createElement("span");
        host.appendChild(replacement);
      }
      replacement.dataset.codexSkinIcon = key;
      if (replacement.dataset.codexSkinMarkup !== key) {
        replacement.innerHTML = markup;
        replacement.dataset.codexSkinMarkup = key;
      }
      return true;
    };
    const applySidebarIcons = () => {
      const normalize = (value) => String(value || "").replace(/\\s+/g, " ").trim();
      const navRules = [
        { key: "newTask", match: /^(新建任务|New task)/i },
        { key: "scheduled", match: /^(已安排|Scheduled)/i },
        { key: "plugins", match: /^(插件|Plugins)/i },
        { key: "sites", match: /^(站点|Sites)/i },
        { key: "pullRequests", match: /^(拉取请求|Pull requests)/i },
        { key: "chats", match: /^(聊天|Chats)/i },
      ];
      let appliedCount = 0;
      document.querySelectorAll("button").forEach((row) => {
        const rect = row.getBoundingClientRect();
        if (rect.x >= 306 || rect.y < 70 || rect.y > 280) return;
        const text = normalize(row.textContent);
        const rule = navRules.find((candidate) => candidate.match.test(text));
        if (rule && applyIcon(row, rule.key)) appliedCount += 1;
      });
      document.querySelectorAll('[class*="group/folder-row"]').forEach((row) => {
        const rect = row.getBoundingClientRect();
        if (rect.x < 306 && applyIcon(row, "folderPaw")) appliedCount += 1;
      });
      return appliedCount;
    };
    clearSidebarIcons();
    let sidebarIconsApplied = 0;
    if (Object.keys(icons).length) {
      sidebarIconsApplied = applySidebarIcons();
      let queued = false;
      const observer = new MutationObserver(() => {
        if (queued) return;
        queued = true;
        queueMicrotask(() => {
          queued = false;
          applySidebarIcons();
        });
      });
      observer.observe(document.body, { childList: true, subtree: true });
      window.__codexSkinSidebarObserver = observer;
    }
    return {
      applied: Boolean(main),
      selector,
      version: style.dataset.codexSkinVersion,
      sidebarIconsApplied,
      backgroundImage: main ? getComputedStyle(main).backgroundImage.slice(0, 80) : null,
      bounds: main ? (() => {
        const rect = main.getBoundingClientRect();
        return { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) };
      })() : null,
    };
  })()`;
  return evaluate(client, expression);
}

async function removeSkin(client, selector) {
  return evaluate(
    client,
    `(() => {
      document.getElementById(${JSON.stringify(STYLE_ID)})?.remove();
      delete document.documentElement.dataset.codexSkin;
      window.__codexSkinSidebarObserver?.disconnect();
      delete window.__codexSkinSidebarObserver;
      document.querySelectorAll("[data-codex-skin-icon]").forEach((node) => node.remove());
      document.querySelectorAll("svg[data-codex-skin-original]").forEach((node) => {
        node.style.removeProperty("display");
        node.removeAttribute("data-codex-skin-original");
      });
      const main = document.querySelector(${JSON.stringify(selector)});
      if (main) delete main.dataset.codexSkinTarget;
      return { removed: true, selectorMatched: Boolean(main) };
    })()`,
  );
}

async function captureScreenshot(client, outputPath) {
  await client.request("Page.enable");
  const result = await client.request("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
  });
  ensureParent(outputPath);
  fs.writeFileSync(outputPath, Buffer.from(result.data, "base64"));
  return outputPath;
}

async function connectToPage(port) {
  const target = await findPageTarget(port);
  if (!target) throw new Error("Codex page target was not found");
  const client = new CdpClient(target.webSocketDebuggerUrl);
  await client.connect();
  await client.request("Runtime.enable");
  await client.request("Page.enable");
  await client.request("Page.setBypassCSP", { enabled: true });
  return { target, client };
}

async function runOneShot(args, port, configPath) {
  const rawConfig = readJson(configPath);
  const config = normalizeConfig(rawConfig);
  const { target, client } = await connectToPage(port);
  try {
    if (args.remove) {
      const result = await removeSkin(client, config.mainSelector);
      process.stdout.write(`${JSON.stringify({ ok: true, mode: "remove", targetId: target.id, ...result })}\n`);
      return;
    }
    if (args.probe) {
      const appliedVersion = await getAppliedVersion(client);
      const result = await evaluate(client, `(() => {
        const main = document.querySelector(${JSON.stringify(config.mainSelector)});
        const rect = main?.getBoundingClientRect();
        return {
          title: document.title,
          url: location.href,
          selectorMatched: Boolean(main),
          bounds: rect ? { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) } : null,
          styleVersion: ${JSON.stringify(appliedVersion)},
        };
      })()`);
      process.stdout.write(`${JSON.stringify({ ok: true, mode: "probe", targetId: target.id, ...result }, null, 2)}\n`);
      return;
    }
    const skin = buildSkin(config);
    const applied = config.enabled ? await applySkin(client, config, skin) : await removeSkin(client, config.mainSelector);
    let screenshot = null;
    if (args.screenshot) screenshot = await captureScreenshot(client, path.resolve(String(args.screenshot)));
    process.stdout.write(`${JSON.stringify({ ok: true, mode: "once", targetId: target.id, ...applied, screenshot }, null, 2)}\n`);
  } finally {
    client.close();
  }
}

async function runWatch(args, port, configPath, statePath) {
  const logPath = path.join(path.dirname(configPath), "agent.log");
  if (fs.existsSync(statePath)) {
    try {
      const existing = readJson(statePath);
      if (existing.port === port && isProcessAlive(Number(existing.pid))) {
        appendLog(logPath, "info", "agent_already_running", { pid: existing.pid, port });
        return;
      }
    } catch {
      // Replace stale or unreadable state.
    }
  }

  const state = {
    pid: process.pid,
    port,
    startedAt: new Date().toISOString(),
    status: "starting",
    targetId: null,
    styleVersion: null,
    lastAppliedAt: null,
    lastError: null,
  };
  writeJson(statePath, state);
  appendLog(logPath, "info", "agent_started", { pid: process.pid, port });

  let client = null;
  let targetId = null;
  let missingEndpointSince = null;
  let lastConfigMtime = 0;
  let config = null;
  let skin = null;
  let stopping = false;

  const cleanup = () => {
    if (stopping) return;
    stopping = true;
    client?.close();
    try {
      if (fs.existsSync(statePath)) {
        const current = readJson(statePath);
        if (Number(current.pid) === process.pid) fs.rmSync(statePath, { force: true });
      }
    } catch {
      // Ignore cleanup races.
    }
    appendLog(logPath, "info", "agent_stopped", { pid: process.pid, port });
  };

  process.on("SIGINT", () => { cleanup(); process.exit(0); });
  process.on("SIGTERM", () => { cleanup(); process.exit(0); });
  process.on("exit", cleanup);

  while (!stopping) {
    try {
      const stat = fs.statSync(configPath);
      if (stat.mtimeMs !== lastConfigMtime) {
        config = normalizeConfig(readJson(configPath));
        skin = config.enabled ? buildSkin(config) : null;
        lastConfigMtime = stat.mtimeMs;
      }

      const target = await findPageTarget(port);
      missingEndpointSince = null;
      if (!target) throw new Error("Codex page target was not found");

      if (!client || client.closed || target.id !== targetId) {
        client?.close();
        client = new CdpClient(target.webSocketDebuggerUrl);
        await client.connect();
        await client.request("Runtime.enable");
        await client.request("Page.enable");
        await client.request("Page.setBypassCSP", { enabled: true });
        targetId = target.id;
        state.targetId = targetId;
        appendLog(logPath, "info", "renderer_connected", { targetId });
      }

      const currentVersion = await getAppliedVersion(client);
      if (!config.enabled) {
        if (currentVersion) await removeSkin(client, config.mainSelector);
        state.status = "disabled";
        state.styleVersion = null;
      } else if (currentVersion !== skin.fingerprint) {
        const result = await applySkin(client, config, skin);
        if (!result.applied) throw new Error(`Skin selector did not match: ${config.mainSelector}`);
        state.status = "active";
        state.styleVersion = skin.fingerprint;
        state.lastAppliedAt = new Date().toISOString();
        appendLog(logPath, "info", "skin_applied", {
          targetId,
          styleVersion: skin.fingerprint,
          bounds: result.bounds,
        });
      } else {
        state.status = "active";
        state.styleVersion = currentVersion;
      }
      state.lastError = null;
      writeJson(statePath, state);
    } catch (error) {
      client?.close();
      client = null;
      targetId = null;
      state.status = "waiting";
      state.lastError = String(error?.message || error);
      writeJson(statePath, state);
      if (!missingEndpointSince) missingEndpointSince = Date.now();
      if (Date.now() - missingEndpointSince > 15000) {
        appendLog(logPath, "info", "cdp_endpoint_closed", { port });
        break;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1200));
  }

  cleanup();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const port = Number(requireArg(args, "port"));
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid --port");
  const configPath = path.resolve(requireArg(args, "config"));
  const statePath = path.resolve(args.state || path.join(path.dirname(configPath), "agent-state.json"));

  if (args.once || args.remove || args.probe || args.screenshot) {
    await runOneShot(args, port, configPath);
  } else {
    await runWatch(args, port, configPath, statePath);
  }
}

main().catch((error) => {
  process.stderr.write(`codex-skin-agent: ${error?.stack || error}\n`);
  process.exitCode = 1;
});
