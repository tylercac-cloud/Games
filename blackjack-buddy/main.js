// Blackjack Buddy — Electron main process.
// Creates a frameless, transparent, always-on-top window parked above the taskbar.
// Transparent areas are click-through; the renderer tells us when the cursor is over her or the table.

const { app, BrowserWindow, ipcMain, screen, Menu, Tray, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

// If the widget ever shows up as a black box on your PC, uncomment the next line.
// app.disableHardwareAcceleration();

const W = 560, H = 412;

let win = null;
let tray = null;
let dragStart = null;
let saveTimer = null;
const iconPath = path.join(__dirname, 'icon.png');

const posFile = () => path.join(app.getPath('userData'), 'position.json');

function loadPos() {
  try { return JSON.parse(fs.readFileSync(posFile(), 'utf8')); } catch (e) { return null; }
}

function savePos() {
  if (!win || win.isDestroyed()) return;
  try {
    const [x, y] = win.getPosition();
    fs.writeFileSync(posFile(), JSON.stringify({ x, y }));
  } catch (e) { /* not important */ }
}

function onSomeScreen(p) {
  return screen.getAllDisplays().some(d => {
    const b = d.workArea;
    return p.x + W - 60 > b.x && p.x + 60 < b.x + b.width && p.y + H - 60 > b.y && p.y + 60 < b.y + b.height;
  });
}

function create() {
  const wa = screen.getPrimaryDisplay().workArea;
  let x = wa.x + wa.width - W - 8;
  let y = wa.y + wa.height - H;
  const saved = loadPos();
  if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y) && onSomeScreen(saved)) {
    x = saved.x; y = saved.y;
  }

  win = new BrowserWindow({
    x, y, width: W, height: H,
    frame: false, transparent: true, alwaysOnTop: true, skipTaskbar: true,
    resizable: false, maximizable: false, fullscreenable: false, hasShadow: false,
    show: false, title: 'Blackjack Buddy',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: true,
    },
  });
  win.setMenu(null);
  // Export CSV: offer the Downloads folder in the save dialog
  win.webContents.session.on('will-download', (e, item) => {
    item.setSaveDialogOptions({ defaultPath: path.join(app.getPath('downloads'), item.getFilename()) });
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.loadFile('index.html');
  win.once('ready-to-show', () => {
    win.show();
    win.setIgnoreMouseEvents(true, { forward: true });
  });
  win.on('move', () => { clearTimeout(saveTimer); saveTimer = setTimeout(savePos, 400); });
  win.on('closed', () => { win = null; });
  createTray();

  if (process.env.BB_TEST) { try { require('./test-hook')(win, app); } catch (e) { /* not shipped in the packaged app */ } }
}

function toggleVisible() {
  if (!win) return;
  if (win.isVisible()) win.hide();
  else { win.show(); win.setIgnoreMouseEvents(true, { forward: true }); }
}

function createTray() {
  if (!fs.existsSync(iconPath)) return;
  try {
    tray = new Tray(nativeImage.createFromPath(iconPath).resize({ width: 32, height: 32 }));
    tray.setToolTip('Blackjack Buddy');
    const send = cmd => () => { if (win) { if (!win.isVisible()) win.show(); win.webContents.send('menu', cmd); } };
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Show / hide her', click: toggleVisible },
      { label: 'Open / close table', click: send('toggle') },
      { label: 'House rules & paytables', click: send('rules') },
      { label: 'Stats & VIP', click: send('stats') },
      { label: 'Sound on / off', click: send('mute') },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() },
    ]));
    tray.on('click', toggleVisible);
  } catch (e) { tray = null; }
}

ipcMain.on('ignore-mouse', (e, ignore) => {
  if (!win) return;
  if (ignore) win.setIgnoreMouseEvents(true, { forward: true });
  else win.setIgnoreMouseEvents(false);
});

ipcMain.on('drag-start', () => { if (win) dragStart = win.getPosition(); });
ipcMain.on('drag-move', (e, d) => {
  if (!win || !dragStart) return;
  win.setPosition(Math.round(dragStart[0] + d.dx), Math.round(dragStart[1] + d.dy));
});

ipcMain.on('context-menu', () => {
  if (!win) return;
  const send = cmd => () => win && win.webContents.send('menu', cmd);
  Menu.buildFromTemplate([
    { label: 'Open / close table', click: send('toggle') },
    { label: 'House rules & paytables', click: send('rules') },
    { label: 'Stats & VIP', click: send('stats') },
    { label: 'Sound on / off', click: send('mute') },
    { label: 'Top up chips (when broke)', click: send('reset') },
    { label: 'Hide her (tray icon brings her back)', click: toggleVisible },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]).popup({ window: win });
});

ipcMain.on('quit', () => { savePos(); app.quit(); });

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => { if (win) win.show(); });
  app.whenReady().then(create);
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', savePos);
}
