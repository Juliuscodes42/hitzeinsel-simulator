import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// base './' sorgt dafür, dass die App auch in einem Unterordner
// (GitHub Pages: /<repo-name>/) alle Dateien findet.
export default defineConfig({
  base: './',
  plugins: [react()],
})
