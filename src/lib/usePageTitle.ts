import { useEffect } from 'react'

const APP_NAME = 'Classroom Survey'

/** Sets the browser tab title, which screen readers also announce on page changes. */
export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} · ${APP_NAME}` : APP_NAME
  }, [title])
}
