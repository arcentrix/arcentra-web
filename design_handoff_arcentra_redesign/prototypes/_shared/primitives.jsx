// Shared utilities & primitives for the Arcentra UI kits.
// Loaded as Babel JSX. Exposes globals to window.

const cn = (...xs) => xs.filter(Boolean).join(" ");

/* ──────────────────────────────────────────────────────────────
   Lucide icon shim — production uses lucide-react. Here we
   inline the small set we actually need so the prototype works
   offline without a CDN fetch. Stroke 1.7, line-cap round.
   ────────────────────────────────────────────────────────────── */
const Icon = ({ d, size = 16, stroke = 1.7, className, viewBox = "0 0 24 24" }) => (
  <svg
    width={size}
    height={size}
    viewBox={viewBox}
    fill="none"
    stroke="currentColor"
    strokeWidth={stroke}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
  </svg>
);

// Each entry is a path-d string (or array of paths). Pulled from lucide-static.
const I = {
  arrowUpRight:  "M7 17 17 7M7 7h10v10",
  arrowRight:    "M5 12h14M12 5l7 7-7 7",
  arrowLeft:     "M19 12H5M12 5l-7 7 7 7",
  github:        ["M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"],
  cloud:         "M17.5 19a4.5 4.5 0 1 0 0-9h-1.8A7 7 0 1 0 5 17.6",
  terminal:      ["m4 17 6-6-6-6", "M12 19h8"],
  check:         "M20 6 9 17l-5-5",
  checkCircle:   ["M22 11.08V12a10 10 0 1 1-5.93-9.14", "m9 11 3 3L22 4"],
  x:             "M18 6 6 18M6 6l12 12",
  xCircle:       ["M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10Z","m15 9-6 6", "m9 9 6 6"],
  alertCircle:   ["M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10Z","M12 8v4","M12 16h.01"],
  play:          "m6 3 14 9-14 9V3Z",
  pause:         ["M6 4h4v16H6zM14 4h4v16h-4z"],
  loader:        "M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83",
  refresh:       ["M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8","M3 3v5h5","M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16","M16 16h5v5"],
  clock:         ["M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10Z","M12 6v6l4 2"],
  zap:           "M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14H4Z",
  trendUp:       ["m22 7-8.5 8.5-5-5L2 17","M16 7h6v6"],
  trendDown:     ["m22 17-8.5-8.5-5 5L2 7","M16 17h6v-6"],
  activity:      "M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.5.5 0 0 1-.96 0L9.24 2.18a.5.5 0 0 0-.96 0l-2.35 8.36A2 2 0 0 1 4 12H2",
  server:        ["M22 7a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2Z", "M22 17a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2Z", "M6 6h.01", "M6 16h.01"],
  serverCog:     ["M5 10H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-1.5","M19 22v-3","M21.5 20.5l-2-1.5","M22.5 17.5l-2.5-.5","M17 17.5l-2.5.5","M17.5 20.5l2-1.5","M14 22a3 3 0 1 1 6 0","M5 14h-1a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h7","M6 6h.01","M6 16h.01"],
  shield:        "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1Z",
  shieldCheck:   ["M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1Z", "m9 12 2 2 4-4"],
  hammer:        ["m15 12-8.373 8.373a1 1 0 1 1-3-3L12 9","m18 15 4-4","m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172V7l-2.26-2.26a6 6 0 0 0-4.202-1.756L9 2.96l.92.82A6.18 6.18 0 0 1 12 8.4V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5"],
  rocket:        ["M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09Z","m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2Z","M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0","M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"],
  bot:           ["M12 8V4H8","M2 14h2","M20 14h2","M15 13v2","M9 13v2","M6 4h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"],
  frame:         ["M22 6H2", "M22 18H2", "M6 2v20", "M18 2v20"],
  layoutDash:    ["M3 3h7v9H3z","M14 3h7v5h-7z","M14 12h7v9h-7z","M3 16h7v5H3z"],
  search:        ["M21 21l-4.34-4.34","M11 17a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z"],
  settings:      ["M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z", "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"],
  gitBranch:     ["M6 3v12","M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z","M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z","M18 9a9 9 0 0 1-9 9"],
  gitCommit:     ["M12 3v6","M12 15v6","M12 12m-3 0a3 3 0 1 0 6 0 3 3 0 1 0-6 0"],
  gitPull:       ["M6 3v12","M18 21V9","M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z","M6 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z","M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"],
  gitMerge:      ["M6 21V9", "M18 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z", "M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z", "M6 9c0 9 12 6 12 12"],
  map:           ["m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z", "M9 3v15", "M15 6v15"],
  code:          ["m16 18 6-6-6-6", "m8 6-6 6 6 6"],
  brain:         "M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 0 0 12 18Zm0 0a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 0 1 12 18Z",
  database:      ["M3 5v14a9 3 0 0 0 18 0V5","M3 12a9 3 0 0 0 18 0","M3 5a9 3 0 1 0 18 0 9 3 0 1 0-18 0"],
  cpu:           ["M3 7h18","M3 17h18","M7 3v18","M17 3v18", "M6 6h12v12H6z"],
  mapPin:        ["M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z","M12 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"],
  scanEye:       ["M3 7V5a2 2 0 0 1 2-2h2","M17 3h2a2 2 0 0 1 2 2v2","M21 17v2a2 2 0 0 1-2 2h-2","M7 21H5a2 2 0 0 1-2-2v-2","M12 8a4 4 0 1 0 4 4","M12 12h.01"],
  boxes:         ["M2.97 12.92A2 2 0 0 0 2 14.63v3.24a2 2 0 0 0 .97 1.71l3 1.8a2 2 0 0 0 2.06 0L12 19v-5l-5-3z","m7 16.5-4.74-2.85","m7 16.5 5-3","M7 16.5v5.17","M12 13.71V19l3.97 2.38a2 2 0 0 0 2.06 0l3-1.8a2 2 0 0 0 .97-1.71v-3.24a2 2 0 0 0-.97-1.71L17 10","m17 16.5-5-3","m17 16.5 4.74-2.85","M17 16.5v5.17","M7.97 4.42A2 2 0 0 0 7 6.13v4.37l5 3 5-3V6.13a2 2 0 0 0-.97-1.71l-3-1.8a2 2 0 0 0-2.06 0l-3 1.8z","M12 8 7.26 5.15","m12 8 4.74-2.85","M12 13.5V8"],
  workflow:      ["M3 3h7v7H3z","M14 14h7v7h-7z","M14 3h7v3a3 3 0 0 1-3 3h-1","M10 14H7a3 3 0 0 0-3 3v3"],
  building:      ["M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z","M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2","M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2","M10 6h4","M10 10h4","M10 14h4","M10 18h4"],
  helpCircle:    ["M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10Z","M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3","M12 17h.01"],
  message:       ["M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"],
  panelLeft:     ["M3 3h18v18H3z","M9 3v18"],
  bell:          ["M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9","M10 21a2 2 0 0 0 4 0"],
  user:          ["M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2","M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z"],
  eye:           ["M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z","M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"],
  copy:          ["M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2","M8 4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2Z"],
  chevronRight:  "m9 6 6 6-6 6",
  plus:          ["M12 5v14", "M5 12h14"],
  more:          ["M12 5a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z", "M12 13a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z", "M12 21a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"],
};

/* ──────────────────────────────────────────────────────────────
   Status dot — colored circle with optional pulse animation.
   ────────────────────────────────────────────────────────────── */
const StatusDot = ({ tone = "ok", pulse, className }) => {
  const map = {
    ok:    "var(--accent-success)",
    info:  "var(--accent-info)",
    warn:  "var(--accent-warn)",
    fail:  "var(--accent-danger)",
    muted: "var(--fg-subtle)",
  };
  return (
    <span
      className={cn(pulse && "pulse-dot", className)}
      style={{
        display: "inline-block",
        width: 6, height: 6, borderRadius: 9999,
        background: map[tone] || map.ok,
        flexShrink: 0,
      }}
      aria-hidden="true"
    />
  );
};

/* ──────────────────────────────────────────────────────────────
   Button — primary inverts canvas; secondary uses border-strong.
   ────────────────────────────────────────────────────────────── */
const Button = (props) => {
  const {
    variant = "primary", size = "md",
    children, leftIcon, rightIcon,
    onClick, type = "button", className,
    disabled, title, "aria-label": ariaLabel,
  } = props;
  const sizes = {
    sm: { h: 32, px: 12, fz: 13, r: 8 },
    md: { h: 36, px: 16, fz: 14, r: 8 },
    lg: { h: 44, px: 20, fz: 14, r: 10 },
  }[size] || { h: 36, px: 16, fz: 14, r: 8 };

  const styles = {
    primary: {
      background: "var(--accent-bg)",
      color: "var(--accent-fg)",
      border: "1px solid transparent",
    },
    secondary: {
      background: "transparent",
      color: "var(--fg)",
      border: "1px solid var(--border-strong)",
    },
    ghost: {
      background: "transparent",
      color: "var(--fg)",
      border: "1px solid transparent",
    },
    outline: {
      background: "transparent",
      color: "var(--fg)",
      border: "1px solid var(--border)",
    },
  }[variant];

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      className={cn("ars-btn", className)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        height: sizes.h,
        padding: `0 ${sizes.px}px`,
        borderRadius: sizes.r,
        fontFamily: "var(--font-sans)",
        fontWeight: 500,
        fontSize: sizes.fz,
        cursor: "pointer",
        transition: "background-color var(--duration-2) var(--easing-out), color var(--duration-2) var(--easing-out)",
        ...styles,
      }}
    >
      {leftIcon}
      <span>{children}</span>
      {rightIcon}
    </button>
  );
};

/* ──────────────────────────────────────────────────────────────
   Badge — outline (default), solid (accent), or status (colored).
   ────────────────────────────────────────────────────────────── */
const Badge = ({ variant = "outline", tone, children, className }) => {
  const toneMap = {
    success: ["oklch(0.696 0.17 162.48)", "color-mix(in oklab, oklch(0.696 0.17 162.48) 12%, var(--bg))"],
    info:    ["oklch(0.7 0.14 220)",      "color-mix(in oklab, oklch(0.7 0.14 220)    12%, var(--bg))"],
    warn:    ["oklch(0.8 0.18 84)",       "color-mix(in oklab, oklch(0.8 0.18 84)     12%, var(--bg))"],
    danger:  ["oklch(0.645 0.246 16.4)",  "color-mix(in oklab, oklch(0.645 0.246 16.4) 12%, var(--bg))"],
  };
  if (tone && toneMap[tone]) {
    const [fg, bg] = toneMap[tone];
    return (
      <span className={cn(className)} style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        height: 22, padding: "0 10px", borderRadius: 6,
        background: bg, color: fg,
        border: `1px solid color-mix(in oklab, ${fg} 32%, transparent)`,
        fontSize: 11.5, fontWeight: 600, fontFamily: "var(--font-sans)",
        letterSpacing: 0,
      }}>{children}</span>
    );
  }
  const styles = {
    outline: {
      border: "1px solid var(--border)", background: "transparent", color: "var(--fg-muted)",
    },
    solid: {
      border: "1px solid transparent", background: "var(--accent-bg)", color: "var(--accent-fg)",
    },
    secondary: {
      border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--fg-muted)",
    },
  }[variant];
  return (
    <span className={cn(className)} style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      height: 22, padding: "0 10px", borderRadius: 9999,
      fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 500,
      ...styles,
    }}>{children}</span>
  );
};

/* ──────────────────────────────────────────────────────────────
   GridBg — dot-grid background, used in heroes & CTAs.
   ────────────────────────────────────────────────────────────── */
const GridBg = ({ fade = "radial", className, style }) => (
  <div
    aria-hidden="true"
    className={cn("grid-bg", fade === "radial" && "fade-mask-radial", fade === "y" && "fade-mask-y", className)}
    style={{ position: "absolute", inset: 0, pointerEvents: "none", ...style }}
  />
);

/* ──────────────────────────────────────────────────────────────
   Eyebrow — the brand's signature uppercase mono caption.
   Pass `arrow` to prepend the signal-colored ▸ glyph that
   appears throughout the engineering-blueprint motif.
   ────────────────────────────────────────────────────────────── */
const Eyebrow = ({ children, arrow = true, className, style }) => (
  <div className={cn("eyebrow", arrow && "eyebrow-arrow", className)} style={{
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--fg-subtle)",
    ...style,
  }}>{children}</div>
);

/* ──────────────────────────────────────────────────────────────
   LogoLockup — icon + signature wordmark. The icon is rendered
   as a CSS mask so it tints from --fg automatically (no inversion
   filter needed — works in both light and dark themes). The
   wordmark is set in Geist Mono, lowercase, with a brand-signal
   "/" at the end — like a CLI command or namespace prefix.
   ────────────────────────────────────────────────────────────── */
const LogoLockup = ({ size = 20, gap = 10, className, withText = true }) => {
  const wordmarkSize = Math.round(size * 0.85);
  return (
    <span className={cn(className)} style={{ display: "inline-flex", alignItems: "center", gap }}>
      <span aria-hidden="true" style={{
        display: "inline-block",
        width: size, height: size,
        backgroundColor: "var(--fg)",
        WebkitMaskImage: "url(../../assets/logo-icon.svg)",
        maskImage: "url(../../assets/logo-icon.svg)",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskPosition: "center",
        maskPosition: "center",
      }} />
      {withText && (
        <span style={{
          fontFamily: "var(--font-mono)",
          fontSize: wordmarkSize,
          fontWeight: 500,
          letterSpacing: "-0.02em",
          lineHeight: 1,
          color: "var(--fg)",
        }}>
          arcentra<span style={{
            color: "var(--brand-signal)",
            fontWeight: 500,
          }}>/</span>
        </span>
      )}
    </span>
  );
};

/* ──────────────────────────────────────────────────────────────
   Wordmark-only variant — for places where the icon is already
   carried elsewhere (e.g. compact navs, footers).
   ────────────────────────────────────────────────────────────── */
const Wordmark = ({ size = 16, className }) => (
  <span className={cn(className)} style={{
    fontFamily: "var(--font-mono)",
    fontSize: size,
    fontWeight: 500,
    letterSpacing: "-0.02em",
    lineHeight: 1,
    color: "var(--fg)",
  }}>
    arcentra<span style={{ color: "var(--brand-signal)" }}>/</span>
  </span>
);

Object.assign(window, { cn, Icon, I, StatusDot, Button, Badge, GridBg, Eyebrow, LogoLockup, Wordmark });

