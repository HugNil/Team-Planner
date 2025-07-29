import Image from "next/image";

export default function Home() {
  return (
    <section className="h-screen flex flex-col gap-5 items-center justify-center p-4">
      <h1 className="text-7xl font-bold mb-4 text-center">This is TeamPlanner</h1>
      <p className="mb-8 text-center">A simple platform for real-time collaboration in the selection committee.</p>
      <p className="text-sm text-center">Team Planner hopes to streamline the process of team selection<br/>and improve communication among committee members.</p>
      <a href="/login" className="px-6 py-2 bg-transparent border-2 border-black text-black font-semibold rounded transition-transform duration-500 hover:scale-105">Get Started</a>
    </section>
  )
}
