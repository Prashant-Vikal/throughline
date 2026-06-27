import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative base so the built `dist/` works from any sub-path on shared hosting.
export default defineConfig({
  plugins: [react()],
  base: './',
})
