import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/determinations')({
  loader: () => {
    throw redirect({ to: '/intelligence' })
  },
})
