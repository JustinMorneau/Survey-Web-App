// Optional Vitest tests for the CSV builder (D15).
// To use: npm install -D vitest, add "test": "vitest run" to package.json scripts,
// copy this file to src/lib/csv.test.ts, then run: npm test
import { describe, expect, it } from 'vitest'
import { buildResultsCsv, csvFilename, escapeCsvCell } from './csv'
import type { SurveyForEdit } from './surveys'

describe('escapeCsvCell', () => {
  it('leaves plain text alone', () => {
    expect(escapeCsvCell('A base case')).toBe('A base case')
  })

  it('quotes commas, quotes, and line breaks', () => {
    expect(escapeCsvCell('a, b')).toBe('"a, b"')
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""')
    expect(escapeCsvCell('line 1\nline 2')).toBe('"line 1\nline 2"')
  })

  it('neutralizes formulas', () => {
    expect(escapeCsvCell('=SUM(A1)')).toBe("'=SUM(A1)")
    expect(escapeCsvCell('+1')).toBe("'+1")
    expect(escapeCsvCell('-1')).toBe("'-1")
    expect(escapeCsvCell('@cmd')).toBe("'@cmd")
  })

  it('keeps non-English text', () => {
    expect(escapeCsvCell('Ñandú — 学生')).toBe('Ñandú — 学生')
  })
})

describe('buildResultsCsv', () => {
  const survey: SurveyForEdit = {
    id: 's1',
    title: 'Test',
    description: null,
    status: 'closed',
    responseCount: 2,
    questions: [
      {
        id: 'q1',
        question_text: 'Pick one, please',
        question_type: 'multiple_choice',
        position: 1,
        choices: [
          { id: 'c1', choice_text: 'A', position: 1 },
          { id: 'c2', choice_text: 'B "quoted"', position: 2 },
        ],
      },
      {
        id: 'q2',
        question_text: 'True?',
        question_type: 'true_false',
        position: 2,
        choices: [
          { id: 'c3', choice_text: 'True', position: 1 },
          { id: 'c4', choice_text: 'False', position: 2 },
        ],
      },
    ],
  }

  it('writes a header and one row per response', () => {
    const csv = buildResultsCsv(survey, [
      {
        id: 'r1',
        submitted_at: '2026-08-17T12:10:00Z',
        answers: [
          { question_id: 'q1', choice_id: 'c2' },
          { question_id: 'q2', choice_id: 'c3' },
        ],
      },
      { id: 'r2', submitted_at: '2026-08-17T12:11:00Z', answers: [] },
    ])

    expect(csv.split('\r\n')).toEqual([
      'response_id,submitted_at,"Pick one, please",True?',
      'r1,2026-08-17T12:10:00.000Z,"B ""quoted""",True',
      'r2,2026-08-17T12:11:00.000Z,,',
      '',
    ])
  })
})

describe('csvFilename', () => {
  it('slugifies the title and adds the date', () => {
    expect(csvFilename('Recursion: Concept Check!', new Date(2026, 7, 17))).toBe(
      'recursion-concept-check_2026-08-17.csv',
    )
  })

  it('falls back when the title has no letters or digits', () => {
    expect(csvFilename('???', new Date(2026, 0, 5))).toBe('survey_2026-01-05.csv')
  })
})
