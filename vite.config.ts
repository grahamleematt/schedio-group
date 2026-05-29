import { resolve } from 'node:path'

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
  // WorkOS AuthKit's internal code imports the package by its own name
  // (a self-reference), which Vite leaves as a bare external. That bare import
  // is never traced into the Vercel function -> ERR_MODULE_NOT_FOUND at runtime.
  // Aliasing the specifier to its real entry forces the bundler to inline the
  // package everywhere (server + the self-import), and noExternal keeps its
  // request-scoped session deps bundled too.
  resolve: {
    alias: {
      '@workos/authkit-tanstack-react-start': resolve(
        import.meta.dirname,
        'node_modules/@workos/authkit-tanstack-react-start/dist/index.js',
      ),
    },
  },
  ssr: {
    noExternal: ['@workos/authkit-tanstack-react-start'],
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
