// Base URL for links students open from a QR code (D12).
export function getPublicSiteUrl(): string {
  const configured = import.meta.env.VITE_PUBLIC_SITE_URL?.trim()
  return (configured || window.location.origin).replace(/\/+$/, '')
}

export function getSurveyUrl(slug: string): string {
  return `${getPublicSiteUrl()}/s/${slug}`
}
