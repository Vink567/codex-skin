import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const VERSION = '0.1.5';
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
const RUNTIME_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));

function runtimeRoot() {
  return process.env.CODEX_SKIN_RUNTIME_ROOT
    ? path.resolve(process.env.CODEX_SKIN_RUNTIME_ROOT)
    : path.join(os.homedir(), 'Library', 'Application Support', 'CodexSkin');
}

function paths() {
  const root = runtimeRoot();
  return {
    root,
    assets: path.join(root, 'assets'),
    config: path.join(root, 'config.json'),
    state: path.join(root, 'agent-state.json'),
    agent: process.env.CODEX_SKIN_AGENT_PATH || path.join(RUNTIME_DIRECTORY, 'codex-skin-agent.mjs'),
  };
}

function parseArguments(argv) {
  const [command, positionalPath, ...rest] = argv;
  const options = {};
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith('-')) throw new Error(`Unexpected argument: ${token}`);
    const name = token.replace(/^-+/, '').toLowerCase();
    const value = rest[index + 1];
    if (value == null || value.startsWith('-')) throw new Error(`Missing value for ${token}`);
    options[name] = value;
    index += 1;
  }
  return { command, filePath: positionalPath, options };
}

function ensureDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true });
}

function writeJson(filePath, value) {
  ensureDirectory(path.dirname(filePath));
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(temporaryPath, filePath);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readConfig() {
  const { config } = paths();
  return fs.existsSync(config) ? readJson(config) : null;
}

function result(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

function asNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function validateImage(filePath) {
  const resolved = path.resolve(String(filePath || ''));
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) throw new Error('未找到要应用的主题背景图。');
  if (!IMAGE_EXTENSIONS.has(path.extname(resolved).toLowerCase())) throw new Error('主题背景必须是 PNG、JPG、WEBP 或 GIF 图像。');
  return resolved;
}

function buildConfig(sourceImage, options) {
  const rootPaths = paths();
  ensureDirectory(rootPaths.assets);
  for (const entry of fs.readdirSync(rootPaths.assets, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.startsWith('background.')) fs.rmSync(path.join(rootPaths.assets, entry.name), { force: true });
  }
  const extension = path.extname(sourceImage).toLowerCase();
  const backgroundPath = path.join(rootPaths.assets, `background${extension}`);
  fs.copyFileSync(sourceImage, backgroundPath);
  return {
    schemaVersion: 1,
    toolVersion: VERSION,
    enabled: true,
    backgroundPath,
    fit: ['cover', 'contain', 'fill'].includes(options.fit) ? options.fit : 'cover',
    position: String(options.position || 'center center'),
    overlayOpacity: Math.min(.9, Math.max(0, asNumber(options.overlay, .3))),
    overlayColor: '255, 249, 238',
    baseColor: '#f4d18f',
    mainSelector: 'main.main-surface',
    composerScrim: false,
    headerSurface: true,
    headerSelector: 'header.app-header-tint',
    headerBackground: 'rgba(255, 248, 235, 0.94)',
    headerBorder: 'rgba(126, 87, 45, 0.18)',
    sidebarSurface: true,
    sidebarSelector: 'aside.app-shell-left-panel',
    sidebarBackground: '#fff8eb',
    removeTopFade: true,
    homeSuggestionCards: true,
    composerChrome: true,
    projectBarChrome: true,
    sidebarIcons: true,
    sidebarIconColor: '#8a5a32',
    folderIconColor: '#75451f',
    folderIconFill: 'rgba(229, 166, 77, 0.34)',
    installedAt: new Date().toISOString(),
    sourceImageSha256: crypto.createHash('sha256').update(fs.readFileSync(sourceImage)).digest('hex'),
  };
}

function resolveCodexApp() {
  const candidates = [
    process.env.CODEX_SKIN_CODEX_APP_PATH,
    '/Applications/Codex.app',
    path.join(os.homedir(), 'Applications', 'Codex.app'),
  ].filter(Boolean);
  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) return resolved;
  }
  const spotlight = spawnSync('/usr/bin/mdfind', ['kMDItemFSName == "Codex.app"c'], { encoding: 'utf8' });
  if (spotlight.status === 0) {
    const discovered = String(spotlight.stdout || '').split(/\r?\n/).map((item) => item.trim()).find((item) => item.endsWith('/Codex.app') && fs.existsSync(item));
    if (discovered) return discovered;
  }
  throw new Error('未找到 Codex.app。请先安装官方 Codex Desktop，或设置 CODEX_SKIN_CODEX_APP_PATH 指向 Codex.app。');
}

function macProcesses() {
  const command = spawnSync('/bin/ps', ['-axo', 'pid=,command='], { encoding: 'utf8' });
  if (command.status !== 0) return [];
  return String(command.stdout || '').split(/\r?\n/).map((line) => {
    const match = line.trim().match(/^(\d+)\s+(.+)$/);
    return match ? { pid: Number(match[1]), command: match[2] } : null;
  }).filter(Boolean);
}

function findCodexProcesses() {
  const configuredPath = process.env.CODEX_SKIN_CODEX_APP_PATH;
  const appPath = configuredPath && fs.existsSync(configuredPath) ? path.resolve(configuredPath) : null;
  return macProcesses().filter((entry) => {
    if (appPath) return entry.command.includes(path.join(appPath, 'Contents', 'MacOS'));
    return /\/Codex\.app\/Contents\/MacOS\/Codex(?:\s|$)/.test(entry.command);
  });
}

function debugPort(processInfo) {
  const match = String(processInfo?.command || '').match(/--remote-debugging-port(?:=|\s+)(\d+)/);
  return match ? Number(match[1]) : null;
}

function isAlive(pid) {
  try { process.kill(Number(pid), 0); return true; }
  catch { return false; }
}

function pause(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close((error) => error ? reject(error) : resolve(address.port));
    });
  });
}

function cdpAvailable(port, timeout = 900) {
  return new Promise((resolve) => {
    const request = http.get({ host: '127.0.0.1', port, path: '/json/version', timeout }, (response) => {
      response.resume();
      resolve(response.statusCode === 200);
    });
    request.once('timeout', () => { request.destroy(); resolve(false); });
    request.once('error', () => resolve(false));
  });
}

async function waitForCdp(port, timeout = 30000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await cdpAvailable(port)) return true;
    await pause(350);
  }
  return false;
}

function agentEnvironment() {
  const environment = { ...process.env };
  if (process.versions.electron || process.env.ELECTRON_RUN_AS_NODE) environment.ELECTRON_RUN_AS_NODE = '1';
  return environment;
}

function stopAgent() {
  const rootPaths = paths();
  if (!fs.existsSync(rootPaths.state)) return;
  try {
    const state = readJson(rootPaths.state);
    if (isAlive(state.pid)) process.kill(Number(state.pid), 'SIGTERM');
  } catch {
    // A stale or malformed state file cannot block applying a new skin.
  }
  fs.rmSync(rootPaths.state, { force: true });
}

function startAgent(port) {
  const rootPaths = paths();
  if (!fs.existsSync(rootPaths.agent)) throw new Error('未找到 Codex Skin macOS 监听器。请重新安装 Studio。');
  stopAgent();
  const child = spawn(process.execPath, [rootPaths.agent, '--port', String(port), '--config', rootPaths.config, '--state', rootPaths.state], {
    detached: true,
    stdio: 'ignore',
    env: agentEnvironment(),
  });
  child.unref();
  return child.pid;
}

function runAgentOnce(port, args) {
  return new Promise((resolve, reject) => {
    const rootPaths = paths();
    const child = spawn(process.execPath, [rootPaths.agent, '--port', String(port), '--config', rootPaths.config, ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: agentEnvironment(),
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => code === 0 ? resolve(stdout.trim()) : reject(new Error(stderr.trim() || stdout.trim() || `监听器退出码 ${code}`)));
  });
}

function launchCodex(appPath, port) {
  const child = spawn('/usr/bin/open', ['-n', appPath, '--args', `--remote-debugging-port=${port}`, '--remote-debugging-address=127.0.0.1'], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
}

async function launchOrAttach() {
  const config = readConfig();
  if (!config) throw new Error('尚未应用主题。请先导入主题包并点击“应用”。');
  const running = findCodexProcesses();
  const runningWithCdp = running.find((entry) => debugPort(entry));
  if (runningWithCdp && await cdpAvailable(debugPort(runningWithCdp))) {
    const agentPid = config.enabled ? startAgent(debugPort(runningWithCdp)) : null;
    return { launched: false, liveApplied: Boolean(config.enabled), debugPort: debugPort(runningWithCdp), agentPid };
  }
  if (running.length) {
    return {
      launched: false,
      liveApplied: false,
      requiresRelaunch: true,
      message: 'Codex 当前以普通方式运行。请先退出 Codex，再点击“使用当前皮肤启动 Codex”。',
    };
  }
  const port = await getFreePort();
  launchCodex(resolveCodexApp(), port);
  if (!await waitForCdp(port)) throw new Error('Codex 已启动，但没有开放本地预览连接。请确认使用的是官方 Codex Desktop 后重试。');
  const agentPid = config.enabled ? startAgent(port) : null;
  return { launched: true, liveApplied: Boolean(config.enabled), debugPort: port, agentPid };
}

async function changeSkin(filePath, options) {
  const sourceImage = validateImage(filePath);
  const rootPaths = paths();
  writeJson(rootPaths.config, buildConfig(sourceImage, options));
  const launch = await launchOrAttach();
  return {
    toolVersion: VERSION,
    installed: true,
    background: readConfig().backgroundPath,
    ...launch,
    packageFilesModified: false,
  };
}

async function restoreSkin() {
  const config = readConfig();
  if (!config) return { restored: true, installed: false, packageFilesModified: false };
  config.enabled = false;
  writeJson(paths().config, config);
  const running = findCodexProcesses().find((entry) => debugPort(entry));
  if (running && await cdpAvailable(debugPort(running))) {
    try { await runAgentOnce(debugPort(running), ['--once', '--remove']); } catch { /* The browser may be closing. */ }
  }
  stopAgent();
  return { restored: true, configPath: paths().config, packageFilesModified: false };
}

async function skinStatus() {
  const config = readConfig();
  const statePath = paths().state;
  let state = null;
  try { if (fs.existsSync(statePath)) state = readJson(statePath); } catch { /* Report an unavailable agent below. */ }
  const running = findCodexProcesses();
  const debugged = running.find((entry) => debugPort(entry));
  const port = debugPort(debugged);
  return {
    toolVersion: VERSION,
    installed: Boolean(config),
    enabled: Boolean(config?.enabled),
    background: config?.backgroundPath || null,
    configPath: paths().config,
    codexRunning: running.length > 0,
    codexProcessId: running[0]?.pid || null,
    debugPort: port,
    cdpAvailable: port ? await cdpAvailable(port) : false,
    agentRunning: Boolean(state && isAlive(state.pid)),
    agentProcessId: state?.pid || null,
    agentStatus: state?.status || null,
    styleVersion: state?.styleVersion || null,
    lastAppliedAt: state?.lastAppliedAt || null,
    lastError: state?.lastError || null,
    packageFilesModified: false,
  };
}

async function main() {
  if (process.platform !== 'darwin') throw new Error('codex-skin.mjs 只能在 macOS 上运行。');
  const { command, filePath, options } = parseArguments(process.argv.slice(2));
  if (command === 'change' || command === 'install') return result(await changeSkin(filePath, options));
  if (command === 'launch') return result(await launchOrAttach());
  if (command === 'restore') return result(await restoreSkin());
  if (command === 'status') return result(await skinStatus());
  throw new Error('用法：codex-skin.mjs <change|launch|restore|status> [背景图路径]');
}

main().catch((error) => {
  process.stderr.write(`codex-skin macOS: ${error?.stack || error}\n`);
  process.exitCode = 1;
});
