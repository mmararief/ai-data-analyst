import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  appType: 'spa',
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    host: true,          // bind ke 0.0.0.0 agar bisa di-forward VS Code tunnel
    proxy: {
      '/streamlit/app': {
        target: 'http://localhost:8501',
        ws: true,
        changeOrigin: true,
      },
      '/auth': 'http://localhost:8000',
      '/chat': {
        target: 'http://localhost:8000',
        // Only proxy API calls (POST /chat/stream etc.), not the SPA route /chat/:id
        bypass(req) {
          // If it's a browser navigation (accepts HTML), let Vite serve index.html
          if (req.headers.accept?.includes('text/html')) return req.url
        },
      },
      '/datasets': 'http://localhost:8000',
      '/notebook': 'http://localhost:8000',
      '/history': 'http://localhost:8000',
      '/streamlit': 'http://localhost:8000',
    },
  },
})
