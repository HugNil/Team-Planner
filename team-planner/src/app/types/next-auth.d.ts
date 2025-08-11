import NextAuth from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
      role: string
      clubId?: string | null
      clubName?: string | null
      isAdmin: boolean
    }
  }

  interface User {
    id: string
    email: string
    role: string
    clubId?: string | null
    clubName?: string | null
    isAdmin: boolean
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string
    clubId?: string | null
    clubName?: string | null
    isAdmin?: boolean
  }
}
