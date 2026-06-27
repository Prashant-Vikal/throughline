import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Served at a custom domain root (throughline.vikals.com), so use an absolute base.
export default defineConfig({
  plugins: [react()],
  base: '/',
})
