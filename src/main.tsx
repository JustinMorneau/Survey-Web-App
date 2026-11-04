import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createBrowserRouter } from 'react-router'
import AuthProvider from './components/AuthProvider'
import ProtectedRoute from './components/ProtectedRoute'
import DashboardPage from './pages/DashboardPage'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import NotFoundPage from './pages/NotFoundPage'
import PresentSurveyPage from './pages/PresentSurveyPage'
import ResultsPage from './pages/ResultsPage'
import StudentSurveyPage from './pages/StudentSurveyPage'
import SurveyEditorPage from './pages/SurveyEditorPage'
import './index.css'

// A data router (createBrowserRouter) is required for useBlocker,
// which the survey editor uses to warn about unsaved changes.
const router = createBrowserRouter([
  { path: '/', element: <HomePage /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/s/:slug', element: <StudentSurveyPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      { path: '/dashboard', element: <DashboardPage /> },
      { path: '/surveys/new', element: <SurveyEditorPage /> },
      { path: '/surveys/:id/edit', element: <SurveyEditorPage /> },
      { path: '/surveys/:id/present', element: <PresentSurveyPage /> },
      { path: '/surveys/:id/results', element: <ResultsPage /> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </StrictMode>,
)
