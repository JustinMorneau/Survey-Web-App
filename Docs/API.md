# Classroom Survey Web App — API and Data Access Specification

## Overview

The application uses Supabase as its backend. There is no custom application server.

- Simple single-table reads, updates, and deletes use the Supabase JavaScript client directly.
- Multi-row writes and results use database functions (RPCs) called with `supabase.rpc(...)` (D6).

Function definitions, security settings, and permissions are in `DATABASE.md` §10. Decision numbers (D1–D18) refer to the main specification, §11.

---

# 1. Environment

```text
VITE_SUPABASE_URL        Supabase project URL
VITE_SUPABASE_ANON_KEY   Public anon key (safe to ship; security is in the database)
VITE_PUBLIC_SITE_URL     Base URL used in QR codes (D12)
```

Public survey URL:

```ts
const base = import.meta.env.VITE_PUBLIC_SITE_URL || window.location.origin;
const url = `${base}/s/${survey.public_slug}`;
```

---

# 2. Authentication

Supabase Auth handles instructor authentication.

Required operations:

```text
signInWithPassword
signOut
getSession
onAuthStateChange
```

There is no sign-up operation. Public sign-up is disabled and the instructor account is created manually (D7).

Students do not authenticate.

---

# 3. Data Models

## Survey

```json
{
  "id": "uuid",
  "title": "Recursion Concept Check",
  "description": "Quick in-class survey",
  "status": "active",
  "public_slug": "x7kf2qmb",
  "created_at": "2026-08-17T12:00:00Z",
  "updated_at": "2026-08-17T12:05:00Z"
}
```

`status` is one of `draft`, `active`, `closed`, `archived`. `public_slug` is null until first activation (D2).

## Question

```json
{
  "id": "uuid",
  "survey_id": "uuid",
  "question_text": "What is required for a recursive function?",
  "question_type": "multiple_choice",
  "position": 1
}
```

`question_type` is `multiple_choice` or `true_false`.

## Choice

```json
{
  "id": "uuid",
  "question_id": "uuid",
  "choice_text": "A base case",
  "position": 1
}
```

## Response

```json
{
  "id": "uuid",
  "survey_id": "uuid",
  "anonymous_token": "browser-token",
  "submitted_at": "2026-08-17T12:10:00Z"
}
```

---

# 4. Error Codes (D9)

Database functions raise exceptions whose message is one of these codes. The frontend reads `error.message`, maps the code to a UI message (`UI.md` §17), and shows a generic message for anything unknown. Raw database errors are never shown.

| Code | Raised by | Meaning |
|---|---|---|
| `SURVEY_NOT_FOUND` | all survey RPCs | No survey with that ID |
| `SURVEY_NOT_ACTIVE` | `submit_survey_response` | Survey is not accepting responses |
| `SURVEY_ACTIVE` | `save_survey` | Active surveys cannot be edited |
| `SURVEY_LOCKED` | `save_survey` | Survey has responses; questions are locked |
| `SURVEY_HAS_NO_QUESTIONS` | `activate_survey` | Survey needs at least one question |
| `INVALID_STATUS_TRANSITION` | status trigger, `close_survey` | Lifecycle rule violated (D3) |
| `VALIDATION_FAILED` | `save_survey` | Question rules violated (D5) |
| `DUPLICATE_RESPONSE` | `submit_survey_response` | This browser already submitted |
| `INVALID_QUESTION` | `submit_survey_response` | Question not in this survey |
| `INVALID_CHOICE` | `submit_survey_response` | Choice not in its question |
| `MISSING_REQUIRED_ANSWER` | `submit_survey_response` | Not every question answered |

---

# 5. Instructor Operations — Reading

## List Surveys

```ts
supabase
  .from("surveys")
  .select("*, responses(count)")
  .order("created_at", { ascending: false })
```

The dashboard hides Archived surveys unless the status filter includes them (D3). The response count drives the delete warning.

## Get Survey

```ts
supabase
  .from("surveys")
  .select("*, questions(*, choices(*)), responses(count)")
  .eq("id", surveyId)
  .single()
```

Sort questions and choices by `position` in the client.

Expected result:

```json
{
  "id": "uuid",
  "title": "Recursion Concept Check",
  "status": "draft",
  "responses": [{ "count": 0 }],
  "questions": [
    {
      "id": "uuid",
      "question_text": "What is recursion?",
      "question_type": "multiple_choice",
      "position": 1,
      "choices": []
    }
  ]
}
```

A survey with a response count above 0 is locked (D4).

---

# 6. Instructor Operations — Writing

## Create or Save Survey (D4, D5)

```ts
supabase.rpc("save_survey", {
  p_survey_id: null,           // null creates a new Draft
  p_title: "Recursion Concept Check",
  p_description: "In-class poll",
  p_questions: [
    {
      question_text: "What is required for recursion?",
      question_type: "multiple_choice",
      choices: [
        { choice_text: "A base case" },
        { choice_text: "A pointer" }
      ]
    },
    {
      question_text: "Every recursive function needs a stopping condition.",
      question_type: "true_false",
      choices: [
        { choice_text: "True" },
        { choice_text: "False" }
      ]
    }
  ]
})
```

Returns the survey ID. Positions come from array order.

Validation (checked in the editor first, enforced again in the function):

- title is not empty;
- at least one question to activate (saving a Draft with zero questions is allowed);
- every question has non-empty text;
- Multiple Choice: 2–10 non-empty, distinct choices;
- True/False: exactly "True" then "False".

Errors: `SURVEY_NOT_FOUND`, `SURVEY_ACTIVE`, `SURVEY_LOCKED`, `VALIDATION_FAILED`.

## Update Title and Description of a Locked Survey

```ts
supabase
  .from("surveys")
  .update({ title, description })
  .eq("id", surveyId)
```

Used only when the survey has responses and is not Active.

## Archive and Unarchive (D3)

```ts
supabase.from("surveys").update({ status: "archived" }).eq("id", surveyId)  // from draft or closed
supabase.from("surveys").update({ status: "closed" }).eq("id", surveyId)    // unarchive
```

The status trigger rejects other transitions with `INVALID_STATUS_TRANSITION`.

## Delete Survey

```ts
supabase.from("surveys").delete().eq("id", surveyId)
```

Allowed for any non-Active survey. Deletion cascades to questions, choices, responses, and answers. The UI asks for confirmation, with a stronger warning when the survey has responses.

## Duplicate Survey

```ts
supabase.rpc("duplicate_survey", { p_survey_id: surveyId })
```

Returns the new survey ID. The copy is a Draft named `Copy of <title>`, with questions and choices but no responses and no slug. The UI then opens the editor for the copy.

---

# 7. Activation

```ts
supabase.rpc("activate_survey", { p_survey_id: surveyId })
```

Responsibilities:

1. close any existing Active survey;
2. create a public slug if the survey does not have one (D2);
3. change the requested survey to Active;
4. return the survey.

Example output:

```json
{
  "id": "uuid",
  "status": "active",
  "public_slug": "x7kf2qmb"
}
```

Errors: `SURVEY_NOT_FOUND`, `SURVEY_HAS_NO_QUESTIONS`, `INVALID_STATUS_TRANSITION`.

When activating from the editor, save first, then activate.

---

# 8. Close Survey

```ts
supabase.rpc("close_survey", { p_survey_id: surveyId })
```

Result: `status = closed`. Student submissions fail immediately after closing.

Errors: `SURVEY_NOT_FOUND`, `INVALID_STATUS_TRANSITION`.

---

# 9. Present-Page Response Count (D11)

```ts
supabase
  .from("responses")
  .select("*", { count: "exact", head: true })
  .eq("survey_id", surveyId)
```

Poll every 5 seconds while `document.visibilityState === "visible"`. Stop polling when the page is hidden or unmounted.

---

# 10. Public Student Survey

Route:

```text
/s/:slug
```

The anon role can read only the Active survey and its questions and choices (RLS).

```ts
supabase
  .from("surveys")
  .select("id, title, description, questions(id, question_text, question_type, position, choices(id, choice_text, position))")
  .eq("public_slug", slug)
  .maybeSingle()
```

If no row comes back, the survey either does not exist or is not Active. The page shows the "no longer accepting responses" message in both cases, because anon cannot tell them apart.

Needed data:

```json
{
  "survey": {
    "id": "uuid",
    "title": "Recursion Concept Check",
    "description": "Quick check"
  },
  "questions": [
    {
      "id": "uuid",
      "question_text": "What is required for recursion?",
      "question_type": "multiple_choice",
      "position": 1,
      "choices": [
        {
          "id": "uuid",
          "choice_text": "A base case",
          "position": 1
        }
      ]
    }
  ]
}
```

No response data is ever returned to anonymous users.

---

# 11. Student Submission (D7, D8)

## Browser token

```text
localStorage key  cs_anon_token        crypto.randomUUID(), created once per browser
localStorage key  cs_submitted_<id>    set after a successful submission
```

If `cs_submitted_<surveyId>` exists when the page loads, show "already submitted" without rendering the form.

## Call

```ts
supabase.rpc("submit_survey_response", {
  p_survey_id: "uuid",
  p_anonymous_token: "random-browser-token",
  p_answers: [
    { question_id: "uuid", choice_id: "uuid" }
  ]
})
```

Success response:

```json
{
  "success": true,
  "response_id": "uuid"
}
```

Errors: `SURVEY_NOT_FOUND`, `SURVEY_NOT_ACTIVE`, `DUPLICATE_RESPONSE`, `INVALID_QUESTION`, `INVALID_CHOICE`, `MISSING_REQUIRED_ANSWER`.

On `DUPLICATE_RESPONSE`, also set `cs_submitted_<surveyId>`.

Accepted limitation: a private window or another browser can submit again.

---

# 12. Results (D10)

Instructor-only.

```ts
supabase.rpc("get_survey_results", { p_survey_id: surveyId })
```

Result:

```json
{
  "survey_id": "uuid",
  "response_count": 52,
  "questions": [
    {
      "question_id": "uuid",
      "question_text": "What is required for recursion?",
      "response_count": 52,
      "choices": [
        {
          "choice_id": "uuid",
          "choice_text": "A base case",
          "count": 45,
          "percentage": 86.5
        }
      ]
    }
  ]
}
```

- Question-level `response_count` is the number of responses that answered that question.
- `percentage = round(count * 100 / question response_count, 1)`; 0 when there are no answers.
- Questions and choices are ordered by `position`.

---

# 13. CSV Export (D13)

Instructor-only. Generated in the browser; no server endpoint.

Data fetched:

```ts
supabase
  .from("responses")
  .select("id, submitted_at, answers(question_id, choice_id)")
  .eq("survey_id", surveyId)
  .order("submitted_at")
```

plus the survey's questions and choices.

Layout:

```text
response_id,submitted_at,<question 1 text>,<question 2 text>,...
<uuid>,2026-08-17T12:10:00Z,A base case,True,...
```

Rules:

- one row per response;
- `submitted_at` in ISO 8601 UTC;
- question columns in position order; cells contain the chosen choice text;
- survey metadata goes in the filename: `<title-slug>_<YYYY-MM-DD>.csv`;
- wrap any field containing `"`, `,`, or a line break in double quotes, doubling inner quotes;
- prefix any cell that starts with `=`, `+`, `-`, or `@` with `'`;
- write UTF-8 with a byte-order mark so Excel reads non-English text correctly.

---

# 14. Error Handling

Standard UI handling is defined for:

```text
Network error
Authentication required
Survey not found
Survey closed
Duplicate submission
Validation error
Unexpected server error
```

Messages are listed in `UI.md` §17. Never show raw database exceptions to anyone.

An expired instructor session redirects to `/login`.

---

# 15. Loading States

Every asynchronous page includes a loading state:

```text
Loading survey...
Loading results...
Saving...
Submitting...
```

Buttons that trigger mutations are disabled while the request is in progress.

---

# 16. Future API Extensions

Possible future operations:

```text
importSurvey
exportSurvey
generateQuestions
listQuestionBank
saveQuestionToBank
createCourse
listCourses
assignSurveyToCourse
getAnalytics
subscribeToResults (Supabase Realtime)
```

These are outside the MVP.