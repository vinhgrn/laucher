(function () {
  'use strict';
  let allApps = [];
  let filteredApps = [];
  let runningWindows = [];
  let currentCategory = 'all';
  let currentPage = 1;
  let isTaskbarHidden = true;
  let spotlightIndex = 0;
  let activeAnimation = null;
  let customPinnedApps = JSON.parse(localStorage.getItem('aero_pinned_dock') || '[]');
  let isSplitActive = false;
  let currentSplitType = 2;
  let currentSplitRatio = 0.5;
  let splitWindowsHwnds = [];
  let isDraggingSplitDivider = false;
  let contextTargetApp = null;
  const wallpaper = document.getElementById('wallpaper');
  const wallpaperContainer = document.getElementById('wallpaperContainer');
  const homescreenWrapper = document.getElementById('homescreenWrapper');
  const homescreenPages = document.getElementById('homescreenPages');
  const appsGrid = document.getElementById('appsGrid');
  const dockShelf = document.getElementById('dockShelf');
  const categoryTabs = document.getElementById('categoryTabs');
  const pageIndicators = document.getElementById('pageIndicators');
  const nightLightOverlay = document.getElementById('nightLightOverlay');
  const topDragHandle = document.getElementById('topDragHandle');
  const androidShade = document.getElementById('androidShade');
  const shadeBackdrop = document.getElementById('shadeBackdrop');
  const shadeClock = document.getElementById('shadeClock');
  const shadeDate = document.getElementById('shadeDate');
  const shadeBtnClose = document.getElementById('shadeBtnClose');
  const shadeBtnSettings = document.getElementById('shadeBtnSettings');
  const shadeBtnPower = document.getElementById('shadeBtnPower');
  const statusLeftTrigger = document.getElementById('statusLeftTrigger');
  const statusWifiIcon = document.getElementById('statusWifiIcon');
  const tileWifi = document.getElementById('tileWifi');
  const tileWifiSettings = document.getElementById('tileWifiSettings');
  const tileBt = document.getElementById('tileBt');
  const tileBtSettings = document.getElementById('tileBtSettings');
  const tileDarkMode = document.getElementById('tileDarkMode');
  const tileDarkSub = document.getElementById('tileDarkSub');
  const tileAirplane = document.getElementById('tileAirplane');
  const tileNightLight = document.getElementById('tileNightLight');
  const tileHotspot = document.getElementById('tileHotspot');
  const tileSound = document.getElementById('tileSound');
  const tileSoundSub = document.getElementById('tileSoundSub');
  const tileDnd = document.getElementById('tileDnd');
  const shadeBrightSlider = document.getElementById('shadeBrightSlider');
  const shadeVolSlider = document.getElementById('shadeVolSlider');
  const notifClearBtn = document.getElementById('notifClearBtn');
  const notifCardsList = document.getElementById('notifCardsList');
  const dynamicIsland = document.getElementById('dynamicIsland');
  const diSummary = document.getElementById('diSummary');
  const diCpuVal = document.getElementById('diCpuVal');
  const diCpuBar = document.getElementById('diCpuBar');
  const diRamVal = document.getElementById('diRamVal');
  const diRamBar = document.getElementById('diRamBar');
  const diCloseBtn = document.getElementById('diCloseBtn');
  const diBtnSwitcher = document.getElementById('diBtnSwitcher');
  const diBtnSplit = document.getElementById('diBtnSplit');
  const diBtnSpotlight = document.getElementById('diBtnSpotlight');
  const diBtnExit = document.getElementById('diBtnExit');
  const statusTime = document.getElementById('statusTime');
  const statusDate = document.getElementById('statusDate');
  const batteryPct = document.getElementById('batteryPct');
  const batteryBar = document.getElementById('batteryBar');
  const batteryBolt = document.getElementById('batteryBolt');
  const diBatteryText = document.getElementById('diBatteryText');
  const diBatteryLevel = document.getElementById('diBatteryLevel');
  const ccTrigger = document.getElementById('ccTrigger');
  const spotlightOverlay = document.getElementById('spotlightOverlay');
  const spotlightBackdrop = document.getElementById('spotlightBackdrop');
  const spotlightInput = document.getElementById('spotlightInput');
  const spotlightResults = document.getElementById('spotlightResults');
  const spotlightClose = document.getElementById('spotlightClose');
  const switcherOverlay = document.getElementById('switcherOverlay');
  const switcherBackdrop = document.getElementById('switcherBackdrop');
  const switcherDeckScroller = document.getElementById('switcherDeckScroller');
  const switcherDeck = document.getElementById('switcherDeck');
  const switcherSplitView = document.getElementById('switcherSplitView');
  const switcherCount = document.getElementById('switcherCount');
  const btnSwitcherClose = document.getElementById('btnSwitcherClose');
  const btnSwitcherCloseAll = document.getElementById('btnSwitcherCloseAll');
  const btnModeDeck = document.getElementById('btnModeDeck');
  const btnModeSplit = document.getElementById('btnModeSplit');
  const splitTypePills = document.getElementById('splitTypePills');
  const splitRatioPills = document.getElementById('splitRatioPills');
  const splitSlotsGrid = document.getElementById('splitSlotsGrid');
  const btnApplySplit = document.getElementById('btnApplySplit');
  const switcherHint = document.getElementById('switcherHint');
  const splitDividerOverlay = document.getElementById('splitDividerOverlay');
  const splitDividerBar = document.getElementById('splitDividerBar');
  const splitCurrentRatioText = document.getElementById('splitCurrentRatioText');
  const btnExitSplit = document.getElementById('btnExitSplit');
  const instantLaunchOverlay = document.getElementById('instantLaunchOverlay');
  const instantLaunchImg = document.getElementById('instantLaunchImg');
  const instantLaunchIcon = document.getElementById('instantLaunchIcon');
  const instantLaunchTitle = document.getElementById('instantLaunchTitle');
  const folderModalOverlay = document.getElementById('folderModalOverlay');
  const folderBackdrop = document.getElementById('folderBackdrop');
  const folderModalTitle = document.getElementById('folderModalTitle');
  const folderModalClose = document.getElementById('folderModalClose');
  const folderModalGrid = document.getElementById('folderModalGrid');
  const appContextMenu = document.getElementById('appContextMenu');
  const ctxPinDock = document.getElementById('ctxPinDock');
  const ctxOpenFull = document.getElementById('ctxOpenFull');
  const desktopModalOverlay = document.getElementById('desktopModalOverlay');
  const desktopModalBackdrop = document.getElementById('desktopModalBackdrop');
  const desktopModalWindow = document.getElementById('desktopModalWindow');
  const desktopModalClose = document.getElementById('desktopModalClose');
  const desktopFilesGrid = document.getElementById('desktopFilesGrid');
  const desktopFilesCount = document.getElementById('desktopFilesCount');
  const desktopSearchInput = document.getElementById('desktopSearchInput');
  const btnDesktopNewFile = document.getElementById('btnDesktopNewFile');
  const btnDesktopNewFolder = document.getElementById('btnDesktopNewFolder');
  const btnDesktopOpenExplorer = document.getElementById('btnDesktopOpenExplorer');
  const desktopContextMenu = document.getElementById('desktopContextMenu');
  const ctxDesktopOpen = document.getElementById('ctxDesktopOpen');
  const ctxDesktopShow = document.getElementById('ctxDesktopShow');
  const ctxDesktopRename = document.getElementById('ctxDesktopRename');
  const ctxDesktopDelete = document.getElementById('ctxDesktopDelete');
  const homeContextMenu = document.getElementById('homeContextMenu');
  const ctxHomeNewFile = document.getElementById('ctxHomeNewFile');
  const ctxHomeNewFolder = document.getElementById('ctxHomeNewFolder');
  const ctxHomeOpenDesktop = document.getElementById('ctxHomeOpenDesktop');
  const ctxHomeRescan = document.getElementById('ctxHomeRescan');
  const ctxHomeTaskMgr = document.getElementById('ctxHomeTaskMgr');
  let desktopFiles = [];
  let contextTargetDesktopFile = null;
  const clockHour = document.getElementById('clockHour');
  const clockMin = document.getElementById('clockMin');
  const clockSec = document.getElementById('clockSec');
  const clockDigital = document.getElementById('clockDigital');
  const clockDay = document.getElementById('clockDay');
  const widgetCpuText = document.getElementById('widgetCpuText');
  const widgetRamText = document.getElementById('widgetRamText');
  const cpuCircle = document.getElementById('cpuCircle');
  const ramCircle = document.getElementById('ramCircle');
  const widgetRamDetails = document.getElementById('widgetRamDetails');
  const widgetCpuBadge = document.getElementById('widgetCpuBadge');
  const calMonthTitle = document.getElementById('calMonthTitle');
  const calTodayNum = document.getElementById('calTodayNum');
  const notesInput = document.getElementById('notesInput');
  const animProxy = document.getElementById('animProxy');
  const animProxyIcon = document.getElementById('animProxyIcon');
  const animProxySnap = document.getElementById('animProxySnap');
  const animProxyTitle = document.getElementById('animProxyTitle');
  const animProxyLoader = document.getElementById('animProxyLoader');
  let currentLaunchingApp = null;
  let lastActiveWindowInfo = null;
  let launchCoverTimeout = null;
  const SMART_FOLDERS = [
    {
      id: 'folder_browsers',
      name: 'Trình duyệt & Web',
      category: 'Browsers & Web',
      filter: (a) => a.category === 'Browsers & Web' || /chrome|edge|firefox|opera|brave|browser/i.test(a.name)
    },
    {
      id: 'folder_office',
      name: 'Văn phòng & Làm việc',
      category: 'Productivity',
      filter: (a) => a.category === 'Productivity' || /word|excel|powerpoint|office|access|note|pdf|calculator/i.test(a.name)
    },
    {
      id: 'folder_dev',
      name: 'Lập trình & Dev',
      category: 'Developer Tools',
      filter: (a) => a.category === 'Developer Tools' || /code|visual studio|powershell|cmd|git|python|terminal/i.test(a.name)
    },
    {
      id: 'folder_media',
      name: 'Đồ hoạ & Media',
      category: 'Media & Creative',
      filter: (a) => a.category === 'Media & Creative' || /photo|image|camera|media|video|player|spotify|music/i.test(a.name)
    },
    {
      id: 'folder_system',
      name: 'Hệ thống & Tiện ích',
      category: 'Utilities & System',
      filter: (a) => a.category === 'Utilities & System' || /setting|task|7-zip|zip|security|manager/i.test(a.name)
    }
  ];
  function updateClock() {
    const now = new Date();
    const hrs = now.getHours();
    const mins = now.getMinutes();
    const secs = now.getSeconds();
    const hh = String(hrs).padStart(2, '0');
    const mm = String(mins).padStart(2, '0');
    const timeStr = `${hh}:${mm}`;
    statusTime.textContent = timeStr;
    clockDigital.textContent = timeStr;
    if (shadeClock) shadeClock.textContent = timeStr;
    const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const months = ['Th1', 'Th2', 'Th3', 'Th4', 'Th5', 'Th6', 'Th7', 'Th8', 'Th9', 'Th10', 'Th11', 'Th12'];
    const monthsFull = ['THÁNG 1','THÁNG 2','THÁNG 3','THÁNG 4','THÁNG 5','THÁNG 6','THÁNG 7','THÁNG 8','THÁNG 9','THÁNG 10','THÁNG 11','THÁNG 12'];
    const dateStr = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]}`;
    statusDate.textContent = dateStr;
    clockDay.textContent = days[now.getDay()];
    if (shadeDate) shadeDate.textContent = dateStr;
    if (calMonthTitle) calMonthTitle.textContent = monthsFull[now.getMonth()];
    if (calTodayNum) calTodayNum.textContent = String(now.getDate());
    const secDeg = (secs / 60) * 360;
    const minDeg = ((mins + secs / 60) / 60) * 360;
    const hrDeg = (((hrs % 12) + mins / 60) / 12) * 360;
    clockHour.style.transform = `rotate(${hrDeg}deg)`;
    clockMin.style.transform = `rotate(${minDeg}deg)`;
    clockSec.style.transform = `rotate(${secDeg}deg)`;
  }
  setInterval(updateClock, 1000);
  updateClock();
  if (localStorage.getItem('aero_notes')) {
    notesInput.value = localStorage.getItem('aero_notes');
  }
  notesInput.addEventListener('input', () => {
    localStorage.setItem('aero_notes', notesInput.value);
  });
  async function loadApps() {
    if (!window.electronAPI) return;
    try {
      allApps = await window.electronAPI.getApps();
      applyCategoryFilter(currentCategory);
      setupDock();
      syncRunningWindows();
    } catch (e) {
      console.error('Failed to load apps:', e);
    }
  }
  function applyCategoryFilter(cat) {
    currentCategory = cat;
    document.querySelectorAll('.cat-pill').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.cat === cat);
    });
    if (cat === 'all') {
      filteredApps = allApps;
      renderAppsGrid(false);
    } else if (cat === 'folders') {
      renderFoldersGrid();
    } else {
      filteredApps = allApps.filter(a => a.category === cat);
      renderAppsGrid(false);
    }
  }
  categoryTabs.addEventListener('click', (e) => {
    const pill = e.target.closest('.cat-pill');
    if (!pill) return;
    applyCategoryFilter(pill.dataset.cat);
  });
  function createDesktopFolderCard() {
    const item = document.createElement('div');
    item.className = 'app-item desktop-special-folder';
    item.dataset.appid = 'desktop-folder';
    item.dataset.name = 'Desktop';
    item.tabIndex = 0;
    const wrap = document.createElement('div');
    wrap.className = 'app-icon-wrap';
    wrap.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
        <rect x="2" y="3" width="20" height="14" rx="2"/>
        <line x1="8" y1="21" x2="16" y2="21"/>
        <line x1="12" y1="17" x2="12" y2="21"/>
      </svg>
    `;
    const title = document.createElement('span');
    title.className = 'app-title';
    title.textContent = 'Desktop';
    item.appendChild(wrap);
    item.appendChild(title);
    item.addEventListener('click', () => {
      openDesktopModal();
    });
    item.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showHomeContextMenu(e.clientX, e.clientY);
    });
    return item;
  }
  function renderAppsGrid(includeFolders = false) {
    appsGrid.innerHTML = '';
    const fragment = document.createDocumentFragment();
    if (currentCategory === 'all') {
      fragment.appendChild(createDesktopFolderCard());
    }
    if (currentCategory === 'all') {
      SMART_FOLDERS.forEach(folder => {
        const folderApps = allApps.filter(folder.filter);
        if (folderApps.length >= 2) {
          fragment.appendChild(createFolderCard(folder, folderApps));
        }
      });
    }
    filteredApps.forEach(app => {
      const item = createAppItemElement(app);
      fragment.appendChild(item);
    });
    appsGrid.appendChild(fragment);
  }
  function renderFoldersGrid() {
    appsGrid.innerHTML = '';
    const fragment = document.createDocumentFragment();
    SMART_FOLDERS.forEach(folder => {
      const folderApps = allApps.filter(folder.filter);
      fragment.appendChild(createFolderCard(folder, folderApps));
    });
    appsGrid.appendChild(fragment);
  }
  function createFolderCard(folder, folderApps) {
    const item = document.createElement('div');
    item.className = 'app-item folder-item';
    item.dataset.folderid = folder.id;
    const wrap = document.createElement('div');
    wrap.className = 'app-icon-wrap folder-icon-wrap';
    const miniGrid = document.createElement('div');
    miniGrid.className = 'folder-mini-grid';
    const previewApps = folderApps.slice(0, 4);
    previewApps.forEach(a => {
      if (a.icon) {
        const img = document.createElement('img');
        img.className = 'folder-mini-icon';
        img.src = a.icon;
        miniGrid.appendChild(img);
      } else {
        const fb = createFallbackIcon(a.name);
        fb.style.fontSize = '12px';
        fb.style.borderRadius = '4px';
        miniGrid.appendChild(fb);
      }
    });
    wrap.appendChild(miniGrid);
    const title = document.createElement('span');
    title.className = 'app-title';
    title.textContent = folder.name;
    item.appendChild(wrap);
    item.appendChild(title);
    item.addEventListener('click', () => {
      openFolderModal(folder, folderApps);
    });
    return item;
  }
  function createAppItemElement(app) {
    const item = document.createElement('div');
    item.className = 'app-item';
    item.dataset.appid = app.appId;
    item.dataset.name = app.name;
    item.tabIndex = 0;
    const isRunning = runningWindows.some(w => 
      (w.processName && app.appId.toLowerCase().includes(w.processName.toLowerCase())) ||
      (w.title && w.title.toLowerCase().includes(app.name.toLowerCase()))
    );
    if (isRunning) item.classList.add('running');
    const iconWrap = document.createElement('div');
    iconWrap.className = 'app-icon-wrap';
    if (app.icon) {
      const img = document.createElement('img');
      img.className = 'app-icon-img';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.src = app.icon;
      img.alt = app.name;
      img.onerror = () => {
        img.replaceWith(createFallbackIcon(app.name));
      };
      iconWrap.appendChild(img);
    } else {
      iconWrap.appendChild(createFallbackIcon(app.name));
    }
    const dot = document.createElement('span');
    dot.className = 'app-running-indicator';
    iconWrap.appendChild(dot);
    const title = document.createElement('span');
    title.className = 'app-title';
    title.textContent = app.name;
    item.appendChild(iconWrap);
    item.appendChild(title);
    item.addEventListener('click', () => {
      launchAppWithAnimation(app, item);
    });
    item.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showAppContextMenu(app, e.clientX, e.clientY);
    });
    return item;
  }
  function createFallbackIcon(name) {
    const fb = document.createElement('div');
    fb.className = 'app-icon-fallback';
    const firstChar = (name || '?').charAt(0).toUpperCase();
    fb.textContent = firstChar;
    const hue = (firstChar.charCodeAt(0) * 47) % 360;
    fb.style.background = `linear-gradient(135deg, hsl(${hue}, 85%, 60%), hsl(${(hue + 45) % 360}, 85%, 45%))`;
    return fb;
  }
  function openFolderModal(folder, folderApps) {
    folderModalTitle.textContent = folder.name;
    folderModalGrid.innerHTML = '';
    folderApps.forEach(app => {
      const item = createAppItemElement(app);
      item.addEventListener('click', () => {
        closeFolderModal();
      });
      folderModalGrid.appendChild(item);
    });
    folderModalOverlay.classList.add('active');
  }
  function closeFolderModal() {
    folderModalOverlay.classList.remove('active');
  }
  folderModalClose.addEventListener('click', closeFolderModal);
  folderBackdrop.addEventListener('click', closeFolderModal);
  function showAppContextMenu(app, x, y) {
    contextTargetApp = app;
    appContextMenu.style.left = `${Math.min(x, window.innerWidth - 220)}px`;
    appContextMenu.style.top = `${Math.min(y, window.innerHeight - 150)}px`;
    appContextMenu.classList.add('active');
  }
  function closeAppContextMenu() {
    appContextMenu.classList.remove('active');
    contextTargetApp = null;
  }
  window.addEventListener('click', (e) => {
    if (!e.target.closest('#appContextMenu')) {
      closeAppContextMenu();
    }
  });
  ctxPinDock.addEventListener('click', () => {
    if (contextTargetApp && !customPinnedApps.includes(contextTargetApp.appId)) {
      customPinnedApps.push(contextTargetApp.appId);
      localStorage.setItem('aero_pinned_dock', JSON.stringify(customPinnedApps));
      setupDock();
    }
    closeAppContextMenu();
  });
  ctxOpenFull.addEventListener('click', () => {
    if (contextTargetApp) {
      const elem = document.querySelector(`.app-item[data-appid="${contextTargetApp.appId}"]`);
      launchAppWithAnimation(contextTargetApp, elem);
    }
    closeAppContextMenu();
  });
  async function openDesktopModal() {
    closeSpotlight();
    closeAppSwitcher();
    closeAndroidShade();
    closeFolderModal();
    closeAllContextMenus();
    closeDynamicIsland();
    desktopModalOverlay.classList.add('active');
    if (desktopSearchInput) desktopSearchInput.value = '';
    await loadDesktopFiles();
  }
  function closeDesktopModal() {
    desktopModalOverlay.classList.remove('active');
    closeAllContextMenus();
  }
  if (desktopModalClose) desktopModalClose.addEventListener('click', closeDesktopModal);
  if (desktopModalBackdrop) desktopModalBackdrop.addEventListener('click', closeDesktopModal);
  async function loadDesktopFiles() {
    if (!window.electronAPI || !window.electronAPI.getDesktopFiles) return;
    try {
      desktopFiles = await window.electronAPI.getDesktopFiles();
      renderDesktopFiles(desktopFiles);
    } catch (e) {
      console.error('Failed to load desktop files:', e);
    }
  }
  function getFileIconSvg(type) {
    switch (type) {
      case 'folder':
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`;
      case 'image':
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;
      case 'document':
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`;
      case 'code':
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`;
      case 'archive':
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>`;
      case 'video':
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>`;
      case 'audio':
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`;
      case 'exe':
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`;
      case 'shortcut':
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`;
      default:
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>`;
    }
  }
  function renderDesktopFiles(files) {
    if (!desktopFilesGrid) return;
    desktopFilesGrid.innerHTML = '';
    if (desktopFilesCount) desktopFilesCount.textContent = `${files.length} mục trên Desktop`;
    if (files.length === 0) {
      desktopFilesGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: rgba(255,255,255,0.4); padding: 50px 0; font-size: 15px;">Thư mục Desktop trống</div>`;
      return;
    }
    files.forEach(file => {
      const item = document.createElement('div');
      item.className = `desktop-file-item type-${file.type}`;
      item.title = `${file.name}\n${file.size || 'Thư mục'}\n${file.mtimeStr || ''}`;
      const iconWrap = document.createElement('div');
      iconWrap.className = 'desktop-file-icon-wrap';
      iconWrap.innerHTML = getFileIconSvg(file.type);
      if (file.type === 'shortcut') {
        const badge = document.createElement('div');
        badge.className = 'desktop-shortcut-badge';
        badge.innerHTML = '↗';
        iconWrap.appendChild(badge);
      }
      const nameEl = document.createElement('span');
      nameEl.className = 'desktop-file-name';
      nameEl.textContent = file.name;
      const metaEl = document.createElement('span');
      metaEl.className = 'desktop-file-meta';
      metaEl.textContent = file.isDirectory ? 'Thư mục' : file.size;
      item.appendChild(iconWrap);
      item.appendChild(nameEl);
      item.appendChild(metaEl);
      item.addEventListener('click', () => {
        document.querySelectorAll('.desktop-file-item').forEach(el => el.classList.remove('selected'));
        item.classList.add('selected');
        window.electronAPI.openDesktopFile(file.fullPath);
      });
      item.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showDesktopContextMenu(file, e.clientX, e.clientY);
      });
      desktopFilesGrid.appendChild(item);
    });
  }
  if (desktopSearchInput) {
    desktopSearchInput.addEventListener('input', () => {
      const q = desktopSearchInput.value.toLowerCase().trim();
      if (!q) {
        renderDesktopFiles(desktopFiles);
      } else {
        const filtered = desktopFiles.filter(f => f.name.toLowerCase().includes(q));
        renderDesktopFiles(filtered);
      }
    });
  }
  if (btnDesktopNewFile) {
    btnDesktopNewFile.addEventListener('click', async () => {
      const fileName = prompt('Nhập tên tệp văn bản mới:', 'Tài liệu mới.txt');
      if (!fileName) return;
      const res = await window.electronAPI.createDesktopItem({ name: fileName, type: 'file' });
      if (res && res.success) {
        showToast(`Đã tạo tệp: ${res.name}`);
        await loadDesktopFiles();
      }
    });
  }
  if (btnDesktopNewFolder) {
    btnDesktopNewFolder.addEventListener('click', async () => {
      const folderName = prompt('Nhập tên thư mục mới:', 'Thư mục mới');
      if (!folderName) return;
      const res = await window.electronAPI.createDesktopItem({ name: folderName, type: 'folder' });
      if (res && res.success) {
        showToast(`Đã tạo thư mục: ${res.name}`);
        await loadDesktopFiles();
      }
    });
  }
  if (btnDesktopOpenExplorer) {
    btnDesktopOpenExplorer.addEventListener('click', () => {
      window.electronAPI.openDesktopFile('C:\\Users\\acer\\Desktop');
    });
  }
  function showDesktopContextMenu(file, x, y) {
    closeAllContextMenus();
    contextTargetDesktopFile = file;
    desktopContextMenu.style.left = `${Math.min(x, window.innerWidth - 220)}px`;
    desktopContextMenu.style.top = `${Math.min(y, window.innerHeight - 200)}px`;
    desktopContextMenu.classList.add('active');
  }
  function closeAllContextMenus() {
    if (desktopContextMenu) desktopContextMenu.classList.remove('active');
    if (homeContextMenu) homeContextMenu.classList.remove('active');
    closeAppContextMenu();
  }
  window.addEventListener('click', (e) => {
    if (!e.target.closest('#desktopContextMenu') && !e.target.closest('#homeContextMenu') && !e.target.closest('#appContextMenu')) {
      closeAllContextMenus();
    }
  });
  if (ctxDesktopOpen) {
    ctxDesktopOpen.addEventListener('click', () => {
      if (contextTargetDesktopFile) {
        window.electronAPI.openDesktopFile(contextTargetDesktopFile.fullPath);
      }
      closeAllContextMenus();
    });
  }
  if (ctxDesktopShow) {
    ctxDesktopShow.addEventListener('click', () => {
      if (contextTargetDesktopFile) {
        window.electronAPI.showItemInFolder(contextTargetDesktopFile.fullPath);
      }
      closeAllContextMenus();
    });
  }
  if (ctxDesktopRename) {
    ctxDesktopRename.addEventListener('click', async () => {
      if (!contextTargetDesktopFile) return;
      const currentName = contextTargetDesktopFile.name;
      const newName = prompt('Đổi tên thành:', currentName);
      if (newName && newName !== currentName) {
        const res = await window.electronAPI.renameDesktopItem({ oldPath: contextTargetDesktopFile.fullPath, newName });
        if (res && res.success) {
          showToast(`Đã đổi tên thành: ${res.name}`);
          await loadDesktopFiles();
        }
      }
      closeAllContextMenus();
    });
  }
  if (ctxDesktopDelete) {
    ctxDesktopDelete.addEventListener('click', async () => {
      if (!contextTargetDesktopFile) return;
      if (confirm(`Bạn có chắc muốn xóa "${contextTargetDesktopFile.name}"?`)) {
        const ok = await window.electronAPI.deleteDesktopItem(contextTargetDesktopFile.fullPath);
        if (ok) {
          showToast(`Đã xóa: ${contextTargetDesktopFile.name}`);
          await loadDesktopFiles();
        }
      }
      closeAllContextMenus();
    });
  }
  function showHomeContextMenu(x, y) {
    closeAllContextMenus();
    homeContextMenu.style.left = `${Math.min(x, window.innerWidth - 240)}px`;
    homeContextMenu.style.top = `${Math.min(y, window.innerHeight - 240)}px`;
    homeContextMenu.classList.add('active');
  }
  if (wallpaperContainer) {
    wallpaperContainer.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showHomeContextMenu(e.clientX, e.clientY);
    });
  }
  if (ctxHomeNewFile) {
    ctxHomeNewFile.addEventListener('click', async () => {
      closeAllContextMenus();
      const fileName = prompt('Nhập tên tệp văn bản mới trên Desktop:', 'Ghi chú mới.txt');
      if (!fileName) return;
      const res = await window.electronAPI.createDesktopItem({ name: fileName, type: 'file' });
      if (res && res.success) {
        showToast(`Đã tạo tệp trên Desktop: ${res.name}`);
        if (desktopModalOverlay.classList.contains('active')) {
          await loadDesktopFiles();
        }
      }
    });
  }
  if (ctxHomeNewFolder) {
    ctxHomeNewFolder.addEventListener('click', async () => {
      closeAllContextMenus();
      const folderName = prompt('Nhập tên thư mục mới trên Desktop:', 'Thư mục mới');
      if (!folderName) return;
      const res = await window.electronAPI.createDesktopItem({ name: folderName, type: 'folder' });
      if (res && res.success) {
        showToast(`Đã tạo thư mục trên Desktop: ${res.name}`);
        if (desktopModalOverlay.classList.contains('active')) {
          await loadDesktopFiles();
        }
      }
    });
  }
  if (ctxHomeOpenDesktop) {
    ctxHomeOpenDesktop.addEventListener('click', () => {
      closeAllContextMenus();
      openDesktopModal();
    });
  }
  if (ctxHomeRescan) {
    ctxHomeRescan.addEventListener('click', async () => {
      closeAllContextMenus();
      showToast('Đang quét lại ứng dụng...');
      await rescanApps();
    });
  }
  if (ctxHomeTaskMgr) {
    ctxHomeTaskMgr.addEventListener('click', () => {
      closeAllContextMenus();
      window.electronAPI.openTaskMgr();
    });
  }
  function showToast(msg) {
    let toast = document.getElementById('launcherToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'launcherToast';
      toast.className = 'launcher-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('active');
    setTimeout(() => {
      toast.classList.remove('active');
    }, 2800);
  }
  function setupDock() {
    dockShelf.innerHTML = '';
    const defaultKeywords = [
      { key: 'explorer', name: 'Files' },
      { key: 'chrome', fallbackKey: 'edge', name: 'Browser' },
      { key: 'powershell', fallbackKey: 'cmd', name: 'Terminal' },
      { key: 'settings', name: 'Settings' }
    ];
    const pinnedApps = [];
    customPinnedApps.forEach(appId => {
      const found = allApps.find(a => a.appId === appId);
      if (found && !pinnedApps.some(p => p.appId === found.appId)) {
        pinnedApps.push(found);
      }
    });
    defaultKeywords.forEach(kw => {
      let found = allApps.find(a => 
        a.appId.toLowerCase().includes(kw.key) || a.name.toLowerCase().includes(kw.key)
      );
      if (!found && kw.fallbackKey) {
        found = allApps.find(a => 
          a.appId.toLowerCase().includes(kw.fallbackKey) || a.name.toLowerCase().includes(kw.fallbackKey)
        );
      }
      if (found && !pinnedApps.some(p => p.appId === found.appId)) {
        pinnedApps.push(found);
      }
    });
    const switcherItem = document.createElement('div');
    switcherItem.className = 'dock-item';
    switcherItem.title = 'Trình chuyển đổi ứng dụng';
    switcherItem.innerHTML = `
      <svg viewBox="0 0 24 24" style="width: 32px; height: 32px; color: #fff;">
        <rect x="4" y="4" width="7" height="7" rx="2" fill="currentColor"/>
        <rect x="13" y="4" width="7" height="7" rx="2" fill="currentColor"/>
        <rect x="4" y="13" width="7" height="7" rx="2" fill="currentColor"/>
        <rect x="13" y="13" width="7" height="7" rx="2" fill="currentColor"/>
      </svg>
    `;
    switcherItem.addEventListener('click', toggleAppSwitcher);
    dockShelf.appendChild(switcherItem);
    pinnedApps.slice(0, 7).forEach(app => {
      const item = document.createElement('div');
      item.className = 'dock-item';
      item.title = app.name;
      item.dataset.appid = app.appId;
      if (app.icon) {
        const img = document.createElement('img');
        img.className = 'dock-icon-img';
        img.src = app.icon;
        item.appendChild(img);
      } else {
        item.appendChild(createFallbackIcon(app.name));
      }
      const dot = document.createElement('span');
      dot.className = 'dock-running-dot';
      item.appendChild(dot);
      item.addEventListener('click', () => {
        launchAppWithAnimation(app, item);
      });
      dockShelf.appendChild(item);
    });
  }
  let launchGeneration = 0;
  function clearProxyAnimations() {
    for (const el of [animProxy, animProxyIcon, animProxySnap]) {
      el.getAnimations().forEach(animation => animation.cancel());
    }
    activeAnimation = null;
  }
  async function launchAppWithAnimation(app, sourceElement) {
    if (!app) return;
    const generation = ++launchGeneration;
    clearProxyAnimations();
    clearTimeout(launchCoverTimeout);
    currentLaunchingApp = { ...app, sourceElement, time: Date.now() };
    await executeSpringZoomLaunch(app, sourceElement, generation);
  }
  function resetProxyToFullscreen(borderRadius, opacity) {
    animProxy.style.display = 'block';
    animProxy.style.transformOrigin = '0 0';
    animProxy.style.transform = 'translate(0px,0px) scale(1,1)';
    animProxy.style.borderRadius = borderRadius || '0px';
    animProxy.style.opacity = String(opacity !== undefined ? opacity : 1);
  }
  async function executeSpringZoomLaunch(app, sourceElement, generation) {
    const iconWrap = sourceElement && (sourceElement.querySelector('.app-icon-wrap') || sourceElement);
    const rect = iconWrap ? iconWrap.getBoundingClientRect() : {
      left: innerWidth / 2 - 36, top: innerHeight / 2 - 36, width: 72, height: 72
    };
    resetProxyToFullscreen('20px', 1);
    animProxy.style.transform = 'translate(' + rect.left + 'px,' + rect.top + 'px) scale(' +
      rect.width / innerWidth + ',' + rect.height / innerHeight + ')';
    animProxySnap.style.opacity = '0';
    animProxyIcon.src = app.icon || '';
    animProxyIcon.style.opacity = app.icon ? '1' : '0';
    animProxyIcon.style.transform = 'scale(1)';
    if (animProxyTitle) { animProxyTitle.textContent = app.name; animProxyTitle.style.display = 'block'; }
    if (animProxyLoader) animProxyLoader.style.display = 'block';
    document.body.classList.add('app-open');
    const zoom = animProxy.animate([
      { transform: animProxy.style.transform, opacity: 1 },
      { transform: 'translate(0px,0px) scale(1,1)', opacity: 1 }
    ], { duration: 320, easing: 'cubic-bezier(0.16,1,0.3,1)', fill: 'forwards' });
    activeAnimation = zoom;
    const api = window.electronAPI;
    const begin = api ? api.beginLaunch({ appId: app.appId, name: app.name, icon: app.icon }) : Promise.resolve();
    let target = runningWindows.find(w => window.launcherPolicy.matchesApp(w, app));
    const startup = begin.then(async () => {
      if (generation !== launchGeneration || !api) return;
      if (!target) {
        const fresh = await api.getWindows();
        target = fresh.find(w => window.launcherPolicy.matchesApp(w, app));
      }
      if (!target && generation === launchGeneration) await api.launchApp(app);
    });
    if (api) api.getCachedSnapshot(app.appId).then(url => {
      if (url && generation === launchGeneration) {
        animProxySnap.src = url; animProxySnap.style.opacity = '1';
      }
    }).catch(() => {});
    try {
      await zoom.finished;
      if (generation !== launchGeneration) return;
      animProxy.style.transform = 'translate(0px,0px) scale(1,1)';
      zoom.cancel(); activeAnimation = null;
      await startup;
      const deadline = performance.now() + 14000;
      let info = null;
      while (generation === launchGeneration && performance.now() < deadline) {
        info = api ? await api.launchWindowInfo(target && target.hwnd) : null;
        if (info && info.rect && info.rect.w > 60 && info.rect.h > 60) break;
        await new Promise(resolve => setTimeout(resolve, 80));
      }
      if (generation !== launchGeneration) return;
      if (!info || !info.rect || info.rect.w <= 60) throw Error('Ứng dụng chưa tạo cửa sổ. Bạn có thể thử mở lại.');
      const r = info.rect;
      const { x, y, w, h } = r;
      const windowed = w < innerWidth - 24 || h < innerHeight - 24;
      if (animProxyLoader) animProxyLoader.style.display = 'none';
      if (animProxyTitle) animProxyTitle.style.display = 'none';
      if (windowed) {
        const transform = 'translate(' + x + 'px,' + y + 'px) scale(' + w / innerWidth + ',' + h / innerHeight + ')';
        const morph = animProxy.animate([
          { transform: 'translate(0px,0px) scale(1,1)', opacity: 1 },
          { transform, opacity: 1 }
        ], { duration: 280, easing: 'cubic-bezier(0.16,1,0.3,1)', fill: 'forwards' });
        activeAnimation = morph;
        await morph.finished;
        if (generation !== launchGeneration) return;
        animProxy.style.transform = transform; morph.cancel();
      }
      animProxy.style.display = 'none';
      currentLaunchingApp = null; activeAnimation = null;
      lastActiveWindowInfo = { ...info, rect: { x, y, w, h }, isSmallWindow: windowed };
      if (api) await api.finishLaunch(info.hwnd);
      syncRunningWindows();
    } catch (error) {
      if (generation !== launchGeneration) return;
      clearProxyAnimations(); animProxy.style.display = 'none';
      currentLaunchingApp = null; document.body.classList.remove('app-open');
      if (api) await api.finishLaunch(null);
      if (error.name !== 'AbortError') showToast(error.message || 'Không mở được ứng dụng');
    }
  }
  function handleForegroundWindowAppeared(msg) {
    if (currentLaunchingApp) return;
    syncRunningWindows();
    lastActiveWindowInfo = msg;
  }
  function animateWindowMorph(oldRect, newRect, fromSmall, toSmall, targetHwnd) {
    if (activeAnimation) { activeAnimation.cancel(); activeAnimation = null; }
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const sx = oldRect.x !== undefined ? oldRect.x : (oldRect.left || 0);
    const sy = oldRect.y !== undefined ? oldRect.y : (oldRect.top || 0);
    const sw = Math.max(oldRect.w !== undefined ? oldRect.w : ((oldRect.right - oldRect.left) || vw), 4);
    const sh = Math.max(oldRect.h !== undefined ? oldRect.h : ((oldRect.bottom - oldRect.top) || vh), 4);
    const ex = newRect.x !== undefined ? newRect.x : (newRect.left || 0);
    const ey = newRect.y !== undefined ? newRect.y : (newRect.top || 0);
    const ew = Math.max(newRect.w !== undefined ? newRect.w : ((newRect.right - newRect.left) || vw), 4);
    const eh = Math.max(newRect.h !== undefined ? newRect.h : ((newRect.bottom - newRect.top) || vh), 4);
    const ssx = sw / vw; const ssy = sh / vh;
    const esx = ew / vw; const esy = eh / vh;
    animProxy.style.display = 'block';
    animProxy.style.transformOrigin = '0 0';
    animProxy.style.transform = `translate(${sx}px,${sy}px) scale(${ssx},${ssy})`;
    animProxy.style.borderRadius = fromSmall ? '16px' : '0px';
    animProxy.style.opacity = '0.92';
    if (animProxyTitle) animProxyTitle.style.display = 'none';
    if (animProxyLoader) animProxyLoader.style.display = 'none';
    animProxySnap.style.opacity = '0';
    animProxyIcon.style.opacity = '0';
    const morphAnim = animProxy.animate([
      { transform: `translate(${sx}px,${sy}px) scale(${ssx},${ssy})`, opacity: 0.92 },
      { transform: `translate(${ex}px,${ey}px) scale(${esx},${esy})`, opacity: 0.92 }
    ], {
      duration: 280,
      easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
      fill: 'forwards'
    });
    activeAnimation = morphAnim;
    morphAnim.onfinish = () => {
      animProxy.style.transform = `translate(${ex}px,${ey}px) scale(${esx},${esy})`;
      animProxy.style.borderRadius = toSmall ? '16px' : '0px';
      morphAnim.cancel();
      if (window.electronAPI && targetHwnd) {
        window.electronAPI.lowerLauncher();
        window.electronAPI.setWindowForeground(targetHwnd);
      }
      const fadeOut = animProxy.animate([{ opacity: 0.92 }, { opacity: 0 }], { duration: 120, fill: 'forwards' });
      fadeOut.onfinish = () => {
        animProxy.style.display = 'none';
        fadeOut.cancel();
        activeAnimation = null;
      };
    };
  }
  function handleWindowRectChanged(msg) {
    if (currentLaunchingApp || activeAnimation || isSplitActive || isDraggingSplitDivider) return;
    if (lastActiveWindowInfo && Number(lastActiveWindowInfo.hwnd) === Number(msg.hwnd)) {
      lastActiveWindowInfo.rect = msg.rect;
    }
  }
  async function returnHomeWithAnimation(data) {
    ++launchGeneration;
    currentLaunchingApp = null;
    clearProxyAnimations();
    if (window.electronAPI) window.electronAPI.finishLaunch(null);
    if (activeAnimation) { activeAnimation.cancel(); activeAnimation = null; }
    if (launchCoverTimeout) { clearTimeout(launchCoverTimeout); launchCoverTimeout = null; }
    closeSpotlight(); closeAppSwitcher(); closeAndroidShade();
    closeFolderModal(); closeDesktopModal(); closeAllContextMenus(); closeDynamicIsland();
    if (window.electronAPI && window.electronAPI.raiseLauncher) {
      window.electronAPI.raiseLauncher();
    }
    let targetRect = null;
    let targetIcon = data ? data.icon : null;
    let searchAppId = data ? data.appId : null;
    let searchHwnd = data ? data.hwnd : null;
    if (currentPage !== 1) setPage(1);
    if (currentCategory !== 'all') applyCategoryFilter('all');
    let foundElem = null;
    if (searchAppId) {
      foundElem = document.querySelector(`.app-item[data-appid="${CSS.escape(searchAppId)}"]`) ||
                  document.querySelector(`.dock-item[data-appid="${searchAppId}"]`);
    }
    if (!foundElem && (searchHwnd || lastActiveWindowInfo)) {
      const winObj = (searchHwnd ? runningWindows.find(w => w.hwnd === searchHwnd) : null) || lastActiveWindowInfo;
      if (winObj) {
        const proc = (winObj.processName || '').replace('.exe', '').toLowerCase();
        const title = (winObj.title || '').toLowerCase();
        document.querySelectorAll('.app-item, .dock-item').forEach(el => {
          if (foundElem) return;
          const aid = (el.dataset.appid || '').toLowerCase();
          const nm = (el.dataset.name || '').toLowerCase();
          if ((proc && (aid.includes(proc) || nm.includes(proc))) ||
              (title && nm && (title.includes(nm) || nm.includes(title)))) foundElem = el;
        });
      }
    }
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (foundElem) {
      const wrap = foundElem.querySelector('.app-icon-wrap') || foundElem;
      targetRect = wrap.getBoundingClientRect();
      const img = wrap.querySelector('img');
      if (img && img.src) targetIcon = img.src;
    }
    if (!targetRect) {
      const dock = document.getElementById('dockShelf');
      const dRect = dock.getBoundingClientRect();
      targetRect = { left: dRect.left + dRect.width / 2 - 36, top: dRect.top + dRect.height / 2 - 36, width: 72, height: 72 };
    }
    const tx = targetRect.left;
    const ty = targetRect.top;
    const tw = targetRect.width || 72;
    const th = targetRect.height || 72;
    const scaleXf = tw / vw;
    const scaleYf = th / vh;
    animProxy.style.display = 'block';
    animProxy.style.transformOrigin = '0 0';
    animProxy.style.transform = 'translate(0px,0px) scale(1,1)';
    animProxy.style.borderRadius = '0px';
    animProxy.style.opacity = '1';
    if (animProxyTitle) animProxyTitle.style.display = 'none';
    if (animProxyLoader) animProxyLoader.style.display = 'none';
    const hasSnap = Boolean(data && data.snapPath);
    if (hasSnap) {
      animProxySnap.src = data.snapPath;
      animProxySnap.style.opacity = '1';
      animProxyIcon.style.opacity = '0';
    } else {
      animProxySnap.style.opacity = '0';
      if (targetIcon) animProxyIcon.src = targetIcon;
      animProxyIcon.style.opacity = '1';
    }
    animProxyIcon.style.transform = 'scale(1,1)';
    animProxyIcon.style.transformOrigin = '50% 50%';
    document.body.classList.remove('app-open');
    const shrinkAnim = animProxy.animate([
      { transform: 'translate(0px,0px) scale(1,1)', opacity: 1 },
      { transform: `translate(${tx}px,${ty}px) scale(${scaleXf},${scaleYf})`, opacity: 0 }
    ], {
      duration: 340,
      easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
      fill: 'forwards'
    });
    activeAnimation = shrinkAnim;
    if (hasSnap) {
      animProxySnap.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 280, easing: 'ease-in', fill: 'forwards' });
      animProxyIcon.animate([
        { opacity: 0, transform: 'scale(0.7,0.7)' },
        { opacity: 1, transform: 'scale(1,1)' }
      ], { duration: 340, easing: 'cubic-bezier(0.16,1,0.3,1)', fill: 'forwards' });
    }
    shrinkAnim.onfinish = () => {
      animProxy.style.transform = `translate(${tx}px,${ty}px) scale(${scaleXf},${scaleYf})`;
      animProxy.style.opacity = '0';
      animProxy.style.display = 'none';
      shrinkAnim.cancel();
      clearProxyAnimations();
      if (foundElem) {
        foundElem.animate([
          { transform: 'scale(0.88)' },
          { transform: 'scale(1.06)' },
          { transform: 'scale(1.0)' }
        ], { duration: 320, easing: 'cubic-bezier(0.16,1,0.3,1)' });
      }
      syncRunningWindows();
    };
  }
  function openAndroidShade() {
    closeSpotlight();
    closeAppSwitcher();
    closeFolderModal();
    closeDynamicIsland();
    androidShade.classList.add('active');
  }
  function closeAndroidShade() {
    androidShade.classList.remove('active');
  }
  function toggleAndroidShade() {
    if (performance.now() < suppressShadeClickUntil) return;
    if (androidShade.classList.contains('active')) {
      closeAndroidShade();
    } else {
      openAndroidShade();
    }
  }
  topDragHandle.addEventListener('click', toggleAndroidShade);
  statusLeftTrigger.addEventListener('click', toggleAndroidShade);
  statusWifiIcon.addEventListener('click', toggleAndroidShade);
  ccTrigger.addEventListener('click', toggleAndroidShade);
  shadeBtnClose.addEventListener('click', closeAndroidShade);
  shadeBackdrop.addEventListener('click', closeAndroidShade);
  androidShade.addEventListener('click', (e) => {
    if (!e.target.closest('#shadePanel')) {
      closeAndroidShade();
    }
  });
  let suppressShadeClickUntil = 0;
  let shadeGesture = null, shadeFrame = 0;
  const shadePanel = document.getElementById('shadePanel');
  window.addEventListener('pointerdown', e => {
    const open = androidShade.classList.contains('active');
    if (!e.isPrimary || e.button !== 0 || e.target.closest('button,input')) return;
    if ((!open && e.clientY <= 30) || (open && e.target.closest('.shade-header'))) {
      shadeGesture = { id: e.pointerId, y: e.clientY, last: e.clientY,
        height: shadePanel.getBoundingClientRect().height, open, moved: false };
    }
  });
  window.addEventListener('pointermove', e => {
    const g = shadeGesture;
    if (!g || e.pointerId !== g.id) return;
    g.last = e.clientY;
    if (Math.abs(g.last - g.y) < 10 && !g.moved) return;
    g.moved = true;
    if (!g.open && !androidShade.classList.contains('active')) openAndroidShade();
    if (!shadeFrame) shadeFrame = requestAnimationFrame(() => {
      shadeFrame = 0;
      if (shadeGesture !== g) return;
      const offset = Math.max(-g.height, Math.min(0, (g.open ? 0 : -g.height) + g.last - g.y));
      shadePanel.style.transition = 'none';
      shadePanel.style.transform = 'translate(-50%,' + offset + 'px)';
      shadeBackdrop.style.opacity = String(1 + offset / g.height);
    });
  }, { passive: true });
  function endShadeGesture(e) {
    const g = shadeGesture;
    if (!g || e.pointerId !== g.id) return;
    shadeGesture = null; cancelAnimationFrame(shadeFrame); shadeFrame = 0;
    if (!g.moved) return;
    suppressShadeClickUntil = performance.now() + 350;
    shadePanel.style.transition = '';
    const delta = g.last - g.y;
    const open = e.type === 'pointercancel' ? g.open : (g.open ? delta > -65 : delta > 65);
    androidShade.classList.toggle('active', open);
    shadePanel.style.transform = ''; shadeBackdrop.style.opacity = '';
  }
  window.addEventListener('pointerup', endShadeGesture);
  window.addEventListener('pointercancel', endShadeGesture);
  tileDarkMode.addEventListener('click', () => {
    const isDark = document.body.classList.toggle('dark-mode');
    document.body.classList.toggle('light-mode', !isDark);
    tileDarkMode.classList.toggle('active', isDark);
    tileDarkSub.textContent = isDark ? 'Bật' : 'Tắt';
  });
  tileNightLight.addEventListener('click', () => {
    const active = document.body.classList.toggle('night-light');
    tileNightLight.classList.toggle('active', active);
    document.getElementById('tileNightSub').textContent = active ? 'Dịu mắt (Bật)' : 'Tắt';
  });
  shadeBtnSettings.addEventListener('click', () => {
    if (window.electronAPI) window.electronAPI.openSettings();
    closeAndroidShade();
  });
  shadeBtnPower.addEventListener('click', () => {
    if (confirm('Khôi phục Windows Taskbar và thoát AeroIOS Launcher?')) {
      if (window.electronAPI) window.electronAPI.exitShell();
    }
  });
  notifClearBtn.addEventListener('click', () => {
    notifCardsList.innerHTML = '<div style="color: rgba(255,255,255,0.4); font-size: 13px; text-align: center; padding: 20px;">Không có thông báo mới</div>';
  });
  async function toggleAppSwitcher() {
    if (switcherOverlay.classList.contains('active')) {
      closeAppSwitcher();
    } else {
      openAppSwitcher();
    }
  }
  async function openAppSwitcher() {
    closeSpotlight();
    closeAndroidShade();
    closeFolderModal();
    closeDynamicIsland();
    document.body.classList.add('switcher-open');
    switcherOverlay.classList.add('active');
    setSwitcherMode('deck');
    await renderAppSwitcherDeck();
  }
  function closeAppSwitcher() {
    switcherOverlay.classList.remove('active');
    document.body.classList.remove('switcher-open');
  }
  function setSwitcherMode(mode) {
    if (mode === 'deck') {
      btnModeDeck.classList.add('active');
      btnModeSplit.classList.remove('active');
      switcherDeckScroller.style.display = 'block';
      switcherSplitView.style.display = 'none';
      switcherHint.textContent = 'Vuốt thẻ lên để đóng ứng dụng • Chọn thẻ để mở toàn màn hình';
    } else {
      btnModeDeck.classList.remove('active');
      btnModeSplit.classList.add('active');
      switcherDeckScroller.style.display = 'none';
      switcherSplitView.style.display = 'block';
      switcherHint.textContent = 'Chọn ứng dụng và tỷ lệ rồi bấm Kích hoạt để chia màn hình';
      renderSplitSetup();
    }
  }
  btnModeDeck.addEventListener('click', () => setSwitcherMode('deck'));
  btnModeSplit.addEventListener('click', () => setSwitcherMode('split'));
  diBtnSplit.addEventListener('click', () => {
    closeDynamicIsland();
    openAppSwitcher();
    setSwitcherMode('split');
  });
  btnSwitcherClose.addEventListener('click', closeAppSwitcher);
  switcherBackdrop.addEventListener('click', closeAppSwitcher);
  let isDraggingDeck = false;
  let deckStartX = 0;
  let deckScrollStart = 0;
  let deckVelocity = 0;
  let lastDeckMoveTime = 0;
  let lastDeckMoveX = 0;
  let momentumAnimId = null;
  let hasDraggedFar = false;
  let deckGesturesInitialized = false;
  function initDeckGestures() {
    if (deckGesturesInitialized) return;
    deckGesturesInitialized = true;
    switcherDeckScroller.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      if (e.target.closest('.card-close-btn')) return;
      if (momentumAnimId) {
        cancelAnimationFrame(momentumAnimId);
        momentumAnimId = null;
      }
      isDraggingDeck = true;
      hasDraggedFar = false;
      deckStartX = e.clientX;
      deckScrollStart = switcherDeckScroller.scrollLeft;
      lastDeckMoveX = e.clientX;
      lastDeckMoveTime = performance.now();
      deckVelocity = 0;
      switcherDeckScroller.classList.add('dragging');
    });
    window.addEventListener('mousemove', (e) => {
      if (!isDraggingDeck) return;
      const dx = e.clientX - deckStartX;
      if (Math.abs(dx) > 6) hasDraggedFar = true;
      switcherDeckScroller.scrollLeft = deckScrollStart - dx;
      const now = performance.now();
      const dt = now - lastDeckMoveTime;
      if (dt > 10) {
        deckVelocity = (e.clientX - lastDeckMoveX) / dt;
        lastDeckMoveX = e.clientX;
        lastDeckMoveTime = now;
      }
      updateDeckCardsFocus();
    });
    window.addEventListener('mouseup', () => {
      if (!isDraggingDeck) return;
      isDraggingDeck = false;
      switcherDeckScroller.classList.remove('dragging');
      if (Math.abs(deckVelocity) > 0.12) {
        let vel = deckVelocity * 16;
        const friction = 0.94;
        function momentumStep() {
          if (Math.abs(vel) < 0.4) {
            cancelAnimationFrame(momentumAnimId);
            momentumAnimId = null;
            updateDeckCardsFocus();
            return;
          }
          switcherDeckScroller.scrollLeft -= vel;
          vel *= friction;
          updateDeckCardsFocus();
          momentumAnimId = requestAnimationFrame(momentumStep);
        }
        momentumAnimId = requestAnimationFrame(momentumStep);
      } else {
        updateDeckCardsFocus();
      }
    });
    switcherDeckScroller.addEventListener('wheel', (e) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        switcherDeckScroller.scrollLeft += e.deltaY;
        e.preventDefault();
        updateDeckCardsFocus();
      }
    }, { passive: false });
  }
  function updateDeckCardsFocus() {
    const scrollerRect = switcherDeckScroller.getBoundingClientRect();
    const centerX = scrollerRect.left + scrollerRect.width / 2;
    const cards = Array.from(switcherDeck.querySelectorAll('.switcher-card'));
    let closestCard = null;
    let minDistance = Infinity;
    cards.forEach(card => {
      const cardRect = card.getBoundingClientRect();
      const cardCenter = cardRect.left + cardRect.width / 2;
      const dist = Math.abs(cardCenter - centerX);
      if (dist < minDistance) {
        minDistance = dist;
        closestCard = card;
      }
    });
    cards.forEach(card => {
      card.classList.toggle('focused', card === closestCard);
    });
  }
  btnSwitcherCloseAll.addEventListener('click', async () => {
    if (!window.electronAPI) return;
    try {
      const cards = Array.from(switcherDeck.querySelectorAll('.switcher-card'));
      cards.forEach((card, idx) => {
        setTimeout(() => {
          card.style.transition = 'transform 0.4s var(--ios-spring), opacity 0.3s ease';
          card.style.transform = 'translateY(-140%) scale(0.7) rotate(-5deg)';
          card.style.opacity = '0';
        }, idx * 35);
      });
      if (window.electronAPI.closeAllWindows) {
        await window.electronAPI.closeAllWindows();
      } else {
        for (const win of runningWindows) {
          await window.electronAPI.closeWindow(win.hwnd);
        }
      }
      setTimeout(() => {
        switcherDeck.innerHTML = '<div style="color: rgba(255,255,255,0.5); font-size: 16px; margin: 40px auto;">Không có ứng dụng nào đang chạy</div>';
        switcherCount.textContent = '0 ứng dụng đang mở';
        closeAppSwitcher();
        syncRunningWindows();
      }, cards.length * 35 + 260);
    } catch (e) {
      console.error('Error closing all windows:', e);
    }
  });
  async function renderAppSwitcherDeck() {
    initDeckGestures();
    switcherDeck.innerHTML = '';
    if (!window.electronAPI) return;
    try {
      runningWindows = await window.electronAPI.getWindows();
      switcherCount.textContent = `${runningWindows.length} ứng dụng đang mở`;
      if (runningWindows.length === 0) {
        switcherDeck.innerHTML = '<div style="color: rgba(255,255,255,0.5); font-size: 16px; margin: 40px auto;">Không có ứng dụng nào đang chạy</div>';
        return;
      }
      runningWindows.forEach((win, index) => {
        const card = document.createElement('div');
        card.className = 'switcher-card';
        card.dataset.hwnd = win.hwnd;
        card.style.zIndex = index + 1;
        const matchingApp = allApps.find(a => 
          (win.processName && a.appId.toLowerCase().includes(win.processName.toLowerCase())) ||
          (win.title && a.name.toLowerCase().includes(win.title.toLowerCase()))
        );
        const iconSrc = matchingApp && matchingApp.icon ? matchingApp.icon : 'assets/icons/222f5c98f761.png';
        card.innerHTML = `
          <div class="switcher-card-header">
            <div class="card-title-group">
              <img class="card-icon" src="${iconSrc}" onerror="this.style.display='none'">
              <span class="card-title">${escapeHtml(win.title)}</span>
            </div>
            <button class="card-close-btn" title="Thu nhỏ ứng dụng">✕</button>
          </div>
          <div class="switcher-card-preview">
            <img loading="lazy" decoding="async" class="card-snap-img" src="cache/snapshots/snap_${win.hwnd}.jpg">
          </div>
        `;
        const preview = card.querySelector('.card-snap-img');
        preview.addEventListener('error', () => preview.replaceWith(createCardPlaceholder(win.title)), { once: true });
        card.addEventListener('click', (e) => {
          if (e.target.closest('.card-close-btn')) return;
          if (hasDraggedFar) return;
          const cardRect = card.getBoundingClientRect();
          const startX = cardRect.left;
          const startY = cardRect.top;
          const scaleX = cardRect.width / window.innerWidth;
          const scaleY = cardRect.height / window.innerHeight;
          animProxy.style.transition = 'none';
          animProxy.style.transform = `translate3d(${startX}px, ${startY}px, 0) scale3d(${scaleX}, ${scaleY}, 1)`;
          animProxy.style.borderRadius = '24px';
          animProxy.style.opacity = '1';
          animProxy.style.display = 'block';
          const snapImg = card.querySelector('.card-snap-img');
          if (snapImg && snapImg.src && !snapImg.classList.contains('card-placeholder-text')) {
            animProxySnap.src = snapImg.src;
            animProxySnap.style.opacity = '1';
            animProxyIcon.style.opacity = '0';
          } else {
            animProxySnap.style.opacity = '0';
            animProxyIcon.src = iconSrc;
            animProxyIcon.style.opacity = '1';
          }
          if (animProxyTitle) animProxyTitle.style.display = 'none';
          if (animProxyLoader) animProxyLoader.style.display = 'none';
          closeAppSwitcher();
          const zoomAnim = animProxy.animate([
            {
              transform: `translate3d(${startX}px, ${startY}px, 0) scale3d(${scaleX}, ${scaleY}, 1)`,
              opacity: 1
            },
            {
              transform: 'translate3d(0px, 0px, 0) scale3d(1, 1, 1)',
              opacity: 1
            }
          ], {
            duration: 340,
            easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
            fill: 'forwards'
          });
          zoomAnim.onfinish = () => {
            animProxy.style.display = 'none';
            zoomAnim.cancel();
            if (window.electronAPI) {
              window.electronAPI.lowerLauncher();
              window.electronAPI.restoreWindow(win.hwnd);
              window.electronAPI.setWindowForeground(win.hwnd);
            }
          };
        });
        const closeBtn = card.querySelector('.card-close-btn');
        closeBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          card.style.transition = 'transform 0.35s var(--ios-spring), opacity 0.25s';
          card.style.transform = 'translateY(-130%) scale(0.8) rotate(-4deg)';
          card.style.opacity = '0';
          await window.electronAPI.closeWindow(win.hwnd);
          setTimeout(() => {
            card.remove();
            syncRunningWindows();
            updateDeckCardsFocus();
          }, 300);
        });
        let cardStartY = 0;
        let cardStartX = 0;
        let isCardSwiping = false;
        card.addEventListener('pointerdown', (e) => {
          if (e.target.closest('.card-close-btn')) return;
          cardStartY = e.clientY;
          cardStartX = e.clientX;
          isCardSwiping = false;
        });
        card.addEventListener('pointermove', (e) => {
          if (e.buttons !== 1) return;
          const dy = e.clientY - cardStartY;
          const dx = Math.abs(e.clientX - cardStartX);
          if (dy < -25 && Math.abs(dy) > dx) {
            isCardSwiping = true;
            card.style.transition = 'none';
            card.style.transform = `translateY(${dy}px) scale(${Math.max(0.75, 1 + dy / 800)})`;
            card.style.opacity = `${Math.max(0.2, 1 + dy / 300)}`;
          }
        });
        card.addEventListener('pointerup', async (e) => {
          if (!isCardSwiping) return;
          const dy = e.clientY - cardStartY;
          if (dy < -65) {
            card.style.transition = 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease';
            card.style.transform = 'translateY(-140%) scale(0.7)';
            card.style.opacity = '0';
            await window.electronAPI.closeWindow(win.hwnd);
            setTimeout(() => {
              card.remove();
              syncRunningWindows();
              updateDeckCardsFocus();
            }, 250);
          } else {
            card.style.transition = 'transform 0.3s var(--ios-spring), opacity 0.25s';
            card.style.transform = '';
            card.style.opacity = '';
          }
          isCardSwiping = false;
        });
        switcherDeck.appendChild(card);
      });
      requestAnimationFrame(() => {
        updateDeckCardsFocus();
      });
    } catch (e) {
      console.error(e);
    }
  }
  function createCardPlaceholder(title) {
    const el = document.createElement('div');
    el.className = 'card-placeholder-text';
    el.textContent = title;
    return el;
  }
  function renderSplitSetup() {
    splitSlotsGrid.innerHTML = '';
    document.querySelectorAll('.split-pill').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.split-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentSplitType = parseInt(btn.dataset.type, 10);
        document.getElementById('ratioSectionTitle').style.display = currentSplitType === 2 ? 'block' : 'none';
        splitRatioPills.style.display = currentSplitType === 2 ? 'flex' : 'none';
        renderSplitSlots();
      };
    });
    document.querySelectorAll('.ratio-pill').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.ratio-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentSplitRatio = parseFloat(btn.dataset.ratio);
      };
    });
    renderSplitSlots();
  }
  function renderSplitSlots() {
    splitSlotsGrid.innerHTML = '';
    const numSlots = currentSplitType;
    for (let i = 1; i <= numSlots; i++) {
      const slotCard = document.createElement('div');
      slotCard.className = 'split-slot-card';
      let slotLabel = `Vị trí ${i}`;
      if (numSlots === 2) slotLabel = i === 1 ? 'Màn hình Trái (Slot 1)' : 'Màn hình Phải (Slot 2)';
      else if (numSlots === 3) slotLabel = i === 1 ? 'Màn hình Chính (Trái)' : `Màn hình Phụ ${i - 1} (Phải)`;
      else if (numSlots === 4) slotLabel = `Góc ${i === 1 ? 'Trên-Trái' : i === 2 ? 'Trên-Phải' : i === 3 ? 'Dưới-Trái' : 'Dưới-Phải'}`;
      slotCard.innerHTML = `
        <div class="split-slot-header">
          <span>${slotLabel}</span>
          <span style="font-size: 11px; color: rgba(255,255,255,0.5);">Cửa sổ</span>
        </div>
        <select class="split-slot-select" id="splitSlotSelect_${i}">
          ${runningWindows.map((w, idx) => `<option value="${w.hwnd}" ${idx === (i - 1) ? 'selected' : ''}>${escapeHtml(w.title || w.processName)}</option>`).join('')}
          ${allApps.slice(0, 15).map(a => `<option value="app:${a.appId}">Mở mới: ${escapeHtml(a.name)}</option>`).join('')}
        </select>
      `;
      splitSlotsGrid.appendChild(slotCard);
    }
  }
  btnApplySplit.addEventListener('click', async () => {
    if (btnApplySplit.disabled) return;
    const selected = [...splitSlotsGrid.querySelectorAll('select')].map(select => select.value);
    if (selected.length !== currentSplitType || new Set(selected).size !== selected.length) { showToast('Chọn các ứng dụng khác nhau cho từng vị trí.'); return; }
    btnApplySplit.disabled = true;
    try {
    const layout = [];
    const screenW = window.screen.width;
    const screenH = window.screen.height;
    splitWindowsHwnds = [];
    for (let i = 1; i <= currentSplitType; i++) {
      const select = document.getElementById(`splitSlotSelect_${i}`);
      if (!select) continue;
      const val = select.value;
      let hwnd = null;
      if (val.startsWith('app:')) {
        const appId = val.substring(4);
        const app = allApps.find(item => item.appId === appId);
        let windows = await window.electronAPI.getWindows();
        let match = app && windows.find(win => window.launcherPolicy.matchesApp(win, app));
        if (!match) await window.electronAPI.launchApp(app || appId);
        const deadline = performance.now() + 12000;
        while (!match && performance.now() < deadline) {
          await new Promise(resolve => setTimeout(resolve, 160));
          windows = await window.electronAPI.getWindows();
          match = app && windows.find(win => window.launcherPolicy.matchesApp(win, app));
        }
        if (!match) throw Error('Không tìm thấy cửa sổ của ứng dụng đã chọn.');
        hwnd = match.hwnd;
      } else {
        hwnd = parseInt(val, 10);
      }
      if (hwnd && splitWindowsHwnds.some(existing => Number(existing) === Number(hwnd))) throw Error('Hai vị trí đang trỏ cùng một cửa sổ.');
      if (hwnd) {
        splitWindowsHwnds.push(hwnd);
        let x = 0, y = 0, w = screenW, h = screenH;
        if (currentSplitType === 2) {
          const splitX = Math.floor(screenW * currentSplitRatio);
          if (i === 1) {
            x = 0; y = 0; w = splitX; h = screenH;
          } else {
            x = splitX; y = 0; w = screenW - splitX; h = screenH;
          }
        } else if (currentSplitType === 3) {
          const halfW = Math.floor(screenW / 2);
          const halfH = Math.floor(screenH / 2);
          if (i === 1) {
            x = 0; y = 0; w = halfW; h = screenH;
          } else if (i === 2) {
            x = halfW; y = 0; w = screenW - halfW; h = halfH;
          } else {
            x = halfW; y = halfH; w = screenW - halfW; h = screenH - halfH;
          }
        } else if (currentSplitType === 4) {
          const halfW = Math.floor(screenW / 2);
          const halfH = Math.floor(screenH / 2);
          if (i === 1) { x = 0; y = 0; w = halfW; h = halfH; }
          else if (i === 2) { x = halfW; y = 0; w = screenW - halfW; h = halfH; }
          else if (i === 3) { x = 0; y = halfH; w = halfW; h = screenH - halfH; }
          else { x = halfW; y = halfH; w = screenW - halfW; h = screenH - halfH; }
        }
        layout.push({ hwnd, x, y, w, h });
      }
    }
    if (layout.length > 0 && window.electronAPI) {
      await window.electronAPI.setSplitMode({ active: true, hwnds: splitWindowsHwnds });
      await window.electronAPI.snapWindows(layout);
      isSplitActive = true;
      closeAppSwitcher();
      showSplitDividerOverlay();
    }
    } catch (error) { showToast(error.message); }
    finally { btnApplySplit.disabled = false; }
  });
  function showSplitDividerOverlay() {
    if (currentSplitType !== 2 || splitWindowsHwnds.length < 2) return;
    const screenW = window.screen.width;
    const posX = Math.floor(screenW * currentSplitRatio);
    splitDividerBar.style.left = '0'; splitDividerBar.style.transform = `translate3d(${posX}px,0,0)`;
    updateSplitRatioText();
    splitDividerOverlay.classList.add('active');
  }
  function hideSplitDividerOverlay() {
    splitDividerOverlay.classList.remove('active');
  }
  function updateSplitRatioText() {
    const pct1 = Math.round(currentSplitRatio * 100);
    const pct2 = 100 - pct1;
    splitCurrentRatioText.textContent = `${pct1}% | ${pct2}%`;
  }
  splitDividerBar.addEventListener('pointerdown', (e) => {
    splitDividerBar.setPointerCapture(e.pointerId);
    isDraggingSplitDivider = true;
    splitDividerBar.classList.add('dragging');
  });
  let splitFrame = 0;
  window.addEventListener('pointermove', (e) => {
    if (!isDraggingSplitDivider || splitFrame) return;
    const clientX = e.clientX;
    splitFrame = requestAnimationFrame(() => {
    splitFrame = 0;
    const screenW = window.screen.width;
    let ratio = clientX / screenW;
    ratio = Math.max(0.2, Math.min(0.8, ratio));
    currentSplitRatio = ratio;
    const posX = Math.floor(screenW * ratio);
    splitDividerBar.style.left = '0'; splitDividerBar.style.transform = `translate3d(${posX}px,0,0)`;
    updateSplitRatioText();
    if (splitWindowsHwnds.length >= 2 && window.electronAPI) {
      window.electronAPI.setWindowRect({
        hwnd: splitWindowsHwnds[0],
        x: 0,
        y: 0,
        w: posX,
        h: window.screen.height
      });
      window.electronAPI.setWindowRect({
        hwnd: splitWindowsHwnds[1],
        x: posX,
        y: 0,
        w: screenW - posX,
        h: window.screen.height
      });
    }
    });
  });
  window.addEventListener('pointerup', () => {
    if (isDraggingSplitDivider) {
      isDraggingSplitDivider = false;
      splitDividerBar.classList.remove('dragging');
    }
  });
  document.querySelectorAll('.split-quick-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.split-quick-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const ratio = parseFloat(btn.dataset.ratio);
      currentSplitRatio = ratio;
      const screenW = window.screen.width;
      const posX = Math.floor(screenW * ratio);
      splitDividerBar.style.left = '0'; splitDividerBar.style.transform = `translate3d(${posX}px,0,0)`;
      updateSplitRatioText();
      if (splitWindowsHwnds.length >= 2 && window.electronAPI) {
        window.electronAPI.setWindowRect({
          hwnd: splitWindowsHwnds[0],
          x: 0,
          y: 0,
          w: posX,
          h: window.screen.height
        });
        window.electronAPI.setWindowRect({
          hwnd: splitWindowsHwnds[1],
          x: posX,
          y: 0,
          w: screenW - posX,
          h: window.screen.height
        });
      }
    });
  });
  btnExitSplit.addEventListener('click', async () => {
    isSplitActive = false;
    hideSplitDividerOverlay();
    if (window.electronAPI) {
      await window.electronAPI.setSplitMode({ active: false });
      if (splitWindowsHwnds[0]) {
        await window.electronAPI.maximizeWindow(splitWindowsHwnds[0]);
      }
    }
  });
  function openSpotlight() {
    closeAppSwitcher();
    closeAndroidShade();
    closeFolderModal();
    closeDynamicIsland();
    spotlightOverlay.classList.add('active');
    spotlightInput.value = '';
    spotlightInput.focus();
    renderSpotlightResults('');
  }
  function closeSpotlight() {
    spotlightOverlay.classList.remove('active');
  }
  spotlightClose.addEventListener('click', closeSpotlight);
  spotlightBackdrop.addEventListener('click', closeSpotlight);
  spotlightInput.addEventListener('input', () => {
    renderSpotlightResults(spotlightInput.value.trim().toLowerCase());
  });
  spotlightInput.addEventListener('keydown', (e) => {
    const items = spotlightResults.querySelectorAll('.spotlight-item');
    if (items.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      spotlightIndex = (spotlightIndex + 1) % items.length;
      updateSpotlightSelection();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      spotlightIndex = (spotlightIndex - 1 + items.length) % items.length;
      updateSpotlightSelection();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = items[spotlightIndex];
      if (selected) selected.click();
    } else if (e.key === 'Escape') {
      closeSpotlight();
    }
  });
  function updateSpotlightSelection() {
    const items = spotlightResults.querySelectorAll('.spotlight-item');
    items.forEach((item, idx) => {
      item.classList.toggle('selected', idx === spotlightIndex);
    });
  }
  function renderSpotlightResults(query) {
    spotlightResults.innerHTML = '';
    spotlightIndex = 0;
    const matches = query
      ? allApps.filter(a => a.name.toLowerCase().includes(query) || a.category.toLowerCase().includes(query)).slice(0, 10)
      : allApps.slice(0, 8);
    matches.forEach((app, idx) => {
      const item = document.createElement('div');
      item.className = `spotlight-item ${idx === 0 ? 'selected' : ''}`;
      const iconSrc = app.icon || 'assets/icons/222f5c98f761.png';
      item.innerHTML = `
        <img class="spotlight-item-icon" src="${iconSrc}">
        <div class="spotlight-item-info">
          <span class="spotlight-item-name">${escapeHtml(app.name)}</span>
          <span class="spotlight-item-cat">${escapeHtml(app.category)}</span>
        </div>
      `;
      item.addEventListener('click', () => {
        closeSpotlight();
        const appElem = document.querySelector(`.app-item[data-appid="${app.appId}"]`);
        launchAppWithAnimation(app, appElem || spotlightInput);
      });
      spotlightResults.appendChild(item);
    });
  }
  dynamicIsland.addEventListener('click', (e) => {
    if (e.target.closest('.di-btn') || e.target.closest('.di-close-btn')) return;
    dynamicIsland.classList.toggle('expanded');
  });
  diCloseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closeDynamicIsland();
  });
  function closeDynamicIsland() {
    dynamicIsland.classList.remove('expanded');
  }
  diBtnSwitcher.addEventListener('click', () => {
    closeDynamicIsland();
    openAppSwitcher();
  });
  diBtnSpotlight.addEventListener('click', () => {
    closeDynamicIsland();
    openSpotlight();
  });
  diBtnExit.addEventListener('click', () => {
    if (confirm('Khôi phục thanh taskbar Windows và thoát AeroIOS Shell?')) {
      if (window.electronAPI) window.electronAPI.exitShell();
    }
  });
  pageIndicators.addEventListener('click', (e) => {
    const dot = e.target.closest('.page-dot');
    if (!dot) return;
    setPage(parseInt(dot.dataset.page, 10));
  });
  function setPage(idx) {
    currentPage = Math.max(0, Math.min(1, idx));
    homescreenPages.style.transform = `translateX(-${currentPage * 100}vw)`;
    document.querySelectorAll('.page-dot').forEach((dot, i) => {
      dot.classList.toggle('active', i === currentPage);
    });
  }
  let pageGesture = null;
  let pageFrame = 0;
  homescreenPages.style.touchAction = 'pan-y';
  homescreenPages.addEventListener('pointerdown', e => {
    if (!e.isPrimary || e.button !== 0 || e.target.closest('button,input,select,.app-item,.widget-card')) return;
    pageGesture = { id: e.pointerId, x: e.clientX, y: e.clientY, last: e.clientX, time: performance.now(), horizontal: false };
  });
  window.addEventListener('pointermove', e => {
    const g = pageGesture;
    if (!g || e.pointerId !== g.id) return;
    const dx = e.clientX - g.x, dy = e.clientY - g.y;
    if (!g.horizontal && Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10) { pageGesture = null; return; }
    if (Math.abs(dx) > 10) g.horizontal = true;
    if (!g.horizontal) return;
    g.last = e.clientX;
    if (!pageFrame) pageFrame = requestAnimationFrame(() => {
      pageFrame = 0;
      if (!pageGesture) return;
      let delta = g.last - g.x;
      if ((currentPage === 0 && delta > 0) || (currentPage === 1 && delta < 0)) delta *= 0.2;
      homescreenPages.style.transition = 'none';
      homescreenPages.style.transform = 'translate3d(' + (-currentPage * innerWidth + delta) + 'px,0,0)';
    });
  }, { passive: true });
  function endPageGesture(e) {
    const g = pageGesture;
    if (!g || e.pointerId !== g.id) return;
    pageGesture = null; cancelAnimationFrame(pageFrame); pageFrame = 0;
    homescreenPages.style.transition = '';
    const dx = e.clientX - g.x, velocity = dx / Math.max(1, performance.now() - g.time);
    const change = e.type !== 'pointercancel' && g.horizontal && (Math.abs(dx) > innerWidth * 0.15 || Math.abs(velocity) > 0.45);
    setPage(Math.max(0, Math.min(1, currentPage + (change ? (dx > 0 ? -1 : 1) : 0))));
  }
  window.addEventListener('pointerup', endPageGesture);
  window.addEventListener('pointercancel', endPageGesture);
  async function updateSystemStats() {
    if (!window.electronAPI) return;
    try {
      const stats = await window.electronAPI.getStats();
      const cpu = Math.round(stats.cpu);
      diSummary.textContent = `CPU ${cpu}%`;
      diCpuVal.textContent = `${cpu}%`;
      diCpuBar.style.width = `${cpu}%`;
      widgetCpuText.textContent = `${cpu}%`;
      cpuCircle.setAttribute('stroke-dasharray', `${cpu}, 100`);
      if (widgetCpuBadge) widgetCpuBadge.textContent = cpu < 40 ? 'Mượt mà' : cpu < 70 ? 'Bình thường' : 'Nặng tải';
      const ram = Math.round(stats.ramPct);
      diRamVal.textContent = `${ram}%`;
      diRamBar.style.width = `${ram}%`;
      widgetRamText.textContent = `${ram}%`;
      ramCircle.setAttribute('stroke-dasharray', `${ram}, 100`);
      widgetRamDetails.textContent = `Đã dùng ${stats.ramUsedGB} GB / ${stats.ramTotalGB} GB`;
      batteryPct.textContent = `${stats.battery}%`;
      batteryBar.style.width = `${stats.battery}%`;
      diBatteryText.textContent = `${stats.battery}%`;
      diBatteryLevel.style.width = `${stats.battery}%`;
      batteryBolt.classList.toggle('active', stats.isCharging);
    } catch (e) {}
  }
  setInterval(updateSystemStats, 2000);
  updateSystemStats();
  async function syncRunningWindows() {
    if (!window.electronAPI) return;
    try {
      runningWindows = await window.electronAPI.getWindows();
      document.querySelectorAll('.app-item').forEach(item => {
        const appId = (item.dataset.appid || '').toLowerCase();
        const name = (item.dataset.name || '').toLowerCase();
        const isRunning = runningWindows.some(w => 
          (w.processName && appId.includes(w.processName.toLowerCase())) ||
          (w.title && w.title.toLowerCase().includes(name))
        );
        item.classList.toggle('running', isRunning);
      });
      document.querySelectorAll('.dock-item').forEach(item => {
        const appId = (item.dataset.appid || '').toLowerCase();
        const isRunning = runningWindows.some(w => 
          w.processName && appId.includes(w.processName.toLowerCase())
        );
        item.classList.toggle('running', isRunning);
      });
    } catch (e) {}
  }
  function showTopIslandNotification(title, message, iconType) {
    let notifEl = document.getElementById('topIslandNotification');
    if (!notifEl) {
      notifEl = document.createElement('div');
      notifEl.id = 'topIslandNotification';
      notifEl.style.cssText = `
        position: fixed; top: 12px; left: 50%; transform: translateX(-50%) translateY(-120%);
        background: rgba(28, 28, 35, 0.92); backdrop-filter: blur(28px) saturate(190%);
        -webkit-backdrop-filter: blur(28px) saturate(190%);
        border: 1px solid rgba(255, 255, 255, 0.18);
        box-shadow: 0 16px 38px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.1);
        border-radius: 26px; padding: 10px 22px; z-index: 999999;
        display: flex; align-items: center; gap: 12px; color: #fff;
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif;
        transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease;
        pointer-events: none; opacity: 0; min-width: 280px; max-width: 440px;
      `;
      document.body.appendChild(notifEl);
    }
    const iconSvg = iconType === 'warning'
      ? `<svg width="22" height="22" viewBox="0 0 24 24" fill="#ff9f0a"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>`
      : `<svg width="22" height="22" viewBox="0 0 24 24" fill="#32d74b"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/></svg>`;
    notifEl.innerHTML = `
      <div style="flex-shrink:0;">${iconSvg}</div>
      <div style="display:flex; flex-direction:column; min-width:0;">
        <span style="font-size:13px; font-weight:600; color:#fff; line-height:1.2;">${escapeHtml(title)}</span>
        <span style="font-size:11.5px; color:rgba(255,255,255,0.72); line-height:1.3; margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(message)}</span>
      </div>
    `;
    requestAnimationFrame(() => {
      notifEl.style.opacity = '1';
      notifEl.style.transform = 'translateX(-50%) translateY(0px)';
    });
    setTimeout(() => {
      notifEl.style.opacity = '0';
      notifEl.style.transform = 'translateX(-50%) translateY(-120%)';
    }, 4500);
  }
  if (window.electronAPI) {
    if (typeof window.electronAPI.onTriggerHome === 'function') {
      window.electronAPI.onTriggerHome((data) => returnHomeWithAnimation(data));
    }
    if (typeof window.electronAPI.onTriggerSwitcher === 'function') {
      window.electronAPI.onTriggerSwitcher(() => openAppSwitcher());
    }
    if (typeof window.electronAPI.onToggleSpotlight === 'function') {
      window.electronAPI.onToggleSpotlight(() => openSpotlight());
    } else if (typeof window.electronAPI.onTriggerSpotlight === 'function') {
      window.electronAPI.onTriggerSpotlight(() => openSpotlight());
    }
    if (typeof window.electronAPI.onWindowMinimized === 'function') {
      window.electronAPI.onWindowMinimized((msg) => syncRunningWindows());
    }
    if (typeof window.electronAPI.onForegroundChanged === 'function') {
      window.electronAPI.onForegroundChanged((msg) => handleForegroundWindowAppeared(msg));
    }
    if (typeof window.electronAPI.onWindowRectChanged === 'function') {
      window.electronAPI.onWindowRectChanged((msg) => handleWindowRectChanged(msg));
    }
    if (typeof window.electronAPI.onWindowDestroyed === 'function') {
      window.electronAPI.onWindowDestroyed((msg) => syncRunningWindows());
    }
    if (typeof window.electronAPI.onAppsUpdated === 'function') {
      window.electronAPI.onAppsUpdated((newApps) => {
        allApps = newApps;
        applyCategoryFilter(currentCategory);
        setupDock();
      });
    }
    if (typeof window.electronAPI.onRamWarning === 'function') {
      window.electronAPI.onRamWarning((data) => {
        showTopIslandNotification('Bộ nhớ RAM đầy', data.message, 'warning');
      });
    }
    if (typeof window.electronAPI.onRamAlert === 'function') {
      window.electronAPI.onRamAlert((data) => {
        showTopIslandNotification('Giám sát RAM', data.message, data.level === 'critical' ? 'warning' : 'info');
      });
    }
    if (typeof window.electronAPI.onMemoryPressure === 'function') {
      window.electronAPI.onMemoryPressure(() => {
        if (!switcherOverlay.classList.contains('active')) switcherDeck.replaceChildren();
        if (!currentLaunchingApp && !activeAnimation) animProxySnap.removeAttribute('src');
      });
    }
  }
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.code === 'Space') {
      e.preventDefault();
      openSpotlight();
    } else if (e.key === 'Escape') {
      closeSpotlight();
      closeAppSwitcher();
      closeAndroidShade();
      closeFolderModal();
      closeDesktopModal();
      closeAllContextMenus();
      closeDynamicIsland();
    }
  });
  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  setPage(1);
  closeAndroidShade();
  loadApps();
})();