'use client'
import { useSession, signOut } from 'next-auth/react'
import { useState } from 'react'
import AuthWrapper from '../components/AuthWrapper'

export default function ProfilePage() {
  return (
    <AuthWrapper>
      <ProfileContent />
    </AuthWrapper>
  )
}

function ProfileContent() {
  const { data: session } = useSession()
  const [passwordData, setPasswordData] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setIsLoading(true)

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('New passwords do not match')
      setIsLoading(false)
      return
    }

    if (passwordData.newPassword.length < 6) {
      setError('New password must be at least 6 characters long')
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          oldPassword: passwordData.oldPassword,
          newPassword: passwordData.newPassword
        })
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to change password')
      } else {
        setMessage('Password changed successfully!')
        setPasswordData({
          oldPassword: '',
          newPassword: '',
          confirmPassword: ''
        })
      }
    } catch (error) {
      setError('Network error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPasswordData({
      ...passwordData,
      [e.target.name]: e.target.value
    })
  }

  if (!session?.user) {
    return <div>Loading...</div>
  }

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <h1 className="text-3xl font-bold mb-6">Profile</h1>
      
      {/* User Information */}
      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">User Information</h2>
        <div className="space-y-3">
          <div>
            <span className="font-medium">Email: </span>
            {session.user.email}
          </div>
          <div>
            <span className="font-medium">Role: </span>
            {session.user.role}
          </div>
          {session.user.clubName && (
            <div>
              <span className="font-medium">Club: </span>
              {session.user.clubName}
            </div>
          )}
          {session.user.isAdmin && (
            <div className="text-blue-600 font-medium">
              ✓ Admin privileges
            </div>
          )}
        </div>
      </div>

      {/* Change Password */}
      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Change Password</h2>
        
        {error && (
          <div className="text-red-600 text-sm bg-red-50 p-3 rounded mb-4">
            {error}
          </div>
        )}

        {message && (
          <div className="text-green-600 text-sm bg-green-50 p-3 rounded mb-4">
            {message}
          </div>
        )}

        <form onSubmit={handlePasswordChange} className="space-y-4">
          <input
            type="password"
            name="oldPassword"
            placeholder="Current Password"
            value={passwordData.oldPassword}
            onChange={handleInputChange}
            required
            className="w-full p-2 border rounded"
            disabled={isLoading}
          />
          
          <input
            type="password"
            name="newPassword"
            placeholder="New Password (minimum 6 characters)"
            value={passwordData.newPassword}
            onChange={handleInputChange}
            required
            minLength={6}
            className="w-full p-2 border rounded"
            disabled={isLoading}
          />
          
          <input
            type="password"
            name="confirmPassword"
            placeholder="Confirm New Password"
            value={passwordData.confirmPassword}
            onChange={handleInputChange}
            required
            className="w-full p-2 border rounded"
            disabled={isLoading}
          />
          
          <button 
            type="submit" 
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            disabled={isLoading}
          >
            {isLoading ? 'Changing Password...' : 'Change Password'}
          </button>
        </form>
      </div>

      {/* Sign Out */}
      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Account Actions</h2>
        <button 
          onClick={() => signOut({ callbackUrl: '/' })}
          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
        >
          Sign Out
        </button>
      </div>
    </div>
  )
}