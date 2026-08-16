import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import arasaacHandler from './api/arasaac.js'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'arasaac-local-api',
      configureServer(server) {
        server.middlewares.use('/api/arasaac', (request, response) => {
          void arasaacHandler(request, response)
        })
      },
    },
  ],
})
