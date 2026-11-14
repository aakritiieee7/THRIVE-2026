/**
 * The state and board/curriculum lists, defined once.
 *
 * These used to be duplicated inline in profile.tsx, guided.tsx and
 * compiler.tsx, and the three copies disagreed: the forms offered
 * "Bihar SCERT" while the compiler admitted Bihar content is not loaded, and
 * every state was shown the same flat board list regardless of its own SCERT.
 *
 * Honesty rules encoded here:
 *   • every state maps to the boards that actually exist for it;
 *   • a state whose curriculum is NOT in THRIVE's corpus says so in
 *     `note`, shown next to the picker — the option is never silently
 *     offered as if the content were there;
 *   • NCERT is available everywhere, because that is what the corpus holds.
 */

export type BoardOption = {
  value: string
  /** Shown under the picker when this board's content is not in the corpus. */
  note?: string
}

export const STATES = [
  'Bihar',
  'Delhi',
  'Uttar Pradesh',
  'Madhya Pradesh',
  'Rajasthan',
  'Other',
] as const

/** NCERT is the only curriculum actually bundled, so it is always offered. */
const NCERT: BoardOption = { value: 'NCERT' }

const STATE_BOARD_NOTE =
  'This state’s SCERT content is not included in THRIVE yet — your own goals are used as context.'

export const BOARDS_BY_STATE: Record<string, BoardOption[]> = {
  Bihar: [{ value: 'Bihar SCERT', note: STATE_BOARD_NOTE }, NCERT],
  Delhi: [{ value: 'Delhi SCERT', note: STATE_BOARD_NOTE }, NCERT],
  'Uttar Pradesh': [{ value: 'UP Basic Education (SCERT)', note: STATE_BOARD_NOTE }, NCERT],
  'Madhya Pradesh': [{ value: 'MPBSE / SCERT MP', note: STATE_BOARD_NOTE }, NCERT],
  Rajasthan: [{ value: 'RBSE / SCERT Rajasthan', note: STATE_BOARD_NOTE }, NCERT],
  Other: [NCERT],
}

/** Boards for a state; falls back to NCERT alone for an unset/unknown state. */
export function boardsFor(state?: string): BoardOption[] {
  const list = BOARDS_BY_STATE[state || ''] || [NCERT]
  return [...list, { value: 'Other — teacher-provided goals' }]
}

/** The note to show for the currently chosen board, if it has one. */
export function boardNote(state?: string, board?: string): string {
  if (!board) return ''
  const found = (BOARDS_BY_STATE[state || ''] || []).find(b => b.value === board)
  return found?.note || ''
}

export const MEDIUMS = ['Hindi + English', 'Hindi', 'English', 'Other']
