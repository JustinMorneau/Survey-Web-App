// Student-side data access (anon role). See API.md §10–§11.
import type { QuestionType } from './surveys'
import { supabase } from './supabase'

export type PublicSurvey = {
  id: string
  title: string
  description: string | null
  questions: {
    id: string
    question_text: string
    question_type: QuestionType
    choices: { id: string; choice_text: string }[]
  }[]
}

export type AnswerInput = { question_id: string; choice_id: string }

/**
 * Loads the Active survey with this slug. RLS only lets students read the
 * Active survey, so a missing, closed, or archived survey all return null.
 */
export async function getPublicSurvey(slug: string): Promise<PublicSurvey | null> {
  const { data, error } = await supabase
    .from('surveys')
    .select(
      'id, title, description, questions(id, question_text, question_type, position, choices(id, choice_text, position))',
    )
    .eq('public_slug', slug)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return {
    id: data.id,
    title: data.title,
    description: data.description,
    questions: [...data.questions]
      .sort((a, b) => a.position - b.position)
      .map((question) => ({
        id: question.id,
        question_text: question.question_text,
        question_type: question.question_type as QuestionType,
        choices: [...question.choices]
          .sort((a, b) => a.position - b.position)
          .map((choice) => ({ id: choice.id, choice_text: choice.choice_text })),
      })),
  }
}

export async function submitSurveyResponse(
  surveyId: string,
  anonymousToken: string,
  answers: AnswerInput[],
): Promise<void> {
  const { error } = await supabase.rpc('submit_survey_response', {
    p_survey_id: surveyId,
    p_anonymous_token: anonymousToken,
    p_answers: answers,
  })
  if (error) throw error
}

// ------------------------------------------------------------------
// Browser token and "already submitted" flag (D8)
// ------------------------------------------------------------------

const TOKEN_KEY = 'cs_anon_token'
const submittedKey = (surveyId: string) => `cs_submitted_${surveyId}`

// Used only if localStorage is unavailable (some privacy modes block it).
let memoryToken: string | null = null

export function getAnonymousToken(): string {
  try {
    let token = localStorage.getItem(TOKEN_KEY)
    if (!token) {
      token = crypto.randomUUID()
      localStorage.setItem(TOKEN_KEY, token)
    }
    return token
  } catch {
    memoryToken ??= crypto.randomUUID()
    return memoryToken
  }
}

export function hasSubmitted(surveyId: string): boolean {
  try {
    return localStorage.getItem(submittedKey(surveyId)) !== null
  } catch {
    return false
  }
}

export function markSubmitted(surveyId: string): void {
  try {
    localStorage.setItem(submittedKey(surveyId), new Date().toISOString())
  } catch {
    // The database still rejects a second submission with the same token.
  }
}

/** The database error code (the exception message), if there is one. */
export function errorCode(err: unknown): string {
  if (typeof err === 'object' && err !== null && 'message' in err) {
    const message = (err as { message: unknown }).message
    return typeof message === 'string' ? message.trim() : ''
  }
  return ''
}
