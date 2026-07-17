const defaults = {
  overlay: '#fff9ee', header: '#fff8eb', headerBorder: '#7e572d', sidebar: '#fff8eb', navIcon: '#8a5a32', folder: '#75451f',
  card1: '#e9f3fa', card2: '#f4eefb', card3: '#ebf5eb', card4: '#fceede', composer: '#fff9f0', composerBorder: '#88542a',
  add: '#e8f3fa', permission: '#ffebda', model: '#f3edf9', mic: '#ebf4e8', send: '#b9683a', projectBar: '#faf0de',
  projectControl: '#fffaf1', headerSurface: true, sidebarSurface: true, sidebarIcons: true, homeSuggestionCards: true,
  composerChrome: true, projectBarChrome: true, removeTopFade: true,
};
const state = { items: [], selected: null, overlay: .3, fit: 'cover', theme: { ...defaults } };
const $ = (selector) => document.querySelector(selector);

function toast(message, error = false) {
  const element = $('#toast');
  element.textContent = message;
  element.classList.toggle('error', error);
  element.classList.add('visible');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove('visible'), 3600);
}

function bytes(value) { return value > 1048576 ? `${(value / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(value / 1024))} KB`; }
const iconFallbacks = { newTask: '✎', scheduled: '◷', plugins: '⌘', sites: '▦', pullRequests: '⑂', chats: '◌' };
function fallbackFolderSvg() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path class="folder-body" d="M3.2 5.6h6.1l2 2.2h9.2c1.3 0 2.3 1 2.3 2.3v7.4c0 1.3-1 2.3-2.3 2.3H3.2c-1.3 0-2.3-1-2.3-2.3V7.9c0-1.3 1-2.3 2.3-2.3Z"/><g class="folder-paw"><circle cx="15" cy="11.1" r="1.1"/><circle cx="17.7" cy="10.2" r="1.1"/><circle cx="20.1" cy="11.6" r="1.1"/><path d="M15.1 15.7c0-1.9 1.5-3.2 2.5-3.2s2.5 1.3 2.5 3.2c0 1.2-.9 2-2.5 2s-2.5-.8-2.5-2Z"/></g></svg>`;
}
function fallbackIcon(key) { return key === 'folderPaw' ? fallbackFolderSvg() : (iconFallbacks[key] || ''); }
function packageIconMarkup(key) { return state.selected?.iconSvgs?.[key] || fallbackIcon(key); }
function navIcon(key) { return `<span class="preview-nav-icon" data-package-icon="${key}">${packageIconMarkup(key)}</span>`; }
function folderIcon(className = '') { return `<span class="preview-folder ${className}" data-package-icon="folderPaw">${packageIconMarkup('folderPaw')}</span>`; }
function micIcon() {
  return `<svg class="preview-mic-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="8.2" y="3" width="7.6" height="11.4" rx="3.8"/><path d="M5.2 11.8a6.8 6.8 0 0 0 13.6 0M12 18.6V21M8.4 21h7.2"/></svg>`;
}

function installDomPreview() {
  const host = $('#dom-preview');
  host.innerHTML = `
    <div class="codex-dom-stage">
      <div class="codex-dom-systembar">
        <span class="system-menu">▣　←　→　　文件　 编辑　 视图　 帮助</span><span>—　□　×</span>
      </div>
      <div class="codex-dom-shell">
        <aside class="codex-dom-sidebar" data-preview-module="sidebar">
          <div class="preview-brand"><b>Codex</b><span>⌕</span></div>
          <nav class="preview-nav">
            <div class="preview-nav-row active" data-preview-module="nav-icon">${navIcon('newTask')}<span>新建任务</span></div>
            <div class="preview-nav-row" data-preview-module="nav-icon">${navIcon('scheduled')}<span>已安排</span></div>
            <div class="preview-nav-row" data-preview-module="nav-icon">${navIcon('plugins')}<span>插件</span></div>
            <div class="preview-nav-row" data-preview-module="nav-icon">${navIcon('sites')}<span>站点</span></div>
            <div class="preview-nav-row" data-preview-module="nav-icon">${navIcon('pullRequests')}<span>拉取请求</span></div>
            <div class="preview-nav-row" data-preview-module="nav-icon">${navIcon('chats')}<span>聊天</span></div>
          </nav>
          <div class="preview-section-label">项目</div>
          <div class="preview-project-row active" data-preview-module="folder-icon">${folderIcon()}<span>项目1</span><em>●</em></div>
          <div class="preview-project-row" data-preview-module="folder-icon">${folderIcon()}<span>项目2</span></div>
          <div class="preview-user"><span class="preview-avatar">V</span><b>Vink</b><span>•••</span></div>
        </aside>
        <main class="codex-dom-main" data-preview-module="main-background">
          <div class="preview-background-layer"></div>
          <div class="preview-background-overlay"></div>
          <header class="codex-dom-header" data-preview-module="header">
            <div>${folderIcon('mini')}<b>项目1</b><span class="preview-more">•••</span></div>
            <div class="preview-window-actions">⌘　□　◫</div>
          </header>
          <section class="preview-home">
            <div class="preview-home-mark">◌</div>
            <h1>我们应该在项目1中做些什么？</h1>
            <div class="preview-suggestion-grid">
              <button data-preview-module="suggestion-card-1"><span class="card-icon blue">⌕</span><b>探索并理解代码</b></button>
              <button data-preview-module="suggestion-card-2"><span class="card-icon purple">⌁</span><b>构建新功能、应用或工具</b></button>
              <button data-preview-module="suggestion-card-3"><span class="card-icon green">⟳</span><b>审查代码并提出修改建议</b></button>
              <button data-preview-module="suggestion-card-4"><span class="card-icon orange">♨</span><b>修复问题和失败</b></button>
            </div>
          </section>
          <div class="preview-project-bar" data-preview-module="project-bar">
            <button data-preview-module="project-control">${folderIcon('mini')} 项目1</button>
          </div>
          <div class="preview-composer" data-preview-module="composer">
            <span class="preview-placeholder">随心输入</span>
            <div class="preview-composer-actions">
              <button class="composer-add" data-preview-module="add-button">＋</button>
              <button class="composer-permission" data-preview-module="permission-button">◉ 完全访问</button>
              <span class="composer-spacer"></span>
              <button class="composer-model" data-preview-module="model-button">5.6 Terra　高⌄</button>
              <button class="composer-mic" data-preview-module="mic-button" aria-label="麦克风">${micIcon()}</button>
              <button class="composer-send" data-preview-module="send-button">↑</button>
            </div>
          </div>
        </main>
      </div>
    </div>`;

  const style = document.createElement('style');
  style.id = 'codex-dom-preview-styles';
  style.textContent = `
    #dom-preview{position:absolute;inset:0;overflow:hidden;background:#07080b}
    #dom-preview[hidden]{display:none}
    .codex-dom-stage{--preview-overlay:#fff9ee;--preview-overlay-alpha:.3;--preview-header:#fff8eb;--preview-header-border:#7e572d;--preview-sidebar:#fff8eb;--preview-nav-icon:#8a5a32;--preview-folder:#75451f;--preview-card-1:#e9f3fa;--preview-card-2:#f4eefb;--preview-card-3:#ebf5eb;--preview-card-4:#fceede;--preview-composer:#fff9f0;--preview-composer-border:#88542a;--preview-add:#e8f3fa;--preview-permission:#ffebda;--preview-model:#f3edf9;--preview-mic:#ebf4e8;--preview-send:#b9683a;--preview-project-bar:#faf0de;--preview-project-control:#fffaf1;position:absolute;width:1228px;height:814px;transform-origin:top left;background:#f5f5f3;color:#1a1c1f;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:13px;overflow:hidden}
    .codex-dom-systembar{position:absolute;inset:0 0 auto;height:36px;display:flex;align-items:center;justify-content:space-between;padding:0 15px;background:#f5f5f3;border-bottom:1px solid #e6e6e6;color:#74777d;font-size:11px}.system-menu{word-spacing:3px}
    .codex-dom-shell{position:absolute;inset:36px 0 0;display:flex}.codex-dom-sidebar{position:relative;display:flex;width:298px;flex:0 0 298px;flex-direction:column;padding:12px 8px 8px;background:var(--preview-sidebar);color:#1a1c1f}.preview-brand{display:flex;align-items:center;justify-content:space-between;height:35px;padding:0 9px;font-size:14px}.preview-nav{display:flex;flex-direction:column;gap:1px}.preview-nav-row,.preview-project-row{display:flex;align-items:center;gap:10px;height:31px;padding:0 9px;border-radius:7px;white-space:nowrap}.preview-nav-row.active,.preview-project-row.active{background:color-mix(in srgb,currentColor 7%,transparent)}.preview-nav-icon{display:grid;width:17px;place-items:center;color:var(--preview-nav-icon);font-size:15px}.preview-section-label{height:36px;padding:17px 9px 0;color:#6f737a;font-size:11px}.preview-project-row{color:#34363a}.preview-project-row em{margin-left:auto;color:#757980;font-size:8px;font-style:normal}.preview-folder{display:block;width:17px;height:17px;flex:0 0 17px;color:var(--preview-folder);overflow:visible}.preview-folder .folder-body{fill:currentColor}.preview-folder .folder-paw{fill:color-mix(in srgb,var(--preview-sidebar) 90%,white)}.preview-user{display:flex;align-items:center;gap:8px;margin-top:auto;padding:7px 9px}.preview-user>span:last-child{margin-left:auto}.preview-avatar{display:grid;width:20px;height:20px;place-items:center;border-radius:50%;background:linear-gradient(135deg,#e8c4a6,#806694);color:#fff;font-size:10px}
    .codex-dom-main{position:relative;width:930px;height:778px;overflow:hidden;border-radius:12.5px 0 0;background:#fff;box-shadow:rgba(26,28,31,.118) 0 0 0 .5px,rgba(0,0,0,.04) 0 3px 7.5px,rgba(0,0,0,.05) 0 0 20px}.preview-background-layer{position:absolute;inset:46px 0 0;background-position:center;background-repeat:no-repeat;background-size:cover}.preview-background-overlay{position:absolute;inset:46px 0 0;background:color-mix(in srgb,var(--preview-overlay) calc(var(--preview-overlay-alpha)*100%),transparent)}.codex-dom-header{position:absolute;z-index:4;inset:0 0 auto;height:46px;display:flex;align-items:center;justify-content:space-between;padding:0 17px;background:color-mix(in srgb,var(--preview-header) 94%,transparent);border-bottom:1px solid color-mix(in srgb,var(--preview-header-border) 25%,transparent);backdrop-filter:blur(16px);font-size:12px}.codex-dom-header>div{display:flex;align-items:center;gap:8px}.preview-more{margin-left:5px;color:#7a7d82}.preview-window-actions{color:#797d82}.preview-folder.mini{width:16px;height:16px;flex-basis:16px}.preview-mic-icon{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;vertical-align:middle}
    .preview-home{position:absolute;z-index:2;left:110px;top:267px;width:710px;text-align:center}.preview-home-mark{display:grid;width:42px;height:42px;margin:0 auto 18px;place-items:center;color:#a8aaae;font-size:34px}.preview-home h1{margin:0 0 31px;font-size:29px;line-height:34px;font-weight:445;letter-spacing:-.5px}.preview-suggestion-grid{display:grid;grid-template-columns:repeat(4,169px);gap:12px}.preview-suggestion-grid button{position:relative;display:flex;height:104px;flex-direction:column;justify-content:flex-end;padding:12px 16px;border:1px solid rgba(26,28,31,.12);border-radius:16px;color:#2d3034;font:500 14px/20px inherit;text-align:left;box-shadow:0 3px 9px rgba(0,0,0,.08)}.preview-suggestion-grid button:nth-child(1){background:var(--preview-card-1)}.preview-suggestion-grid button:nth-child(2){background:var(--preview-card-2)}.preview-suggestion-grid button:nth-child(3){background:var(--preview-card-3)}.preview-suggestion-grid button:nth-child(4){background:var(--preview-card-4)}.card-icon{position:absolute;left:16px;top:13px;font-size:17px}.blue{color:#3186ff}.purple{color:#8b55e6}.green{color:#2aad67}.orange{color:#ec6b25}
    .preview-project-bar{position:absolute;z-index:3;left:110px;top:625px;width:710px;height:61px;padding:6px 6px 27px;border-radius:20px 20px 0 0;background:var(--preview-project-bar)}.preview-project-bar button{display:flex;height:28px;align-items:center;gap:6px;padding:0 9px;border:1px solid transparent;border-radius:999px;background:var(--preview-project-control);color:#44474c;font:500 13px inherit}.preview-composer{position:absolute;z-index:4;left:97px;top:664px;width:736px;height:98px;padding:15px 13px 8px;border-radius:25px;background:color-mix(in srgb,var(--preview-composer) 94%,transparent);box-shadow:0 0 0 .5px color-mix(in srgb,var(--preview-composer-border) 34%,transparent),0 3px 7.5px rgba(0,0,0,.04),0 0 20px rgba(0,0,0,.05);backdrop-filter:blur(16px)}.preview-placeholder{color:#a3a5aa}.preview-composer-actions{position:absolute;right:10px;bottom:8px;left:10px;display:flex;height:28px;align-items:center;gap:5px}.preview-composer-actions button{height:28px;border:1px solid transparent;border-radius:999px;color:#4c4f54;font:500 12px inherit}.composer-add{width:28px;background:var(--preview-add)}.composer-permission{padding:0 8px;background:var(--preview-permission);color:#e46225!important}.composer-spacer{flex:1}.composer-model{padding:0 9px;background:var(--preview-model)}.composer-mic{width:28px;background:var(--preview-mic)}.composer-send{width:28px;background:var(--preview-send)!important;color:white!important;font-size:17px!important}
    .codex-dom-stage:not(.feature-headerSurface) [data-preview-module="header"]{background:#fff;border-color:#e6e6e6;backdrop-filter:none}.codex-dom-stage:not(.feature-sidebarSurface) [data-preview-module="sidebar"]{background:#f4f4f2}.codex-dom-stage:not(.feature-sidebarIcons) [data-preview-module="nav-icon"] .preview-nav-icon,.codex-dom-stage:not(.feature-sidebarIcons) [data-preview-module="folder-icon"] .preview-folder{color:#666a70}.codex-dom-stage:not(.feature-homeSuggestionCards) .preview-suggestion-grid button{background:#fff}.codex-dom-stage:not(.feature-composerChrome) .preview-composer{background:#fff;box-shadow:0 0 0 .5px rgba(26,28,31,.118),0 3px 7.5px rgba(0,0,0,.04),0 0 20px rgba(0,0,0,.05)}.codex-dom-stage:not(.feature-composerChrome) .preview-composer-actions button{background:transparent}.codex-dom-stage:not(.feature-projectBarChrome) .preview-project-bar{background:#f6f6f6}.codex-dom-stage:not(.feature-projectBarChrome) .preview-project-bar button{background:transparent}
    .preview-nav-icon{height:17px;flex:0 0 17px}.preview-nav-icon>svg{display:block;width:100%;height:100%;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.preview-folder>svg{display:block;width:100%;height:100%;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}.preview-folder .codex-skin-folder-shape{fill:currentColor;stroke:none}.preview-folder .codex-skin-paw-fill{fill:color-mix(in srgb,var(--preview-sidebar) 90%,white);stroke:none}
  `;
  document.head.appendChild(style);
  const stage = host.querySelector('.codex-dom-stage');
  const fit = () => {
    const scale = Math.min(host.clientWidth / 1228, host.clientHeight / 814);
    const left = Math.max(0, (host.clientWidth - 1228 * scale) / 2);
    const top = Math.max(0, (host.clientHeight - 814 * scale) / 2);
    stage.style.transform = `translate(${left}px,${top}px) scale(${scale})`;
  };
  new ResizeObserver(fit).observe(host);
  fit();
}

function syncEditorControls() {
  $('#overlay').value = String(Math.round(state.overlay * 100));
  document.querySelectorAll('[data-fit]').forEach((button) => button.classList.toggle('selected', button.dataset.fit === state.fit));
  document.querySelectorAll('[data-theme-color]').forEach((input) => { input.value = state.theme[input.dataset.themeColor]; });
  document.querySelectorAll('[data-feature]').forEach((input) => { input.checked = state.theme[input.dataset.feature] !== false; });
}

function renderAssets() {
  const list = $('#asset-list');
  $('#asset-count').textContent = `${state.items.length} 个素材`;
  list.replaceChildren();
  if (!state.items.length) { list.innerHTML = '<div class="empty-assets">先导入一个主题资源包，或一张背景图。</div>'; return; }
  state.items.forEach((item) => {
    const button = document.createElement('button');
    button.className = `asset-item ${state.selected?.id === item.id ? 'selected' : ''}`;
    const detail = item.kind === 'theme' ? `完整主题 · v${item.version}` : bytes(item.size);
    button.innerHTML = `<img src="${item.previewUrl || item.url}" alt="${item.name}"><span><b>${item.name}</b><small>${detail}</small></span><i>✓</i>`;
    button.onclick = () => selectItem(item);
    list.append(button);
  });
}

function applyThemeToDom() {
  const stage = $('.codex-dom-stage');
  if (!stage) return;
  const variableMap = { overlay: 'overlay', header: 'header', headerBorder: 'header-border', sidebar: 'sidebar', navIcon: 'nav-icon', folder: 'folder', card1: 'card-1', card2: 'card-2', card3: 'card-3', card4: 'card-4', composer: 'composer', composerBorder: 'composer-border', add: 'add', permission: 'permission', model: 'model', mic: 'mic', send: 'send', projectBar: 'project-bar', projectControl: 'project-control' };
  Object.entries(variableMap).forEach(([key, variable]) => stage.style.setProperty(`--preview-${variable}`, state.theme[key]));
  stage.style.setProperty('--preview-overlay-alpha', state.overlay);
  ['headerSurface', 'sidebarSurface', 'sidebarIcons', 'homeSuggestionCards', 'composerChrome', 'projectBarChrome', 'removeTopFade'].forEach((key) => stage.classList.toggle(`feature-${key}`, state.theme[key] !== false));
  const background = stage.querySelector('.preview-background-layer');
  if (state.selected) {
    background.style.backgroundImage = `url("${state.selected.url}")`;
    background.style.backgroundSize = state.fit;
    background.style.backgroundPosition = state.selected.position || 'center center';
  } else background.style.backgroundImage = '';
}

function renderPackageIcons() {
  document.querySelectorAll('[data-package-icon]').forEach((element) => {
    element.innerHTML = packageIconMarkup(element.dataset.packageIcon);
  });
}

function refresh() {
  $('#apply-button').disabled = !state.selected;
  $('#state-label').textContent = state.selected ? (state.selected.kind === 'theme' ? '完整主题' : '背景素材') : '未选择';
  $('#overlay-output').textContent = `${Math.round(state.overlay * 100)}%`;
  $('#preview-empty').hidden = Boolean(state.selected);
  $('#dom-preview').hidden = !state.selected;
  $('#preview-title').textContent = state.selected ? 'Codex 新建任务 DOM 预览' : '新建任务预览';
  applyThemeToDom();
}

function selectItem(item) {
  state.selected = item;
  state.overlay = Number.isFinite(item?.overlay) ? item.overlay : .3;
  state.fit = ['cover', 'contain', 'fill'].includes(item?.fit) ? item.fit : 'cover';
  state.theme = { ...defaults, ...(item?.studioTheme || {}) };
  renderPackageIcons();
  syncEditorControls();
  renderAssets();
  refresh();
  $('#selected-preview').innerHTML = `<img src="${item.previewUrl || item.url}" alt="${item.name}">`;
}

async function importTheme(paths) {
  try {
    const response = paths ? await window.skinStudio.importPaths(paths) : await window.skinStudio.pickTheme();
    if (response.canceled) return;
    state.items = response.items;
    $('#package-name').textContent = response.sourceName;
    selectItem(response.items[0]);
    toast(response.items[0]?.kind === 'theme' ? `已导入主题：${response.items[0].name}` : `已导入 ${response.items.length} 张背景图`);
  } catch (error) { toast(error.message || '导入失败', true); }
}

const restoreButton = document.createElement('button');
restoreButton.id = 'restore-button';
restoreButton.className = 'status-button';
restoreButton.type = 'button';
restoreButton.textContent = '恢复官方主题';
$('#status-button').after(restoreButton);

$('#import-button').onclick = () => importTheme();
$('#overlay').oninput = (event) => { state.overlay = Number(event.target.value) / 100; refresh(); };
$('#fit-control').onclick = (event) => { const button = event.target.closest('[data-fit]'); if (!button) return; state.fit = button.dataset.fit; syncEditorControls(); refresh(); };
document.querySelectorAll('[data-theme-color]').forEach((input) => { input.oninput = (event) => { state.theme[event.target.dataset.themeColor] = event.target.value; refresh(); }; });
document.querySelectorAll('[data-feature]').forEach((input) => { input.onchange = (event) => { state.theme[event.target.dataset.feature] = event.target.checked; refresh(); }; });
$('#reset-button').onclick = () => { state.theme = { ...defaults, ...(state.selected?.studioTheme || {}) }; state.overlay = Number.isFinite(state.selected?.overlay) ? state.selected.overlay : .3; syncEditorControls(); refresh(); toast('已恢复资源包默认设置'); };
$('#apply-button').onclick = async () => {
  const button = $('#apply-button');
  button.disabled = true;
  button.textContent = '正在应用…';
  try { const response = await window.skinStudio.apply({ itemId: state.selected.id, overlay: state.overlay, fit: state.fit, theme: state.theme }); toast(response.fullTheme ? `已应用完整主题：${response.themeName}` : '背景已应用到 Codex。'); }
  catch (error) { toast(error.message || '应用失败', true); }
  finally { button.disabled = false; button.textContent = '应用全部区域到 Codex'; }
};
$('#status-button').onclick = async () => { const response = await window.skinStudio.status(); const enabled = /Enabled\s*:\s*True/i.test(response.result || ''); toast(response.error ? `状态检查失败：${response.error}` : (enabled ? 'Codex Skin 当前已启用。' : 'Codex Skin 当前未启用。'), Boolean(response.error)); };
restoreButton.onclick = async () => { if (!window.confirm('恢复 Codex 官方主题并停止当前皮肤监听？')) return; restoreButton.disabled = true; try { await window.skinStudio.restore(); toast('已恢复 Codex 官方主题。'); } catch (error) { toast(error.message || '恢复失败', true); } finally { restoreButton.disabled = false; } };
document.addEventListener('dragover', (event) => event.preventDefault());
document.addEventListener('drop', (event) => { event.preventDefault(); importTheme([...event.dataTransfer.files].map((file) => file.path)); });

installDomPreview();
renderAssets();
syncEditorControls();
refresh();
