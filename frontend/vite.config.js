import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite dev server runs on http://localhost:5173 and proxies nothing:
// the React app talks to FastAPI directly via VITE_API_URL (see src/services/api.js).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
})
