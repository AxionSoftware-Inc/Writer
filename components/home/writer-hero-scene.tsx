export function WriterHeroScene() {
  return (
    <div className="relative min-h-[390px] w-full overflow-hidden sm:min-h-[460px] lg:min-h-[550px]" aria-hidden="true">
      <style>{`
        @keyframes ax-writer-page-a { 0%,100% { transform: translate3d(0,0,0) rotate(-5deg); } 50% { transform: translate3d(0,-7px,0) rotate(-3.8deg); } }
        @keyframes ax-writer-page-b { 0%,100% { transform: translate3d(0,0,0) rotate(7deg); } 50% { transform: translate3d(0,8px,0) rotate(5.5deg); } }
        @keyframes ax-writer-drift { 0%,100% { transform: translate3d(0,0,0); } 50% { transform: translate3d(7px,-4px,0); } }
        @media (prefers-reduced-motion: reduce) { .ax-writer-a,.ax-writer-b,.ax-writer-drift { animation:none !important; } }
      `}</style>

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_58%_47%,rgba(75,142,232,0.11),transparent_31%),radial-gradient(circle_at_78%_36%,rgba(132,101,229,0.05),transparent_26%)]" />

      <svg viewBox="0 0 760 520" className="absolute inset-0 h-full w-full" role="presentation">
        <defs>
          <linearGradient id="writer-paper-a" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.98" />
            <stop offset="1" stopColor="#f5f8fd" stopOpacity="0.9" />
          </linearGradient>
          <linearGradient id="writer-paper-b" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f8fbff" stopOpacity="0.9" />
            <stop offset="1" stopColor="#eeeaff" stopOpacity="0.72" />
          </linearGradient>
          <filter id="writer-shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="20" stdDeviation="22" floodColor="#1f3e70" floodOpacity="0.09" />
          </filter>
        </defs>

        <g fill="none" stroke="#809fd2" strokeWidth="1" opacity="0.18">
          <ellipse cx="430" cy="266" rx="245" ry="76" transform="rotate(-13 430 266)" strokeDasharray="6 10" />
          <ellipse cx="430" cy="270" rx="185" ry="122" transform="rotate(27 430 270)" strokeDasharray="5 11" />
        </g>

        <g className="ax-writer-b" style={{ animation: "ax-writer-page-b 12s ease-in-out infinite", transformOrigin: "500px 270px" }} opacity="0.82">
          <path d="M430 118 L646 151 L615 380 L400 345 Z" fill="url(#writer-paper-b)" stroke="#dfe5ee" />
          <path d="M466 188 H590" stroke="#8293ae" strokeWidth="4" opacity="0.18" strokeLinecap="round" />
          <path d="M466 211 H575" stroke="#8293ae" strokeWidth="3" opacity="0.16" strokeLinecap="round" />
          <path d="M466 234 H598" stroke="#8293ae" strokeWidth="3" opacity="0.16" strokeLinecap="round" />
          <path d="M466 257 H560" stroke="#8293ae" strokeWidth="3" opacity="0.14" strokeLinecap="round" />
          <path d="M470 313 C500 286 531 286 559 312 C588 338 608 331 624 315" fill="none" stroke="#3573c6" strokeWidth="2.2" />
        </g>

        <g className="ax-writer-a" style={{ animation: "ax-writer-page-a 9.5s ease-in-out infinite", transformOrigin: "392px 267px" }} filter="url(#writer-shadow)">
          <path d="M230 106 L526 92 L558 399 L265 415 Z" fill="url(#writer-paper-a)" stroke="#dce4ef" strokeWidth="1.2" />
          <text x="295" y="160" fill="#1c2739" fontSize="27" fontFamily="Georgia, serif">Diffusion in bounded media</text>
          <text x="296" y="185" fill="#8190a5" fontSize="10" fontFamily="system-ui">A. Researcher · Axion Science Project</text>
          <path d="M296 221 H500" stroke="#92a0b4" strokeWidth="3.5" opacity="0.2" strokeLinecap="round" />
          <path d="M296 244 H474" stroke="#92a0b4" strokeWidth="3.5" opacity="0.17" strokeLinecap="round" />
          <text x="326" y="294" fill="#18243a" fontSize="23" fontFamily="Georgia, serif">u(x,t) = e⁻ᵅᵗ sin(x)</text>
          <path d="M304 346 H500" stroke="#d8e0ea" strokeWidth="1" />
          <path d="M316 350 C344 322 374 321 402 349 C431 378 462 377 493 347" fill="none" stroke="#2f70c1" strokeWidth="2.4" />
        </g>

        <g className="ax-writer-drift" style={{ animation: "ax-writer-drift 8.5s ease-in-out infinite" }}>
          <circle cx="198" cy="213" r="4.5" fill="#4d97da" opacity="0.48" />
          <circle cx="645" cy="132" r="4" fill="#7a83db" opacity="0.38" />
          <circle cx="662" cy="358" r="5" fill="#63b7d3" opacity="0.38" />
          <text x="166" y="157" fill="#758bb4" fontSize="15" fontFamily="Georgia, serif" fontStyle="italic" opacity="0.52">figure 4 · linked result</text>
          <text x="590" y="431" fill="#758bb4" fontSize="15" fontFamily="Georgia, serif" fontStyle="italic" opacity="0.46">source → evidence → paper</text>
        </g>
      </svg>

      <div className="absolute inset-y-0 left-0 w-[18%] bg-gradient-to-r from-[var(--ax-canvas)] to-transparent" />
    </div>
  );
}
