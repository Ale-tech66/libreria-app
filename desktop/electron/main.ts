import { app, BrowserWindow, shell } from 'electron';
import * as path from 'path';

const isDev = !!process.env.VITE_DEV_SERVER_URL;

function crearVentana(): void {
  const ventana = new BrowserWindow({
    width: 1240,
    height: 780,
    minWidth: 1024,
    minHeight: 660,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0f172a',
    title: 'Librería App',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  ventana.once('ready-to-show', () => ventana.show());

  ventana.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    ventana.loadURL(process.env.VITE_DEV_SERVER_URL!);
  } else {
    ventana.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  crearVentana();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) crearVentana();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});