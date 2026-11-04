import { useParams } from 'react-router'

// Placeholder so QR codes can be tested in Phase 4.
// Replaced by the real student survey in Phase 5.
export default function StudentSurveyPage() {
  const { slug } = useParams()
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold">Survey {slug}</h1>
        <p className="mt-3 text-muted">The student survey page is added in Phase 5.</p>
      </div>
    </main>
  )
}
