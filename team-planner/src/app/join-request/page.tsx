'use client'
import { useState } from 'react'

export default function JoinRequestPage() {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await fetch('/api/join-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name })
    })
    alert('Your account has been created!')
  }

  return (
    <section className="h-screen flex flex-col gap-5 items-center justify-center py-20">
      <form onSubmit={handleSubmit} className="max-w-md mx-auto space-y-4">
        <h2 className="text-2xl font-semibold">Join us!</h2>
        <input
          type="email"
          placeholder="Your email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full p-2 border rounded"
        />
        <input
          type="text"
          placeholder="Your name"
          value={name}
          onChange={e => setName(e.target.value)}
          className="w-full p-2 border rounded"
        />
        <button type="submit" className="w-full py-2 bg-transparent border-2 border-black text-black font-semibold rounded hover:bg-green-500 transition-colors duration-500">
          Create account
        </button>
        <p className="text-sm flex justify-end">
          <a href="/login" className="text-blue-600">Back</a>
        </p>
      </form>
    </section>
  )
}
