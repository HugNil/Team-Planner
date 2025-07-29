'use client'
import { signIn } from 'next-auth/react'
import { useState } from 'react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  return (
    <form
      onSubmit={e => {
        e.preventDefault()
        signIn('credentials', { email, password, callbackUrl: '/builder' })
      }}
      className="max-w-md mx-auto space-y-4"
    >
      <h2 className="text-2xl font-semibold">Logga in</h2>
      <input
        type="email"
        placeholder="E-post"
        value={email}
        onChange={e => setEmail(e.target.value)}
        className="w-full p-2 border rounded"
      />
      <input
        type="password"
        placeholder="Lösenord"
        value={password}
        onChange={e => setPassword(e.target.value)}
        className="w-full p-2 border rounded"
      />
      <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded">
        Logga in
      </button>
      <p className="text-sm">
        Nytt konto? <a href="/join-request" className="text-blue-600">Skicka join-request</a>
      </p>
    </form>
  )
}
