import Image from "next/image";

export default function Home() {
  return (
    <section className="h-screen flex flex-col gap-5 items-center justify-center py-20">
      <h1 className="text-7xl font-bold mb-4">This is TeamPlanner</h1>
      <p className="mb-8">A simple platform for real-time collaboration in the selection committee.</p>
      <a href="/login" className="px-6 py-2 bg-blue-600 text-white rounded">Get Started</a>
    </section>
  )
}
