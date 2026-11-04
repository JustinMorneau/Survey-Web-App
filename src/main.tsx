import { StrictMode, Suspense, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createBrowserRouter } from 'react-router'
import AuthProvider from './components/AuthProvider'
import PageLoading from './components/PageLoading'
import ProtectedRoute from './components/ProtectedRoute'
import { DashboardPage, PresentSurveyPage, ResultsPage, SurveyEditorPage } from './lazyPages'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import NotFoundPage from './pages/NotFoundPage'
import StudentSurveyPage from './pages/StudentSurveyPage'
import './index.css'

function withLoading(page: ReactNode) {
  return <Suspense fallback={<PageLoading />}>{page}</Suspense>
}

// A data router (createBrowserRouter) is required for useBlocker,
// which the survey editor uses to warn about unsaved changes.
const router = createBrowserRouter([
  { path: '/', element: <HomePage /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/s/:slug', element: <StudentSurveyPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      { path: '/dashboard', element: withLoading(<DashboardPage />) },
      { path: '/surveys/new', element: withLoading(<SurveyEditorPage />) },
      { path: '/surveys/:id/edit', element: withLoading(<SurveyEditorPage />) },
      { path: '/surveys/:id/present', element: withLoading(<PresentSurveyPage />) },
      { path: '/surveys/:id/results', element: withLoading(<ResultsPage />) },
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
