// THRIVE brand mark: an open book whose pages grow into a leaf,
// with a small connecting node — growth + learning + togetherness.
// No graduation caps. Variants: full (mark + wordmark), icon, mono.

type Variant = 'full' | 'icon' | 'mono' | 'mono-full';
type Tone = 'light' | 'dark';

export function ThriveLogo({
  variant = 'full',
  tone = 'light',
  size = 32,
  className = '',
}: {
  variant?: Variant;
  tone?: Tone; // which background it sits on
  size?: number;
  className?: string;
}) {
  const onDark = tone === 'dark';
  const mark = (mono: boolean) => (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" focusable="false">
      {/* open book — two pages, slight spread */}
      <path
        d="M32 38 C 24 31.5, 15 31, 8 33.5 L8 52.5 C 15 50, 24 50.5, 32 57 C 39 50.5, 48 50, 55 52.5 L55 33.5 C 48 31, 39 31.5, 32 38 Z"
        fill={mono ? (onDark ? '#FAF7F1' : '#1F3D2B') : 'var(--forest, #2E5940)'}
      />
      {/* spine highlight */}
      <path d="M32 38 L32 57" stroke={mono ? (onDark ? '#1F3D2B' : '#FAF7F1') : '#FAF7F1'} strokeWidth="1.6" strokeLinecap="round" opacity="0.85" />
      {/* leaf growing from the spine */}
      <path
        d="M32 36 C 30 28, 25.5 21.5, 18.5 18.5 C 18.8 27.5, 23.5 33.5, 32 36 Z"
        fill={mono ? (onDark ? '#FAF7F1' : '#1F3D2B') : 'var(--sage, #7FA08B)'}
      />
      <path
        d="M32 36 C 34.5 27, 39.5 20.5, 46.5 18 C 46 27.5, 41.5 33.5, 32 36 Z"
        fill={mono ? (onDark ? '#FAF7F1' : '#1F3D2B') : 'var(--honey, #C89021)'}
      />
      {/* vein */}
      <path d="M32 35 C 31 29, 30 24.5, 28.5 20.5" stroke={mono ? (onDark ? '#1F3D2B' : '#FAF7F1') : '#FAF7F1'} strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.7" />
      {/* togetherness node */}
      <circle cx="32" cy="36" r="2.4" fill={mono ? (onDark ? '#1F3D2B' : '#FAF7F1') : 'var(--ivory, #FAF7F1)'} />
    </svg>
  );

  const mono = variant === 'mono' || variant === 'mono-full';
  const word = !variant.includes('icon') ? (
    <span className="logo-word" style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
      <span style={{
        fontFamily: 'Fraunces, Georgia, serif',
        fontWeight: 640,
        fontSize: size * 0.62,
        letterSpacing: '0.06em',
        color: onDark ? '#FAF7F1' : 'var(--forest, #2E5940)',
      }}>THRIVE</span>
      <span style={{ fontSize: Math.max(8, size * 0.22), letterSpacing: '0.14em', textTransform: 'uppercase', color: onDark ? 'rgba(250,247,241,0.65)' : 'var(--sage, #7FA08B)' }}>
        Teacher Support, Together
      </span>
    </span>
  ) : null;

  return (
    <span className={`thrive-logo ${className}`} style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.35 }}>
      {mark(mono)}
      {word}
    </span>
  );
}
