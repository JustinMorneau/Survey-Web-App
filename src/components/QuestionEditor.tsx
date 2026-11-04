import { buttonStyles, inputStyles, labelStyles } from './styles'
import {
  MAX_CHOICES,
  MIN_CHOICES,
  fieldIds,
  type EditorQuestion,
  type QuestionErrors,
} from '../lib/surveyEditor'
import { QUESTION_TYPE_LABELS, type QuestionType } from '../lib/surveys'

const iconButton =
  'inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-line bg-white text-lg font-semibold hover:bg-paper focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-board disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white'

type QuestionEditorProps = {
  question: EditorQuestion
  index: number
  total: number
  errors?: QuestionErrors
  disabled: boolean
  /** Key of a question or choice that was just added and should receive focus. */
  autoFocusKey: string | null
  onTextChange: (text: string) => void
  onTypeChange: (type: QuestionType) => void
  onMove: (direction: -1 | 1) => void
  onDelete: () => void
  onChoiceChange: (choiceKey: string, text: string) => void
  onAddChoice: () => void
  onDeleteChoice: (choiceKey: string) => void
  onMoveChoice: (choiceKey: string, direction: -1 | 1) => void
}

export default function QuestionEditor({
  question,
  index,
  total,
  errors,
  disabled,
  autoFocusKey,
  onTextChange,
  onTypeChange,
  onMove,
  onDelete,
  onChoiceChange,
  onAddChoice,
  onDeleteChoice,
  onMoveChoice,
}: QuestionEditorProps) {
  const number = index + 1
  const headingId = `question-${question.key}-heading`
  const textId = fieldIds.questionText(question.key)
  const textErrorId = `${textId}-error`
  const typeId = `question-${question.key}-type`
  const choicesId = fieldIds.questionChoices(question.key)
  const choicesErrorId = `${choicesId}-error`
  const isTrueFalse = question.type === 'true_false'

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-xl border border-line bg-white p-5 sm:p-6"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id={headingId} className="text-lg font-bold">
          Question {number}
        </h2>
        <div className="flex gap-2">
          <button
            type="button"
            className={iconButton}
            onClick={() => onMove(-1)}
            disabled={disabled || index === 0}
            aria-label={`Move question ${number} up`}
          >
            ↑
          </button>
          <button
            type="button"
            className={iconButton}
            onClick={() => onMove(1)}
            disabled={disabled || index === total - 1}
            aria-label={`Move question ${number} down`}
          >
            ↓
          </button>
        </div>
      </div>

      <div className="mt-4">
        <label htmlFor={textId} className={labelStyles}>
          Question text
        </label>
        <textarea
          id={textId}
          rows={2}
          value={question.text}
          onChange={(event) => onTextChange(event.target.value)}
          disabled={disabled}
          autoFocus={autoFocusKey === question.key}
          aria-invalid={errors?.text ? true : undefined}
          aria-describedby={errors?.text ? textErrorId : undefined}
          className={`${inputStyles} py-2`}
        />
        {errors?.text && (
          <p id={textErrorId} className="mt-1 text-sm font-semibold text-red-700">
            {errors.text}
          </p>
        )}
      </div>

      <div className="mt-4 sm:max-w-xs">
        <label htmlFor={typeId} className={labelStyles}>
          Type
        </label>
        <select
          id={typeId}
          value={question.type}
          onChange={(event) => onTypeChange(event.target.value as QuestionType)}
          disabled={disabled}
          className={inputStyles}
        >
          {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((type) => (
            <option key={type} value={type}>
              {QUESTION_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </div>

      <fieldset
        id={choicesId}
        tabIndex={-1}
        className="mt-5"
        aria-describedby={errors?.choices ? choicesErrorId : undefined}
      >
        <legend className={labelStyles}>Choices</legend>

        {isTrueFalse ? (
          <>
            <ul className="mt-2 space-y-2">
              {question.choices.map((choice) => (
                <li
                  key={choice.key}
                  className="flex min-h-11 items-center rounded-lg border border-line bg-paper px-3"
                >
                  {choice.text}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-sm text-muted">True / False choices are fixed.</p>
          </>
        ) : (
          <>
            <ol className="mt-2 space-y-2">
              {question.choices.map((choice, choiceIndex) => {
                const choiceNumber = choiceIndex + 1
                const inputId = fieldIds.choice(choice.key)
                const errorId = `${inputId}-error`
                const choiceError = errors?.choiceText[choice.key]
                return (
                  <li key={choice.key}>
                    <div className="flex gap-2">
                      <label htmlFor={inputId} className="sr-only">
                        Choice {choiceNumber}
                      </label>
                      <input
                        id={inputId}
                        type="text"
                        value={choice.text}
                        onChange={(event) => onChoiceChange(choice.key, event.target.value)}
                        disabled={disabled}
                        autoFocus={autoFocusKey === choice.key}
                        placeholder={`Choice ${choiceNumber}`}
                        aria-invalid={choiceError ? true : undefined}
                        aria-describedby={choiceError ? errorId : undefined}
                        className={`${inputStyles} mt-0`}
                      />
                      <button
                        type="button"
                        className={iconButton}
                        onClick={() => onMoveChoice(choice.key, -1)}
                        disabled={disabled || choiceIndex === 0}
                        aria-label={`Move choice ${choiceNumber} up`}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className={iconButton}
                        onClick={() => onMoveChoice(choice.key, 1)}
                        disabled={disabled || choiceIndex === question.choices.length - 1}
                        aria-label={`Move choice ${choiceNumber} down`}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className={iconButton}
                        onClick={() => onDeleteChoice(choice.key)}
                        disabled={disabled || question.choices.length <= MIN_CHOICES}
                        aria-label={`Delete choice ${choiceNumber}`}
                      >
                        ✕
                      </button>
                    </div>
                    {choiceError && (
                      <p id={errorId} className="mt-1 text-sm font-semibold text-red-700">
                        {choiceError}
                      </p>
                    )}
                  </li>
                )
              })}
            </ol>

            {question.choices.length < MAX_CHOICES && (
              <button
                type="button"
                className={`${buttonStyles.secondary} mt-3`}
                onClick={onAddChoice}
                disabled={disabled}
              >
                + Add Choice
              </button>
            )}
          </>
        )}

        {errors?.choices && (
          <p id={choicesErrorId} className="mt-2 text-sm font-semibold text-red-700">
            {errors.choices}
          </p>
        )}
      </fieldset>

      <div className="mt-6 border-t border-line pt-4">
        <button
          type="button"
          className={`${buttonStyles.secondary} text-red-700`}
          onClick={onDelete}
          disabled={disabled}
        >
          Delete Question
        </button>
      </div>
    </section>
  )
}
