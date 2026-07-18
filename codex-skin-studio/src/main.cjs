const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const AdmZip = require('adm-zip');
const { spawn } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
const PACKAGE_FORMAT = 'codex-skin-studio-theme';
const ALLOWED_RUNTIME_KEYS = new Set([
  'overlayColor', 'baseColor', 'mainSelector', 'composerScrim',
  'headerSurface', 'headerSelector', 'headerBackground', 'headerBorder',
  'sidebarSurface', 'sidebarSelector', 'sidebarBackground', 'removeTopFade',
  'homeSuggestionCards', 'composerChrome', 'projectBarChrome', 'sidebarIcons',
  'sidebarIconColor', 'folderIconColor', 'folderIconFill'
]);
const ICON_KEYS = new Set(['newTask', 'scheduled', 'plugins', 'sites', 'pullRequests', 'chats', 'folderPaw', 'attachment', 'permission', 'model', 'microphone', 'send']);
const SIDEBAR_ICON_KEYS = new Set(['newTask', 'scheduled', 'plugins', 'sites', 'pullRequests', 'chats', 'folderPaw']);
const importedItems = new Map();
let mainWindow;

function importRoot() {
  const root = path.join(app.getPath('userData'), 'theme-packages');
  fs.mkdirSync(root, { recursive: true });
  return root;
}

function runtimeRoot() {
  return process.platform === 'win32'
    ? path.join(process.env.LOCALAPPDATA || app.getPath('appData'), 'CodexSkin')
    : path.join(app.getPath('appData'), 'CodexSkin');
}

function skinRuntimePath() {
  if (process.platform === 'darwin') {
    const packaged = path.join(process.resourcesPath, 'codex-skin-runtime', 'codex-skin.mjs');
    const development = path.resolve(__dirname, '..', '..', 'codex-skin-runtime', 'codex-skin.mjs');
    return fs.existsSync(packaged) ? packaged : development;
  }
  const packaged = path.join(process.resourcesPath, 'codex-skin-runtime', 'codex-skin.ps1');
  const development = path.resolve(__dirname, '..', '..', 'codex-skin-runtime', 'codex-skin.ps1');
  return fs.existsSync(packaged) ? packaged : development;
}

function hexColor(value, fallback) {
  return /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value).toLowerCase() : fallback;
}

function hexToRgba(hex, alpha) {
  const normalized = hexColor(hex, '#ffffff').slice(1);
  const channels = normalized.match(/.{2}/g).map((value) => Number.parseInt(value, 16));
  return `rgba(${channels.join(', ')}, ${alpha})`;
}

function studioTheme(theme = {}) {
  const colors = {
    overlay: hexColor(theme.overlay, '#fff9ee'), header: hexColor(theme.header, '#fff8eb'), headerBorder: hexColor(theme.headerBorder, '#7e572d'),
    sidebar: hexColor(theme.sidebar, '#fff8eb'), navIcon: hexColor(theme.navIcon, '#8a5a32'), folder: hexColor(theme.folder, '#75451f'),
    card1: hexColor(theme.card1, '#e9f3fa'), card2: hexColor(theme.card2, '#f4eefb'), card3: hexColor(theme.card3, '#ebf5eb'), card4: hexColor(theme.card4, '#fceedf'),
    composer: hexColor(theme.composer, '#fff9f0'), composerBorder: hexColor(theme.composerBorder, '#88542a'), add: hexColor(theme.add, '#e8f3fa'),
    permission: hexColor(theme.permission, '#ffebda'), model: hexColor(theme.model, '#f3edf9'), mic: hexColor(theme.mic, '#ebf4e8'), send: hexColor(theme.send, '#b9683a'),
    projectBar: hexColor(theme.projectBar, '#faf0de'), projectControl: hexColor(theme.projectControl, '#fffaf1'),
  };
  const enabled = Object.fromEntries(['headerSurface', 'sidebarSurface', 'sidebarIcons', 'homeSuggestionCards', 'composerChrome', 'projectBarChrome', 'removeTopFade'].map((key) => [key, theme[key] !== false]));
  return { colors, enabled };
}

function normalizeIconEnabled(iconPaths, requested) {
  const input = requested && typeof requested === 'object' && !Array.isArray(requested) ? requested : {};
  return Object.fromEntries(Object.keys(iconPaths || {}).filter((key) => ICON_KEYS.has(key)).map((key) => [key, input[key] !== false]));
}

function buildIconCss(colors, iconEnabled) {
  const navigationSelectors = [...SIDEBAR_ICON_KEYS].filter((key) => key !== 'folderPaw' && iconEnabled[key])
    .map((key) => `[data-codex-skin-icon="${key}"]`).join(',');
  return [
    navigationSelectors ? `${navigationSelectors}{color:${colors.navIcon}!important;}` : '',
    iconEnabled.folderPaw ? `[data-codex-skin-icon="folderPaw"]{color:${colors.folder}!important;--codex-skin-folder-fill:${hexToRgba(colors.folder,.34)}!important;}` : '',
  ].filter(Boolean).join('\n');
}

function buildStudioCss({ colors, enabled, iconEnabled = {} }) {
  const card = (index, color) => `section[class~="group/home-suggestions"] [class~="grid"] > :nth-child(${index}){--codex-skin-card-bg:${hexToRgba(color,.96)}!important;--codex-skin-card-hover:${hexToRgba(color,.99)}!important;--codex-skin-card-border:${color}!important;}`;
  return [
    enabled.headerSurface ? `main.main-surface header.app-header-tint{background-color:${hexToRgba(colors.header,.94)}!important;border-bottom-color:${hexToRgba(colors.headerBorder,.25)}!important;}` : '',
    enabled.sidebarSurface ? `aside.app-shell-left-panel{background-color:${colors.sidebar}!important;}` : '',
    enabled.sidebarIcons ? buildIconCss(colors, iconEnabled) : '',
    enabled.homeSuggestionCards ? [card(1, colors.card1), card(2, colors.card2), card(3, colors.card3), card(4, colors.card4)].join('\n') : '',
    enabled.composerChrome ? `[data-codex-skin-composer]{background-color:${hexToRgba(colors.composer,.94)}!important;outline-color:${hexToRgba(colors.composerBorder,.34)}!important}[data-codex-skin-composer]:focus-within{outline-color:${hexToRgba(colors.composerBorder,.68)}!important;box-shadow:0 0 0 3px ${hexToRgba(colors.composerBorder,.15)},0 12px 30px ${hexToRgba(colors.composerBorder,.18)}!important}[data-codex-skin-composer-control="add"]{background-color:${hexToRgba(colors.add,.94)}!important}[data-codex-skin-composer-control="permission"]{background-color:${hexToRgba(colors.permission,.94)}!important}[data-codex-skin-composer-control="model"]{background-color:${hexToRgba(colors.model,.94)}!important}[data-codex-skin-composer-control="mic"]{background-color:${hexToRgba(colors.mic,.94)}!important}[data-codex-skin-composer-control="send"]{background-color:${colors.send}!important;border-color:${colors.send}!important}` : '',
    enabled.projectBarChrome ? `[data-codex-skin-project-bar]{background-color:${hexToRgba(colors.projectBar,.96)}!important}[data-codex-skin-project-control]{background-color:${hexToRgba(colors.projectControl,.82)}!important}` : '',
  ].filter(Boolean).join('\n');
}

function isSafeSvg(markup) {
  return /^\s*<svg\b/i.test(markup)
    && !/<\s*(script|foreignObject|iframe|object|embed)\b|\son[a-z]+\s*=|javascript:|data:|https?:|url\s*\(/i.test(markup);
}

function installThemeIcons(iconPaths, runtimeRoot) {
  const installed = {};
  if (!iconPaths || typeof iconPaths !== 'object' || Array.isArray(iconPaths)) return installed;
  const destinationRoot = path.join(runtimeRoot, 'assets', 'theme-icons');
  fs.mkdirSync(destinationRoot, { recursive: true });
  for (const [key, sourcePath] of Object.entries(iconPaths)) {
    if (!ICON_KEYS.has(key)) throw new Error(`主题包含不支持的图标：${key}`);
    if (!fs.existsSync(sourcePath)) throw new Error(`主题图标不存在：${key}`);
    const markup = fs.readFileSync(sourcePath, 'utf8');
    if (!isSafeSvg(markup)) throw new Error(`主题图标不安全：${key}`);
    const destination = path.join(destinationRoot, `${key}.svg`);
    fs.writeFileSync(destination, markup, 'utf8');
    installed[key] = destination;
  }
  return installed;
}

function writeStudioTheme(theme, item, requestedIconEnabled) {
  const skinRoot = runtimeRoot();
  const configPath = path.join(skinRoot, 'config.json');
  if (!fs.existsSync(configPath)) throw new Error('Codex Skin 运行时尚未初始化。请重试应用主题。');
  const { colors, enabled } = studioTheme(theme);
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const iconEnabled = normalizeIconEnabled(item?.iconPaths, requestedIconEnabled);
  const enabledIconPaths = Object.fromEntries(Object.entries(item?.iconPaths || {}).filter(([key]) => iconEnabled[key]));
  const installedIconPaths = installThemeIcons(enabledIconPaths, skinRoot);
  const sidebarIconsEnabled = enabled.sidebarIcons && [...SIDEBAR_ICON_KEYS].some((key) => iconEnabled[key]);
  const cssPath = path.join(skinRoot, 'assets', 'studio-theme.css');
  fs.mkdirSync(path.dirname(cssPath), { recursive: true });
  const packageCss = item?.customCssPath && fs.existsSync(item.customCssPath)
    ? fs.readFileSync(item.customCssPath, 'utf8')
    : '';
  fs.writeFileSync(cssPath, `${packageCss}\n${buildStudioCss({ colors, enabled, iconEnabled })}`.trim(), 'utf8');
  if (item?.runtimeConfig) Object.assign(config, item.runtimeConfig);
  Object.assign(config, {
    overlayColor: hexToRgba(colors.overlay, 1).match(/\d+/g).slice(0, 3).join(', '), baseColor: colors.overlay,
    headerSurface: enabled.headerSurface, headerBackground: hexToRgba(colors.header, .94), headerBorder: hexToRgba(colors.headerBorder, .25),
    sidebarSurface: enabled.sidebarSurface, sidebarBackground: colors.sidebar, sidebarIcons: sidebarIconsEnabled,
    sidebarIconColor: colors.navIcon, folderIconColor: colors.folder, folderIconFill: hexToRgba(colors.folder, .34),
    homeSuggestionCards: enabled.homeSuggestionCards, composerChrome: enabled.composerChrome, projectBarChrome: enabled.projectBarChrome,
    removeTopFade: enabled.removeTopFade, customCssPath: cssPath,
    iconPaths: installedIconPaths, iconEnabled,
    themeId: item?.themeId || null,
    themeName: item?.name || 'Studio Custom Theme',
    themeVersion: item?.version || null,
    themePackage: item?.packageName || null,
  });
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
}

function toThemeItem(filePath, metadata = {}) {
  const previewPath = metadata.previewPath && fs.existsSync(metadata.previewPath) ? metadata.previewPath : filePath;
  return {
    id: crypto.createHash('sha1').update(`${filePath}|${metadata.version || ''}`).digest('hex').slice(0, 12),
    kind: metadata.kind || 'image',
    name: metadata.name || path.basename(filePath),
    version: metadata.version || null,
    description: metadata.description || '',
    path: filePath,
    url: pathToFileURL(filePath).href,
    previewUrl: pathToFileURL(previewPath).href,
    size: fs.statSync(filePath).size,
    overlay: Number.isFinite(metadata.overlay) ? metadata.overlay : .3,
    fit: ['cover', 'contain', 'fill'].includes(metadata.fit) ? metadata.fit : 'cover',
    position: metadata.position || 'center center',
    modifiedAreas: Array.isArray(metadata.modifiedAreas) ? metadata.modifiedAreas : [],
    studioTheme: metadata.studioTheme || null,
    customCssPath: metadata.customCssPath || null,
    iconPaths: metadata.iconPaths || {},
    iconSvgs: metadata.iconSvgs || {},
    runtimeConfig: metadata.runtimeConfig || {},
    packageName: metadata.packageName || null,
    themeId: metadata.themeId || null,
  };
}

function normalizeRelativePath(value, label = '资源路径') {
  const raw = String(value || '').replaceAll('\\', '/');
  if (!raw || raw.startsWith('/') || /^[a-zA-Z]:/.test(raw)) throw new Error(`${label}必须是包内相对路径。`);
  const normalized = path.posix.normalize(raw).replace(/^\.\//, '');
  if (!normalized || normalized === '..' || normalized.startsWith('../') || normalized.includes('/../')) {
    throw new Error(`${label}包含不安全的路径。`);
  }
  return normalized;
}

function createImportTarget(label) {
  const safeLabel = String(label || 'theme').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 80);
  const target = path.join(importRoot(), `${Date.now()}-${safeLabel}`);
  fs.mkdirSync(target, { recursive: true });
  return target;
}

function writeImportedFile(target, relativePath, bytes) {
  const safeRelative = normalizeRelativePath(relativePath);
  const rootPrefix = `${path.resolve(target)}${path.sep}`;
  const destination = path.resolve(target, safeRelative.split('/').join(path.sep));
  if (!destination.startsWith(rootPrefix)) throw new Error('素材包包含不安全的文件路径。');
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, bytes);
  return destination;
}

function importStudioTheme(zip, entryMap, manifestName) {
  let theme;
  try { theme = JSON.parse(entryMap.get(manifestName).getData().toString('utf8')); }
  catch { throw new Error('theme.json 不是有效的 JSON。'); }

  if (theme?.schemaVersion !== 1) throw new Error('不支持的主题清单版本。');
  if (theme?.package?.format !== PACKAGE_FORMAT || theme?.package?.formatVersion !== 1) {
    throw new Error('这不是 Codex Skin Studio 主题资源包。');
  }
  for (const key of ['id', 'name', 'version', 'description', 'scopeSlug']) {
    if (typeof theme[key] !== 'string' || !theme[key].trim()) throw new Error(`theme.json 缺少字段：${key}`);
  }
  if (!/^\d+\.\d+\.\d+$/.test(theme.version)) throw new Error('主题版本必须使用 major.minor.patch。');
  if (!theme.background || !theme.resources || !theme.runtimeConfig) throw new Error('theme.json 缺少资源或运行配置。');
  if (!Array.isArray(theme.modifiedAreas) || !theme.modifiedAreas.length) throw new Error('theme.json 没有声明修改区域。');

  const rootPrefix = path.posix.dirname(manifestName);
  if (!rootPrefix || rootPrefix === '.') throw new Error('主题 ZIP 必须包含单一根目录。');
  if (path.posix.basename(rootPrefix) !== theme.package.name) throw new Error('ZIP 根目录与主题包名称不一致。');

  const backgroundRelative = normalizeRelativePath(theme.background.file, '背景路径');
  const previewRelative = normalizeRelativePath(theme.resources.preview, '预览路径');
  const customCssRelative = theme.resources.customCss ? normalizeRelativePath(theme.resources.customCss, '主题 CSS 路径') : null;
  const iconRelativePaths = {};
  if (theme.resources.icons != null) {
    if (typeof theme.resources.icons !== 'object' || Array.isArray(theme.resources.icons)) {
      throw new Error('主题图标映射必须是对象。');
    }
    for (const [key, resourcePath] of Object.entries(theme.resources.icons)) {
      if (!ICON_KEYS.has(key)) throw new Error(`主题包含不支持的图标：${key}`);
      const relativePath = normalizeRelativePath(resourcePath, `图标路径 ${key}`);
      if (path.extname(relativePath).toLowerCase() !== '.svg') throw new Error(`主题图标必须是 SVG：${key}`);
      if (Object.values(iconRelativePaths).includes(relativePath)) throw new Error(`主题图标资源重复：${relativePath}`);
      iconRelativePaths[key] = relativePath;
    }
  }
  const isBackgroundOnly = theme.modifiedAreas.length === 1 && theme.modifiedAreas[0] === 'main-background';
  if (!isBackgroundOnly) {
    const missingIcons = [...ICON_KEYS].filter((key) => !iconRelativePaths[key]);
    if (missingIcons.length) throw new Error(`主题缺少 SVG 图标：${missingIcons.join(', ')}`);
  }
  if (!IMAGE_EXTENSIONS.has(path.extname(backgroundRelative).toLowerCase())) throw new Error('主题背景格式不受支持。');
  if (path.extname(previewRelative).toLowerCase() !== '.png') throw new Error('主题预览必须是 PNG。');
  if (customCssRelative && path.extname(customCssRelative).toLowerCase() !== '.css') throw new Error('主题样式必须是 CSS。');
  if (!['cover', 'contain', 'fill'].includes(theme.background.fit)) throw new Error('主题图片适配方式无效。');
  const overlay = Number(theme.background.overlayOpacity);
  if (!Number.isFinite(overlay) || overlay < 0 || overlay > .9) throw new Error('主题遮罩值必须在 0 到 0.9 之间。');

  const runtimeConfig = {};
  for (const [key, value] of Object.entries(theme.runtimeConfig)) {
    if (!ALLOWED_RUNTIME_KEYS.has(key)) throw new Error(`主题包含不支持的运行配置：${key}`);
    runtimeConfig[key] = value;
  }
  const normalizedStudioTheme = studioTheme(theme.studioTheme || {});
  const studioPalette = { ...normalizedStudioTheme.colors, ...normalizedStudioTheme.enabled };

  const packageEntryName = (relativePath) => `${rootPrefix}/${relativePath}`;
  const requiredRelativeFiles = ['theme.json', 'SHA256SUMS.txt', previewRelative, backgroundRelative];
  if (customCssRelative) requiredRelativeFiles.push(customCssRelative);
  requiredRelativeFiles.push(...Object.values(iconRelativePaths));
  const allowedPackageFiles = new Set(requiredRelativeFiles);
  for (const entryName of entryMap.keys()) {
    if (!entryName.startsWith(`${rootPrefix}/`)) throw new Error('主题 ZIP 只能包含一个根目录。');
    const relative = entryName.slice(rootPrefix.length + 1);
    if (!allowedPackageFiles.has(relative)) throw new Error(`主题包包含不允许的文件：${relative}`);
  }
  for (const relative of requiredRelativeFiles) {
    if (!entryMap.has(packageEntryName(relative))) throw new Error(`主题包缺少文件：${relative}`);
  }
  for (const [key, relative] of Object.entries(iconRelativePaths)) {
    if (!isSafeSvg(entryMap.get(packageEntryName(relative)).getData().toString('utf8'))) {
      throw new Error(`主题图标不安全：${key}`);
    }
  }

  const checksumText = entryMap.get(packageEntryName('SHA256SUMS.txt')).getData().toString('utf8');
  const checksumPaths = new Set();
  for (const line of checksumText.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const match = line.match(/^([a-fA-F0-9]{64})  (.+)$/);
    if (!match) throw new Error(`校验文件包含无效记录：${line}`);
    const relative = normalizeRelativePath(match[2], '校验路径');
    if (relative === 'SHA256SUMS.txt' || !allowedPackageFiles.has(relative)) throw new Error(`校验文件引用了无效资源：${relative}`);
    const entry = entryMap.get(packageEntryName(relative));
    if (!entry) throw new Error(`校验资源不存在：${relative}`);
    const actual = crypto.createHash('sha256').update(entry.getData()).digest('hex');
    if (actual.toLowerCase() !== match[1].toLowerCase()) throw new Error(`资源校验失败：${relative}`);
    checksumPaths.add(relative);
  }
  for (const relative of requiredRelativeFiles.filter((item) => item !== 'SHA256SUMS.txt')) {
    if (!checksumPaths.has(relative)) throw new Error(`资源缺少 SHA-256：${relative}`);
  }

  const target = createImportTarget(`${theme.id}-${theme.version}`);
  const extracted = {};
  for (const relative of requiredRelativeFiles) {
    extracted[relative] = writeImportedFile(target, relative, entryMap.get(packageEntryName(relative)).getData());
  }
  const iconPaths = Object.fromEntries(Object.entries(iconRelativePaths).map(([key, relative]) => [key, extracted[relative]]));
  const iconSvgs = Object.fromEntries(Object.entries(iconPaths).map(([key, iconPath]) => {
    const markup = fs.readFileSync(iconPath, 'utf8');
    if (!isSafeSvg(markup)) throw new Error(`主题图标不安全：${key}`);
    return [key, markup];
  }));
  return [toThemeItem(extracted[backgroundRelative], {
    kind: 'theme', name: theme.name, version: theme.version, description: theme.description,
    previewPath: extracted[previewRelative], overlay, fit: theme.background.fit,
    position: String(theme.background.position || 'center center'), modifiedAreas: theme.modifiedAreas.map(String),
    studioTheme: studioPalette, customCssPath: customCssRelative ? extracted[customCssRelative] : null, iconPaths, iconSvgs,
    runtimeConfig, packageName: theme.package.name, themeId: theme.id,
  })];
}

function extractZipSafely(zipPath) {
  const zip = new AdmZip(zipPath);
  const entryMap = new Map();
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;
    const entryName = normalizeRelativePath(entry.entryName.replace(/\/$/, ''), 'ZIP 条目');
    if (entryMap.has(entryName)) throw new Error(`素材包包含重复文件：${entryName}`);
    entryMap.set(entryName, entry);
  }
  const manifests = [...entryMap.keys()].filter((name) => name === 'theme.json' || name.endsWith('/theme.json'));
  if (manifests.length > 1) throw new Error('主题包只能包含一个 theme.json。');
  if (manifests.length === 1) return importStudioTheme(zip, entryMap, manifests[0]);

  const target = createImportTarget(path.basename(zipPath, path.extname(zipPath)));
  const items = [];
  for (const [entryName, entry] of entryMap) {
    if (!IMAGE_EXTENSIONS.has(path.extname(entryName).toLowerCase())) continue;
    items.push(toThemeItem(writeImportedFile(target, entryName, entry.getData())));
  }
  if (!items.length) throw new Error('素材包内没有找到主题清单或可用背景图。');
  return items.sort((a, b) => b.size - a.size);
}

function copySingleImage(sourcePath) {
  const extension = path.extname(sourcePath).toLowerCase();
  if (!IMAGE_EXTENSIONS.has(extension)) throw new Error('请选择 PNG、JPG、WEBP 或 GIF 图片。');
  const destinationFolder = path.join(importRoot(), `${Date.now()}-single-image`);
  fs.mkdirSync(destinationFolder, { recursive: true });
  const destination = path.join(destinationFolder, path.basename(sourcePath));
  fs.copyFileSync(sourcePath, destination);
  return [toThemeItem(destination)];
}

function runPowerShell(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', skinRuntimePath(), command, ...args], {
      windowsHide: true
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) reject(new Error(stderr.trim() || stdout.trim() || `换肤脚本退出码 ${code}`));
      else resolve(stdout.trim());
    });
  });
}

function runMacRuntime(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [skinRuntimePath(), command, ...args], {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || stdout.trim() || `macOS 换肤运行时退出码 ${code}`));
        return;
      }
      try { resolve(JSON.parse(stdout)); }
      catch { reject(new Error(`macOS 换肤运行时返回了无效结果：${stdout.trim() || stderr.trim()}`)); }
    });
  });
}

function runSkinRuntime(command, args) {
  if (process.platform === 'win32') return runPowerShell(command, args).then((result) => ({ result }));
  if (process.platform === 'darwin') return runMacRuntime(command, args);
  return Promise.reject(new Error('Codex Skin Studio 目前只支持 Windows 和 macOS。'));
}

function createWindow() {
  const isMac = process.platform === 'darwin';
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 960,
    minWidth: 1120,
    minHeight: 740,
    icon: path.join(__dirname, '..', 'build', isMac ? 'app-icon.icns' : 'app-icon.ico'),
    backgroundColor: '#10131c',
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    ...(isMac ? {} : { titleBarOverlay: { color: '#10131c', symbolColor: '#e7e9ef', height: 38 } }),
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false }
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  const validationPackage = process.env.CODEX_SKIN_STUDIO_VALIDATE_PACKAGE;
  if (validationPackage) {
    try {
      const result = importFile(validationPackage);
      process.stdout.write(`${JSON.stringify({ sourceName: result.sourceName, items: result.items }, null, 2)}\n`);
      app.exit(0);
    } catch (error) {
      process.stderr.write(`${error.stack || error.message}\n`);
      app.exit(1);
    }
    return;
  }

  ipcMain.handle('theme:pick', async () => {
    const choice = await dialog.showOpenDialog(mainWindow, {
      title: '导入 Codex Skin 素材包',
      properties: ['openFile'],
      filters: [{ name: '素材包或背景图', extensions: ['zip', 'png', 'jpg', 'jpeg', 'webp', 'gif'] }]
    });
    if (choice.canceled || !choice.filePaths[0]) return { canceled: true };
    return importFile(choice.filePaths[0]);
  });

  ipcMain.handle('theme:import-paths', async (_event, filePaths) => {
    if (!filePaths?.length) return { canceled: true };
    return importFile(filePaths[0]);
  });

  ipcMain.handle('skin:apply', async (_event, { itemId, overlay, fit, theme, iconEnabled }) => {
    const item = importedItems.get(itemId);
    if (!item || !fs.existsSync(item.path)) throw new Error('请先导入并选择一个主题资源。');
    const scriptExists = fs.existsSync(skinRuntimePath());
    if (!scriptExists) throw new Error('未找到 Codex Skin 换肤脚本。');
    const runtime = await runSkinRuntime('change', [item.path, '-Overlay', String(overlay), '-Fit', fit, '-Position', item.position]);
    writeStudioTheme(theme, item, iconEnabled);
    return { ...runtime, themeName: item.name, fullTheme: item.kind === 'theme' };
  });

  ipcMain.handle('skin:launch', async () => runSkinRuntime('launch', []));

  ipcMain.handle('skin:restore', async () => runSkinRuntime('restore', []));

  ipcMain.handle('skin:status', async () => {
    try { return await runSkinRuntime('status', []); }
    catch (error) { return { error: error.message }; }
  });

  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

function importFile(filePath) {
  if (!fs.existsSync(filePath)) throw new Error('找不到所选文件。');
  const extension = path.extname(filePath).toLowerCase();
  const items = extension === '.zip' ? extractZipSafely(filePath) : copySingleImage(filePath);
  for (const item of items) importedItems.set(item.id, item);
  return { canceled: false, sourceName: path.basename(filePath), items };
}

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
