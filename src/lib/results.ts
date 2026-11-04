// Results and CSV export data (instructor only). See API.md §12–§13.
import { buildResultsCsv, csvFilename, downloadCsv, type CsvResponse } from './csv'
import { getSurveyForEdit, type QuestionType, type SurveyStatus } from './surveys'
import { supabase } from './supabase'

export type ChoiceResult = {
  choice_id: string
  choice_text: string
  count: number
  percentage: number
}

export type QuestionResult = {
  question_id: string
  question_text: string
  question_type: QuestionType
  /** Responses that answered this question (the percentage denominator, D10). */
  response_count: number
  choices: ChoiceResult[]
}

export type SurveyResults = {
  survey_id: string
  title: string
  status: SurveyStatus
  response_count: number
  questions: QuestionResult[]
}

export async function getSurveyResults(surveyId: string): Promise<SurveyResults> {
  const { data, error } = await supabase.rpc('get_survey_results', { p_survey_id: surveyId })
  // 22P02: the id in the URL is not a valid UUID
  if (error?.code === '22P02') throw new Error('SURVEY_NOT_FOUND')
  if (error) throw error
  // The function returns jsonb, which the generated types describe only as Json.
  return data as unknown as SurveyResults
}

const PAGE_SIZE = 1000

/** All responses with their answers, fetched in pages (Supabase returns at most 1000 rows per request). */
async function getAllResponses(surveyId: string): Promise<CsvResponse[]> {
  const all: CsvResponse[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('responses')
      .select('id, submitted_at, answers(question_id, choice_id)')
      .eq('survey_id', surveyId)
      .order('submitted_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)

    if (error) throw error
    all.push(...data)
    if (data.length < PAGE_SIZE) return all
  }
}

/** Builds the CSV in the browser and starts the download (D13). */
export async function exportSurveyCsv(surveyId: string): Promise<void> {
  const [survey, responses] = await Promise.all([
    getSurveyForEdit(surveyId),
    getAllResponses(surveyId),
  ])
  downloadCsv(csvFilename(survey.title), buildResultsCsv(survey, responses))
}
