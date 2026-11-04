# Classroom Survey Web App — UI Specification

## Design Goals

The interface should be:

- simple;
- fast;
- mobile friendly;
- easy to use during class;
- readable from a projector;
- usable without training.

The student experience should require as few taps as possible.

Decision numbers (D1–D18) refer to the main specification, §11.

---

# 1. Application Routes

```text
/                     Landing page
/login                Instructor login
/dashboard            Instructor dashboard              (protected)
/surveys/new          New survey                        (protected)
/surveys/:id/edit     Edit survey                       (protected)
/surveys/:id/present  Present active survey             (protected)
/surveys/:id/results  View results                      (protected)
/s/:slug              Public student survey (D2)
```

Protected routes redirect to `/login` when there is no session. The Cloudflare Worker serves `index.html` for every unknown route through `"not_found_handling": "single-page-application"` in `wrangler.jsonc`.

---

# 2. Landing Page

Purpose:

Provide a simple entry point for instructors.

```text
+--------------------------------------+
|        Classroom Survey              |
|                                      |
|  Quick in-class understanding checks |
|                                      |
|        [ Instructor Login ]          |
+--------------------------------------+
```

No student link is necessary because students use QR codes. There is no sign-up link (D7).

---

# 3. Instructor Login

```text
+--------------------------------------+
| Instructor Login                     |
|                                      |
| Email                                |
| [____________________________]       |
|                                      |
| Password                             |
| [____________________________]       |
|                                      |
| [ Log In ]                           |
+--------------------------------------+
```

A wrong email or password shows "Incorrect email or password." below the form. The Log In button is disabled while signing in.

---

# 4. Dashboard

Purpose:

Display surveys and their current states.

Header:

```text
Classroom Survey
Dashboard                 instructor@school.edu
[ New Survey ]            [ Logout ]
```

Controls:

```text
Search: [________________]
Status: [ All except Archived ▼ ]
Created: [ from ] – [ to ]
```

Status filter options: All except Archived (default), Draft, Active, Closed, Archived, All (D3). Dates are shown and filtered in local time by creation date (D16).

Survey card:

```text
+--------------------------------------------------+
| Recursion Concept Check                         |
| [Draft]  Created: Aug 17, 2026  ·  0 responses  |
|                                                  |
| [Edit] [Activate] [Duplicate] [Archive] [Delete]|
+--------------------------------------------------+
```

## Actions by status (D3, D4)

| Status   | Actions                                            |
| -------- | -------------------------------------------------- |
| Draft    | Edit, Activate, Duplicate, Archive, Delete         |
| Active   | Present, Results, Close, Duplicate                 |
| Closed   | Results, Edit*, Reopen, Duplicate, Archive, Delete |
| Archived | Results, Duplicate, Unarchive, Delete              |

\* Closed surveys with responses open the editor in locked mode (§5).

Activate and Reopen go to the Present page after success.

Status badges always show the status as text, not only as color.

---

# 5. Survey Editor

Purpose:

Allow surveys to be prepared quickly before class.

Top section:

```text
Survey Title
[________________________________________]

Description (optional)
[________________________________________]
```

Question card:

```text
+------------------------------------------------+
| Question 1                       [↑] [↓]       |
|                                                |
| [ What is required for recursion?           ] |
|                                                |
| Type: [ Multiple Choice ▼ ]                    |
|                                                |
| Choices                                        |
| [ A base case                     ] [↑][↓][✕]  |
| [ A pointer                       ] [↑][↓][✕]  |
| [ A loop                          ] [↑][↓][✕]  |
|                                                |
| [+ Add Choice]                                 |
|                                                |
| [Delete Question]                              |
+------------------------------------------------+
```

Bottom controls:

```text
[ + Add Question ]

Saving... / Saved        [ Save Draft ]    [ Activate ]
```

## Question rules (D5)

- Every question is required for students; there is no "required" toggle.
- Multiple Choice: 2–10 choices. Add Choice is hidden at 10; delete is disabled at 2. Choices must be non-empty and distinct.
- True / False: shows fixed "True" and "False" choices that cannot be edited, reordered, or deleted.
- Changing a question from Multiple Choice to True / False asks for confirmation, because the existing choices are replaced.

## Editing behavior

- reordering keeps all entered text;
- validation errors appear next to the affected field;
- deleting a question asks for confirmation;
- leaving the page with unsaved changes asks for confirmation;
- Activate saves first, then activates, then opens the Present page;
- Activate is disabled until the survey has at least one question.

## Locked mode (D4)

When the survey has responses:

```text
+------------------------------------------------+
| This survey has 52 responses, so its questions |
| can't be changed. You can still edit the title |
| and description.            [ Duplicate to edit ] |
+------------------------------------------------+
```

Questions and choices are shown read-only.

Active surveys cannot be opened in the editor; the dashboard does not offer Edit for them.

---

# 6. Present Survey Page

Purpose:

Display the QR code during class. Optimized for a projector.

```text
+--------------------------------------------------------+
| Recursion Concept Check                                |
|                                                        |
|                 +----------------+                     |
|                 |                |                     |
|                 |    QR CODE     |                     |
|                 |                |                     |
|                 +----------------+                     |
|                                                        |
|     survey-web-app.<subdomain>.workers.dev/s/x7kf2qmb  |
|                                                        |
|                  Responses: 42                         |
|                                                        |
| [ Download QR ]  [ View Results ]   [ Close Survey ]   |
+--------------------------------------------------------+
```

Requirements:

- QR code is large and high-contrast;
- URL is readable from the back of a room and built from `VITE_PUBLIC_SITE_URL` (D12);
- response count refreshes every 5 seconds while the page is visible (D11);
- no unnecessary navigation elements;
- suitable for full-screen projection;
- Close Survey asks for confirmation.

If the survey is not Active, the page shows "This survey is not active." with a link to the dashboard.

---

# 7. Student Survey

This is the most important mobile interface.

Requirements:

- no login;
- no menu;
- no distractions;
- touch targets of at least 44px;
- readable text;
- one-column mobile layout.

```text
Recursion Concept Check

Quick understanding check

1. What is required for recursion?

( ) A base case
( ) A pointer
( ) A loop

2. Every recursive function needs
   a stopping condition.

( ) True
( ) False

[            Submit            ]
```

Spacing:

- generous spacing between answer choices;
- the whole choice row is tappable, not just the radio button;
- Submit spans most of the screen width.

If the student taps Submit with unanswered questions, each unanswered question shows "Please choose an answer." and the page scrolls to the first one.

---

# 8. Student Submission States

## Submitting

```text
Submitting...
```

The Submit button is disabled.

## Success

```text
Thank you!

Your response has been recorded.
```

No additional actions.

## Already Submitted

Shown on page load if this browser already submitted, and after a `DUPLICATE_RESPONSE` error (D8).

```text
You have already submitted a response
to this survey.
```

## Survey Not Available

Shown when the slug does not match an Active survey, or when submitting fails with `SURVEY_NOT_ACTIVE` or `SURVEY_NOT_FOUND`. Students cannot tell a closed survey from a missing one, so one message covers both.

```text
This survey is no longer accepting responses.
```

If the survey closes while a student is filling it in, this message replaces the form when they submit.

---

# 9. Results Page

Header:

```text
Recursion Concept Check
[Closed]  52 responses
```

Question result:

```text
What is required for recursion?        52 answered

A base case
████████████████████  45   86.5%

A pointer
██                     3    5.8%

A loop
█                      2    3.8%

A compiler
█                      2    3.8%
```

Percentages use the number of responses that answered the question (D10).

Actions:

```text
[ Refresh ]
[ Export CSV ]
[ Present QR ]        (Active surveys only)
[ Back to Dashboard ]
```

Charts:

- horizontal bar charts;
- every bar shows its count and percentage as text;
- readable without relying on color;
- choices in editor order.

---

# 10. Empty States

No surveys:

```text
You have not created any surveys yet.

[ Create Your First Survey ]
```

No responses:

```text
No responses yet.

Display the QR code so students can join.
```

No search results:

```text
No surveys match your search.
```

---

# 11. Confirmation Dialogs

Use confirmation for:

```text
Delete survey
Archive survey
Close active survey
Delete question
Change question type to True / False
Leave editor with unsaved changes
```

Delete, no responses:

```text
Delete "Recursion Concept Check"?

This will permanently delete the survey.

[ Cancel ] [ Delete ]
```

Delete, with responses (stronger warning):

```text
Delete "Recursion Concept Check"?

This survey has 52 responses. Deleting it
permanently removes all of them.
Archive keeps the results but hides the survey.

[ Cancel ] [ Archive Instead ] [ Delete Permanently ]
```

---

# 12. Responsive Design

## Mobile

Student view:

- single column;
- full-width answer controls;
- minimal header.

Instructor dashboard:

- cards stack vertically;
- action buttons may wrap.

## Tablet

- wider survey cards;
- editor remains one column.

## Desktop

- dashboard may use cards or a compact table;
- results can use larger charts.

---

# 13. Accessibility

Requirements:

- semantic HTML;
- visible focus indicators;
- every control reachable and usable with the keyboard;
- form labels connected to inputs;
- radio groups use `fieldset` and `legend`;
- sufficient color contrast;
- survey status always shown as text;
- charts also display numeric values;
- error messages are associated with their fields.

---

# 14. Visual Style

Recommended characteristics:

```text
Clean
Minimal
Professional
Neutral
Large readable typography
Generous whitespace
```

Avoid:

```text
Decorative animations
Complex gradients
Dense navigation
Small mobile controls
Excessive modal dialogs
```

---

# 15. Loading and Saving Feedback

```text
Loading survey...
Loading results...
Saving...
Saved
Submitting...
```

Buttons that start a request are disabled until it finishes. Do not show success toasts for every minor interaction.

---

# 16. Dates

All dates are shown in the browser's local time (D16), for example `Aug 17, 2026`.

---

# 17. Error Messages (D9)

| Code or situation                                 | Message                                                              |
| ------------------------------------------------- | -------------------------------------------------------------------- |
| Network error                                     | Can't reach the server. Check your connection and try again.         |
| Session expired                                   | Your session has expired. Please log in again.                       |
| `SURVEY_NOT_FOUND` (instructor)                   | This survey no longer exists.                                        |
| `SURVEY_NOT_FOUND`, `SURVEY_NOT_ACTIVE` (student) | This survey is no longer accepting responses.                        |
| `SURVEY_ACTIVE`                                   | Close this survey before editing it.                                 |
| `SURVEY_LOCKED`                                   | This survey has responses, so its questions can't be changed.        |
| `SURVEY_HAS_NO_QUESTIONS`                         | Add at least one question before activating.                         |
| `INVALID_STATUS_TRANSITION`                       | That action isn't available for this survey's current status.        |
| `VALIDATION_FAILED`                               | Some questions need fixing before saving.                            |
| `DUPLICATE_RESPONSE`                              | You have already submitted a response to this survey.                |
| `INVALID_QUESTION`, `INVALID_CHOICE`              | Something went wrong with your answers. Please reload and try again. |
| `MISSING_REQUIRED_ANSWER`                         | Please answer every question.                                        |
| `INVALID_TOKEN`                                   | Something went wrong. Please try again.                              |
| Anything else                                     | Something went wrong. Please try again.                              |

Raw database errors are never shown.

---

# 18. Future UI Enhancements

Possible later screens:

```text
Question Bank
Course Management
Semester Management
Analytics Dashboard
AI Question Generator
Survey Import
Survey Settings
Instructor Management
```

These are outside the MVP.
