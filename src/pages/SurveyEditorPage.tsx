import { useEffect, useState } from 'react'
import { Link, useBlocker, useLocation, useNavigate, useParams } from 'react-router'
import ConfirmDialog from '../components/ConfirmDialog'
import QuestionEditor from '../components/QuestionEditor'
import StatusBadge from '../components/StatusBadge'
import { buttonStyles, inputStyles, labelStyles } from '../components/styles'
import { toUserMessage } from '../lib/errors'
import {
  createChoice,
  createQuestion,
  emptySurvey,
  firstErrorFieldId,
  fieldIds,
  fromSurveyForEdit,
  hasErrors,
  snapshot,
  toSaveQuestions,
  trueFalseChoices,
  validateSurvey,
  type EditorQuestion,
  type EditorSurvey,
  type ValidationErrors,
} from '../lib/surveyEditor'
import {
  QUESTION_TYPE_LABELS,
  activateSurvey,
  duplicateSurvey,
  getActiveSurvey,
  getSurveyForEdit,
  saveSurvey,
  updateSurveyDetails,
  type QuestionType,
  type SurveyStatus,
} from '../lib/surveys'

/** Remounts the editor when the URL switches surveys (e.g. after the first save). */
export default function SurveyEditorPage() {
  const { id } = useParams()
  return <SurveyEditor key={id ?? 'new'} surveyId={id ?? null} />
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'blocked'; title: string; status: SurveyStatus }
  | { kind: 'ready' }

type SaveState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved' }
  | { kind: 'invalid' }
  | { kind: 'error'; message: string }

type PendingConfirm =
  | { kind: 'deleteQuestion'; questionKey: string; number: number }
  | { kind: 'toTrueFalse'; questionKey: string; number: number }
  | { kind: 'activate'; surveyId: string; activeTitle: string }

const EMPTY_ERRORS: ValidationErrors = { questions: {} }

function moveItem<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction
  if (target < 0 || target >= items.length) return items
  const next = [...items]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

function SurveyEditor({ surveyId }: { surveyId: string | null }) {
  const navigate = useNavigate()
  const location = useLocation()
  const arrivedAfterSave = (location.state as { saved?: boolean } | null)?.saved === true

  const [loadState, setLoadState] = useState<LoadState>(() =>
    surveyId ? { kind: 'loading' } : { kind: 'ready' },
  )
  const [survey, setSurvey] = useState<EditorSurvey>(emptySurvey)
  const [savedSnapshot, setSavedSnapshot] = useState(() => snapshot(emptySurvey()))
  const [status, setStatus] = useState<SurveyStatus>('draft')
  const [responseCount, setResponseCount] = useState(0)
  const [saveState, setSaveState] = useState<SaveState>(() =>
    arrivedAfterSave ? { kind: 'saved' } : { kind: 'idle' },
  )
  const [attemptedSave, setAttemptedSave] = useState(false)
  const [pending, setPending] = useState<PendingConfirm | null>(null)
  const [autoFocusKey, setAutoFocusKey] = useState<string | null>(null)
  const [duplicating, setDuplicating] = useState(false)
  const [activating, setActivating] = useState(false)
  // Id of a new survey once its first save succeeds, so a retry updates it instead of creating another.
  const [createdId, setCreatedId] = useState<string | null>(null)
  const effectiveId = surveyId ?? createdId

  const questionsLocked = responseCount > 0
  const saving = saveState.kind === 'saving' || activating
  const isDirty = loadState.kind === 'ready' && snapshot(survey) !== savedSnapshot
  const errors = attemptedSave ? validateSurvey(survey, { questionsLocked }) : EMPTY_ERRORS

  // ---- Load an existing survey ----
  useEffect(() => {
    if (!surveyId) return
    let cancelled = false
    getSurveyForEdit(surveyId).then(
      (loaded) => {
        if (cancelled) return
        if (loaded.status === 'active' || loaded.status === 'archived') {
          setLoadState({ kind: 'blocked', title: loaded.title, status: loaded.status })
          return
        }
        const editorSurvey = fromSurveyForEdit(loaded)
        setSurvey(editorSurvey)
        setSavedSnapshot(snapshot(editorSurvey))
        setStatus(loaded.status)
        setResponseCount(loaded.responseCount)
        setLoadState({ kind: 'ready' })
      },
      (err: unknown) => {
        if (!cancelled) setLoadState({ kind: 'error', message: toUserMessage(err) })
      },
    )
    return () => {
      cancelled = true
    }
  }, [surveyId])

  // ---- Unsaved-changes protection ----
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && currentLocation.pathname !== nextLocation.pathname,
  )

  // A navigation blocked just before a save finished can continue once nothing is unsaved.
  useEffect(() => {
    if (blocker.state === 'blocked' && !isDirty) blocker.proceed()
  }, [blocker, isDirty])

  // Closing or reloading the tab
  useEffect(() => {
    if (!isDirty) return
    const handleBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])

  // ---- Editing helpers ----
  function edit(change: (current: EditorSurvey) => EditorSurvey) {
    setSurvey(change)
    if (saveState.kind === 'saved' || saveState.kind === 'error') setSaveState({ kind: 'idle' })
  }

  function updateQuestion(
    questionKey: string,
    change: (question: EditorQuestion) => EditorQuestion,
  ) {
    edit((current) => ({
      ...current,
      questions: current.questions.map((question) =>
        question.key === questionKey ? change(question) : question,
      ),
    }))
  }

  function addQuestion() {
    const question = createQuestion()
    setAutoFocusKey(question.key)
    edit((current) => ({ ...current, questions: [...current.questions, question] }))
  }

  function moveQuestion(questionKey: string, direction: -1 | 1) {
    edit((current) => {
      const index = current.questions.findIndex((question) => question.key === questionKey)
      return { ...current, questions: moveItem(current.questions, index, direction) }
    })
  }

  function deleteQuestion(questionKey: string) {
    edit((current) => ({
      ...current,
      questions: current.questions.filter((question) => question.key !== questionKey),
    }))
  }

  function setQuestionType(question: EditorQuestion, number: number, type: QuestionType) {
    if (type === question.type) return
    if (type === 'true_false') {
      const hasChoiceText = question.choices.some((choice) => choice.text.trim() !== '')
      if (hasChoiceText) {
        setPending({ kind: 'toTrueFalse', questionKey: question.key, number })
        return
      }
      updateQuestion(question.key, (q) => ({ ...q, type, choices: trueFalseChoices() }))
      return
    }
    updateQuestion(question.key, (q) => ({ ...q, type, choices: [createChoice(), createChoice()] }))
  }

  function addChoice(questionKey: string) {
    const choice = createChoice()
    setAutoFocusKey(choice.key)
    updateQuestion(questionKey, (question) => ({
      ...question,
      choices: [...question.choices, choice],
    }))
  }

  function confirmPending() {
    if (!pending) return
    if (pending.kind === 'activate') {
      void activateAndPresent(pending.surveyId)
      return
    }
    if (pending.kind === 'deleteQuestion') deleteQuestion(pending.questionKey)
    if (pending.kind === 'toTrueFalse') {
      updateQuestion(pending.questionKey, (question) => ({
        ...question,
        type: 'true_false',
        choices: trueFalseChoices(),
      }))
    }
    setPending(null)
  }

  // ---- Saving ----

  /** Validates and saves. Returns the survey id, or null if it couldn't be saved. */
  async function performSave(): Promise<string | null> {
    setAttemptedSave(true)
    const validation = validateSurvey(survey, { questionsLocked })
    if (hasErrors(validation)) {
      setSaveState({ kind: 'invalid' })
      const fieldId = firstErrorFieldId(survey, validation)
      if (fieldId) document.getElementById(fieldId)?.focus()
      return null
    }

    if (effectiveId && !isDirty) return effectiveId

    setSaveState({ kind: 'saving' })
    try {
      let savedId = effectiveId
      if (questionsLocked && effectiveId) {
        await updateSurveyDetails(effectiveId, survey.title, survey.description)
      } else {
        savedId = await saveSurvey({
          surveyId: effectiveId,
          title: survey.title.trim(),
          description: survey.description,
          questions: toSaveQuestions(survey),
        })
        if (!effectiveId) setCreatedId(savedId)
      }
      setSavedSnapshot(snapshot(survey))
      setSaveState({ kind: 'saved' })
      return savedId
    } catch (err) {
      setSaveState({ kind: 'error', message: toUserMessage(err) })
      return null
    }
  }

  async function handleSave() {
    const savedId = await performSave()
    if (savedId && !surveyId) {
      navigate(`/surveys/${savedId}/edit`, { replace: true, state: { saved: true } })
    }
  }

  // ---- Activation (save first, then activate, then present) ----

  async function activateAndPresent(id: string) {
    setActivating(true)
    try {
      await activateSurvey(id)
      navigate(`/surveys/${id}/present`)
    } catch (err) {
      setPending(null)
      setSaveState({ kind: 'error', message: toUserMessage(err) })
      setActivating(false)
    }
  }

  async function handleActivate() {
    const savedId = await performSave()
    if (!savedId) return
    try {
      const active = await getActiveSurvey()
      if (active && active.id !== savedId) {
        // Activating closes the current Active survey (D3), so confirm first.
        setPending({ kind: 'activate', surveyId: savedId, activeTitle: active.title })
        return
      }
    } catch (err) {
      setSaveState({ kind: 'error', message: toUserMessage(err) })
      return
    }
    await activateAndPresent(savedId)
  }

  async function handleDuplicate() {
    if (!surveyId) return
    setDuplicating(true)
    try {
      const newId = await duplicateSurvey(surveyId)
      navigate(`/surveys/${newId}/edit`)
    } catch (err) {
      setSaveState({ kind: 'error', message: toUserMessage(err) })
      setDuplicating(false)
    }
  }

  // ---- Rendering ----
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
      <main className="mx-auto max-w-3xl px-6 py-8">
        <p role="status" className="text-muted">
          Loading survey...
        </p>
      </main>
    )
  }

  if (loadState.kind === 'error' || loadState.kind === 'blocked') {
    const message =
      loadState.kind === 'error'
        ? loadState.message
        : loadState.status === 'active'
          ? `"${loadState.title}" is active. Close it before editing.`
          : `"${loadState.title}" is archived. Unarchive or duplicate it to make changes.`
    return (
      <main className="mx-auto max-w-3xl px-6 py-8">
        {backLink}
        <div role="alert" className="mt-6 rounded-lg border border-line bg-white p-6">
          <p className="text-lg">{message}</p>
        </div>
      </main>
    )
  }

  const statusMessage = activating
    ? 'Activating...'
    : saveState.kind === 'saving'
      ? 'Saving...'
      : saveState.kind === 'invalid' && hasErrors(errors)
        ? 'Fix the highlighted fields before saving.'
        : saveState.kind === 'error'
          ? saveState.message
          : isDirty
            ? 'Unsaved changes'
            : saveState.kind === 'saved'
              ? 'Saved'
              : ''

  const statusIsError =
    (saveState.kind === 'invalid' && hasErrors(errors)) || saveState.kind === 'error'

  const titleErrorId = `${fieldIds.title}-error`

  return (
    <div className="min-h-screen pb-32">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div>
            {backLink}
            <h1 className="mt-1 text-2xl font-bold">{surveyId ? 'Edit Survey' : 'New Survey'}</h1>
          </div>
          {surveyId && <StatusBadge status={status} />}
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-6 py-8">
        {questionsLocked && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-5">
            <p>
              This survey has {responseCount} response{responseCount === 1 ? '' : 's'}, so its
              questions can&rsquo;t be changed. You can still edit the title and description.
            </p>
            <button
              type="button"
              className={`${buttonStyles.secondary} mt-3`}
              onClick={handleDuplicate}
              disabled={duplicating || saving}
            >
              {duplicating ? 'Duplicating...' : 'Duplicate to edit'}
            </button>
          </div>
        )}

        <section className="space-y-4 rounded-xl border border-line bg-white p-5 sm:p-6">
          <div>
            <label htmlFor={fieldIds.title} className={labelStyles}>
              Survey Title
            </label>
            <input
              id={fieldIds.title}
              type="text"
              value={survey.title}
              onChange={(event) => {
                const title = event.target.value
                edit((current) => ({ ...current, title }))
              }}
              disabled={saving}
              aria-invalid={errors.title ? true : undefined}
              aria-describedby={errors.title ? titleErrorId : undefined}
              className={inputStyles}
            />
            {errors.title && (
              <p id={titleErrorId} className="mt-1 text-sm font-semibold text-red-700">
                {errors.title}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="survey-description" className={labelStyles}>
              Description (optional)
            </label>
            <textarea
              id="survey-description"
              rows={2}
              value={survey.description}
              onChange={(event) => {
                const description = event.target.value
                edit((current) => ({ ...current, description }))
              }}
              disabled={saving}
              className={`${inputStyles} py-2`}
            />
          </div>
        </section>

        {questionsLocked ? (
          <section aria-label="Questions" className="space-y-4">
            {survey.questions.map((question, index) => (
              <div key={question.key} className="rounded-xl border border-line bg-white p-5">
                <h2 className="text-lg font-bold">Question {index + 1}</h2>
                <p className="mt-2">{question.text}</p>
                <p className="mt-1 text-sm text-muted">{QUESTION_TYPE_LABELS[question.type]}</p>
                <ul className="mt-3 list-inside list-disc text-muted">
                  {question.choices.map((choice) => (
                    <li key={choice.key}>{choice.text}</li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        ) : (
          <>
            {survey.questions.length === 0 && (
              <p className="rounded-xl border border-dashed border-line bg-white p-8 text-center text-muted">
                No questions yet. Add one to get started.
              </p>
            )}
            {survey.questions.map((question, index) => (
              <QuestionEditor
                key={question.key}
                question={question}
                index={index}
                total={survey.questions.length}
                errors={errors.questions[question.key]}
                disabled={saving}
                autoFocusKey={autoFocusKey}
                onTextChange={(text) => updateQuestion(question.key, (q) => ({ ...q, text }))}
                onTypeChange={(type) => setQuestionType(question, index + 1, type)}
                onMove={(direction) => moveQuestion(question.key, direction)}
                onDelete={() =>
                  setPending({
                    kind: 'deleteQuestion',
                    questionKey: question.key,
                    number: index + 1,
                  })
                }
                onChoiceChange={(choiceKey, text) =>
                  updateQuestion(question.key, (q) => ({
                    ...q,
                    choices: q.choices.map((choice) =>
                      choice.key === choiceKey ? { ...choice, text } : choice,
                    ),
                  }))
                }
                onAddChoice={() => addChoice(question.key)}
                onDeleteChoice={(choiceKey) =>
                  updateQuestion(question.key, (q) => ({
                    ...q,
                    choices: q.choices.filter((choice) => choice.key !== choiceKey),
                  }))
                }
                onMoveChoice={(choiceKey, direction) =>
                  updateQuestion(question.key, (q) => {
                    const choiceIndex = q.choices.findIndex((choice) => choice.key === choiceKey)
                    return { ...q, choices: moveItem(q.choices, choiceIndex, direction) }
                  })
                }
              />
            ))}
            <button
              type="button"
              className={`${buttonStyles.secondary} w-full`}
              onClick={addQuestion}
              disabled={saving}
            >
              + Add Question
            </button>
          </>
        )}
      </main>

      <footer className="fixed inset-x-0 bottom-0 border-t border-line bg-white">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <p
            aria-live="polite"
            className={`text-sm font-semibold ${statusIsError ? 'text-red-700' : 'text-muted'}`}
          >
            {statusMessage}
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              className={buttonStyles.secondary}
              onClick={handleSave}
              disabled={saving || duplicating}
            >
              {saveState.kind === 'saving'
                ? 'Saving...'
                : questionsLocked
                  ? 'Save Details'
                  : 'Save Draft'}
            </button>
            <button
              type="button"
              className={buttonStyles.primary}
              onClick={handleActivate}
              disabled={saving || duplicating || survey.questions.length === 0}
              title={
                survey.questions.length === 0
                  ? 'Add at least one question before activating.'
                  : undefined
              }
            >
              {activating ? 'Activating...' : 'Activate'}
            </button>
          </div>
        </div>
      </footer>

      {pending && (
        <ConfirmDialog
          open
          title={
            pending.kind === 'deleteQuestion'
              ? `Delete question ${pending.number}?`
              : pending.kind === 'toTrueFalse'
                ? `Change question ${pending.number} to True / False?`
                : `Activate "${survey.title.trim()}"?`
          }
          actions={[
            pending.kind === 'deleteQuestion'
              ? { label: 'Delete Question', variant: 'danger', onClick: confirmPending }
              : pending.kind === 'toTrueFalse'
                ? { label: 'Change Type', variant: 'primary', onClick: confirmPending }
                : { label: 'Activate', variant: 'primary', onClick: confirmPending },
          ]}
          onCancel={() => setPending(null)}
          busy={activating}
        >
          <p>
            {pending.kind === 'deleteQuestion'
              ? 'The question and its choices will be removed from this survey.'
              : pending.kind === 'toTrueFalse'
                ? 'The current choices will be replaced with True and False.'
                : `"${pending.activeTitle}" is active now. Activating this survey closes it, and students can no longer submit responses to it.`}
          </p>
        </ConfirmDialog>
      )}

      {blocker.state === 'blocked' && isDirty && (
        <ConfirmDialog
          open
          title="Leave without saving?"
          actions={[{ label: 'Leave', variant: 'danger', onClick: () => blocker.proceed?.() }]}
          onCancel={() => blocker.reset?.()}
        >
          <p>Your unsaved changes to this survey will be lost.</p>
        </ConfirmDialog>
      )}
    </div>
  )
}
