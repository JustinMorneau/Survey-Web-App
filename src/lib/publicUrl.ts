// Base URL for links students open from a QR code (D12).
//
// QR scanners only open a link when the text includes the scheme
// (https://). Without it, phones treat the text as a search, so a
// configured value like "example.workers.dev" is given https:// here.
export function getPublicSiteUrl(): string {
  const configured = import.meta.env.VITE_PUBLIC_SITE_URL?.trim() ?? ''
  const base = configured || window.location.origin
  const withScheme = /^https?:\/\//i.test(base) ? base : `https://${base}`
  return withScheme.replace(/\/+$/, '')
}

export function getSurveyUrl(slug: string): string {
  return `${getPublicSiteUrl()}/s/${slug}`
}
