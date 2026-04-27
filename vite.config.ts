import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import { nitro } from 'nitro/vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const config = defineConfig({
  // Allow tunnel hostnames (ngrok, cloudflared) so DocuPipe webhooks can
  // reach the local dev server without "Invalid Host header" 403s.
  server: {
    allowedHosts: ['.ngrok-free.dev', '.ngrok.app', '.trycloudflare.com'],
  },
  plugins: [
    devtools(),
    tsconfigPaths({ projects: ['./tsconfig.json'] }),
    tailwindcss(),
    tanstackStart(),
    nitro({ preset: 'vercel' }),
    viteReact(),
  ],
})

export default config
