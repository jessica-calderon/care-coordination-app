import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// For GitHub Pages: base should be '/your-repo-name/' (with trailing slash)
// Change 'care-coordination-app' to match your GitHub repository name
// If deploying to root domain (username.github.io), set base to '/'
export default defineConfig({
  plugins: [react()],
  base: process.env.NODE_ENV === 'production' 
    ? '/care-coordination-app/' 
    : '/',
})
