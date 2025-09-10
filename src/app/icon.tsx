import { ImageResponse } from "next/og";

// App icon: 64×64 PNG for broad compatibility
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

// A creative, gem-like favicon with subtle sparkle.
// Built as SVG within ImageResponse for crisp edges at any scale.
export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0b1220", // deep canvas for contrast
        borderRadius: 12, // softened outer corners
      }}
    >
      <svg
        width="56"
        height="56"
        viewBox="0 0 64 64"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Gemini icon"
      >
        <defs>
          <linearGradient id="bgGlow" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="50%" stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#f0abfc" />
          </linearGradient>
          <linearGradient id="gemGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#67e8f9" />
            <stop offset="100%" stopColor="#c084fc" />
          </linearGradient>
          <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Rounded gradient tile with inner glow */}
        <rect x="4" y="4" width="56" height="56" rx="14" fill="#0f172a" />
        <rect
          x="6"
          y="6"
          width="52"
          height="52"
          rx="12"
          fill="url(#bgGlow)"
          opacity="0.18"
          filter="url(#softGlow)"
        />

        {/* Gem (diamond) */}
        <g transform="translate(0,2)">
          <polygon
            points="32,14 46,28 32,50 18,28"
            fill="url(#gemGrad)"
            stroke="#ffffff"
            strokeOpacity="0.7"
            strokeWidth="1.25"
          />
          {/* Facets */}
          <polyline
            points="32,14 32,50"
            stroke="#ffffff"
            strokeOpacity="0.5"
            strokeWidth="1"
          />
          <polyline
            points="18,28 46,28"
            stroke="#ffffff"
            strokeOpacity="0.5"
            strokeWidth="1"
          />
          <polyline
            points="24,28 32,40 40,28"
            stroke="#ffffff"
            strokeOpacity="0.5"
            strokeWidth="1"
            fill="none"
          />
        </g>

        {/* Sparkle */}
        <g transform="translate(46,14) scale(0.9)">
          <path
            d="M6 0 L7.5 4.5 L12 6 L7.5 7.5 L6 12 L4.5 7.5 L0 6 L4.5 4.5 Z"
            fill="#ffffff"
            opacity="0.85"
          />
        </g>
      </svg>
    </div>,
    { ...size },
  );
}
