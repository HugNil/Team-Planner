'use client';

import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';

export default function Header() {
  const { data: session, status } = useSession();
  const isLoggedIn = status === 'authenticated' && session?.user;

  return (
    <>
      <nav className="h-20 w-full bg-transparent shadow p-10 flex justify-between items-center align-middle">
        <Link href="/"><h1 className="text-4xl font-bold transition-transform duration-500 hover:scale-105">TeamPlanner</h1></Link>
        <ul className="flex flex-row gap-6 p-6">
          {isLoggedIn && (
            <>
              <li className="text-xl transition-transform duration-500 hover:scale-105"><Link href="/builder">PLANNER</Link></li>
              <li className="text-xl transition-transform duration-500 hover:scale-105"><Link href="/schedule">MATCHES</Link></li>
              {session.user.isAdmin && (
                <li className="text-xl transition-transform duration-500 hover:scale-105"><Link href="/admin">ADMIN</Link></li>
              )}
            </>
          )}
          <li>
            {isLoggedIn ? (
                <div className="flex items-center gap-4 ">
                  <Link className='text-xl transition-transform duration-500 hover:scale-105' href="/profile">PROFILE</Link>
                  <button
                    onClick={() => signOut({ callbackUrl: '/' })}
                    className="text-sm bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 transition-transform duration-500 hover:scale-105"
                  >
                    SIGN OUT
                  </button>
                </div>
            ) : (
              <div className="flex items-center gap-4 ">
                <Link className='text-xl transition-transform duration-500 hover:scale-105' href="/login">LOGIN</Link>
                <Link className='text-xl transition-transform duration-500 hover:scale-105' href="/register">REGISTER</Link>
              </div>
            )}
          </li>
        </ul>
      </nav>
    </>
  );
}