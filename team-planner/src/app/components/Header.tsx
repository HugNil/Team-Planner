'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function Header() {
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    const storedLoggedIn = sessionStorage.getItem('loggedIn');
    if (storedLoggedIn === 'true') {
      setLoggedIn(true);
    }
  }, []);

  return (
    <>
      <nav className="h-20 w-full bg-transparent shadow p-10 flex justify-between items-center align-middle">
        <Link href="/"><h1 className="text-4xl font-bold transition-transform duration-500 hover:scale-105">TeamPlanner</h1></Link>
        <ul className="flex flex-row gap-6 p-6">
          {loggedIn && (
            <>
              <li className="text-xl transition-transform duration-500 hover:scale-105"><Link href="/builder">PLANNER</Link></li>
              <li className="text-xl transition-transform duration-500 hover:scale-105"><Link href="/matches">MATCHES</Link></li>
            </>
          )}
          <li className="text-xl transition-transform duration-500 hover:scale-105">
            <Link href={loggedIn ? "/profile" : "/login"}>PROFILE</Link>
          </li>
          <li className="text-xl transition-transform duration-500 hover:scale-105"><Link href="/contact">CONTACT</Link></li>
        </ul>
      </nav>
    </>
  );
}