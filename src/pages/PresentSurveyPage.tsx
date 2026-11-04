import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import QRCode from 'qrcode'
import ConfirmDialog from '../components/ConfirmDialog'
import { buttonStyles } from '../components/styles'
import { toUserMessage } from '../lib/errors'
import { getSurveyUrl } from '../lib/publicUrl'
import { closeSurvey, getPresentSurvey, type PresentSurvey } from '../lib/surveys'

const POLL_INTERVAL_MS = 5000

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; survey: PresentSurvey }

export default function PresentSurveyPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()

  const [loadState, setLoadState] = useState<LoadState>({ kind: 'loading' })
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [confirmClose, setConfirmClose] = useState(false)
  const [closing, setClosing] = useState(false)
  const [closeError, setCloseError] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const survey = loadState.kind === 'ready' ? loadState.survey : null
  const isActive = survey?.status === 'active'
  const slug = survey?.publicSlug ?? null
  const surveyUrl = slug ? getSurveyUrl(slug) : null

  // Load, then poll status and response count every 5 s while the tab is visible (D11).
  useEffect(() => {
    let cancelled = false
    let timer: number | undefined

    const refresh = () => {
      getPresentSurvey(id).then(
        (loaded) => {
          if (!cancelled) setLoadState({ kind: 'ready', survey: loaded })
        },
        (err: unknown) => {
          // Keep showing the last good data if a single poll fails.
          if (!cancelled)
            setLoadState((current) =>
              current.kind === 'ready' ? current : { kind: 'error', message: toUserMessage(err) },
            )
        },
      )
    }

    const start = () => {
      if (timer !== undefined) return
      refresh()
      timer = window.setInterval(refresh, POLL_INTERVAL_MS)
    }

    const stop = () => {
      if (timer === undefined) return
      window.clearInterval(timer)
      timer = undefined
    }

    const handleVisibility = () => (document.visibilityState === 'visible' ? start() : stop())

    handleVisibility()
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      cancelled = true
      stop()
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [id])

  // Generate the QR code once the URL is known.
  useEffect(() => {
    if (!surveyUrl) return
    let cancelled = false
    QRCode.toDataURL(surveyUrl, { width: 1024, margin: 2, errorCorrectionLevel: 'M' }).then(
      (dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl)
      },
      () => {
        if (!cancelled) setQrDataUrl(null)
      },
    )
    return () => {
      cancelled = true
    }
  }, [surveyUrl])

  // Track full-screen mode (Escape can also exit it).
  useEffect(() => {
    const handleChange = () => setIsFullscreen(document.fullscreenElement !== null)
    document.addEventListener('fullscreenchange', handleChange)
    return () => document.removeEventListener('fullscreenchange', handleChange)
  }, [])

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      void document.exitFullscreen()
    } else {
      void document.documentElement.requestFullscreen()
    }
  }

  async function handleClose() {
    setClosing(true)
    setCloseError(null)
    try {
      await closeSurvey(id)
      if (document.fullscreenElement) await document.exitFullscreen()
      navigate('/dashboard')
    } catch (err) {
      setConfirmClose(false)
      setCloseError(toUserMessage(err))
      setClosing(false)
    }
  }

  const dashboardLink = (
    <Link
      to="/dashboard"
      className="text-sm font-semibold text-board underline underline-offset-4 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-board"
    >
      Back to Dashboard
    </Link>
  )

  if (loadState.kind === 'loading') {
    return (
      <p role="status" className="p-8 text-center text-muted">
        Loading survey...
      </p>
    )
  }

  if (loadState.kind === 'error' || !survey || !isActive || !surveyUrl) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-8">
        {dashboardLink}
        <div role="alert" className="mt-6 rounded-lg border border-line bg-white p-6 text-lg">
          {loadState.kind === 'error' ? loadState.message : 'This survey is not active.'}
        </div>
      </main>
    )
  }

  const displayUrl = surveyUrl.replace(/^https?:\/\//, '')

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {!isFullscreen && <div className="px-6 pt-4">{dashboardLink}</div>}

      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-6 text-center">
        <h1 className="text-3xl font-bold sm:text-5xl">{survey.title}</h1>

        {qrDataUrl ? (
          <img
            src={qrDataUrl}
            alt={`QR code that opens ${displayUrl}`}
            className="aspect-square w-[min(60vh,85vw)]"
          />
        ) : (
          <div className="flex aspect-square w-[min(60vh,85vw)] items-center justify-center text-muted">
            Generating QR code...
          </div>
        )}

        <p className="text-xl font-semibold break-all sm:text-3xl">{displayUrl}</p>

        <p className="text-2xl sm:text-4xl" aria-live="polite">
          Responses: <span className="font-bold">{survey.responseCount}</span>
        </p>

        {closeError && (
          <p role="alert" className="font-semibold text-red-700">
            {closeError}
          </p>
        )}
      </main>

      <footer className="flex flex-wrap justify-center gap-3 border-t border-line px-6 py-4">
        {qrDataUrl && (
          <a href={qrDataUrl} download={`survey-${slug}-qr.png`} className={buttonStyles.secondary}>
            Download QR
          </a>
        )}
        {document.fullscreenEnabled && (
          <button type="button" className={buttonStyles.secondary} onClick={toggleFullscreen}>
            {isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
          </button>
        )}
        <Link to={`/surveys/${id}/results`} className={buttonStyles.secondary}>
          View Results
        </Link>
        <button
          type="button"
          className={buttonStyles.danger}
          onClick={() => setConfirmClose(true)}
          disabled={closing}
        >
          Close Survey
        </button>
      </footer>

      {confirmClose && (
        <ConfirmDialog
          open
          title={`Close "${survey.title}"?`}
          actions={[{ label: 'Close Survey', variant: 'danger', onClick: handleClose }]}
          onCancel={() => setConfirmClose(false)}
          busy={closing}
        >
          <p>Students will no longer be able to submit responses. You can reopen it later.</p>
        </ConfirmDialog>
      )}
    </div>
  )
}
