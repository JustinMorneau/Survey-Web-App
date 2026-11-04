import type { Database } from './database.types'
import { supabase } from './supabase'

export type SurveyStatus = 'draft' | 'active' | 'closed' | 'archived'
export type QuestionType = 'multiple_choice' | 'true_false'

export const STATUS_LABELS: Record<SurveyStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  closed: 'Closed',
  archived: 'Archived',
}

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  multiple_choice: 'Multiple Choice',
  true_false: 'True / False',
}

type SurveyRow = Database['public']['Tables']['surveys']['Row']

export type SurveySummary = Omit<SurveyRow, 'status'> & {
  status: SurveyStatus
  responseCount: number
}

export type SurveyForEdit = {
  id: string
  title: string
  description: string | null
  status: SurveyStatus
  responseCount: number
  questions: {
    id: string
    question_text: string
    question_type: QuestionType
    position: number
    choices: { id: string; choice_text: string; position: number }[]
  }[]
}

/** Shape sent to save_survey. Positions come from array order. */
export type SaveQuestionInput = {
  question_text: string
  question_type: QuestionType
  choices: { choice_text: string }[]
}

// ------------------------------------------------------------------
// Reading
// ------------------------------------------------------------------

export async function listSurveys(): Promise<SurveySummary[]> {
  const { data, error } = await supabase
    .from('surveys')
    .select('*, responses(count)')
    .order('created_at', { ascending: false })

  if (error) throw error

  return data.map(({ responses, ...survey }) => ({
    ...survey,
    status: survey.status as SurveyStatus,
    responseCount: responses[0]?.count ?? 0,
  }))
}

export async function getSurveyForEdit(surveyId: string): Promise<SurveyForEdit> {
  const { data, error } = await supabase
    .from('surveys')
    .select(
      'id, title, description, status, responses(count), questions(id, question_text, question_type, position, choices(id, choice_text, position))',
    )
    .eq('id', surveyId)
    .maybeSingle()

  // 22P02: the id in the URL is not a valid UUID
  if (error?.code === '22P02') throw new Error('SURVEY_NOT_FOUND')
  if (error) throw error
  if (!data) throw new Error('SURVEY_NOT_FOUND')

  const questions = [...data.questions]
    .sort((a, b) => a.position - b.position)
    .map((question) => ({
      ...question,
      question_type: question.question_type as QuestionType,
      choices: [...question.choices].sort((a, b) => a.position - b.position),
    }))

  return {
    id: data.id,
    title: data.title,
    description: data.description,
    status: data.status as SurveyStatus,
    responseCount: data.responses[0]?.count ?? 0,
    questions,
  }
}

// ------------------------------------------------------------------
// Writing
// ------------------------------------------------------------------

/** Creates a Draft when surveyId is null; otherwise replaces the survey's content (D4). */
export async function saveSurvey(input: {
  surveyId: string | null
  title: string
  description: string
  questions: SaveQuestionInput[]
}): Promise<string> {
  const { data, error } = await supabase.rpc('save_survey', {
    p_title: input.title,
    p_description: input.description,
    p_questions: input.questions,
    ...(input.surveyId ? { p_survey_id: input.surveyId } : {}),
  })

  if (error) throw error
  return data
}

/** Used for locked surveys, whose questions can't change (D4). */
export async function updateSurveyDetails(
  surveyId: string,
  title: string,
  description: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('surveys')
    .update({ title: title.trim(), description: description.trim() || null })
    .eq('id', surveyId)
    .select('id')

  if (error) throw error
  if (data.length === 0) throw new Error('SURVEY_NOT_FOUND')
}

export async function duplicateSurvey(surveyId: string): Promise<string> {
  const { data, error } = await supabase.rpc('duplicate_survey', { p_survey_id: surveyId })
  if (error) throw error
  return data
}

async function setStatus(surveyId: string, status: SurveyStatus): Promise<void> {
  // Invalid transitions are rejected by the database trigger (D3).
  const { data, error } = await supabase
    .from('surveys')
    .update({ status })
    .eq('id', surveyId)
    .select('id')

  if (error) throw error
  if (data.length === 0) throw new Error('SURVEY_NOT_FOUND')
}

export function archiveSurvey(surveyId: string): Promise<void> {
  return setStatus(surveyId, 'archived')
}

/** Unarchived surveys return as Closed (D3). */
export function unarchiveSurvey(surveyId: string): Promise<void> {
  return setStatus(surveyId, 'closed')
}

export async function deleteSurvey(surveyId: string): Promise<void> {
  // RLS refuses to delete Active surveys, which shows up as 0 rows deleted.
  const { data, error } = await supabase.from('surveys').delete().eq('id', surveyId).select('id')

  if (error) throw error
  if (data.length === 0) throw new Error('INVALID_STATUS_TRANSITION')
}
