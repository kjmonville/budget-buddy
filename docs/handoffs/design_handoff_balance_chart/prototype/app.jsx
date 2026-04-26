// App — Budget Buddy web with the new balance chart added between sub-header and calendar.

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "chartStyle": "line",
  "chartHeight": 160,
  "showLowPoint": true,
  "showTodayMarker": true,
  "showHoverScrubber": true,
  "chartContainer": "panel",
  "rangeDays": 30,
  "theme": "light"
}/*EDITMODE-END*/;

// ---------- Synthetic data ----------
// "Today" in the mock is Apr 25, 2026. Build a 60-day window of transactions
// matching the screenshots (Phone -25 on Apr 26, Payday +2000 Apr 28, Ebay +50/Car -200 Apr 30, etc.)
const TODAY = new Date(2026, 3, 25); // Apr 25 2026
const STARTING_BALANCE = 500.00;

const TXN = [
  // Past month-ish (synthesized to make a believable pre-history)
  { offset: -28, name: "Payday", amount: 2000, type: "Recurring", sign: 1 },
  { offset: -25, name: "Rent", amount: -1450, type: "Recurring", sign: -1 },
  { offset: -22, name: "Groceries", amount: -180, type: "One-time", sign: -1 },
  { offset: -18, name: "Internet", amount: -65, type: "Recurring", sign: -1 },
  { offset: -14, name: "Payday", amount: 2000, type: "Recurring", sign: 1 },
  { offset: -12, name: "Drugs", amount: -50, type: "Recurring", sign: -1 },
  { offset: -8, name: "Gas", amount: -55, type: "One-time", sign: -1 },
  { offset: -5, name: "Drugs", amount: -50, type: "Recurring", sign: -1 },
  { offset: -2, name: "Coffee run", amount: -22, type: "One-time", sign: -1 },
  // Today and forward (matches screenshots)
  { offset: 1, name: "Phone", amount: -25, type: "Recurring", sign: -1 },          // Sun Apr 26
  { offset: 3, name: "Payday", amount: 2000, type: "Recurring", sign: 1 },         // Tue Apr 28
  { offset: 5, name: "Ebay sale", amount: 50, type: "One-time", sign: 1 },         // Thu Apr 30
  { offset: 5, name: "Car", amount: -200, type: "Recurring", sign: -1 },           // Thu Apr 30
  { offset: 6, name: "Drugs", amount: -50, type: "Recurring", sign: -1 },          // Fri May 1
  { offset: 13, name: "Drugs", amount: -50, type: "Recurring", sign: -1 },         // Fri May 8
  { offset: 17, name: "Payday", amount: 2000, type: "Recurring", sign: 1 },        // Tue May 12
  { offset: 20, name: "Drugs", amount: -50, type: "Recurring", sign: -1 },         // Fri May 15
  { offset: 25, name: "Rent", amount: -1450, type: "Recurring", sign: -1 },        // May 20
  { offset: 27, name: "Drugs", amount: -50, type: "Recurring", sign: -1 },         // Fri May 22
];

// Compute a daily balance series.
// We "rebase" so that on TODAY the balance equals STARTING_BALANCE (matches the input field).
function buildSeries(rangeDays) {
  const start = new Date(TODAY); start.setDate(start.getDate() - 3); // start a few days before today
  const end = new Date(TODAY); end.setDate(end.getDate() + (rangeDays - 3));

  // Sum all transactions strictly before "start" to find the seed.
  // Then we adjust seed so that on TODAY the running balance = STARTING_BALANCE.
  // Easier: walk forward, then offset.
  const days = [];
  let bal = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const d = new Date(cur);
    const dayTxns = TXN.filter((t) => {
      const td = new Date(TODAY); td.setDate(td.getDate() + t.offset);
      return td.getFullYear() === d.getFullYear() && td.getMonth() === d.getMonth() && td.getDate() === d.getDate();
    });
    for (const t of dayTxns) bal += t.amount;
    days.push({ date: d, balance: bal, txns: dayTxns });
    cur.setDate(cur.getDate() + 1);
  }
  // Find today and offset to STARTING_BALANCE
  const todayDay = days.find((x) =>
    x.date.getFullYear() === TODAY.getFullYear() &&
    x.date.getMonth() === TODAY.getMonth() &&
    x.date.getDate() === TODAY.getDate()
  );
  const offset = STARTING_BALANCE - (todayDay ? todayDay.balance : 0);
  return days.map((x) => ({...x, balance: +(x.balance + offset).toFixed(2)}));
}

// ---------- Helpers ----------
const fmtMoney = (n, withSign = false) => {
  const sign = n < 0 ? "-" : withSign ? "+" : "";
  return sign + "$" + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

// ---------- Header ----------
const Header = ({ theme, setTheme, email }) => (
  <header className="bb-header">
    <div className="bb-logo">
      <span className="bb-logo-emoji" aria-hidden>💰</span>
      <span className="bb-logo-text">Budget Buddy</span>
    </div>
    <div className="bb-header-right">
      <div className="bb-theme-toggle" role="group" aria-label="Theme">
        <button
          className={"bb-theme-btn" + (theme === "light" ? " active" : "")}
          onClick={() => setTheme("light")}
          aria-label="Light theme"
        >
          <SunIcon />
        </button>
        <button
          className={"bb-theme-btn" + (theme === "auto" ? " active" : "")}
          onClick={() => setTheme("auto")}
          aria-label="Auto theme"
        >
          <AutoIcon />
        </button>
        <button
          className={"bb-theme-btn" + (theme === "dark" ? " active" : "")}
          onClick={() => setTheme("dark")}
          aria-label="Dark theme"
        >
          <MoonIcon />
        </button>
      </div>
      <span className="bb-email">{email}</span>
      <button className="bb-link">Log out</button>
    </div>
  </header>
);

// ---------- Sub-header ----------
const SubHeader = ({ balance, setBalance, lowBalance, lowDate, asOf }) => (
  <div className="bb-subheader">
    <div className="bb-sub-group">
      <label className="bb-label" htmlFor="bb-balance">Today's Balance</label>
      <div className="bb-money-input">
        <span className="bb-money-prefix">$</span>
        <input
          id="bb-balance"
          type="text"
          value={balance.toFixed(2)}
          onChange={(e) => {
            const v = parseFloat(e.target.value.replace(/[^0-9.\-]/g, ""));
            if (!Number.isNaN(v)) setBalance(v);
          }}
          inputMode="decimal"
        />
      </div>
      <span className="bb-muted">as of {asOf}</span>
    </div>
    <div className="bb-sub-group">
      <span className="bb-muted">Low Balance</span>
      <strong className="bb-low-text">{fmtMoney(lowBalance)}</strong>
      <span className="bb-muted">on {lowDate}</span>
    </div>
    <div className="bb-sub-actions">
      <button className="bb-btn bb-btn-ghost">Schedule</button>
      <button className="bb-btn bb-btn-primary">+ Add</button>
    </div>
  </div>
);

// ---------- Chart panel ----------
const ChartPanel = ({ series, todayIdx, tweaks, range, setRange }) => {
  const compact = tweaks.chartContainer === "compact";
  return (
    <section className={"bb-chart-panel" + (compact ? " compact" : "")}>
      <div className="bb-chart-header">
        <div>
          <div className="bb-chart-title">Projected Balance</div>
          <div className="bb-chart-sub">
            Next {range} days · hover to see daily balance
          </div>
        </div>
        <div className="bb-range-tabs" role="group" aria-label="Range">
          {[7, 30, 60, 90].map((r) => (
            <button
              key={r}
              className={"bb-range-btn" + (range === r ? " active" : "")}
              onClick={() => setRange(r)}
            >
              {r}d
            </button>
          ))}
        </div>
      </div>
      <BalanceChart
        series={series}
        height={tweaks.chartHeight}
        style={tweaks.chartStyle}
        showLowPoint={tweaks.showLowPoint}
        showTodayMarker={tweaks.showTodayMarker}
        showHoverScrubber={tweaks.showHoverScrubber}
        todayIndex={todayIdx}
      />
      <div className="bb-chart-legend">
        <span className="bb-legend-item"><span className="bb-dot bb-dot-today" /> Today</span>
        <span className="bb-legend-item"><span className="bb-dot bb-dot-low" /> Low balance</span>
      </div>
    </section>
  );
};

// ---------- Calendar ----------
const Calendar = ({ month, year, series, onPrev, onNext, selected, setSelected }) => {
  const first = new Date(year, month, 1);
  const startDow = first.getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  const cells = [];
  // Leading
  for (let i = startDow - 1; i >= 0; i--) {
    cells.push({ day: prevMonthDays - i, inMonth: false, date: new Date(year, month - 1, prevMonthDays - i) });
  }
  // Current
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, inMonth: true, date: new Date(year, month, d) });
  }
  // Trailing
  while (cells.length % 7 !== 0 || cells.length < 35) {
    const last = cells[cells.length - 1].date;
    const next = new Date(last); next.setDate(next.getDate() + 1);
    cells.push({ day: next.getDate(), inMonth: next.getMonth() === month, date: next });
  }

  const monthName = first.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const dows = ["SUN","MON","TUE","WED","THU","FRI","SAT"];

  return (
    <section className="bb-calendar">
      <div className="bb-cal-header">
        <button className="bb-icon-btn" onClick={onPrev} aria-label="Previous month">‹</button>
        <h2 className="bb-cal-title">{monthName}</h2>
        <button className="bb-icon-btn" onClick={onNext} aria-label="Next month">›</button>
      </div>
      <div className="bb-cal-dow">
        {dows.map((d) => <div key={d} className="bb-cal-dow-cell">{d}</div>)}
      </div>
      <div className="bb-cal-grid">
        {cells.map((c, i) => {
          const dayInfo = series.find((x) => sameDay(x.date, c.date));
          const isSelected = selected && sameDay(selected, c.date);
          const isToday = sameDay(c.date, TODAY);
          return (
            <div
              key={i}
              className={[
                "bb-cal-cell",
                c.inMonth ? "" : "out",
                isSelected ? "selected" : "",
                isToday ? "today" : "",
              ].join(" ")}
              onClick={() => setSelected(c.date)}
            >
              <div className="bb-cal-day">{c.day}</div>
              <div className="bb-cal-txns">
                {dayInfo && dayInfo.txns.map((t, k) => (
                  <div key={k} className={"bb-txn-pill " + (t.sign > 0 ? "pos" : "neg")}>
                    <span className="bb-txn-name">{t.sign > 0 ? "+" : "-"}{t.name}</span>
                    <span className="bb-txn-amt">{Math.abs(t.amount).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              {dayInfo && (
                <div className="bb-cal-balance">{fmtMoney(dayInfo.balance)}</div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};

// ---------- Icons ----------
const SunIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>
);
const MoonIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
);
const AutoIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 3v18"/><path d="M12 3a9 9 0 0 0 0 18" fill="currentColor"/></svg>
);

// ---------- App ----------
const App = () => {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [range, setRange] = React.useState(tweaks.rangeDays);
  React.useEffect(() => setRange(tweaks.rangeDays), [tweaks.rangeDays]);

  const [theme, setTheme] = React.useState(tweaks.theme || "light");
  React.useEffect(() => {
    document.documentElement.dataset.theme = theme;
    setTweak("theme", theme);
  }, [theme]);

  const [balance, setBalance] = React.useState(STARTING_BALANCE);
  const [selected, setSelected] = React.useState(new Date(2026, 3, 24));
  const [viewMonth, setViewMonth] = React.useState(3); // April
  const [viewYear, setViewYear] = React.useState(2026);

  const series = React.useMemo(() => buildSeries(range), [range, balance]);
  // Adjust series so that today's balance reflects edited "balance" input
  const adjusted = React.useMemo(() => {
    const todayDay = series.find((x) => sameDay(x.date, TODAY));
    if (!todayDay) return series;
    const off = balance - todayDay.balance;
    return series.map((x) => ({...x, balance: +(x.balance + off).toFixed(2)}));
  }, [series, balance]);

  const todayIdx = adjusted.findIndex((x) => sameDay(x.date, TODAY));

  const lowDay = adjusted.reduce((acc, d) => (d.balance < acc.balance ? d : acc), adjusted[0]);
  const lowDateStr = lowDay.date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const asOfStr = TODAY.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const onPrev = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  };
  const onNext = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  };

  return (
    <div className="bb-app" data-screen-label="Budget Buddy Home">
      <Header theme={theme} setTheme={setTheme} email="foo@foo.com" />
      <SubHeader
        balance={balance}
        setBalance={setBalance}
        lowBalance={lowDay.balance}
        lowDate={lowDateStr}
        asOf={asOfStr}
      />
      <main className="bb-main">
        <ChartPanel
          series={adjusted}
          todayIdx={todayIdx}
          tweaks={tweaks}
          range={range}
          setRange={(r) => { setRange(r); setTweak("rangeDays", r); }}
        />
        <Calendar
          month={viewMonth}
          year={viewYear}
          series={adjusted}
          onPrev={onPrev}
          onNext={onNext}
          selected={selected}
          setSelected={setSelected}
        />
      </main>

      <TweaksPanel title="Tweaks">
        <TweakSection title="Chart">
          <TweakRadio
            label="Style"
            value={tweaks.chartStyle}
            options={[
              {value: "line", label: "Line"},
              {value: "area", label: "Area"},
              {value: "stepped", label: "Stepped"},
            ]}
            onChange={(v) => setTweak("chartStyle", v)}
          />
          <TweakRadio
            label="Container"
            value={tweaks.chartContainer}
            options={[
              {value: "panel", label: "Panel"},
              {value: "compact", label: "Compact"},
            ]}
            onChange={(v) => setTweak("chartContainer", v)}
          />
          <TweakSlider
            label="Height"
            value={tweaks.chartHeight}
            min={100}
            max={280}
            step={10}
            onChange={(v) => setTweak("chartHeight", v)}
          />
          <TweakToggle
            label="Low-balance marker"
            value={tweaks.showLowPoint}
            onChange={(v) => setTweak("showLowPoint", v)}
          />
          <TweakToggle
            label="Today marker"
            value={tweaks.showTodayMarker}
            onChange={(v) => setTweak("showTodayMarker", v)}
          />
          <TweakToggle
            label="Hover scrubber"
            value={tweaks.showHoverScrubber}
            onChange={(v) => setTweak("showHoverScrubber", v)}
          />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
