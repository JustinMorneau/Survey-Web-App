import { Link } from 'react-router'
import { usePageTitle } from '../lib/usePageTitle'

export default function HomePage() {
  usePageTitle('')
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Classroom Survey</h1>
        <p className="mt-4 text-lg text-muted">Quick in-class understanding checks</p>
        <Link
          to="/login"
          className="mt-10 inline-flex min-h-11 items-center justify-center rounded-lg bg-board px-8 text-lg font-semibold text-white hover:bg-board-dark focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-board"
        >
          Instructor login
        </Link>
      </div>
    </main>
  )
}
