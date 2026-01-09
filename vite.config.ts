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
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Split React and React DOM into separate chunk
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) {
              return 'react-vendor';
            }
            // Split Firebase into its own chunk (it's large)
            // Firebase v9+ uses modular imports like 'firebase/firestore', 'firebase/app', etc.
            if (id.includes('firebase')) {
              return 'firebase-vendor';
            }
            // Split FontAwesome into its own chunk
            if (id.includes('@fortawesome')) {
              return 'fontawesome-vendor';
            }
            // Other node_modules can go into a vendor chunk
            return 'vendor';
          }
        },
      },
    },
    // Increase chunk size warning limit to 600kb (optional, but helps reduce noise)
    chunkSizeWarningLimit: 600,
  },
})
