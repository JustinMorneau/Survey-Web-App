import type { SurveyStatus } from './surveys'

export type SurveyAction =
  | 'edit'
  | 'activate'
  | 'present'
  | 'results'
  | 'close'
  | 'reopen'
  | 'duplicate'
  | 'archive'
  | 'unarchive'
  | 'delete'

export const ACTION_LABELS: Record<SurveyAction, string> = {
  edit: 'Edit',
  activate: 'Activate',
  present: 'Present',
  results: 'Results',
  close: 'Close',
  reopen: 'Reopen',
  duplicate: 'Duplicate',
  archive: 'Archive',
  unarchive: 'Unarchive',
  delete: 'Delete',
}

// UI.md §4: actions by status (D3).
const ACTIONS_BY_STATUS: Record<SurveyStatus, SurveyAction[]> = {
  draft: ['edit', 'activate', 'duplicate', 'archive', 'delete'],
  active: ['present', 'results', 'close', 'duplicate'],
  closed: ['results', 'edit', 'reopen', 'duplicate', 'archive', 'delete'],
  archived: ['results', 'duplicate', 'unarchive', 'delete'],
}

export function getAllowedActions(status: SurveyStatus): SurveyAction[] {
  return ACTIONS_BY_STATUS[status]
}

// Actions built so far. Each later phase adds its actions here:
// Phase 3: edit, duplicate · Phase 4: activate, present, close, reopen · Phase 6: results
export const IMPLEMENTED_ACTIONS: ReadonlySet<SurveyAction> = new Set<SurveyAction>([
  'archive',
  'unarchive',
  'delete',
])
