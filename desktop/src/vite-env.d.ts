/// <reference types="vite/client" />

interface LibreriaBridge {
  plataforma: string;
  version: string;
}

declare global {
  interface Window {
    libreria?: LibreriaBridge;
  }
}

export {};