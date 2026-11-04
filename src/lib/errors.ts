// Maps errors to the messages in UI.md §17 (D9).
// Database functions raise exceptions whose message is an error code.

export type Audience = 'instructor' | 'student'

const GENERIC_MESSAGE = 'Something went wrong. Please try again.'
const NETWORK_MESSAGE = "Can't reach the server. Check your connection and try again."
const SESSION_MESSAGE = 'Your session has expired. Please log in again.'

const CODE_MESSAGES: Record<string, string> = {
  SURVEY_ACTIVE: 'Close this survey before editing it.',
  SURVEY_LOCKED: "This survey has responses, so its questions can't be changed.",
  SURVEY_HAS_NO_QUESTIONS: 'Add at least one question before activating.',
  INVALID_STATUS_TRANSITION: "That action isn't available for this survey's current status.",
  VALIDATION_FAILED: 'Some questions need fixing before saving.',
  DUPLICATE_RESPONSE: 'You have already submitted a response to this survey.',
  INVALID_QUESTION: 'Something went wrong with your answers. Please reload and try again.',
  INVALID_CHOICE: 'Something went wrong with your answers. Please reload and try again.',
  MISSING_REQUIRED_ANSWER: 'Please answer every question.',
}

function readField(err: unknown, field: 'message' | 'code'): string {
  if (typeof err === 'object' && err !== null && field in err) {
    const value = (err as Record<string, unknown>)[field]
    return typeof value === 'string' ? value.trim() : ''
  }
  return ''
}

export function isNetworkError(err: unknown): boolean {
  const message = readField(err, 'message')
  return (
    err instanceof TypeError ||
    /failed to fetch|networkerror|load failed|network request failed/i.test(message)
  )
}

export function toUserMessage(err: unknown, audience: Audience = 'instructor'): string {
  if (isNetworkError(err)) return NETWORK_MESSAGE

  const message = readField(err, 'message')
  const code = readField(err, 'code')

  if (code === 'PGRST301' || /jwt expired/i.test(message)) return SESSION_MESSAGE

  if (message === 'SURVEY_NOT_FOUND' || message === 'SURVEY_NOT_ACTIVE') {
    return audience === 'student'
      ? 'This survey is no longer accepting responses.'
      : 'This survey no longer exists.'
  }

  return CODE_MESSAGES[message] ?? GENERIC_MESSAGE
}
