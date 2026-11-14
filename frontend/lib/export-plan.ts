/**
 * Export a compiled plan as a printable document.
 *
 * We use the browser's own "Save as PDF" via a print window rather than
 * bundling a PDF library: it adds no dependency, keeps the app working
 * offline, and produces a document the teacher can also just print.
 *
 * The output is deliberately plain — headings, the minute-by-minute
 * timeline, and a footer with the syllabus disclaimer, because a plan taken
 * into a classroom must not carry unverified claims.
 */

/* Slot shape as /compiler/run really returns it: a start/end minute range
   plus focus/activity prose. (An earlier version of this file assumed
   `minutes`/`label`, which rendered blank rows and a total of 0.) */
type Slot = {
  start?: number
  end?: number
  minutes?: number
  focus?: string
  grades?: string[]
  teacher?: string
  activity?: string
  objective?: string
  check?: string
  kind?: string
  label?: string
  detail?: string
  grade?: string
}
type PlanLike = {
  title?: string
  subject?: string
  minutes?: number
  medium?: string
  board?: string
  materials?: string
  schedule?: Slot[]
  slots?: Slot[]
  grades?: any[]
  assessments?: any[]
  sources?: any[]
}

function esc(s: any): string {
  return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))
}

/** "00:05" from a start minute. */
function clock(mins: number): string {
  const h = Math.floor(mins / 60), m = Math.round(mins % 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Length of one slot: explicit minutes, else end-start, else 0. */
function slotMinutes(s: Slot): number {
  if (typeof s.minutes === 'number') return s.minutes
  if (typeof s.start === 'number' && typeof s.end === 'number') return Math.max(0, s.end - s.start)
  return 0
}

export function planToHtml(plan: PlanLike, meta?: { teacher?: string; state?: string }): string {
  const slots = plan.schedule || plan.slots || []
  const total = plan.minutes || slots.reduce((a, s) => a + slotMinutes(s), 0)
  const sum = slots.reduce((a, s) => a + slotMinutes(s), 0)

  const rows = slots.map(s => {
    const heading = s.label || s.focus || (s.grades || []).join(', ') || s.grade || ''
    const detail = s.detail || s.activity || s.objective || ''
    return `
    <tr>
      <td class="t">${clock(s.start ?? 0)}</td>
      <td class="m">${esc(slotMinutes(s))}′</td>
      <td><b>${esc(heading)}</b>${detail ? `<br><span class="d">${esc(detail)}</span>` : ''}</td>
    </tr>`
  }).join('')

  const grades = (plan.grades || []).map(g => `
    <tr><td class="g">${esc(g.grade ?? '')}</td><td>${esc(g.topic || '')}</td><td>${esc(g.objective || '')}</td></tr>`).join('')

  const checks = (plan.assessments || []).map(a => `
    <tr><td class="g">${esc(a.grade ?? '')}</td><td>${esc(a.check || a.question || '')}</td></tr>`).join('')

  return `<!doctype html><html><head><meta charset="utf-8">
<title>${esc(plan.title || 'Lesson plan')} — THRIVE</title>
<style>
  @page { margin: 16mm; }
  body { font: 12pt/1.5 Georgia, serif; color: #1f2a24; }
  h1 { font-size: 19pt; margin: 0 0 4px; }
  .sub { color: #5b6b60; font-size: 10.5pt; margin-bottom: 18px; }
  h2 { font-size: 12pt; text-transform: uppercase; letter-spacing: .08em;
       border-bottom: 1px solid #c9d3cc; padding-bottom: 4px; margin: 22px 0 10px; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 6px 8px 6px 0; vertical-align: top; border-bottom: 1px solid #e6ebe7; }
  td.t { font-variant-numeric: tabular-nums; font-weight: 700; white-space: nowrap; width: 62px; }
  td.m { color: #5b6b60; white-space: nowrap; width: 46px; }
  td.g { font-weight: 700; width: 58px; }
  .d { color: #5b6b60; font-size: 10.5pt; }
  .note { margin-top: 22px; padding: 10px 12px; background: #f5f2ea;
          border-left: 3px solid #b98b2e; font-size: 9.5pt; color: #4a4436; }
  .sum { font-size: 10pt; color: #5b6b60; margin-top: 6px; }
  @media print { .noprint { display: none } }
</style></head><body>
  <h1>${esc(plan.title || 'Lesson plan')}</h1>
  <div class="sub">
    ${[plan.subject, plan.medium, plan.board, total ? `${total} minutes` : ''].filter(Boolean).map(esc).join(' · ')}
    ${meta?.teacher ? `<br>Prepared by ${esc(meta.teacher)}${meta.state ? ` · ${esc(meta.state)}` : ''}` : ''}
  </div>

  ${grades ? `<h2>Learning goals by grade</h2>
  <table><tbody>${grades}</tbody></table>` : ''}

  <h2>Minute-by-minute timeline</h2>
  <table><tbody>${rows || '<tr><td>No timeline in this plan.</td></tr>'}</tbody></table>
  <div class="sum">Total planned: ${sum} minutes${total && sum !== total ? ` — does not match the ${total} minutes requested` : ''}.</div>

  ${checks ? `<h2>Closing checks</h2><table><tbody>${checks}</tbody></table>` : ''}

  ${plan.materials ? `<h2>Materials</h2><p>${esc(plan.materials)}</p>` : ''}

  <div class="note">
    Generated with THRIVE. Curriculum points must be checked against your official
    syllabus before use. This document contains no student names or personal data.
  </div>
  <p class="noprint" style="margin-top:14px;font-size:10pt;color:#5b6b60">
    Use your browser's Print dialog and choose “Save as PDF”.
  </p>
  <script>window.addEventListener('load', function(){ setTimeout(function(){ window.print() }, 300) })</script>
</body></html>`
}

/**
 * Open the plan in a print window. Returns false when a popup blocker
 * stopped it, so the caller can tell the teacher to allow popups.
 */
export function exportPlanPdf(plan: PlanLike, meta?: { teacher?: string; state?: string }): boolean {
  if (typeof window === 'undefined') return false
  const w = window.open('', '_blank', 'width=820,height=1000')
  if (!w) return false
  w.document.write(planToHtml(plan, meta))
  w.document.close()
  return true
}

/** A wa.me link if we only have a number; otherwise null (send via API). */
export function waMeLink(number: string, text: string): string {
  const digits = String(number || '').replace(/\D/g, '')
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
}
