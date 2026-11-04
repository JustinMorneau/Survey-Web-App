/** Shown while a page's code is downloading (instructor pages are loaded on demand). */
export default function PageLoading() {
  return (
    <p role="status" className="p-8 text-center text-muted">
      Loading...
    </p>
  )
}
