'use client'
import { signIn } from 'next-auth/react'
import { useState } from 'react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  return (
    <section className="h-[calc(100vh-5rem)] flex flex-col justify-start items-start p-4 py-60">
      <form
        onSubmit={e => {
          e.preventDefault()
          signIn('credentials', { email, password, callbackUrl: '/builder' })
        }}
        className="max-w-md mx-auto space-y-4"
      >
        <h2 className="text-2xl font-semibold">Sign in</h2>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full p-2 border rounded"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full p-2 border rounded"
        />
        <button type="submit" className="w-full py-2 bg-transparent border-2 border-black text-black font-semibold rounded hover:bg-green-500 transition-colors duration-500">
          Sign in
        </button>
        <div className="flex justify-between items-center text-sm">
          <p className="flex flex-row">
            <span className="text-black whitespace-pre">Don't have an account?  </span> <a href="/join-request" className="text-blue-600">Join us!</a>
          </p>
          <a href="/" className="text-blue-600">Back</a>
        </div>
      </form>
    </section>
  )
}
