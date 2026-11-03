import { Link } from 'react-router'

// Placeholder route so deep-link refresh can be verified in Phase 1.
// Replaced by the real login form in Phase 2.
export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md rounded-lg border border-line bg-white p-8">
        <h1 className="text-2xl font-bold">Instructor Login</h1>
        <p className="mt-3 text-muted">The login form is added in Phase 2.</p>
        <Link
          to="/"
          className="mt-6 inline-block font-semibold text-board underline underline-offset-4 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-board"
        >
          Back to home
        </Link>
      </div>
    </main>
  )
}
