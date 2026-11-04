// CSV export (D13). Pure functions except downloadCsv.
import type { SurveyForEdit } from './surveys'

export type CsvResponse = {
  id: string
  submitted_at: string
  answers: { question_id: string; choice_id: string | null }[]
}

const FORMULA_START = /^[=+\-@]/
const NEEDS_QUOTES = /[",\r\n]/

/**
 * Escapes one cell. Cells starting with = + - @ get a leading ' so
 * spreadsheet apps don't run them as formulas; cells containing quotes,
 * commas, or line breaks are wrapped in quotes with inner quotes doubled.
 */
export function escapeCsvCell(value: string): string {
  let cell = FORMULA_START.test(value) ? `'${value}` : value
  if (NEEDS_QUOTES.test(cell)) {
    cell = `"${cell.replace(/"/g, '""')}"`
  }
  return cell
}

export function buildResultsCsv(survey: SurveyForEdit, responses: CsvResponse[]): string {
  const choiceText = new Map<string, string>()
  for (const question of survey.questions) {
    for (const choice of question.choices) choiceText.set(choice.id, choice.choice_text)
  }

  const header = [
    'response_id',
    'submitted_at',
    ...survey.questions.map((question) => question.question_text),
  ]

  const rows = responses.map((response) => {
    const answerByQuestion = new Map(
      response.answers.map((answer) => [answer.question_id, answer.choice_id]),
    )
    return [
      response.id,
      new Date(response.submitted_at).toISOString(),
      ...survey.questions.map((question) => {
        const choiceId = answerByQuestion.get(question.id)
        return choiceId ? (choiceText.get(choiceId) ?? '') : ''
      }),
    ]
  })

  return [header, ...rows].map((row) => row.map(escapeCsvCell).join(',')).join('\r\n') + '\r\n'
}

/** <title-slug>_<YYYY-MM-DD>.csv, using the local date. */
export function csvFilename(title: string, date = new Date()): string {
  const slug =
    title
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'survey'
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${slug}_${date.getFullYear()}-${month}-${day}.csv`
}

/** Downloads as UTF-8 with a byte-order mark so Excel reads non-English text correctly. */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
