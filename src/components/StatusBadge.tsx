import { STATUS_LABELS, type SurveyStatus } from '../lib/surveys'

const STATUS_STYLES: Record<SurveyStatus, string> = {
  draft: 'border-slate-300 bg-slate-100 text-slate-800',
  active: 'border-green-300 bg-green-100 text-green-900',
  closed: 'border-amber-300 bg-amber-100 text-amber-900',
  archived: 'border-zinc-400 bg-zinc-200 text-zinc-800',
}

export default function StatusBadge({ status }: { status: SurveyStatus }) {
  return (
    <span
      className={`inline-block rounded-full border px-3 py-0.5 text-sm font-semibold ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}
