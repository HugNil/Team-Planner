'use client'
import { useState } from 'react'

export default function JoinRequestPage() {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [clubCode, setClubCode] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await fetch('/api/join-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name, clubCode })
    })
    alert('Din förfrågan är skickad!')
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto space-y-4">
      <h2 className="text-2xl font-semibold">Be om konto</h2>
      <input
        type="text"
        placeholder="Klubbkod"
        value={clubCode}
        onChange={e => setClubCode(e.target.value)}
        className="w-full p-2 border rounded"
      />
      <input
        type="email"
        placeholder="Din e-post"
        value={email}
        onChange={e => setEmail(e.target.value)}
        className="w-full p-2 border rounded"
      />
      <input
        type="text"
        placeholder="Ditt namn"
        value={name}
        onChange={e => setName(e.target.value)}
        className="w-full p-2 border rounded"
      />
      <button type="submit" className="w-full bg-green-600 text-white py-2 rounded">
        Skicka förfrågan
      </button>
    </form>
  )
}
