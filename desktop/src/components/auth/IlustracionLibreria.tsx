export function IlustracionLibreria() {
  return (
    <svg viewBox="0 0 800 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="cielo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#312e81" />
          <stop offset="45%" stopColor="#4f46e5" />
          <stop offset="75%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#d946ef" />
        </linearGradient>
        <linearGradient id="piso" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1e1b4b" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
        <linearGradient id="estante" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6b4a2f" />
          <stop offset="100%" stopColor="#4a301f" />
        </linearGradient>
        <radialGradient id="luz" cx="0.5" cy="0.35" r="0.65">
          <stop offset="0%" stopColor="#fde68a" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#fde68a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="libro1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f472b6" />
          <stop offset="100%" stopColor="#be185d" />
        </linearGradient>
        <linearGradient id="libro2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
        <linearGradient id="libro3" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#047857" />
        </linearGradient>
        <linearGradient id="libro4" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#b45309" />
        </linearGradient>
        <filter id="sombra" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#000" floodOpacity="0.35" />
        </filter>
      </defs>

      <rect width="800" height="900" fill="url(#cielo)" />
      <rect width="800" height="900" fill="url(#luz)" />

      <circle cx="600" cy="150" r="56" fill="#fef3c7" opacity="0.9" />
      <circle cx="600" cy="150" r="80" fill="#fef3c7" opacity="0.18" />

      <g opacity="0.16">
        <ellipse cx="180" cy="120" rx="90" ry="22" fill="#fff" />
        <ellipse cx="340" cy="190" rx="60" ry="14" fill="#fff" />
        <ellipse cx="520" cy="90" rx="45" ry="10" fill="#fff" />
      </g>

      <path d="M0 620 Q 200 560 400 600 T 800 590 L 800 900 L 0 900 Z" fill="url(#piso)" />

      <g filter="url(#sombra)">
        <rect x="70" y="330" width="660" height="34" rx="8" fill="url(#estante)" />
        <rect x="70" y="540" width="660" height="34" rx="8" fill="url(#estante)" />

        <rect x="76" y="196" width="20" height="134" rx="5" fill="#4a301f" />
        <rect x="700" y="196" width="20" height="134" rx="5" fill="#4a301f" />
        <rect x="76" y="404" width="20" height="136" rx="5" fill="#4a301f" />
        <rect x="700" y="404" width="20" height="136" rx="5" fill="#4a301f" />
      </g>

      <g>
        <rect x="110" y="238" width="46" height="92" rx="6" fill="url(#libro1)" />
        <rect x="160" y="252" width="40" height="78" rx="5" fill="url(#libro2)" />
        <rect x="204" y="230" width="52" height="100" rx="6" fill="url(#libro3)" />
        <rect x="262" y="246" width="38" height="84" rx="5" fill="#f59e0b" />
        <rect x="306" y="234" width="48" height="96" rx="6" fill="url(#libro1)" />
        <rect x="360" y="254" width="42" height="76" rx="5" fill="url(#libro2)" />
        <rect x="408" y="228" width="54" height="102" rx="6" fill="url(#libro4)" />
        <rect x="470" y="248" width="36" height="82" rx="5" fill="#a78bfa" />
        <rect x="512" y="240" width="46" height="90" rx="6" fill="url(#libro3)" />
        <rect x="564" y="258" width="40" height="72" rx="5" fill="#f472b6" />
        <rect x="610" y="232" width="50" height="98" rx="6" fill="url(#libro2)" />

        <rect x="110" y="448" width="44" height="92" rx="6" fill="url(#libro4)" />
        <rect x="158" y="438" width="50" height="102" rx="6" fill="url(#libro1)" />
        <rect x="214" y="456" width="38" height="84" rx="5" fill="#38bdf8" />
        <rect x="258" y="442" width="46" height="98" rx="6" fill="url(#libro3)" />
        <rect x="310" y="460" width="42" height="80" rx="5" fill="url(#libro2)" />
        <rect x="358" y="434" width="54" height="106" rx="6" fill="#fbbf24" />
        <rect x="418" y="452" width="38" height="88" rx="5" fill="url(#libro1)" />
        <rect x="462" y="446" width="46" height="94" rx="6" fill="url(#libro2)" />
        <rect x="514" y="462" width="40" height="78" rx="5" fill="#34d399" />
        <rect x="560" y="440" width="50" height="100" rx="6" fill="url(#libro4)" />
        <rect x="616" y="454" width="44" height="86" rx="6" fill="#a78bfa" />
      </g>

      <g opacity="0.95">
        <rect x="120" y="262" width="26" height="44" rx="3" fill="#fff" opacity="0.35" />
        <rect x="224" y="254" width="28" height="52" rx="3" fill="#fff" opacity="0.3" />
        <rect x="428" y="250" width="30" height="58" rx="3" fill="#fff" opacity="0.32" />
        <rect x="182" y="470" width="24" height="46" rx="3" fill="#fff" opacity="0.3" />
        <rect x="382" y="466" width="30" height="54" rx="3" fill="#fff" opacity="0.32" />
        <rect x="582" y="472" width="26" height="44" rx="3" fill="#fff" opacity="0.3" />
      </g>

      <g transform="translate(150 640)">
        <rect x="0" y="160" width="470" height="26" rx="7" fill="url(#estante)" />
        <rect x="90" y="40" width="80" height="120" rx="6" fill="url(#libro4)" />
        <rect x="172" y="28" width="66" height="132" rx="6" fill="url(#libro2)" />
        <rect x="240" y="48" width="58" height="112" rx="6" fill="url(#libro1)" />
        <rect x="300" y="34" width="74" height="126" rx="6" fill="url(#libro3)" />
        <rect x="376" y="54" width="54" height="106" rx="6" fill="#a78bfa" />

        <g>
          <path d="M0 78 Q 28 44 58 78 L 48 78 Q 40 62 26 62 Q 12 62 10 78 Z" fill="#22c55e" />
          <path d="M44 88 Q 72 54 102 88 L 92 88 Q 84 72 70 72 Q 56 72 54 88 Z" fill="#16a34a" />
          <path d="M0 90 Q 24 62 50 90 Z" fill="#4ade80" />
          <rect x="-6" y="84" width="62" height="10" rx="4" fill="#92400e" />
          <rect x="38" y="94" width="70" height="10" rx="4" fill="#78350f" />
        </g>
      </g>

      <g>
        <rect x="330" y="760" width="140" height="140" rx="16" fill="#1e293b" opacity="0.55" />
        <rect x="338" y="768" width="124" height="124" rx="12" fill="#fef3c7" />
        <circle cx="400" cy="830" r="34" fill="#f59e0b" />
        <rect x="368" y="842" width="64" height="10" rx="5" fill="#78350f" />
        <rect x="380" y="860" width="40" height="10" rx="5" fill="#78350f" />
      </g>
    </svg>
  );
}