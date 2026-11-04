import { useEffect, useId, useRef, type ReactNode } from 'react'
import { buttonStyles, type ButtonVariant } from './styles'

export type DialogAction = {
  label: string
  variant: ButtonVariant
  onClick: () => void
}

type ConfirmDialogProps = {
  open: boolean
  title: string
  children: ReactNode
  actions: DialogAction[]
  onCancel: () => void
  /** Disables every button while the confirmed action is running. */
  busy?: boolean
}

export default function ConfirmDialog({
  open,
  title,
  children,
  actions,
  onCancel,
  busy = false,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(event) => {
        // Escape key: route through onCancel so React state stays in sync.
        event.preventDefault()
        if (!busy) onCancel()
      }}
      className="m-auto w-[min(32rem,calc(100%-2rem))] rounded-xl border border-line bg-white p-6 text-ink shadow-xl backdrop:bg-black/40"
    >
      <h2 id={titleId} className="text-xl font-bold">
        {title}
      </h2>
      <div className="mt-3 space-y-2 text-muted">{children}</div>
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <button type="button" className={buttonStyles.secondary} onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            className={buttonStyles[action.variant]}
            onClick={action.onClick}
            disabled={busy}
          >
            {action.label}
          </button>
        ))}
      </div>
    </dialog>
  )
}
