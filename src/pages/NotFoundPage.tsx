import { Link } from 'react-router'

export default function NotFoundPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Page not found.</h1>
        <Link
          to="/"
          className="mt-6 inline-block font-semibold text-board underline underline-offset-4 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-board"
        >
          Go to home
        </Link>
      </div>
    </main>
  )
}
