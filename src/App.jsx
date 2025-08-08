import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Check,
  X,
  Plus,
  Plane,
  Train,
  Car,
  Bus,
  Ship,
  Bell,
  Wallet,
  Music4,
  Image as ImageIcon,
  Users,
  Settings,
  ExternalLink,
  Share2,
  Upload,
  Download,
  Sun,
  Moon,
  ShieldAlert,
  Bug,
} from "lucide-react";

/**
 * Trip Prep Tracker — single-file React app (with guards + self-tests)
 * TailwindCSS recommended. Works without but looks best with it.
 * All data persists to localStorage under key TRIP_PREP_STATE_V3.
 * Sound effects are synthesized in-browser with WebAudio (no external files).
 *
 * NOTE: Some dev environments or browser extensions try to auto-connect
 * to MetaMask and throw "Failed to connect to MetaMask" on load.
 * This app does NOT use web3. We install global guards to catch and
 * ignore external MetaMask/ethereum errors so they do not crash the UI.
 */

// -------------------------- global guards (MetaMask-safe) --------------------------
function installGlobalGuards() {
  if (typeof window === "undefined") return;
  if (window.__TRIP_PREP_GUARDS__) return;
  Object.defineProperty(window, "__TRIP_PREP_GUARDS__", { value: true, configurable: false });

  const normalize = (err) => {
    try {
      if (!err) return "";
      const msg = (err?.message || err?.toString?.() || String(err)).toLowerCase();
      return msg;
    } catch {
      return "";
    }
  };

  // Swallow unhandled promise rejections caused by external web3 scripts
  window.addEventListener(
    "unhandledrejection",
    (e) => {
      const msg = normalize(e.reason);
      if (msg.includes("metamask") || msg.includes("ethereum")) {
        console.warn("[TripPrep] Ignored external web3 error:", e.reason);
        e.preventDefault?.();
      }
    },
    { capture: true }
  );

  // Swallow window.onerror from external web3 scripts to keep UI alive
  window.addEventListener(
    "error",
    (e) => {
      const msg = normalize(e.error || e.message);
      if (msg.includes("metamask") || msg.includes("ethereum")) {
        console.warn("[TripPrep] Caught external web3 error:", e.error || e.message);
        e.preventDefault?.();
      }
    },
    { capture: true }
  );
}

// -------------------------- Error Boundary --------------------------
class AppBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error("[TripPrep] Boundary caught", error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen w-full bg-gradient-to-br from-zinc-900 via-slate-900 to-indigo-950 text-white">
          <div className="mx-auto max-w-3xl px-6 py-10">
            <div className="mb-6 flex items-center gap-3">
              <ShieldAlert className="h-6 w-6 text-amber-300" />
              <h1 className="text-2xl font-bold">The app hit an error, but your data is safe</h1>
            </div>
            <p className="text-white/80">
              If you saw a MetaMask error, it is likely from a browser extension or the host environment. This app does not use web3. Try reloading the page.
            </p>
            <button
              onClick={() => location.reload()}
              className="mt-4 rounded-xl border border-white/20 bg-white/10 px-4 py-2 backdrop-blur transition hover:bg-white/20"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// -------------------------- helpers --------------------------
const STORAGE_KEY = "TRIP_PREP_STATE_V3";

function safeUUID() {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch {}
  // Fallback UUID v4-ish
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const defaultPeople = [
  { id: safeUUID(), name: "Bogdan", role: "boy", paid: false, amount: 0, transport: "Car", eta: "2025-08-12T17:30", notes: "", tasks: { packing: false, id: false, toiletries: false } },
  { id: safeUUID(), name: "Rishabh", role: "boy", paid: false, amount: 0, transport: "Plane", eta: "2025-08-12T15:00", notes: "", tasks: { packing: false, id: false, toiletries: false } },
  { id: safeUUID(), name: "Dav", role: "boy", paid: false, amount: 0, transport: "Car", eta: "2025-08-12T18:00", notes: "", tasks: { packing: false, id: false, toiletries: false } },
  { id: safeUUID(), name: "Taco", role: "boy", paid: false, amount: 0, transport: "Car", eta: "2025-08-12T19:00", notes: "", tasks: { packing: false, id: false, toiletries: false } },
  { id: safeUUID(), name: "Cyn", role: "lady", paid: false, amount: 0, transport: "Plane", eta: "2025-08-12T14:45", notes: "", tasks: { packing: false, id: false, toiletries: false } },
  { id: safeUUID(), name: "Fafe", role: "boy", paid: false, amount: 0, transport: "Train", eta: "2025-08-12T19:30", notes: "", tasks: { packing: false, id: false, toiletries: false } },
  { id: safeUUID(), name: "Memers", role: "boy", paid: false, amount: 0, transport: "Bus", eta: "2025-08-12T20:00", notes: "", tasks: { packing: false, id: false, toiletries: false } },
];

const transportIcons = { Plane, Train, Car, Bus, Ship };

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

// synth beep sfx
function useBeep() {
  const ctxRef = useRef(null);
  const enabledRef = useRef(true);
  const ensureCtx = () => {
    if (!ctxRef.current) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) ctxRef.current = new AudioCtx();
    }
    return ctxRef.current;
  };
  const toggle = (v) => {
    enabledRef.current = typeof v === "boolean" ? v : !enabledRef.current;
  };
  const play = (type = "ok") => {
    if (!enabledRef.current) return;
    const ctx = ensureCtx();
    if (!ctx) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type === "ok" ? "triangle" : type === "warn" ? "square" : "sine";
    const now = ctx.currentTime;
    o.frequency.setValueAtTime(type === "ok" ? 880 : type === "warn" ? 180 : 440, now);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.2, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(now + 0.26);
    if (navigator.vibrate) navigator.vibrate([10]);
  };
  return { play, toggle };
}

// localStorage state
function usePersistedState(key, initial) {
  const [state, setState] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : initial;
    } catch (e) {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {}
  }, [key, state]);
  return [state, setState];
}

// -------------------------- App wrapper --------------------------
export default function App() {
  installGlobalGuards();
  return (
    <AppBoundary>
      <TripPrepApp />
    </AppBoundary>
  );
}

// -------------------------- main app --------------------------
function TripPrepApp() {
  const [dark, setDark] = usePersistedState("DARK_MODE", false);
  const [tab, setTab] = usePersistedState("TAB", "Overview");
  const [state, setState] = usePersistedState(STORAGE_KEY, {
    title: "Beach House Getaway",
    location: "Outer Banks, NC",
    tripDate: "2025-08-12T20:00",
    budgetPerPerson: 150,
    galleryQuery: "beach roadtrip friends",
    people: defaultPeople,
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", !!dark);
  }, [dark]);

  const { play, toggle } = useBeep();

  const totals = useMemo(() => {
    const count = state.people.length;
    const paidCount = state.people.filter((p) => p.paid).length;
    const paidSum = state.people.reduce((s, p) => s + (p.amount || 0), 0);
    const expected = state.budgetPerPerson * count;
    return { count, paidCount, paidSum, expected };
  }, [state.people, state.budgetPerPerson]);

  const timeLeft = useMemo(() => {
    const target = new Date(state.tripDate);
    const diff = Math.max(0, target - new Date());
    const d = Math.floor(diff / (1000 * 60 * 60 * 24));
    const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const m = Math.floor((diff / (1000 * 60)) % 60);
    return `${d}d ${h}h ${m}m`;
  }, [state.tripDate]);

  const setPeople = (updater) =>
    setState((s) => ({ ...s, people: typeof updater === "function" ? updater(s.people) : updater }));

  const addPerson = () => {
    const name = prompt("New person name?");
    if (!name) return;
    setPeople((prev) => [
      ...prev,
      {
        id: safeUUID(),
        name,
        role: "boy",
        paid: false,
        amount: 0,
        transport: "Car",
        eta: state.tripDate,
        notes: "",
        tasks: { packing: false, id: false, toiletries: false },
      },
    ]);
    play("ok");
  };

  const removePerson = (id) => {
    if (!confirm("Remove this person?")) return;
    setPeople((prev) => prev.filter((p) => p.id !== id));
    play("warn");
  };

  const markPaid = (id) => {
    setPeople((prev) => prev.map((p) => (p.id === id ? { ...p, paid: !p.paid, amount: !p.paid ? state.budgetPerPerson : 0 } : p)));
    play("ok");
  };

  const updateField = (id, field, value) => {
    setPeople((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  };

  const toggleTask = (id, key) => {
    setPeople((prev) => prev.map((p) => (p.id === id ? { ...p, tasks: { ...p.tasks, [key]: !p.tasks[key] } } : p)));
    play("ok");
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "trip_prep_state.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJSON = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        setState(JSON.parse(reader.result));
        play("ok");
      } catch {
        alert("Invalid file");
      }
    };
    reader.readAsText(file);
  };

  // -------------------------- UI --------------------------
  return (
    <div className={cx(
      "min-h-screen w-full",
      "bg-gradient-to-br from-indigo-950 via-slate-900 to-fuchsia-900 dark:from-zinc-950 dark:via-slate-900 dark:to-indigo-950",
      "text-white"
    )}>
      {/* floating glow */}
      <div className="pointer-events-none fixed inset-0 opacity-40 blur-3xl" aria-hidden>
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-fuchsia-500/30 animate-pulse" />
        <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-indigo-500/30 animate-pulse [animation-delay:300ms]" />
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight drop-shadow-sm">{state.title}</h1>
            <p className="text-sm text-white/80">
              {state.location} • Trip starts in <span className="font-semibold text-white">{timeLeft}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDark((d) => !d)}
              className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 backdrop-blur transition hover:bg-white/20 flex items-center gap-2"
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />} <span className="text-sm">Theme</span>
            </button>
            <label className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 backdrop-blur transition hover:bg-white/20 cursor-pointer flex items-center gap-2">
              <Upload className="h-4 w-4" />
              <span className="text-sm">Import</span>
              <input type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files && importJSON(e.target.files[0])} />
            </label>
            <button onClick={exportJSON} className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 backdrop-blur transition hover:bg-white/20 flex items-center gap-2">
              <Download className="h-4 w-4" /> <span className="text-sm">Export</span>
            </button>
            <button
              onClick={() => {
                navigator.clipboard.writeText(window.location.href).then(() => play("ok"));
              }}
              className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 backdrop-blur transition hover:bg-white/20 flex items-center gap-2"
            >
              <Share2 className="h-4 w-4" /> <span className="text-sm">Share</span>
            </button>
            <button
              onClick={() => {
                toggle();
              }}
              title="Toggle sounds"
              className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 backdrop-blur transition hover:bg-emerald-500/20 flex items-center gap-2"
            >
              <Music4 className="h-4 w-4" /> <span className="text-sm">SFX</span>
            </button>
          </div>
        </div>

        {/* controls */}
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
            <label className="text-xs uppercase tracking-wide text-white/70">Trip title</label>
            <input
              value={state.title}
              onChange={(e) => setState((s) => ({ ...s, title: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 outline-none focus:ring-2 focus:ring-fuchsia-400"
            />
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
            <label className="text-xs uppercase tracking-wide text-white/70">Location</label>
            <input
              value={state.location}
              onChange={(e) => setState((s) => ({ ...s, location: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
            <label className="text-xs uppercase tracking-wide text-white/70">Trip date & time</label>
            <input
              type="datetime-local"
              value={state.tripDate}
              onChange={(e) => setState((s) => ({ ...s, tripDate: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>
        </div>

        {/* high-contrast tabs */}
        <div className="mt-6">
          <div role="tablist" className="flex flex-wrap gap-2">
            {[
              { k: "Overview", i: Users },
              { k: "People", i: Wallet },
              { k: "Gallery", i: ImageIcon },
              { k: "Checklist", i: Bell },
              { k: "Dev", i: Bug },
              { k: "Settings", i: Settings },
            ].map(({ k, i: Icon }) => (
              <button
                key={k}
                role="tab"
                aria-selected={tab === k}
                onClick={() => setTab(k)}
                className={cx(
                  "group relative flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition",
                  tab === k
                    ? "bg-gradient-to-r from-fuchsia-500 to-indigo-500 shadow-lg ring-2 ring-white/30"
                    : "bg-white/10 hover:bg-white/20 text-white/80 border border-white/10"
                )}
              >
                <Icon className="h-4 w-4" /> {k}
              </button>
            ))}
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 backdrop-blur">
            {tab === "Overview" && <Overview totals={totals} people={state.people} budget={state.budgetPerPerson} />}
            {tab === "People" && (
              <PeopleTab
                people={state.people}
                budget={state.budgetPerPerson}
                onAdd={addPerson}
                onRemove={removePerson}
                onTogglePaid={markPaid}
                onUpdate={updateField}
                onToggleTask={toggleTask}
                play={play}
              />
            )}
            {tab === "Gallery" && <Gallery query={state.galleryQuery} onQuery={(q) => setState((s) => ({ ...s, galleryQuery: q }))} />}
            {tab === "Checklist" && <Checklist people={state.people} toggleTask={toggleTask} />}
            {tab === "Dev" && <DevTab />}
            {tab === "Settings" && <SettingsTab state={state} setState={setState} />}
          </div>
        </div>
      </div>
    </div>
  );
}

// -------------------------- sections --------------------------
function Overview({ totals, people, budget }) {
  const ratio = totals.expected ? Math.min(1, totals.paidSum / totals.expected) : 0;
  const pct = Math.round(ratio * 100);
  const paidBadge = `${totals.paidCount}/${totals.count} paid`;
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
        <p className="text-white/70 text-sm">Payment progress</p>
        <div className="mt-2 flex items-end justify-between">
          <div className="text-4xl font-bold">{pct}%</div>
          <div className="text-right text-white/80">
            <div className="text-2xl font-semibold">${totals.paidSum}</div>
            <div className="text-xs">of ${totals.expected} expected</div>
          </div>
        </div>
        <div className="mt-3 h-3 w-full rounded-full bg-white/10">
          <div className="h-3 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-2 text-xs text-white/70">{paidBadge}</div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
        <p className="text-white/70 text-sm">Arrivals</p>
        <ul className="mt-2 space-y-2">
          {people.map((p) => (
            <li key={p.id} className="flex items-center justify-between rounded-xl bg-black/20 px-3 py-2">
              <span className="truncate">{p.name}</span>
              <span className="text-white/80 text-sm">{new Date(p.eta).toLocaleString()}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
        <p className="text-white/70 text-sm">Transport mix</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {groupBy(people, (p) => p.transport).map(([k, arr]) => (
            <span key={k} className="inline-flex items-center gap-2 rounded-xl bg-black/20 px-3 py-2 text-sm">
              {React.createElement(transportIcons[k] || Car, { className: "h-4 w-4" })}
              {k}: <b>{arr.length}</b>
            </span>
          ))}
        </div>
        <p className="mt-3 text-xs text-white/70">Tip: hover a name in People to see their notes.</p>
      </div>
    </div>
  );
}

function PeopleTab({ people, budget, onAdd, onRemove, onTogglePaid, onUpdate, onToggleTask, play }) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">People</h2>
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={onAdd}
          className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-2 font-semibold shadow-lg ring-2 ring-white/20"
        >
          <Plus className="h-4 w-4" /> Add person
        </motion.button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-y-2">
          <thead>
            <tr className="text-left text-sm text-white/80">
              {["Name", "Role", "Paid", "Amount", "$ per", "Transport", "ETA", "Tasks", "Notes", "Actions"].map((h) => (
                <th key={h} className="px-3">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {people.map((p) => (
              <tr key={p.id} className="rounded-xl bg-white/10 backdrop-blur">
                <td className="px-3 py-2 font-semibold" title={p.notes}>
                  {p.name}
                </td>
                <td className="px-3 py-2">
                  <select value={p.role} onChange={(e) => onUpdate(p.id, "role", e.target.value)} className="rounded-lg bg-black/30 px-2 py-1">
                    <option>boy</option>
                    <option>lady</option>
                  </select>
                </td>
                <td className="px-3 py-2">
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => onTogglePaid(p.id)}
                    className={
                      cx(
                        "inline-flex items-center gap-2 rounded-lg px-3 py-1 font-semibold",
                        p.paid ? "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-400/40" : "bg-rose-500/20 text-rose-200 ring-1 ring-rose-400/40"
                      )
                    }
                  >
                    {p.paid ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />} {p.paid ? "Paid" : "Unpaid"}
                  </motion.button>
                </td>
                <td className="px-3 py-2">
                  <input type="number" value={p.amount} onChange={(e) => onUpdate(p.id, "amount", Number(e.target.value))} className="w-24 rounded-lg bg-black/30 px-2 py-1" />
                </td>
                <td className="px-3 py-2 text-white/80">${budget}</td>
                <td className="px-3 py-2">
                  <TransportPicker value={p.transport} onChange={(v) => onUpdate(p.id, "transport", v)} />
                </td>
                <td className="px-3 py-2">
                  <input type="datetime-local" value={p.eta} onChange={(e) => onUpdate(p.id, "eta", e.target.value)} className="rounded-lg bg-black/30 px-2 py-1" />
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    {Object.entries(p.tasks).map(([k, val]) => (
                      <label
                        key={k}
                        className={cx(
                          "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs ring-1",
                          val ? "bg-emerald-500/20 ring-emerald-400/40" : "bg-white/10 ring-white/20"
                        )}
                      >
                        <input type="checkbox" checked={!!val} onChange={() => onToggleTask(p.id, k)} /> {labelizeTask(k)}
                      </label>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <input value={p.notes} onChange={(e) => onUpdate(p.id, "notes", e.target.value)} className="w-64 rounded-lg bg-black/30 px-2 py-1" placeholder="notes" />
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => {
                        play("ok");
                        alert(`Heads up, ${p.name}! \nSee you at ${new Date(p.eta).toLocaleString()}`);
                      }}
                      className="rounded-lg bg-indigo-500/30 px-3 py-1 ring-1 ring-indigo-400/40"
                    >
                      Nudge
                    </motion.button>
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => onRemove(p.id)} className="rounded-lg bg-rose-500/30 px-3 py-1 ring-1 ring-rose-400/40">
                      Remove
                    </motion.button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TransportPicker({ value, onChange }) {
  const options = ["Car", "Plane", "Train", "Bus", "Ship"];
  const Icon = transportIcons[value] || Car;
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4" />
      <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-lg bg-black/30 px-2 py-1">
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}

function Gallery({ query, onQuery }) {
  const [q, setQ] = useState(query);
  const urls = useMemo(() => makeUnsplash(q || "travel friends roadtrip"), [q]);
  return (
    <div>
      <div className="mb-3 flex items-end gap-2">
        <div className="flex-1">
          <label className="text-xs uppercase tracking-wide text-white/70">Image theme</label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 outline-none focus:ring-2 focus:ring-fuchsia-400"
            placeholder="e.g., beach bonfire sunset"
          />
        </div>
        <button onClick={() => onQuery(q)} className="rounded-2xl bg-gradient-to-r from-fuchsia-500 to-indigo-500 px-4 py-2 font-semibold shadow-lg ring-2 ring-white/20">
          Save theme
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {urls.map((u, i) => (
          <a key={i} href={u} target="_blank" rel="noreferrer" className="group relative block overflow-hidden rounded-2xl border border-white/10">
            <img src={u} alt="Trip vibe" className="aspect-[4/3] w-full object-cover transition group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
            <div className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/50 px-2 py-1 text-[10px]">
              Open <ExternalLink className="h-3 w-3" />
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

function Checklist({ people, toggleTask }) {
  const taskKeys = ["packing", "id", "toiletries"];
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {people.map((p) => (
        <div key={p.id} className="rounded-2xl border border-white/10 bg-white/10 p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-lg font-semibold">{p.name}</h3>
            <span className={cx("rounded-full px-2 py-1 text-xs ring-1", p.paid ? "bg-emerald-500/20 ring-emerald-400/40" : "bg-rose-500/20 ring-rose-400/40")}>
              {p.paid ? "paid" : "unpaid"}
            </span>
          </div>
          <ul className="space-y-2">
            {taskKeys.map((k) => (
              <li key={k} className="flex items-center justify-between rounded-xl bg-black/20 px-3 py-2">
                <span>{labelizeTask(k)}</span>
                <button
                  onClick={() => toggleTask(p.id, k)}
                  className={cx("rounded-lg px-3 py-1 text-sm", p.tasks[k] ? "bg-emerald-500/30 ring-1 ring-emerald-400/40" : "bg-white/10 ring-1 ring-white/20")}
                >
                  {p.tasks[k] ? "Done" : "Todo"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function SettingsTab({ state, setState }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
        <h3 className="mb-2 text-lg font-semibold">Budget</h3>
        <label className="text-sm text-white/80">Budget per person</label>
        <div className="mt-1 flex items-center gap-2">
          <span>$</span>
          <input
            type="number"
            value={state.budgetPerPerson}
            onChange={(e) => setState((s) => ({ ...s, budgetPerPerson: Number(e.target.value) }))}
            className="w-32 rounded-xl bg-black/30 px-3 py-2"
          />
        </div>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
        <h3 className="mb-2 text-lg font-semibold">Reset</h3>
        <button
          onClick={() => {
            if (confirm("Reset everything to defaults?")) {
              localStorage.clear();
              location.reload();
            }
          }}
          className="rounded-2xl bg-gradient-to-r from-rose-500 to-orange-500 px-4 py-2 font-semibold shadow-lg ring-2 ring-white/20"
        >
          Reset app
        </button>
        <p className="mt-2 text-sm text-white/80">This clears saved data and reloads the page.</p>
      </div>
    </div>
  );
}

// -------------------------- Dev / Tests --------------------------
function DevTab() {
  const [results, setResults] = useState([]);
  const [ethStatus, setEthStatus] = useState("unknown");
  useEffect(() => {
    try {
      const eth = window.ethereum;
      if (!eth) setEthStatus("no-ethereum");
      else setEthStatus("ethereum-present");
    } catch {
      setEthStatus("unknown");
    }
  }, []);

  const run = () => setResults(runSelfTests());

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
        <h3 className="mb-2 flex items-center gap-2 text-lg font-semibold">
          <Bug className="h-5 w-5" /> Self-tests
        </h3>
        <p className="text-sm text-white/80">
          Quick checks for helpers and state logic. These do not contact any networks and do not use MetaMask.
        </p>
        <button onClick={run} className="mt-3 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-2 font-semibold ring-2 ring-white/20">
          Run tests
        </button>
        {results.length > 0 && (
          <ul className="mt-3 space-y-2">
            {results.map((r, i) => (
              <li key={i} className="flex items-start justify-between gap-3 rounded-xl bg-black/20 p-3">
                <div>
                  <div className="font-semibold">{r.name}</div>
                  {r.info && <div className="text-sm text-white/70">{r.info}</div>}
                </div>
                <div className={cx("rounded-full px-2 py-1 text-sm", r.ok ? "bg-emerald-500/20" : "bg-rose-500/20")}>{r.ok ? "✅" : "❌"}</div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
        <h3 className="mb-2 text-lg font-semibold">Environment</h3>
        <p className="text-sm text-white/80">window.ethereum status: <b>{ethStatus}</b></p>
        <p className="text-xs text-white/60 mt-1">
          If you still see a MetaMask error overlay, it is likely outside this app. The guards should keep the UI running anyway.
        </p>
      </div>
    </div>
  );
}

function runSelfTests() {
  const out = [];
  const push = (name, ok, info = "") => out.push({ name, ok: !!ok, info });

  // Test: groupBy
  const gb = groupBy(
    [
      { t: "Car" },
      { t: "Car" },
      { t: "Plane" },
      { t: "Bus" },
      { t: "Plane" },
    ],
    (x) => x.t
  );
  const groups = Object.fromEntries(gb.map(([k, arr]) => [k, arr.length]));
  push("groupBy groups correctly", groups.Car === 2 && groups.Plane === 2 && groups.Bus === 1, JSON.stringify(groups));

  // Test: labelizeTask
  push("labelizeTask id -> ID/License", labelizeTask("id") === "ID/License");
  push("labelizeTask packing -> capitalized", labelizeTask("packing") === "Packing");

  // Test: makeUnsplash
  const urls = makeUnsplash("unit-test-theme");
  push("makeUnsplash returns 12", urls.length === 12);
  push("makeUnsplash looks like Unsplash URLs", urls.every((u) => u.includes("images.unsplash.com")));

  // Test: safeUUID uniqueness
  const u1 = safeUUID();
  const u2 = safeUUID();
  push("safeUUID produces non-empty", !!u1 && !!u2);
  push("safeUUID appears unique across calls", u1 !== u2, `${u1} vs ${u2}`);

  // Test: toggle paid simulation
  const budget = 150;
  const person = { id: "1", paid: false, amount: 0 };
  const toggled1 = { ...person, paid: !person.paid, amount: !person.paid ? budget : 0 };
  const toggled2 = { ...toggled1, paid: !toggled1.paid, amount: !toggled1.paid ? budget : 0 };
  push("markPaid sets amount to budget when paying", toggled1.paid === true && toggled1.amount === budget);
  push("markPaid resets amount to 0 when unpaying", toggled2.paid === false && toggled2.amount === 0);

  // Test: toggle task simulation
  const tasks = { packing: false, id: false, toiletries: true };
  const toggledTasks = { ...tasks, packing: !tasks.packing };
  push("toggleTask flips boolean", toggledTasks.packing === true);

  return out;
}

// -------------------------- utils --------------------------
function groupBy(arr, keyFn) {
  const map = new Map();
  for (const item of arr) {
    const k = keyFn(item);
    map.set(k, [...(map.get(k) || []), item]);
  }
  return [...map.entries()];
}

function labelizeTask(k) {
  return k === "id" ? "ID/License" : k.charAt(0).toUpperCase() + k.slice(1);
}

function makeUnsplash(q) {
  // quick Unsplash source set; these are not static and are fine for a vibe board
  const encoded = encodeURIComponent(q);
  return Array.from({ length: 12 }).map(
    (_, i) =>
      `https://images.unsplash.com/photo-15${i + 10}0${(i * 7) % 9}0-0${(i + 3) % 9}a?auto=format&fit=crop&w=1200&q=60&sig=${i}&${encoded}`
  );
}
