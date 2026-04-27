import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Repo name → served at https://<user>.github.io/evm-trainer/
export default defineConfig({
  base: '/evm-trainer/',
  plugins: [react(), tailwindcss()],
})
