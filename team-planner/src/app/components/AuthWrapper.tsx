'use client'
import { useSession, signIn } from 'next-auth/react'
import { ReactNode, useEffect } from 'react'

export default function AuthWrapper({ children }: { children: ReactNode }) {
  const { status } = useSession()
  useEffect(() => {
    if (status === 'unauthenticated') signIn()
  }, [status])
  if (status !== 'authenticated') return <p>Loading…</p>
  return <>{children}</>
}
