import { createMiddleware, createStart } from '@tanstack/react-start'
import { authkitMiddleware } from '@workos/authkit-tanstack-react-start'

function hasWorkOsConfig(): boolean {
  return Boolean(
    process.env.WORKOS_API_KEY &&
    process.env.WORKOS_CLIENT_ID &&
    process.env.WORKOS_COOKIE_PASSWORD &&
    process.env.WORKOS_REDIRECT_URI,
  )
}

const optionalAuthkitMiddleware = createMiddleware().server(async (ctx) => {
  if (!hasWorkOsConfig()) return ctx.next()
  const runAuthkit = authkitMiddleware().options.server
  if (!runAuthkit) return ctx.next()
  return runAuthkit(ctx)
})

export const startInstance = createStart(() => ({
  requestMiddleware: [optionalAuthkitMiddleware],
}))
