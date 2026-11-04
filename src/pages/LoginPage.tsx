import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { buttonStyles, inputStyles, labelStyles } from '../components/styles'
import { isNetworkError, toUserMessage } from '../lib/errors'
import { useAuth } from '../lib/useAuth'

type LocationState = { from?: string } | null

export default function LoginPage() {
  const { session, loading, signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as LocationState)?.from ?? '/dashboard'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (loading) {
    return (
      <p role="status" className="p-8 text-center text-muted">
        Loading...
      </p>
    )
  }

  if (session && !submitting) {
    return <Navigate to={from} replace />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    const authError = await signIn(email.trim(), password)

    if (authError) {
      setSubmitting(false)
      setError(
        isNetworkError(authError)
          ? toUserMessage(authError)
          : authError.code === 'invalid_credentials' || authError.status === 400
            ? 'Incorrect email or password.'
            : toUserMessage(authError),
      )
      return
    }

    navigate(from, { replace: true })
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-md rounded-xl border border-line bg-white p-8">
        <h1 className="text-2xl font-bold">Instructor Login</h1>

        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className={labelStyles}>
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={inputStyles}
            />
          </div>

          <div>
            <label htmlFor="password" className={labelStyles}>
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={inputStyles}
            />
          </div>

          {error && (
            <p role="alert" className="text-sm font-semibold text-red-700">
              {error}
            </p>
          )}

          <button type="submit" className={`${buttonStyles.primary} w-full`} disabled={submitting}>
            {submitting ? 'Logging in...' : 'Log in'}
          </button>
        </form>

        <Link
          to="/"
          className="mt-6 inline-block text-sm font-semibold text-board underline underline-offset-4 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-board"
        >
          Back to home
        </Link>
      </div>
    </main>
  )
}
