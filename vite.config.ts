import { defineConfig } from 'vite'
//import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [],
  root: '.',
  build: {
    outDir: 'dist/client',
    emptyOutDir: false
  }
})
