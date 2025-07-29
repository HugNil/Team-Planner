'use client'
import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'

export default function Nav() {
  const { data: session } = useSession()
  return (
    <nav className="bg-white shadow p-4 flex justify-between">
      <div className="space-x-4">
        <Link href="/">Home</Link>
        {session && <>
          <Link href="/builder">Builder</Link>
          <Link href="/schedule">Schedule</Link>
        </>}
      </div>
      <div>
        {session ? (
          <button onClick={() => signOut()} className="text-sm">Logga ut</button>
        ) : (
          <Link href="/login" className="text-sm">Logga in</Link>
        )}
      </div>
    </nav>
  )
}
