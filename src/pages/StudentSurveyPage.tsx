import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useParams } from 'react-router'
import { toUserMessage } from '../lib/errors'
import {
  errorCode,
  getAnonymousToken,
  getPublicSurvey,
  hasSubmitted,
  markSubmitted,
  submitSurveyResponse,
  type PublicSurvey,
} from '../lib/studentSurvey'

type PageState =
  | { kind: 'loading' }
  | { kind: 'loadError'; message: string }
  | { kind: 'unavailable' }
  | { kind: 'alreadySubmitted' }
  | { kind: 'form'; survey: PublicSurvey }
  | { kind: 'success' }

const UNAVAILABLE_CODES = new Set(['SURVEY_NOT_FOUND', 'SURVEY_NOT_ACTIVE'])

function questionId(id: string) {
  return `question-${id}`
}

export default function StudentSurveyPage() {
  const { slug = '' } = useParams()

  const [state, setState] = useState<PageState>({ kind: 'loading' })
  const [selected, setSelected] = useState<Record<string, string>>({})
  const [showMissing, setShowMissing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getPublicSurvey(slug).then(
      (survey) => {
        if (cancelled) return
        if (!survey) setState({ kind: 'unavailable' })
        else if (hasSubmitted(survey.id)) setState({ kind: 'alreadySubmitted' })
        else setState({ kind: 'form', survey })
      },
      (err: unknown) => {
        if (!cancelled) setState({ kind: 'loadError', message: toUserMessage(err, 'student') })
      },
    )
    return () => {
      cancelled = true
    }
  }, [slug])

  if (state.kind === 'loading') {
    return <Message role="status">Loading survey...</Message>
  }

  if (state.kind === 'loadError') {
    return (
      <Message role="alert">
        <p>{state.message}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 min-h-12 w-full rounded-lg bg-board px-6 text-lg font-semibold text-white focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-board"
        >
          Try again
        </button>
      </Message>
    )
  }

  if (state.kind === 'unavailable') {
    return <Message>This survey is no longer accepting responses.</Message>
  }

  if (state.kind === 'alreadySubmitted') {
    return <Message>You have already submitted a response to this survey.</Message>
  }

  if (state.kind === 'success') {
    return (
      <Message role="status">
        <h1 className="text-3xl font-bold">Thank you!</h1>
        <p className="mt-3 text-lg">Your response has been recorded.</p>
      </Message>
    )
  }

  const { survey } = state
  const missing = survey.questions.filter((question) => !selected[question.id])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitError(null)

    if (missing.length > 0) {
      setShowMissing(true)
      const first = document.getElementById(questionId(missing[0].id))
      first?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      first?.querySelector('input')?.focus({ preventScroll: true })
      return
    }

    setSubmitting(true)
    try {
      await submitSurveyResponse(
        survey.id,
        getAnonymousToken(),
        survey.questions.map((question) => ({
          question_id: question.id,
          choice_id: selected[question.id],
        })),
      )
      markSubmitted(survey.id)
      setState({ kind: 'success' })
    } catch (err) {
      const code = errorCode(err)
      if (code === 'DUPLICATE_RESPONSE') {
        markSubmitted(survey.id)
        setState({ kind: 'alreadySubmitted' })
      } else if (UNAVAILABLE_CODES.has(code)) {
        setState({ kind: 'unavailable' })
      } else {
        setSubmitError(toUserMessage(err, 'student'))
        setSubmitting(false)
      }
    }
  }

  return (
    <main className="mx-auto max-w-xl px-4 pt-6 pb-12">
      <h1 className="text-2xl font-bold sm:text-3xl">{survey.title}</h1>
      {survey.description && <p className="mt-2 text-lg text-muted">{survey.description}</p>}

      <form className="mt-6 space-y-6" onSubmit={handleSubmit} noValidate>
        {survey.questions.map((question, index) => {
          const isMissing = showMissing && !selected[question.id]
          const errorId = `${questionId(question.id)}-error`
          return (
            <fieldset
              key={question.id}
              id={questionId(question.id)}
              aria-describedby={isMissing ? errorId : undefined}
              className={`rounded-xl border bg-white p-4 ${isMissing ? 'border-red-400' : 'border-line'}`}
            >
              <legend className="float-left w-full text-lg font-semibold">
                {index + 1}. {question.question_text}
              </legend>

              <div className="clear-both space-y-3 pt-3">
                {question.choices.map((choice) => (
                  <label
                    key={choice.id}
                    className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-line px-4 py-3 text-lg has-checked:border-board has-checked:bg-green-50 has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-board"
                  >
                    <input
                      type="radio"
                      name={question.id}
                      value={choice.id}
                      checked={selected[question.id] === choice.id}
                      onChange={() =>
                        setSelected((current) => ({ ...current, [question.id]: choice.id }))
                      }
                      disabled={submitting}
                      className="size-5 shrink-0 accent-board"
                    />
                    <span>{choice.choice_text}</span>
                  </label>
                ))}
              </div>

              {isMissing && (
                <p id={errorId} className="mt-3 font-semibold text-red-700">
                  Please choose an answer.
                </p>
              )}
            </fieldset>
          )
        })}

        {submitError && (
          <p role="alert" className="font-semibold text-red-700">
            {submitError}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="min-h-14 w-full rounded-xl bg-board px-6 text-lg font-semibold text-white hover:bg-board-dark focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-board disabled:opacity-60"
        >
          {submitting ? 'Submitting...' : 'Submit'}
        </button>
      </form>
    </main>
  )
}

function Message({ children, role }: { children: ReactNode; role?: 'status' | 'alert' }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 text-center">
      <div role={role} className="max-w-md text-xl">
        {children}
      </div>
    </main>
  )
}
