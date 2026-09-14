# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and ESLint.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

`eslint.config.js` uses [typescript-eslint](https://typescript-eslint.io) with type-aware rules disabled by default for speed. To enable type-aware linting, use `tseslint.configs.recommendedTypeChecked` (or `strictTypeChecked`) in place of `tseslint.configs.recommended`, and set `languageOptions.parserOptions.projectService` — see the [typed linting docs](https://typescript-eslint.io/getting-started/typed-linting) for details.
