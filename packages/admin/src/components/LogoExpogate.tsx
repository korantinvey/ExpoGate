interface Props { height?: number }

export function LogoExpogate({ height = 44 }: Props) {
  // 90° angle at peak: half-width = height of chevron
  // height = 30px → half-width = 30px → full width = 60px per chevron
  return (
    <svg width="100%" height={height} viewBox="0 0 220 46" preserveAspectRatio="xMidYMid meet" style={{ display: 'block' }}>
      <defs>
        <linearGradient id="grad1" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#1D9E75"/>
          <stop offset="100%" stopColor="#5DCAA5"/>
        </linearGradient>
        <linearGradient id="grad2" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#0F6E56"/>
          <stop offset="100%" stopColor="#1D9E75"/>
        </linearGradient>
      </defs>
      {/* Chevron gauche — angle 90° : half-width == height (30px) */}
      <polyline
        points="4,43 28,7 52,43"
        fill="none" stroke="url(#grad1)" strokeWidth="5"
        strokeLinecap="round" strokeLinejoin="round"
      />
      {/* Chevron droit décalé — même proportions */}
      <polyline
        points="28,43 52,7 76,43"
        fill="none" stroke="url(#grad2)" strokeWidth="5"
        strokeLinecap="round" strokeLinejoin="round"
      />
      <text x="92" y="32" fontFamily="system-ui, sans-serif" fontWeight="800" fontSize="22" letterSpacing="1">
        <tspan fill="var(--text)">Expo</tspan><tspan fill="url(#grad2)">Gate</tspan>
      </text>
    </svg>
  )
}
