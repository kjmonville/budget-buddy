// Budget Buddy logo explorations.
// Six distinct money-bag mark concepts + web lockup + iOS Liquid Glass icon mockups.

// ---------- Color tokens ----------
const C = {
  indigo: "#6366F1",
  indigoDeep: "#4F46E5",
  indigoSoft: "#A5A8F4",
  amber: "#F59E0B",
  mint: "#10B981",
  coral: "#F97757",
  ink: "#0F1115",
  paper: "#FFFFFF",
  smoke: "#F4F4F8",
  border: "#E5E7EB",
  muted: "#6B7280",
};

// ============================================================
// MARKS — each takes `size` and renders a square SVG.
// Designed in a 64×64 grid, scaled via viewBox.
// ============================================================

// 1) Geometric Bag — clean primitives, indigo solid, amber knot accent
const Mark1 = ({ size = 64, accent = C.amber }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
    {/* Body — circle */}
    <circle cx="32" cy="38" r="20" fill={C.indigo} />
    {/* Neck trapezoid */}
    <path d="M22 18 L42 18 L38 24 L26 24 Z" fill={C.indigoDeep} />
    {/* Knot accent */}
    <rect x="28" y="14" width="8" height="6" rx="2" fill={accent} />
    {/* Highlight */}
    <circle cx="26" cy="32" r="3" fill={C.paper} opacity="0.25" />
  </svg>
);

// 2) B-bag monogram — bag silhouette doubles as a stylized "B"
const Mark2 = ({ size = 64 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
    <rect width="64" height="64" rx="14" fill={C.indigo} />
    {/* Custom B that reads as bag — vertical spine + two stacked pouches */}
    <path
      d="M20 14 L20 50 L36 50 C44 50 48 46 48 41 C48 37 45 34 41 33.5 C44 33 47 30 47 26 C47 21 43 18 36 18 L20 14 Z M28 22 L36 22 C39 22 40 24 40 26 C40 28 39 30 36 30 L28 30 Z M28 36 L37 36 C40 36 42 38 42 41 C42 44 40 46 37 46 L28 46 Z"
      fill={C.paper}
    />
    {/* Knot */}
    <rect x="22" y="10" width="8" height="6" rx="2" fill={C.amber} />
  </svg>
);

// 3) Knotted bag — focus on the cinch, two-tone
const Mark3 = ({ size = 64 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
    {/* Body — softer rounded shape */}
    <path
      d="M14 38 C14 26 20 20 32 20 C44 20 50 26 50 38 C50 50 44 56 32 56 C20 56 14 50 14 38 Z"
      fill={C.indigo}
    />
    {/* Cinch band */}
    <path d="M20 22 L44 22 L40 28 L24 28 Z" fill={C.indigoDeep} />
    {/* Knot ears */}
    <path d="M24 22 C22 16 26 12 28 16 L28 22 Z" fill={C.amber} />
    <path d="M40 22 C42 16 38 12 36 16 L36 22 Z" fill={C.amber} />
    {/* Tie middle */}
    <rect x="30" y="14" width="4" height="10" rx="2" fill={C.amber} />
  </svg>
);

// 4) Coin-bag hybrid — bag silhouette with coin face inset (no $ — uses BB)
const Mark4 = ({ size = 64 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
    <circle cx="32" cy="38" r="22" fill={C.indigo} />
    {/* Bag neck overlay top */}
    <path d="M20 14 L44 14 L40 22 L24 22 Z" fill={C.indigoDeep} />
    {/* Inset coin */}
    <circle cx="32" cy="38" r="13" fill={C.amber} />
    <circle cx="32" cy="38" r="13" fill="none" stroke={C.indigoDeep} strokeWidth="1.5" strokeDasharray="2 2" opacity="0.5" />
    {/* BB monogram on coin */}
    <text
      x="32" y="43"
      textAnchor="middle"
      fontFamily="'Space Grotesk', sans-serif"
      fontWeight="700"
      fontSize="13"
      fill={C.indigoDeep}
      letterSpacing="-0.5"
    >BB</text>
  </svg>
);

// 5) Bar-stack bag — bag silhouette formed by chart bars (ties to balance chart)
const Mark5 = ({ size = 64 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
    {/* Background tile */}
    <rect width="64" height="64" rx="14" fill={C.indigo} />
    {/* Bag outline as clip */}
    <defs>
      <clipPath id="bagclip5">
        <path d="M16 38 C16 26 22 22 32 22 C42 22 48 26 48 38 C48 50 42 54 32 54 C22 54 16 50 16 38 Z" />
      </clipPath>
    </defs>
    {/* Bars inside bag silhouette */}
    <g clipPath="url(#bagclip5)">
      <rect x="18" y="44" width="4" height="12" fill={C.paper} opacity="0.95" />
      <rect x="24" y="38" width="4" height="18" fill={C.paper} opacity="0.95" />
      <rect x="30" y="30" width="4" height="26" fill={C.amber} />
      <rect x="36" y="36" width="4" height="20" fill={C.paper} opacity="0.95" />
      <rect x="42" y="42" width="4" height="14" fill={C.paper} opacity="0.95" />
    </g>
    {/* Neck */}
    <path d="M22 12 L42 12 L38 20 L26 20 Z" fill={C.paper} />
  </svg>
);

// 6) Negative-space bag — square tile with bag carved out, accent peeking through
const Mark6 = ({ size = 64 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
    <defs>
      <mask id="bagmask6">
        <rect width="64" height="64" fill="white" />
        {/* Bag shape */}
        <path
          d="M14 40 C14 28 20 22 32 22 C44 22 50 28 50 40 C50 52 44 56 32 56 C20 56 14 52 14 40 Z"
          fill="black"
        />
        <path d="M22 14 L42 14 L38 22 L26 22 Z" fill="black" />
      </mask>
    </defs>
    {/* Accent layer behind */}
    <rect width="64" height="64" rx="14" fill={C.amber} />
    {/* Indigo with bag cut out */}
    <rect width="64" height="64" rx="14" fill={C.indigo} mask="url(#bagmask6)" />
  </svg>
);

const MARKS = [
  { id: "geometric", name: "01 · Geometric", component: Mark1 },
  { id: "monogram",  name: "02 · B-bag Monogram", component: Mark2 },
  { id: "knotted",   name: "03 · Knotted", component: Mark3 },
  { id: "coin",      name: "04 · Coin-bag", component: Mark4 },
  { id: "bars",      name: "05 · Bar-stack", component: Mark5 },
  { id: "negative",  name: "06 · Negative Space", component: Mark6 },
];

// ============================================================
// LOCKUP — mark + wordmark
// ============================================================
const Wordmark = ({ size = 28, color = C.indigoDeep }) => (
  <span
    style={{
      fontFamily: "'Space Grotesk', sans-serif",
      fontWeight: 700,
      fontSize: size,
      letterSpacing: "-0.025em",
      color,
      lineHeight: 1,
    }}
  >
    Budget&nbsp;Buddy
  </span>
);

const Lockup = ({ Mark, size = 36, wordSize = 22 }) => (
  <div style={{display: "flex", alignItems: "center", gap: 10}}>
    <Mark size={size} />
    <Wordmark size={wordSize} />
  </div>
);

// ============================================================
// iOS LIQUID GLASS ICON — translucent layered
// ============================================================
const IOSIcon = ({ Mark, size = 180, label = "Budget Buddy" }) => {
  const radius = size * 0.225; // iOS squircle approximation
  return (
    <div style={{display: "flex", flexDirection: "column", alignItems: "center", gap: 8}}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          position: "relative",
          overflow: "hidden",
          boxShadow: "0 12px 32px rgba(79,70,229,0.28), 0 2px 6px rgba(0,0,0,0.12)",
          background: `linear-gradient(135deg, ${C.indigo} 0%, ${C.indigoDeep} 60%, #3730A3 100%)`,
        }}
      >
        {/* Glass layer 1 — soft blur ring */}
        <div style={{
          position: "absolute", inset: "-15%",
          background: `radial-gradient(circle at 30% 25%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 35%)`,
        }} />
        {/* Glass layer 2 — bottom rim shine */}
        <div style={{
          position: "absolute", inset: 0,
          background: `radial-gradient(ellipse at 70% 95%, rgba(245,158,11,0.35) 0%, rgba(245,158,11,0) 40%)`,
        }} />
        {/* Centered mark on a translucent disc */}
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            width: size * 0.66, height: size * 0.66,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.18)",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(255,255,255,0.35)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.15)",
          }}>
            <Mark size={size * 0.5} />
          </div>
        </div>
        {/* Top sheen */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: "45%",
          background: "linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 100%)",
          pointerEvents: "none",
        }} />
      </div>
      <div style={{
        fontSize: 12, color: C.ink, fontWeight: 500,
        fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
      }}>{label}</div>
    </div>
  );
};

// ============================================================
// WEB HEADER MOCKUP
// ============================================================
const WebHeaderMock = ({ Mark }) => (
  <div style={{
    width: "100%",
    background: C.paper,
    border: `1px solid ${C.border}`,
    borderRadius: 12,
    padding: "14px 20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  }}>
    <Lockup Mark={Mark} size={32} wordSize={20} />
    <div style={{display: "flex", gap: 16, alignItems: "center"}}>
      <div style={{display: "flex", border: `1px solid ${C.border}`, borderRadius: 8, padding: "4px 8px", gap: 6, color: C.muted, fontSize: 12}}>
        ☀︎ ◐ ☾
      </div>
      <span style={{color: C.muted, fontSize: 13}}>foo@foo.com</span>
      <span style={{color: C.ink, fontSize: 13}}>Log out</span>
    </div>
  </div>
);

// ============================================================
// iOS HOME SCREEN MOCKUP
// ============================================================
const IOSHomeMock = ({ Mark }) => {
  const apps = [
    {bg: "#F2C744", label: "Notes", emoji: "📝"},
    {bg: "#34C759", label: "Messages", emoji: "💬"},
    {bg: "#007AFF", label: "Maps", emoji: "🗺️"},
    {bg: null, label: "Budget Buddy", isOurs: true},
    {bg: "#FF3B30", label: "Music", emoji: "🎵"},
    {bg: "#5856D6", label: "Camera", emoji: "📷"},
    {bg: "#FF9500", label: "Phone", emoji: "📞"},
    {bg: "#00C7BE", label: "Health", emoji: "❤️"},
  ];
  return (
    <div style={{
      width: 320, height: 580,
      borderRadius: 44,
      background: "linear-gradient(180deg, #FFB088 0%, #C779D0 50%, #4BC0C8 100%)",
      padding: 14,
      position: "relative",
      boxShadow: "0 24px 48px rgba(0,0,0,0.25), inset 0 0 0 8px #111",
    }}>
      {/* status bar */}
      <div style={{
        display: "flex", justifyContent: "space-between",
        color: "white", fontSize: 13, fontWeight: 600, padding: "6px 18px 12px",
      }}>
        <span>9:41</span>
        <span>•••</span>
      </div>
      {/* notch */}
      <div style={{
        position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)",
        width: 100, height: 28, borderRadius: 14, background: "#000",
      }} />
      {/* grid */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 18, padding: "8px 12px",
      }}>
        {apps.map((a, i) => (
          <div key={i} style={{display: "flex", flexDirection: "column", alignItems: "center", gap: 4}}>
            {a.isOurs ? (
              <IOSIcon Mark={Mark} size={56} label="" />
            ) : (
              <div style={{
                width: 56, height: 56, borderRadius: 13,
                background: a.bg, display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 26, boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
              }}>{a.emoji}</div>
            )}
            <span style={{color: "white", fontSize: 10, textShadow: "0 1px 2px rgba(0,0,0,0.4)"}}>{a.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================
// CANVAS
// ============================================================
const App = () => (
  <DesignCanvas title="Budget Buddy — Logo Explorations">
    <DCSection id="marks" title="Mark concepts">
      {MARKS.map((m) => (
        <DCArtboard key={m.id} id={m.id} label={m.name} width={420} height={520}>
          <div style={{
            width: "100%", height: "100%",
            background: C.paper,
            display: "flex", flexDirection: "column",
            padding: 32, gap: 24,
          }}>
            {/* Hero */}
            <div style={{
              flex: 1,
              background: C.smoke,
              borderRadius: 12,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <m.component size={180} />
            </div>
            {/* Size ladder */}
            <div style={{
              display: "flex", alignItems: "flex-end", gap: 18,
              padding: "12px 16px", borderTop: `1px solid ${C.border}`,
            }}>
              <m.component size={64} />
              <m.component size={40} />
              <m.component size={24} />
              <m.component size={16} />
              <div style={{flex: 1}} />
              <span style={{fontSize: 11, color: C.muted, fontFamily: "monospace"}}>
                64 · 40 · 24 · 16
              </span>
            </div>
            {/* Inverted */}
            <div style={{
              background: C.ink, borderRadius: 12, padding: 20,
              display: "flex", alignItems: "center", gap: 12,
            }}>
              <m.component size={36} />
              <span style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 700, fontSize: 18,
                color: C.paper, letterSpacing: "-0.025em",
              }}>Budget&nbsp;Buddy</span>
            </div>
          </div>
        </DCArtboard>
      ))}
    </DCSection>

    <DCSection id="lockups" title="Web header lockups">
      {MARKS.map((m) => (
        <DCArtboard key={m.id} id={`lock-${m.id}`} label={m.name} width={720} height={140}>
          <div style={{padding: 20, height: "100%", background: C.smoke}}>
            <WebHeaderMock Mark={m.component} />
          </div>
        </DCArtboard>
      ))}
    </DCSection>

    <DCSection id="ios" title="iOS app icon — Liquid Glass">
      {MARKS.map((m) => (
        <DCArtboard key={m.id} id={`ios-${m.id}`} label={m.name} width={360} height={420}>
          <div style={{
            padding: 24, height: "100%",
            background: `linear-gradient(135deg, #E0E7FF 0%, #FEF3C7 100%)`,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20,
          }}>
            <IOSIcon Mark={m.component} size={200} label="Budget Buddy" />
            <div style={{display: "flex", gap: 10, alignItems: "flex-end"}}>
              <IOSIcon Mark={m.component} size={88} label="" />
              <IOSIcon Mark={m.component} size={56} label="" />
              <IOSIcon Mark={m.component} size={36} label="" />
            </div>
          </div>
        </DCArtboard>
      ))}
    </DCSection>

    <DCSection id="homescreen" title="iOS home screen in context">
      {MARKS.map((m) => (
        <DCArtboard key={m.id} id={`home-${m.id}`} label={m.name} width={400} height={680}>
          <div style={{
            padding: 30, height: "100%",
            background: "#1C1C1E",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <IOSHomeMock Mark={m.component} />
          </div>
        </DCArtboard>
      ))}
    </DCSection>
  </DesignCanvas>
);

const root = ReactDOM.createRoot(document.getElementById("logo-root"));
root.render(<App />);
