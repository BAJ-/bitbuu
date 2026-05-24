import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'node:path';

const DEV_URL = process.env.VITE_DEV_SERVER_URL;

function isAllowedNavigation(target: string): boolean {
  if (DEV_URL && target.startsWith(DEV_URL)) return true;
  if (target.startsWith('file://')) return true;
  return false;
}

app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  contents.on('will-navigate', (event, target) => {
    if (!isAllowedNavigation(target)) event.preventDefault();
  });
});

ipcMain.handle('ping', () => 'pong' as const);

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
