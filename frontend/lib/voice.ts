/**
 * Browser speech recognition for the teaching assistant.
 * Wraps the Web Speech API (Chrome/Edge/Safari) behind one small hook so the
 * assistant page never touches vendor-prefixed globals directly, and so
 * browsers without support get a clear message instead of a dead button.
 */

type SR = any

function getRecognition(): SR | null {
  if (typeof window === 'undefined') return null
  const w = window as any
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition
  return Ctor ? new Ctor() : null
}

export function speechSupported(): boolean {
  if (typeof window === 'undefined') return false
  const w = window as any
  return !!(w.SpeechRecognition || w.webkitSpeechRecognition)
}

export type VoiceState = 'idle' | 'listening' | 'unsupported'

export function createRecognizer(opts: {
  lang: string
  onText: (text: string) => void
  onState: (state: VoiceState) => void
}) {
  const rec = getRecognition()
  if (!rec) {
    return {
      supported: false as const,
      start: () => opts.onState('unsupported'),
      stop: () => {},
    }
  }
  rec.lang = opts.lang
  rec.continuous = false
  rec.interimResults = false
  rec.maxAlternatives = 1

  rec.onstart = () => opts.onState('listening')
  rec.onerror = (e: any) => {
    // no-speech / not-allowed are quiet by design — the status line explains.
    opts.onState(e?.error === 'not-allowed' ? 'unsupported' : 'idle')
  }
  rec.onend = () => opts.onState('idle')
  rec.onresult = (e: any) => {
    const text = e?.results?.[0]?.[0]?.transcript ?? ''
    if (text) opts.onText(text)
  }

  return {
    supported: true as const,
    start: () => {
      try { rec.start() } catch { /* already running */ }
    },
    stop: () => {
      try { rec.stop() } catch { /* already stopped */ }
    },
  }
}
