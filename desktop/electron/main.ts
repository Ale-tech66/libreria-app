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

  const URL_SEGURA = /^https?:\/\/(libreria-api-4lr3\.onrender\.com|(accounts|api|oauth2)\.google\.com|mail\.google\.com)\//;

  ventana.webContents.setWindowOpenHandler(({ url }) => {
    if (URL_SEGURA.test(url)) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  ventana.webContents.on('will-navigate', (evento, url) => {
    const actual = ventana.webContents.getURL();
    if (url === actual) return;
    const esInterna =
      (isDev && !!process.env.VITE_DEV_SERVER_URL && url.startsWith(process.env.VITE_DEV_SERVER_URL)) ||
      (!isDev && url.startsWith('file:'));
    if (esInterna) return;
    evento.preventDefault();
    if (URL_SEGURA.test(url)) {
      void shell.openExternal(url);
    }
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