// Editor state, validation (D5), and conversion to the save_survey payload.
import type { QuestionType, SaveQuestionInput, SurveyForEdit } from './surveys'

export const MIN_CHOICES = 2
export const MAX_CHOICES = 10
export const TRUE_FALSE_TEXTS = ['True', 'False'] as const

export type EditorChoice = { key: string; text: string }

export type EditorQuestion = {
  key: string
  text: string
  type: QuestionType
  choices: EditorChoice[]
}

export type EditorSurvey = {
  title: string
  description: string
  questions: EditorQuestion[]
}

export type QuestionErrors = {
  text?: string
  choices?: string
  choiceText: Record<string, string>
}

export type ValidationErrors = {
  title?: string
  questions: Record<string, QuestionErrors>
}

// ------------------------------------------------------------------
// Element ids, shared by the editor and error focusing
// ------------------------------------------------------------------

export const fieldIds = {
  title: 'survey-title',
  questionText: (questionKey: string) => `question-${questionKey}-text`,
  questionChoices: (questionKey: string) => `question-${questionKey}-choices`,
  choice: (choiceKey: string) => `choice-${choiceKey}`,
}

// ------------------------------------------------------------------
// Factories
// ------------------------------------------------------------------

function newKey(): string {
  return crypto.randomUUID()
}

export function createChoice(text = ''): EditorChoice {
  return { key: newKey(), text }
}

export function trueFalseChoices(): EditorChoice[] {
  return TRUE_FALSE_TEXTS.map((text) => createChoice(text))
}

export function createQuestion(): EditorQuestion {
  return {
    key: newKey(),
    text: '',
    type: 'multiple_choice',
    choices: [createChoice(), createChoice()],
  }
}

export function emptySurvey(): EditorSurvey {
  return { title: '', description: '', questions: [] }
}

export function fromSurveyForEdit(survey: SurveyForEdit): EditorSurvey {
  return {
    title: survey.title,
    description: survey.description ?? '',
    questions: survey.questions.map((question) => ({
      key: question.id,
      text: question.question_text,
      type: question.question_type,
      choices: question.choices.map((choice) => ({ key: choice.id, text: choice.choice_text })),
    })),
  }
}

// ------------------------------------------------------------------
// Dirty tracking and save payload
// ------------------------------------------------------------------

/** Content-only snapshot (no keys), used to detect unsaved changes. */
export function snapshot(survey: EditorSurvey): string {
  return JSON.stringify({
    title: survey.title,
    description: survey.description,
    questions: survey.questions.map((question) => ({
      text: question.text,
      type: question.type,
      choices: question.choices.map((choice) => choice.text),
    })),
  })
}

export function toSaveQuestions(survey: EditorSurvey): SaveQuestionInput[] {
  return survey.questions.map((question) => ({
    question_text: question.text.trim(),
    question_type: question.type,
    choices: question.choices.map((choice) => ({ choice_text: choice.text.trim() })),
  }))
}

// ------------------------------------------------------------------
// Validation (D5). Questions are skipped when they're locked (D4).
// ------------------------------------------------------------------

export function validateSurvey(
  survey: EditorSurvey,
  options: { questionsLocked: boolean },
): ValidationErrors {
  const errors: ValidationErrors = { questions: {} }

  if (survey.title.trim() === '') {
    errors.title = 'Enter a survey title.'
  }

  if (options.questionsLocked) return errors

  for (const question of survey.questions) {
    const questionErrors: QuestionErrors = { choiceText: {} }

    if (question.text.trim() === '') {
      questionErrors.text = 'Enter the question text.'
    }

    if (question.type === 'multiple_choice') {
      if (question.choices.length < MIN_CHOICES) {
        questionErrors.choices = `Add at least ${MIN_CHOICES} choices.`
      } else if (question.choices.length > MAX_CHOICES) {
        questionErrors.choices = `Use at most ${MAX_CHOICES} choices.`
      }

      const seen = new Set<string>()
      for (const choice of question.choices) {
        const normalized = choice.text.trim().toLowerCase()
        if (normalized === '') {
          questionErrors.choiceText[choice.key] = 'Enter the choice text.'
        } else if (seen.has(normalized)) {
          questionErrors.choiceText[choice.key] = 'This choice is a duplicate.'
        }
        seen.add(normalized)
      }
    }

    if (
      questionErrors.text ||
      questionErrors.choices ||
      Object.keys(questionErrors.choiceText).length > 0
    ) {
      errors.questions[question.key] = questionErrors
    }
  }

  return errors
}

export function hasErrors(errors: ValidationErrors): boolean {
  return Boolean(errors.title) || Object.keys(errors.questions).length > 0
}

/** Id of the first field with an error, in page order. */
export function firstErrorFieldId(survey: EditorSurvey, errors: ValidationErrors): string | null {
  if (errors.title) return fieldIds.title

  for (const question of survey.questions) {
    const questionErrors = errors.questions[question.key]
    if (!questionErrors) continue
    if (questionErrors.text) return fieldIds.questionText(question.key)
    const badChoice = question.choices.find((choice) => questionErrors.choiceText[choice.key])
    if (badChoice) return fieldIds.choice(badChoice.key)
    if (questionErrors.choices) return fieldIds.questionChoices(question.key)
  }

  return null
}
