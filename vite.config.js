import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Code splitting is left to Rollup's own analysis.
//
// Hand-written manualChunks groups (react / mui / charts / ...) were tried and
// rejected: MUI and recharts contain circular imports across their own
// packages, so cutting the graph into named chunks produced a circular chunk
// graph and a runtime "Cannot access 'x' before initialization" crash in the
// built bundle. Heavy routes are lazy-loaded instead (see src/App.jsx), which
// splits along real dependency boundaries and cannot introduce that cycle.
//
// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
})