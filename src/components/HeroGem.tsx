// Lightweight CSS/SVG fallback used when the raster amethyst artwork is unavailable.

interface HeroGemProps {
  size?: number;
  glowColor?: string;
}

const BLOB_PATH =
  'M74 2C118 2 146 44 144 92C142 140 104 178 72 178C40 178 4 138 2 92C0 44 30 2 74 2Z';

export function HeroGem({ size = 150, glowColor = '#5FE0C8' }: HeroGemProps) {
  const width = size;
  const height = size * 1.19;

  return (
    <div
      style={{
        position: 'relative',
        width,
        height: height + 26,
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: -width * 0.35,
          left: '50%',
          transform: 'translateX(-50%)',
          width: width * 2.1,
          height: width * 2.1,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${glowColor}55 0%, ${glowColor}22 40%, transparent 72%)`,
          filter: 'blur(22px)',
          pointerEvents: 'none',
        }}
      />

      <svg
        width={width}
        height={height}
        viewBox="0 0 146 180"
        style={{ position: 'relative', filter: `drop-shadow(0 0 26px ${glowColor}aa)` }}
      >
        <defs>
          <clipPath id="gemClip">
            <path d={BLOB_PATH} />
          </clipPath>
          <radialGradient id="gemBase" cx="38%" cy="28%" r="80%">
            <stop offset="0%" stopColor="#2a3a42" />
            <stop offset="55%" stopColor="#0f1a1e" />
            <stop offset="100%" stopColor="#020506" />
          </radialGradient>
          <filter id="gemBlur" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="9" />
          </filter>
          <radialGradient id="rimLight" cx="50%" cy="50%" r="52%">
            <stop offset="80%" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="97%" stopColor="#eafff8" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#eafff8" stopOpacity="0" />
          </radialGradient>
        </defs>

        <g clipPath="url(#gemClip)">
          <rect width="146" height="180" fill="url(#gemBase)" />
          <g filter="url(#gemBlur)">
            <ellipse cx="48" cy="50" rx="38" ry="42" fill="#5fe8d4" opacity="0.85" />
            <ellipse cx="98" cy="68" rx="34" ry="40" fill="#5b9dfb" opacity="0.7" />
            <ellipse cx="66" cy="128" rx="40" ry="36" fill="#e8c96a" opacity="0.55" />
            <ellipse cx="58" cy="98" rx="26" ry="30" fill="#8ff2e0" opacity="0.5" />
            <ellipse cx="100" cy="130" rx="24" ry="26" fill="#c98cf0" opacity="0.35" />
          </g>
          <ellipse cx="40" cy="38" rx="16" ry="20" fill="#ffffff" opacity="0.5" filter="url(#gemBlur)" />
          <path
            d="M26 24 C34 16 46 14 54 18 L44 48 C36 46 28 40 24 32 Z"
            fill="#ffffff"
            opacity="0.28"
          />
          <path d={BLOB_PATH} fill="url(#rimLight)" />
        </g>
        <path d={BLOB_PATH} fill="none" stroke="#ffffff" strokeOpacity="0.12" strokeWidth="1" />
      </svg>

      <div
        style={{
          position: 'absolute',
          bottom: 4,
          left: '50%',
          transform: 'translateX(-50%)',
          width: width * 0.4,
          height: 10,
          borderRadius: '50%',
          background: 'radial-gradient(ellipse, #2b2b2b 0%, #050505 75%, transparent 100%)',
        }}
      />
    </div>
  );
}
