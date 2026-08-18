import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('libreria', {
  plataforma: process.platform,
  version: '1.0.0',
});