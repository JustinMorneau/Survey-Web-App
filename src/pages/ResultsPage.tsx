import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import ResultsChart from '../components/ResultsChart'
import StatusBadge from '../components/StatusBadge'
import { buttonStyles } from '../components/styles'
import { toUserMessage } from '../lib/errors'
import { exportSurveyCsv, getSurveyResults, type SurveyResults } from '../lib/results'

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; results: SurveyResults }

function formatResponses(count: number): string {
  return `${count} response${count === 1 ? '' : 's'}`
}

export default function ResultsPage() {
  const { id = '' } = useParams()

  const [loadState, setLoadState] = useState<LoadState>({ kind: 'loading' })
  const [refreshing, setRefreshing] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getSurveyResults(id).then(
      (results) => {
        if (!cancelled) setLoadState({ kind: 'ready', results })
      },
      (err: unknown) => {
        if (!cancelled) setLoadState({ kind: 'error', message: toUserMessage(err) })
      },
    )
    return () => {
      cancelled = true
    }
  }, [id])

  async function handleRefresh() {
    setRefreshing(true)
    setActionError(null)
    try {
      const results = await getSurveyResults(id)
      setLoadState({ kind: 'ready', results })
    } catch (err) {
      setActionError(toUserMessage(err))
    } finally {
      setRefreshing(false)
    }
  }

  async function handleExport() {
    setExporting(true)
    setActionError(null)
    try {
      await exportSurveyCsv(id)
    } catch (err) {
      setActionError(toUserMessage(err))
    } finally {
      setExporting(false)
    }
  }

  const backLink = (
    <Link
      to="/dashboard"
      className="text-sm font-semibold text-board underline underline-offset-4 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-board"
    >
      Back to Dashboard
    </Link>
  )

  if (loadState.kind === 'loading') {
    return (
      <main className="mx-auto max-w-4xl px-6 py-8">
        <p role="status" className="text-muted">
          Loading results...
        </p>
      </main>
    )
  }

  if (loadState.kind === 'error') {
    return (
      <main className="mx-auto max-w-4xl px-6 py-8">
        {backLink}
        <div role="alert" className="mt-6 rounded-lg border border-line bg-white p-6 text-lg">
          {loadState.message}
        </div>
      </main>
    )
  }

  const { results } = loadState

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-white">
        <div className="mx-auto max-w-4xl px-6 py-4">
          {backLink}
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{results.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <StatusBadge status={results.status} />
            <span className="text-lg font-semibold">{formatResponses(results.response_count)}</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              className={buttonStyles.secondary}
              onClick={handleRefresh}
              disabled={refreshing}
            >
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
            <button
              type="button"
              className={buttonStyles.secondary}
              onClick={handleExport}
              disabled={exporting}
            >
              {exporting ? 'Exporting...' : 'Export CSV'}
            </button>
            {results.status === 'active' && (
              <Link to={`/surveys/${id}/present`} className={buttonStyles.primary}>
                Present QR
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-6 py-8">
        {actionError && (
          <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-800">
            {actionError}
          </p>
        )}

        {results.response_count === 0 && (
          <div className="rounded-xl border border-dashed border-line bg-white p-10 text-center">
            <p className="text-lg">No responses yet.</p>
            <p className="mt-2 text-muted">Display the QR code so students can join.</p>
          </div>
        )}

        {results.response_count > 0 &&
          results.questions.map((question, index) => (
            <section
              key={question.question_id}
              aria-labelledby={`result-${question.question_id}`}
              className="rounded-xl border border-line bg-white p-5 sm:p-6"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id={`result-${question.question_id}`} className="text-lg font-bold">
                  {index + 1}. {question.question_text}
                </h2>
                <span className="text-sm font-semibold text-muted">
                  {question.response_count} answered
                </span>
              </div>

              {question.response_count === 0 ? (
                <p className="mt-4 rounded-lg bg-paper p-4 text-muted">
                  No answers to this question yet.
                </p>
              ) : (
                <div className="mt-4">
                  <ResultsChart question={question} />
                </div>
              )}
            </section>
          ))}
      </main>
    </div>
  )
}
