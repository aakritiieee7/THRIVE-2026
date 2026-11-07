// Original flat-vector education illustrations for THRIVE.
// No stock photos, no external URLs. Consistent style: warm off-white
// ground, flat shapes, minimal outlines, soft harmonious palette drawn
// from the design tokens (forest / sage / honey / clay / cream).
// Each illustration uses a fixed 4:3 or 1:1 viewBox so aspect ratios
// stay consistent everywhere they are used.

const palette = {
  forest: '#2E5940',
  sage: '#7FA08B',
  honey: '#C89021',
  clay: '#B0512E',
  cream: '#F3EDE0',
  ivory: '#FAF7F1',
  navy: '#1F3D55',
  line: 'rgba(31,61,43,0.28)',
};

type IllProps = { size?: number; className?: string; label?: string };

function Frame({ children, size = 160, className = '', label, ratio = 4 / 3 }: IllProps & { children: React.ReactNode; ratio?: number }) {
  const w = size, h = Math.round(size / ratio);
  return (
    <svg viewBox={`0 0 120 ${120 / ratio}`} width={w} height={h} className={`thr-ill ${className}`} role="img" aria-label={label || 'THRIVE illustration'}>
      {children}
    </svg>
  );
}

// ---------- Mathematics ----------
export function IllMath(p: IllProps) {
  return (
    <Frame {...p} label="Mathematics illustration: numbers, shapes and counting blocks">
      <rect x="0" y="0" width="120" height="90" fill={palette.ivory} />
      <rect x="14" y="52" width="14" height="14" rx="2" fill={palette.honey} />
      <rect x="30" y="52" width="14" height="14" rx="2" fill={palette.sage} />
      <rect x="46" y="52" width="14" height="14" rx="2" fill={palette.forest} />
      <circle cx="86" cy="30" r="15" fill={palette.sage} opacity="0.9" />
      <path d="M86 15 L100 42 L72 42 Z" fill={palette.honey} />
      <path d="M30 30 l10 18 l-20 0 Z" fill={palette.clay} />
      <rect x="70" y="56" width="26" height="12" rx="6" fill={palette.cream} stroke={palette.line} />
      <text x="83" y="65" textAnchor="middle" fontSize="8" fill={palette.forest} fontFamily="Fraunces, serif">7 + 5</text>
      <circle cx="24" cy="24" r="4" fill={palette.clay} />
      <circle cx="38" cy="20" r="3" fill={palette.honey} />
      <circle cx="14" cy="18" r="2.5" fill={palette.sage} />
      <path d="M14 78 h92" stroke={palette.line} strokeWidth="1" strokeDasharray="3 4" />
    </Frame>
  );
}

// ---------- EVS ----------
export function IllEVS(p: IllProps) {
  return (
    <Frame {...p} label="EVS illustration: plant, sun and water">
      <rect x="0" y="0" width="120" height="90" fill={palette.ivory} />
      <circle cx="96" cy="20" r="11" fill={palette.honey} />
      {[0, 45, 90, 135, 180, 225, 270, 315].map(a => (
        <line key={a} x1="96" y1="20" x2={96 + 15 * Math.cos(a * Math.PI / 180)} y2={20 + 15 * Math.sin(a * Math.PI / 180)}
          stroke={palette.honey} strokeWidth="1.4" strokeLinecap="round" opacity="0.7" />
      ))}
      <path d="M40 84 C 40 60, 34 48, 26 42 M40 84 C 40 62, 46 50, 54 44 M40 84 C 40 70, 40 60, 40 50" stroke={palette.forest} strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <ellipse cx="24" cy="40" rx="9" ry="12" fill={palette.sage} transform="rotate(-30 24 40)" />
      <ellipse cx="56" cy="42" rx="9" ry="12" fill={palette.forest} transform="rotate(28 56 42)" />
      <ellipse cx="40" cy="36" rx="7" ry="10" fill={palette.sage} />
      <path d="M12 84 C 22 80, 32 80, 42 84 C 52 88, 62 88, 72 84" stroke={palette.navy} strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.55" />
      <path d="M10 88 C 20 84, 30 84, 40 88 C 50 92, 60 92, 70 88" stroke={palette.navy} strokeWidth="1.4" fill="none" strokeLinecap="round" opacity="0.35" />
      <circle cx="82" cy="72" r="3" fill={palette.clay} />
      <circle cx="92" cy="78" r="2.4" fill={palette.honey} />
    </Frame>
  );
}

// ---------- Language ----------
export function IllLanguage(p: IllProps) {
  return (
    <Frame {...p} label="Language illustration: open book, speech bubble and letters">
      <rect x="0" y="0" width="120" height="90" fill={palette.ivory} />
      <path d="M28 46 C 36 41, 44 41, 50 45 L50 72 C 44 68, 36 68, 28 72 Z" fill={palette.cream} stroke={palette.forest} strokeWidth="1.6" />
      <path d="M72 46 C 64 41, 56 41, 50 45 L50 72 C 56 68, 64 68, 72 72 Z" fill={palette.cream} stroke={palette.forest} strokeWidth="1.6" />
      {[50, 55, 60, 65].map(y => (
        <g key={y}>
          <line x1="33" y1={y} x2="45" y2={y - 2} stroke={palette.line} strokeWidth="1" />
          <line x1="55" y1={y - 2} x2="67" y2={y} stroke={palette.line} strokeWidth="1" />
        </g>
      ))}
      <path d="M84 20 h22 a5 5 0 0 1 5 5 v10 a5 5 0 0 1 -5 5 h-12 l-6 6 v-6 h-4 a5 5 0 0 1 -5 -5 v-10 a5 5 0 0 1 5 -5 Z" fill={palette.sage} />
      <circle cx="88" cy="30" r="1.8" fill={palette.ivory} />
      <circle cx="94" cy="30" r="1.8" fill={palette.ivory} />
      <circle cx="100" cy="30" r="1.8" fill={palette.ivory} />
      <text x="26" y="32" fontSize="13" fill={palette.clay} fontFamily="Fraunces, serif" fontWeight="700">A</text>
      <text x="38" y="24" fontSize="10" fill={palette.honey} fontFamily="Fraunces, serif" fontWeight="700">अ</text>
      <text x="48" y="34" fontSize="9" fill={palette.navy} fontFamily="Fraunces, serif" fontWeight="700">क</text>
    </Frame>
  );
}

// ---------- Science ----------
export function IllScience(p: IllProps) {
  return (
    <Frame {...p} label="Science illustration: flask, magnifier and planet">
      <rect x="0" y="0" width="120" height="90" fill={palette.ivory} />
      <path d="M34 20 h14 v14 l12 30 a6 6 0 0 1 -5.5 8 h-27 a6 6 0 0 1 -5.5 -8 l12 -30 Z" fill="none" stroke={palette.forest} strokeWidth="2" strokeLinejoin="round" />
      <path d="M27 62 l30 0 l-4 10 a5 5 0 0 1 -4.6 3.2 h-12.8 a5 5 0 0 1 -4.6 -3.2 Z" fill={palette.sage} opacity="0.85" />
      <circle cx="38" cy="58" r="2" fill={palette.ivory} />
      <circle cx="46" cy="54" r="1.6" fill={palette.ivory} />
      <circle cx="42" cy="64" r="1.3" fill={palette.ivory} />
      <line x1="34" y1="20" x2="48" y2="20" stroke={palette.honey} strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="84" cy="46" r="13" fill="none" stroke={palette.clay} strokeWidth="2.6" />
      <line x1="93" y1="55" x2="104" y2="66" stroke={palette.clay} strokeWidth="4" strokeLinecap="round" />
      <circle cx="78" cy="18" r="7" fill={palette.navy} />
      <ellipse cx="78" cy="18" rx="11" ry="3" fill="none" stroke={palette.honey} strokeWidth="1.4" transform="rotate(-18 78 18)" />
      <path d="M14 76 l6 6 M20 76 l-6 6" stroke={palette.forest} strokeWidth="1.6" strokeLinecap="round" />
    </Frame>
  );
}

// ---------- Resources / stationery ----------
export function IllResources(p: IllProps) {
  return (
    <Frame {...p} label="Resources illustration: notebooks and flashcards">
      <rect x="0" y="0" width="120" height="90" fill={palette.ivory} />
      <rect x="20" y="24" width="34" height="44" rx="3" fill={palette.cream} stroke={palette.line} />
      <line x1="26" y1="24" x2="26" y2="68" stroke={palette.sage} strokeWidth="3" />
      {[34, 42, 50, 58, 66].map(y => <line key={y} x1="32" y1={y} x2="49" y2={y} stroke={palette.line} strokeWidth="1" />)}
      <rect x="58" y="30" width="30" height="20" rx="2" fill={palette.sage} transform="rotate(-8 73 40)" />
      <rect x="62" y="34" width="30" height="20" rx="2" fill={palette.honey} transform="rotate(4 77 44)" />
      <circle cx="77" cy="40" r="3.4" fill={palette.ivory} />
      <rect x="94" y="22" width="14" height="34" rx="2" fill={palette.forest} />
      <rect x="97" y="26" width="8" height="6" rx="1" fill={palette.ivory} opacity="0.7" />
      <path d="M50 72 l6 4 M56 72 l-6 4" stroke={palette.clay} strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="30" cy="78" r="2.4" fill={palette.honey} />
      <circle cx="42" cy="80" r="1.8" fill={palette.clay} />
    </Frame>
  );
}

// ---------- Training ----------
export function IllTraining(p: IllProps) {
  return (
    <Frame {...p} label="Training illustration: learning path and badge">
      <rect x="0" y="0" width="120" height="90" fill={palette.ivory} />
      <path d="M16 70 C 34 70, 30 40, 48 40 C 66 40, 62 78, 84 62 C 96 53, 98 44, 104 36" fill="none" stroke={palette.sage} strokeWidth="3" strokeLinecap="round" strokeDasharray="1 7" />
      <circle cx="16" cy="70" r="5" fill={palette.forest} />
      <circle cx="48" cy="40" r="5" fill={palette.honey} />
      <circle cx="84" cy="62" r="5" fill={palette.clay} />
      <circle cx="104" cy="36" r="7" fill={palette.forest} />
      <path d="M101 36 l2.4 2.4 l4.2 -4.4" stroke={palette.ivory} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M92 14 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0" fill="none" />
      <circle cx="100" cy="14" r="8" fill={palette.honey} />
      <path d="M96.5 14 l2.6 2.6 l4.6 -5" stroke={palette.ivory} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M96 20 l-2 8 l6 -3 l6 3 l-2 -8" fill={palette.honey} />
    </Frame>
  );
}

// ---------- Community ----------
export function IllCommunity(p: IllProps) {
  return (
    <Frame {...p} label="Community illustration: overlapping speech bubbles">
      <rect x="0" y="0" width="120" height="90" fill={palette.ivory} />
      <path d="M18 22 h34 a6 6 0 0 1 6 6 v14 a6 6 0 0 1 -6 6 h-18 l-7 7 v-7 h-9 a6 6 0 0 1 -6 -6 v-14 a6 6 0 0 1 6 -6 Z" fill={palette.sage} />
      <path d="M56 46 h38 a6 6 0 0 1 6 6 v12 a6 6 0 0 1 -6 6 h-10 l-7 6 v-6 h-21 a6 6 0 0 1 -6 -6 v-12 a6 6 0 0 1 6 -6 Z" fill={palette.honey} />
      <circle cx="30" cy="34" r="2" fill={palette.ivory} />
      <circle cx="37" cy="34" r="2" fill={palette.ivory} />
      <circle cx="44" cy="34" r="2" fill={palette.ivory} />
      <circle cx="70" cy="58" r="2" fill={palette.ivory} />
      <circle cx="77" cy="58" r="2" fill={palette.ivory} />
      <circle cx="84" cy="58" r="2" fill={palette.ivory} />
      <circle cx="26" cy="70" r="3" fill={palette.clay} />
      <circle cx="38" cy="74" r="2.4" fill={palette.forest} />
      <circle cx="48" cy="71" r="1.8" fill={palette.honey} />
    </Frame>
  );
}

// ---------- Hero (landing) ----------
export function IllHero(p: IllProps) {
  return (
    <Frame {...p} label="THRIVE hero illustration: open book growing a leaf with a lesson timeline"
      ratio={16 / 10}>
      <rect x="0" y="0" width="120" height="75" fill={palette.ivory} />
      <circle cx="98" cy="16" r="9" fill={palette.honey} opacity="0.9" />
      <path d="M44 42 C 38 37, 31 36.5, 25 38 L25 50 C 31 48.5, 38 49, 44 53 C 50 49, 57 48.5, 63 50 L63 38 C 57 36.5, 50 37, 44 42 Z" fill={palette.forest} />
      <path d="M44 42 L44 53" stroke={palette.ivory} strokeWidth="1.4" strokeLinecap="round" opacity="0.85" />
      <path d="M44 41 C 42 34, 38.5 28.5, 32.5 26 C 32.8 33.5, 36.5 38.5, 44 41 Z" fill={palette.sage} />
      <path d="M44 41 C 46 34, 50 28, 55.5 26 C 55 33.5, 51.5 38.5, 44 41 Z" fill={palette.honey} />
      <circle cx="44" cy="41" r="2" fill={palette.ivory} />
      {/* timeline chips */}
      <g>
        <rect x="72" y="28" width="38" height="9" rx="4.5" fill={palette.cream} stroke={palette.line} />
        <circle cx="77" cy="32.5" r="2.4" fill={palette.sage} />
        <line x1="82" y1="32.5" x2="106" y2="32.5" stroke={palette.line} strokeWidth="1.4" />
        <rect x="72" y="42" width="38" height="9" rx="4.5" fill={palette.cream} stroke={palette.line} />
        <circle cx="77" cy="46.5" r="2.4" fill={palette.honey} />
        <line x1="82" y1="46.5" x2="106" y2="46.5" stroke={palette.line} strokeWidth="1.4" />
        <rect x="72" y="56" width="38" height="9" rx="4.5" fill={palette.cream} stroke={palette.line} />
        <circle cx="77" cy="60.5" r="2.4" fill={palette.clay} />
        <line x1="82" y1="60.5" x2="106" y2="60.5" stroke={palette.line} strokeWidth="1.4" />
      </g>
      <circle cx="18" cy="64" r="2.4" fill={palette.clay} />
      <circle cx="30" cy="68" r="1.8" fill={palette.honey} />
      <circle cx="64" cy="68" r="2" fill={palette.sage} />
    </Frame>
  );
}

// ---------- Empty state ----------
export function IllEmpty(p: IllProps) {
  return (
    <Frame {...p} label="Empty state illustration: an open book with a small leaf and a question spark" ratio={1}>
      <rect x="0" y="0" width="120" height="120" fill={palette.ivory} />
      <ellipse cx="60" cy="86" rx="34" ry="5" fill={palette.cream} />
      <path d="M60 58 C 48 50, 35 49.5, 24 53 L24 80 C 35 76.5, 48 77, 60 85 C 72 77, 85 76.5, 96 80 L96 53 C 85 49.5, 72 50, 60 58 Z" fill={palette.cream} stroke={palette.line} strokeWidth="1.4" />
      <path d="M60 58 L60 85" stroke={palette.line} strokeWidth="1.4" />
      <path d="M60 55 C 57 46, 52 39, 44 35.5 C 44.4 45.5, 49.5 51.5, 60 55 Z" fill={palette.sage} />
      <path d="M60 55 C 63 45.5, 68 38.5, 76 35 C 75.5 45.5, 71 51.5, 60 55 Z" fill={palette.honey} />
      <path d="M88 30 l2.2 5.4 l5.8 .6 l-4.3 4 l1.2 5.8 l-4.9 -3 l-4.9 3 l1.2 -5.8 l-4.3 -4 l5.8 -.6 Z" fill={palette.clay} opacity="0.85" />
    </Frame>
  );
}
