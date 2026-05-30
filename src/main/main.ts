import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import * as path from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';

const DEV_URL = process.env.VITE_DEV_SERVER_URL;

function isAllowedNavigation(currentUrl: string, target: string): boolean {
  let current: URL;
  let next: URL;
  try {
    current = new URL(currentUrl);
    next = new URL(target);
  } catch {
    return false;
  }
  return current.origin === next.origin && current.pathname === next.pathname;
}

app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  contents.on('will-navigate', (event, target) => {
    if (!isAllowedNavigation(contents.getURL(), target)) event.preventDefault();
  });
});

const FILE_FILTERS = [{ name: 'bitbuu model', extensions: ['buu'] }];
const forceClosing = new WeakSet<BrowserWindow>();

ipcMain.handle('model:save', async (event, bytes: Uint8Array) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return { canceled: true };
  const result = await dialog.showSaveDialog(win, {
    filters: FILE_FILTERS,
    defaultPath: 'model.buu',
  });
  if (result.canceled || !result.filePath) return { canceled: true };
  await writeFile(result.filePath, bytes);
  return { canceled: false };
});

ipcMain.handle('model:open', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return { canceled: true };
  const result = await dialog.showOpenDialog(win, {
    filters: FILE_FILTERS,
    properties: ['openFile'],
  });
  if (result.canceled || result.filePaths.length === 0) return { canceled: true };
  const buf = await readFile(result.filePaths[0]!);
  return { canceled: false, bytes: new Uint8Array(buf) };
});

ipcMain.handle('app:confirm-discard', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return 'discard' as const;
  const result = await dialog.showMessageBox(win, {
    type: 'question',
    buttons: ['Save', "Don't Save", 'Cancel'],
    defaultId: 0,
    cancelId: 2,
    message: 'Save changes to your model?',
    detail: 'Your changes will be lost if you discard them.',
  });
  if (result.response === 0) return 'save' as const;
  if (result.response === 1) return 'discard' as const;
  return 'cancel' as const;
});

ipcMain.handle('app:force-close', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  forceClosing.add(win);
  win.close();
});

async function createWindow(): Promise<void> {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: '#1e1e1e',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  if (DEV_URL) {
    await win.loadURL(DEV_URL);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    await win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  }

  win.on('close', (event) => {
    if (forceClosing.has(win)) return;
    event.preventDefault();
    if (win.webContents.isDestroyed()) return;
    win.webContents.send('app:close-requested');
  });
}

app.whenReady().then(() => {
  createWindow().catch((err) => {
    console.error(err);
    app.exit(1);
  });
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow().catch((err) => {
        console.error(err);
        app.exit(1);
      });
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
