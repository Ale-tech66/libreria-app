# Expo

This project uses **Expo SDK 54** (see `package.json`).

Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code.

## Project conventions

- Lógica de negocio en `src/hooks/` y `src/api/`, nunca dentro de los componentes de UI.
- Tipos compartidos en `src/types/` — no usar `any` en código nuevo.
- Verificar siempre con `npx tsc --noEmit` y `npm run lint`.