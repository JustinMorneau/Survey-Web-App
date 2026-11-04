// Load test (D18): sends N concurrent student submissions to the Active survey.
//
// Usage (from the project root):
//   node --env-file=.env.local scripts/load-test.mjs          # 200 submissions
//   node --env-file=.env.local scripts/load-test.mjs 50       # custom count
//
// It uses the public key only, exactly like a student's phone.
// Every token starts with "loadtest-"; remove the test responses afterwards
// with supabase/tests/cleanup_load_test.sql.

const url = process.env.VITE_SUPABASE_URL?.trim().replace(/\/+$/, '')
const key = process.env.VITE_SUPABASE_ANON_KEY?.trim()
const count = Number.parseInt(process.argv[2] ?? '200', 10)

if (!url || !key) {
  console.error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Run with --env-file=.env.local.',
  )
  process.exit(1)
}
if (!Number.isInteger(count) || count < 1 || count > 1000) {
  console.error('Count must be a whole number from 1 to 1000.')
  process.exit(1)
}

const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }

// 1. Load the Active survey the same way the student page does (RLS allows only Active).
const surveyResponse = await fetch(
  `${url}/rest/v1/surveys?status=eq.active&select=id,title,questions(id,choices(id))`,
  { headers },
)
if (!surveyResponse.ok) {
  console.error(`Could not load the Active survey: HTTP ${surveyResponse.status}`)
  console.error(await surveyResponse.text())
  process.exit(1)
}
const [survey] = await surveyResponse.json()
if (!survey) {
  console.error('No survey is Active. Activate a survey with at least one question, then retry.')
  process.exit(1)
}
console.log(`Survey: "${survey.title}" (${survey.questions.length} questions)`)
console.log(`Sending ${count} submissions at once...\n`)

// 2. Fire all submissions concurrently, each with its own token and random answers.
const runId = Date.now().toString(36)
const pick = (items) => items[Math.floor(Math.random() * items.length)]

async function submitOne(index) {
  const answers = survey.questions.map((question) => ({
    question_id: question.id,
    choice_id: pick(question.choices).id,
  }))
  const started = performance.now()
  try {
    const response = await fetch(`${url}/rest/v1/rpc/submit_survey_response`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        p_survey_id: survey.id,
        p_anonymous_token: `loadtest-${runId}-${index}`,
        p_answers: answers,
      }),
    })
    const body = await response.text()
    return { ok: response.ok, ms: performance.now() - started, error: response.ok ? null : body }
  } catch (error) {
    return { ok: false, ms: performance.now() - started, error: String(error) }
  }
}

const wallStart = performance.now()
const results = await Promise.all(Array.from({ length: count }, (_, i) => submitOne(i)))
const wallMs = performance.now() - wallStart

// 3. Report
const times = results.map((r) => r.ms).sort((a, b) => a - b)
const percentile = (p) => times[Math.min(times.length - 1, Math.floor((p / 100) * times.length))]
const failures = results.filter((r) => !r.ok)

console.log(`Succeeded: ${count - failures.length} / ${count}`)
console.log(`Total time: ${(wallMs / 1000).toFixed(2)} s`)
console.log(
  `Per request: median ${percentile(50).toFixed(0)} ms, 95th percentile ${percentile(95).toFixed(0)} ms, slowest ${times.at(-1).toFixed(0)} ms`,
)

if (failures.length > 0) {
  const grouped = new Map()
  for (const failure of failures) grouped.set(failure.error, (grouped.get(failure.error) ?? 0) + 1)
  console.log('\nFailures:')
  for (const [error, n] of grouped) console.log(`  ${n} x ${error}`)
  process.exitCode = 1
}
