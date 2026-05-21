// Shared character used across landing + app
// Cute octopus mascot with 8 animated tentacles.

export function Mascot({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 150"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Head */}
      <ellipse cx="60" cy="50" rx="42" ry="38" fill="#FFB199" />
      <ellipse cx="60" cy="50" rx="42" ry="38" stroke="#1a1a1a" strokeWidth="3" />

      {/* 8 tentacles — each with a different wave delay */}
      <path className="tentacle tentacle-1" d="M18 70 Q10 95 20 118 Q26 106 24 88"  fill="#FFB199" stroke="#1a1a1a" strokeWidth="2.5" strokeLinejoin="round" />
      <path className="tentacle tentacle-2" d="M30 78 Q24 105 32 125 Q38 112 34 95" fill="#FFB199" stroke="#1a1a1a" strokeWidth="2.5" strokeLinejoin="round" />
      <path className="tentacle tentacle-3" d="M42 84 Q38 112 46 132 Q52 118 48 98" fill="#FFB199" stroke="#1a1a1a" strokeWidth="2.5" strokeLinejoin="round" />
      <path className="tentacle tentacle-4" d="M54 86 Q52 115 58 135 Q64 120 60 100" fill="#FFB199" stroke="#1a1a1a" strokeWidth="2.5" strokeLinejoin="round" />
      <path className="tentacle tentacle-5" d="M66 86 Q68 115 62 135 Q56 120 60 100" fill="#FFB199" stroke="#1a1a1a" strokeWidth="2.5" strokeLinejoin="round" />
      <path className="tentacle tentacle-6" d="M78 84 Q82 112 74 132 Q68 118 72 98" fill="#FFB199" stroke="#1a1a1a" strokeWidth="2.5" strokeLinejoin="round" />
      <path className="tentacle tentacle-7" d="M90 78 Q96 105 88 125 Q82 112 86 95" fill="#FFB199" stroke="#1a1a1a" strokeWidth="2.5" strokeLinejoin="round" />
      <path className="tentacle tentacle-8" d="M102 70 Q110 95 100 118 Q94 106 96 88" fill="#FFB199" stroke="#1a1a1a" strokeWidth="2.5" strokeLinejoin="round" />

      {/* Eyes with blink */}
      <g className="mascot-blink" style={{ transformOrigin: '45px 46px' }}>
        <circle cx="45" cy="46" r="6" fill="#fff" stroke="#1a1a1a" strokeWidth="2.5" />
        <circle cx="45" cy="47" r="2.5" fill="#1a1a1a" />
      </g>
      <g className="mascot-blink" style={{ transformOrigin: '75px 46px' }}>
        <circle cx="75" cy="46" r="6" fill="#fff" stroke="#1a1a1a" strokeWidth="2.5" />
        <circle cx="75" cy="47" r="2.5" fill="#1a1a1a" />
      </g>

      {/* Smile */}
      <path d="M50 62 Q60 69 72 62" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" fill="none" />

      {/* Blush */}
      <circle cx="36" cy="58" r="3" fill="#FF6B6B" opacity="0.5" />
      <circle cx="84" cy="58" r="3" fill="#FF6B6B" opacity="0.5" />
    </svg>
  )
}

export function ThoughtBubble({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 80"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <ellipse cx="50" cy="35" rx="42" ry="25" fill="#fff" stroke="#1a1a1a" strokeWidth="3" />
      <circle cx="22" cy="65" r="6"   fill="#fff" stroke="#1a1a1a" strokeWidth="2.5" />
      <circle cx="14" cy="74" r="3.5" fill="#fff" stroke="#1a1a1a" strokeWidth="2" />
      <text x="50" y="42" textAnchor="middle" fontSize="13" fontWeight="800" fill="#1a1a1a" fontFamily="ui-sans-serif, system-ui, sans-serif">
        thinking…
      </text>
    </svg>
  )
}
