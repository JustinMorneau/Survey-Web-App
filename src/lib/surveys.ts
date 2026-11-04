import type { Database } from './database.types'
import { supabase } from './supabase'

export type SurveyStatus = 'draft' | 'active' | 'closed' | 'archived'

export const STATUS_LABELS: Record<SurveyStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  closed: 'Closed',
  archived: 'Archived',
}

type SurveyRow = Database['public']['Tables']['surveys']['Row']

export type SurveySummary = Omit<SurveyRow, 'status'> & {
  status: SurveyStatus
  responseCount: number
}

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
