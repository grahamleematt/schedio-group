import { createMiddleware, createStart } from '@tanstack/react-start'

function hasWorkOsConfig(): boolean {
  return Boolean(
    process.env.WORKOS_API_KEY &&
    process.env.WORKOS_CLIENT_ID &&
    process.env.WORKOS_COOKIE_PASSWORD &&
    process.env.WORKOS_REDIRECT_URI,
  )
}

// AuthKit is Node-only (iron-session touches `Buffer`). Import it lazily inside
// the server handler so the package never enters the client bundle, which the
// vite `noExternal` inlining would otherwise force and break hydration with a
// `Buffer is not defined` ReferenceError.
const optionalAuthkitMiddleware = createMiddleware().server(async (ctx) => {
  if (!hasWorkOsConfig()) return ctx.next()
  const { authkitMiddleware } = await import(
    '@workos/authkit-tanstack-react-start'
  )
  const runAuthkit = authkitMiddleware().options.server
  if (!runAuthkit) return ctx.next()
  return runAuthkit(ctx)
})

export const startInstance = createStart(() => ({
  requestMiddleware: [optionalAuthkitMiddleware],
}))
