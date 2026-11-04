import { lazy } from 'react'

// Instructor pages load on demand. Students scanning a QR code only download
// the student page, not the editor, Recharts (results), or the QR library.
//
// These live in their own module because react-refresh/only-export-components
// rejects component definitions in a file that has no exports (main.tsx).
export const DashboardPage = lazy(() => import('./pages/DashboardPage'))
export const SurveyEditorPage = lazy(() => import('./pages/SurveyEditorPage'))
export const PresentSurveyPage = lazy(() => import('./pages/PresentSurveyPage'))
export const ResultsPage = lazy(() => import('./pages/ResultsPage'))
