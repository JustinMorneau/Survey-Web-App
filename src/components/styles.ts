const focusRing =
  'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-board'

const buttonBase = `inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold ${focusRing} disabled:cursor-not-allowed disabled:opacity-50`

export const buttonStyles = {
  primary: `${buttonBase} bg-board text-white hover:bg-board-dark disabled:hover:bg-board`,
  secondary: `${buttonBase} border border-line bg-white text-ink hover:bg-paper disabled:hover:bg-white`,
  danger: `${buttonBase} bg-red-700 text-white hover:bg-red-800 disabled:hover:bg-red-700`,
}

export type ButtonVariant = keyof typeof buttonStyles

export const inputStyles = `mt-1 block min-h-11 w-full rounded-lg border border-line bg-white px-3 text-base ${focusRing}`

export const labelStyles = 'block text-sm font-semibold text-ink'
