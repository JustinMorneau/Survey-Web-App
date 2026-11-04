import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import ConfirmDialog, { type DialogAction } from '../components/ConfirmDialog'
import StatusBadge from '../components/StatusBadge'
import { buttonStyles, inputStyles, labelStyles } from '../components/styles'
import { toUserMessage } from '../lib/errors'
import {
  ACTION_LABELS,
  IMPLEMENTED_ACTIONS,
  getAllowedActions,
  type SurveyAction,
} from '../lib/surveyActions'
import {
  activateSurvey,
  archiveSurvey,
  closeSurvey,
  deleteSurvey,
  duplicateSurvey,
  listSurveys,
  unarchiveSurvey,
  type SurveyStatus,
  type SurveySummary,
} from '../lib/surveys'
import { useAuth } from '../lib/useAuth'

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; surveys: SurveySummary[] }

type StatusFilter = 'not_archived' | 'all' | SurveyStatus

type ConfirmKind = 'archive' | 'unarchive' | 'delete' | 'activate' | 'close'

type PendingConfirm = {
  kind: ConfirmKind
  survey: SurveySummary
  /** For 'activate': the survey that will be closed. */
  currentlyActive?: SurveySummary
}

const STATUS_FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'not_archived', label: 'All except Archived' },
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'closed', label: 'Closed' },
  { value: 'archived', label: 'Archived' },
  { value: 'all', label: 'All' },
]

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

/** YYYY-MM-DD in the browser's local time zone (D16), comparable with <input type="date">. */
function toLocalDateKey(iso: string): string {
  const date = new Date(iso)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function formatResponses(count: number): string {
  return `${count} response${count === 1 ? '' : 's'}`
}

export default function DashboardPage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const [loadState, setLoadState] = useState<LoadState>({ kind: 'loading' })
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('not_archived')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [pending, setPending] = useState<PendingConfirm | null>(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [signingOut, setSigningOut] = useState(false)

  const loadSurveys = useCallback(async () => {
    try {
      const surveys = await listSurveys()
      setLoadState({ kind: 'ready', surveys })
    } catch (err) {
      setLoadState({ kind: 'error', message: toUserMessage(err) })
    }
  }, [])

  // Initial load. State is set in the promise callbacks, not in the effect body,
  // which is the pattern react-hooks/set-state-in-effect expects.
  useEffect(() => {
    let cancelled = false
    listSurveys().then(
      (loaded) => {
        if (!cancelled) setLoadState({ kind: 'ready', surveys: loaded })
      },
      (err: unknown) => {
        if (!cancelled) setLoadState({ kind: 'error', message: toUserMessage(err) })
      },
    )
    return () => {
      cancelled = true
    }
  }, [])

  const surveys = useMemo(() => (loadState.kind === 'ready' ? loadState.surveys : []), [loadState])

  const filteredSurveys = useMemo(() => {
    const query = search.trim().toLowerCase()
    return surveys.filter((survey) => {
      if (statusFilter === 'not_archived' && survey.status === 'archived') return false
      if (
        statusFilter !== 'not_archived' &&
        statusFilter !== 'all' &&
        survey.status !== statusFilter
      )
        return false
      if (query && !survey.title.toLowerCase().includes(query)) return false
      const createdDay = toLocalDateKey(survey.created_at)
      if (fromDate && createdDay < fromDate) return false
      if (toDate && createdDay > toDate) return false
      return true
    })
  }, [surveys, search, statusFilter, fromDate, toDate])

  const filtersActive =
    search !== '' || statusFilter !== 'not_archived' || fromDate !== '' || toDate !== ''

  function clearFilters() {
    setSearch('')
    setStatusFilter('not_archived')
    setFromDate('')
    setToDate('')
  }

  function retryLoad() {
    setLoadState({ kind: 'loading' })
    void loadSurveys()
  }

  async function handleSignOut() {
    setSigningOut(true)
    await signOut()
    navigate('/login', { replace: true })
  }

  async function handleDuplicate(survey: SurveySummary) {
    setBusy(true)
    try {
      const newId = await duplicateSurvey(survey.id)
      navigate(`/surveys/${newId}/edit`)
    } catch (err) {
      setActionError(toUserMessage(err))
      setBusy(false)
    }
  }

  async function activateAndPresent(survey: SurveySummary) {
    setBusy(true)
    try {
      await activateSurvey(survey.id)
      navigate(`/surveys/${survey.id}/present`)
    } catch (err) {
      setPending(null)
      setActionError(toUserMessage(err))
      setBusy(false)
    }
  }

  function handleAction(action: SurveyAction, survey: SurveySummary) {
    setActionError(null)
    if (
      action === 'archive' ||
      action === 'unarchive' ||
      action === 'delete' ||
      action === 'close'
    ) {
      setPending({ kind: action, survey })
    } else if (action === 'activate' || action === 'reopen') {
      // Activating closes the current Active survey (D3), so confirm when there is one.
      const currentlyActive = surveys.find((s) => s.status === 'active' && s.id !== survey.id)
      if (currentlyActive) {
        setPending({ kind: 'activate', survey, currentlyActive })
      } else {
        void activateAndPresent(survey)
      }
    } else if (action === 'present') {
      navigate(`/surveys/${survey.id}/present`)
    } else if (action === 'edit') {
      navigate(`/surveys/${survey.id}/edit`)
    } else if (action === 'duplicate') {
      void handleDuplicate(survey)
    }
  }

  async function runConfirmed(kind: ConfirmKind) {
    if (!pending) return
    if (kind === 'activate') {
      await activateAndPresent(pending.survey)
      return
    }
    const surveyId = pending.survey.id
    setBusy(true)
    try {
      if (kind === 'archive') await archiveSurvey(surveyId)
      if (kind === 'unarchive') await unarchiveSurvey(surveyId)
      if (kind === 'close') await closeSurvey(surveyId)
      if (kind === 'delete') await deleteSurvey(surveyId)
      setPending(null)
      await loadSurveys()
    } catch (err) {
      setPending(null)
      setActionError(toUserMessage(err))
    } finally {
      setBusy(false)
    }
  }

  function renderDialog(confirm: PendingConfirm) {
    const { kind, survey } = confirm
    let title: string
    let body: ReactNode
    let actions: DialogAction[]

    if (kind === 'activate') {
      title = `Activate "${survey.title}"?`
      body = (
        <p>
          &ldquo;{confirm.currentlyActive?.title}&rdquo; is active now. Activating this survey
          closes it, and students can no longer submit responses to it.
        </p>
      )
      actions = [{ label: 'Activate', variant: 'primary', onClick: () => runConfirmed('activate') }]
    } else if (kind === 'close') {
      title = `Close "${survey.title}"?`
      body = <p>Students will no longer be able to submit responses. You can reopen it later.</p>
      actions = [{ label: 'Close Survey', variant: 'danger', onClick: () => runConfirmed('close') }]
    } else if (kind === 'archive') {
      title = `Archive "${survey.title}"?`
      body = (
        <p>
          Archived surveys are hidden from the dashboard unless you filter for Archived. Results are
          kept.
        </p>
      )
      actions = [{ label: 'Archive', variant: 'primary', onClick: () => runConfirmed('archive') }]
    } else if (kind === 'unarchive') {
      title = `Unarchive "${survey.title}"?`
      body = <p>The survey returns to the dashboard as Closed.</p>
      actions = [
        { label: 'Unarchive', variant: 'primary', onClick: () => runConfirmed('unarchive') },
      ]
    } else if (survey.responseCount === 0) {
      title = `Delete "${survey.title}"?`
      body = <p>This will permanently delete the survey.</p>
      actions = [{ label: 'Delete', variant: 'danger', onClick: () => runConfirmed('delete') }]
    } else {
      const canArchive = survey.status === 'draft' || survey.status === 'closed'
      title = `Delete "${survey.title}"?`
      body = (
        <>
          <p>
            This survey has {formatResponses(survey.responseCount)}. Deleting it permanently removes
            all of them.
          </p>
          {canArchive && <p>Archive keeps the results but hides the survey.</p>}
        </>
      )
      actions = [
        ...(canArchive
          ? [
              {
                label: 'Archive Instead',
                variant: 'secondary' as const,
                onClick: () => runConfirmed('archive'),
              },
            ]
          : []),
        { label: 'Delete Permanently', variant: 'danger', onClick: () => runConfirmed('delete') },
      ]
    }

    return (
      <ConfirmDialog
        open
        title={title}
        actions={actions}
        onCancel={() => setPending(null)}
        busy={busy}
      >
        {body}
      </ConfirmDialog>
    )
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div>
            <p className="text-sm font-semibold text-muted">Classroom Survey</p>
            <h1 className="text-2xl font-bold">Dashboard</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {user?.email && <span className="text-sm text-muted">{user.email}</span>}
            <button
              type="button"
              className={buttonStyles.primary}
              onClick={() => navigate('/surveys/new')}
            >
              New Survey
            </button>
            <button
              type="button"
              className={buttonStyles.secondary}
              onClick={handleSignOut}
              disabled={signingOut}
            >
              {signingOut ? 'Logging out...' : 'Log out'}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <section aria-label="Filters" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="search" className={labelStyles}>
              Search
            </label>
            <input
              id="search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Survey title"
              className={inputStyles}
            />
          </div>
          <div>
            <label htmlFor="status-filter" className={labelStyles}>
              Status
            </label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              className={inputStyles}
            >
              {STATUS_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="from-date" className={labelStyles}>
              Created from
            </label>
            <input
              id="from-date"
              type="date"
              value={fromDate}
              max={toDate || undefined}
              onChange={(event) => setFromDate(event.target.value)}
              className={inputStyles}
            />
          </div>
          <div>
            <label htmlFor="to-date" className={labelStyles}>
              Created to
            </label>
            <input
              id="to-date"
              type="date"
              value={toDate}
              min={fromDate || undefined}
              onChange={(event) => setToDate(event.target.value)}
              className={inputStyles}
            />
          </div>
        </section>

        {filtersActive && (
          <button type="button" className={`${buttonStyles.secondary} mt-4`} onClick={clearFilters}>
            Clear filters
          </button>
        )}

        {actionError && (
          <div
            role="alert"
            className="mt-6 flex items-start justify-between gap-4 rounded-lg border border-red-300 bg-red-50 p-4 text-red-800"
          >
            <p>{actionError}</p>
            <button
              type="button"
              className="text-sm font-semibold underline"
              onClick={() => setActionError(null)}
            >
              Dismiss
            </button>
          </div>
        )}

        <section aria-label="Surveys" className="mt-8">
          {loadState.kind === 'loading' && (
            <p role="status" className="text-muted">
              Loading surveys...
            </p>
          )}

          {loadState.kind === 'error' && (
            <div
              role="alert"
              className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-800"
            >
              <p>{loadState.message}</p>
              <button
                type="button"
                className={`${buttonStyles.secondary} mt-3`}
                onClick={retryLoad}
              >
                Try again
              </button>
            </div>
          )}

          {loadState.kind === 'ready' && surveys.length === 0 && (
            <div className="rounded-xl border border-dashed border-line bg-white p-10 text-center">
              <p className="text-lg">You have not created any surveys yet.</p>
              <button
                type="button"
                className={`${buttonStyles.primary} mt-4`}
                onClick={() => navigate('/surveys/new')}
              >
                Create Your First Survey
              </button>
            </div>
          )}

          {loadState.kind === 'ready' && surveys.length > 0 && filteredSurveys.length === 0 && (
            <div className="rounded-xl border border-dashed border-line bg-white p-10 text-center">
              <p className="text-lg">No surveys match your search.</p>
              <button
                type="button"
                className={`${buttonStyles.secondary} mt-4`}
                onClick={clearFilters}
              >
                Clear filters
              </button>
            </div>
          )}

          {filteredSurveys.length > 0 && (
            <ul className="space-y-4">
              {filteredSurveys.map((survey) => (
                <li key={survey.id} className="rounded-xl border border-line bg-white p-5">
                  <h2 className="text-lg font-bold">{survey.title}</h2>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
                    <StatusBadge status={survey.status} />
                    <span>Created {dateFormatter.format(new Date(survey.created_at))}</span>
                    <span>{formatResponses(survey.responseCount)}</span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {getAllowedActions(survey.status).map((action) => {
                      const implemented = IMPLEMENTED_ACTIONS.has(action)
                      return (
                        <button
                          key={action}
                          type="button"
                          className={`${buttonStyles.secondary} ${action === 'delete' ? 'text-red-700' : ''}`}
                          onClick={() => handleAction(action, survey)}
                          disabled={!implemented || busy}
                          title={implemented ? undefined : 'Not built yet'}
                        >
                          {ACTION_LABELS[action]}
                        </button>
                      )
                    })}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      {pending && renderDialog(pending)}
    </div>
  )
}
