import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Le serveur de developpement ecoute sur toutes les interfaces reseau : les
// telephones du reseau local doivent pouvoir ouvrir le lien encode dans le QR
// Code. Les appels API passent par le proxy /api, donc ils restent valables que
// la page soit ouverte via localhost, 127.0.0.1 ou l'IP LAN du poste.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
