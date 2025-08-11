'use client'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: ''
  })
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password
        })
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Registration failed')
        setIsLoading(false)
        return
      }

      // Auto-login after successful registration
      const result = await signIn('credentials', {
        email: formData.email,
        password: formData.password,
        redirect: false
      })

      if (result?.error) {
        setError('Registration successful, but login failed. Please try logging in manually.')
      } else {
        router.push('/builder')
      }
    } catch (error) {
      setError('Network error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  return (
    <section className="h-[calc(100vh-5rem)] flex flex-col items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="max-w-md w-full space-y-4 bg-white p-6 rounded shadow">
        <h2 className="text-2xl font-semibold">Register</h2>
        
        {error && (
          <div className="text-red-600 text-sm bg-red-50 p-3 rounded">
            {error}
          </div>
        )}

        <input
          type="email"
          name="email"
          placeholder="Email"
          value={formData.email}
          onChange={handleChange}
          required
          className="w-full p-2 border rounded"
          disabled={isLoading}
        />
        
        <input
          type="password"
          name="password"
          placeholder="Password (minimum 6 characters)"
          value={formData.password}
          onChange={handleChange}
          required
          minLength={6}
          className="w-full p-2 border rounded"
          disabled={isLoading}
        />
        
        <input
          type="password"
          name="confirmPassword"
          placeholder="Confirm Password"
          value={formData.confirmPassword}
          onChange={handleChange}
          required
          className="w-full p-2 border rounded"
          disabled={isLoading}
        />
        
        <button 
          type="submit" 
          className="w-full px-6 py-2 bg-transparent border-2 border-black text-black font-semibold rounded hover:bg-green-400 transition-all duration-300 disabled:opacity-50"
          disabled={isLoading}
        >
          {isLoading ? 'Creating Account...' : 'Register'}
        </button>
        
        <div className="flex justify-between items-center text-sm">
          <p className="flex flex-row">
            <span className="text-black whitespace-pre">Already have an account?  </span> 
            <a href="/login" className="text-blue-600">Sign in!</a>
          </p>
          <a href="/" className="text-blue-600">Back</a>
        </div>
      </form>
    </section>
  )
}
