import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";

const API         = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000/api";
const STORAGE_KEY = "slnk_history";
const THEME_KEY   = "slnk_theme";

// ── Utils ─────────────────────────────────────────────────────────────────────

const getHistory = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch { return []; }
};
const saveHistory = (items) => localStorage.setItem(STORAGE_KEY, JSON.stringify(items));

const EXPIRY_OPTIONS = [
  { value: "",    label: "Never" },
  { value: "1d",  label: "1 day" },
  { value: "7d",  label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "1y",  label: "1 year" },
];

function formatExpiry(expiresAt) {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt) - Date.now();
  if (diff <= 0) return "Expired";
  const days = Math.ceil(diff / 86_400_000);
  if (days === 1) return "Expires tomorrow";
  if (days < 30)  return `Expires in ${days}d`;
  return `Expires ${new Date(expiresAt).toLocaleDateString()}`;
}

function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (s < 60)    return "just now";
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// ── SVG Icons ─────────────────────────────────────────────────────────────────

const Svg = ({ children, className = "w-4 h-4" }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    {children}
  </svg>
);

const Icons = {
  bolt:   <Svg><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></Svg>,
  shield: <Svg><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></Svg>,
  chart:  <Svg><rect x="4" y="10" width="4" height="10" rx="1"/><rect x="10" y="5" width="4" height="15" rx="1"/><rect x="16" y="1" width="4" height="19" rx="1"/></Svg>,
  clock:  <Svg><circle cx="12" cy="12" r="9" strokeWidth="0"/><path d="M12 22c-5.52 0-10-4.48-10-10S6.48 2 12 2s10 4.48 10 10-4.48 10-10 10zm.5-15H11v6l4.25 2.55.75-1.23-3.5-2.07V7z" fill="currentColor"/></Svg>,
  qr:     <Svg><rect x="3"  y="3"  width="7" height="7" rx="1"/><rect x="14" y="3"  width="7" height="7" rx="1"/><rect x="3"  y="14" width="7" height="7" rx="1"/><rect x="4"  y="4"  width="5" height="5" rx="0.5" fill="currentColor" className="opacity-60"/><rect x="15" y="4"  width="5" height="5" rx="0.5" fill="currentColor" className="opacity-60"/><rect x="4"  y="15" width="5" height="5" rx="0.5" fill="currentColor" className="opacity-60"/><rect x="14" y="14" width="3" height="3" rx="0.5"/><rect x="19" y="14" width="2" height="2" rx="0.5"/><rect x="19" y="18" width="2" height="2" rx="0.5"/><rect x="14" y="19" width="3" height="2" rx="0.5"/></Svg>,
  pencil: <Svg><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></Svg>,
  copy:   <Svg><rect x="9" y="9" width="13" height="13" rx="2" strokeWidth="0"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></Svg>,
  check:  <Svg><path d="M20 6 9 17l-5-5"/></Svg>,
  x:      <Svg><path d="M18 6 6 18M6 6l12 12"/></Svg>,
};

const FEATURES = [
  { icon: Icons.bolt,   label: "Sub-100ms redirects", ring: "ring-blue-400/25",   bg: "bg-blue-500/15",    text: "text-blue-300"    },
  { icon: Icons.shield, label: "SSRF protected",       ring: "ring-yellow-400/25", bg: "bg-yellow-500/15",  text: "text-yellow-300"  },
  { icon: Icons.chart,  label: "Click analytics",      ring: "ring-emerald-400/25",bg: "bg-emerald-500/15", text: "text-emerald-300" },
  { icon: Icons.clock,  label: "Link expiry",           ring: "ring-orange-400/25", bg: "bg-orange-500/15",  text: "text-orange-300"  },
  { icon: Icons.qr,     label: "QR codes",              ring: "ring-slate-400/25",  bg: "bg-slate-500/15",   text: "text-slate-300"   },
  { icon: Icons.pencil, label: "Custom aliases",        ring: "ring-purple-400/25", bg: "bg-purple-500/15",  text: "text-purple-300"  },
];

// ── Breathing background ──────────────────────────────────────────────────────

function BreathingBg() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden" style={{ backgroundColor: "#020714" }}>
      
      {/* Base color layer - deep space background */}
      <div className="absolute inset-0" style={{
        background: "linear-gradient(135deg, #0a0515 0%, #0d0825 50%, #080520 100%)",
      }} />

      {/* Layer 1 — main breathing orb: deep violet/purple foundation */}
      <div className="orb breathe-a" style={{
        top: "-15%", left: "50%", width: 1200, height: 850,
        background: "radial-gradient(ellipse, rgba(168,85,247,0.35) 0%, rgba(109,40,217,0.18) 40%, rgba(59,130,246,0.08) 70%, transparent 85%)",
      }} />

      {/* Layer 2 — secondary orb: cool blue accent (slower) */}
      <div className="orb breathe-b" style={{
        top: "5%", left: "20%", width: 900, height: 700,
        background: "radial-gradient(ellipse, rgba(59,130,246,0.28) 0%, rgba(37,99,235,0.12) 45%, transparent 75%)",
      }} />

      {/* Layer 3 — tertiary orb: pink/magenta accent (counter-breathing) */}
      <div className="orb breathe-c" style={{
        top: "35%", right: "15%", width: 800, height: 600,
        background: "radial-gradient(ellipse, rgba(219,39,219,0.22) 0%, rgba(168,85,247,0.10) 50%, transparent 80%)",
      }} />

      {/* Layer 4 — subtle cyan glow bottom-right */}
      <div className="absolute" style={{
        top: "60%", right: "-10%", width: 600, height: 600,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(6,182,212,0.10) 0%, transparent 70%)",
        filter: "blur(120px)",
      }} />

      {/* Layer 5 — fine dot grid texture for depth */}
      <div className="absolute inset-0" style={{
        backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.08) 0.5px, transparent 0.5px)",
        backgroundSize: "32px 32px",
        maskImage: "radial-gradient(ellipse 100% 80% at 50% 20%, black 20%, rgba(0,0,0,0.6) 50%, transparent 80%)",
        WebkitMaskImage: "radial-gradient(ellipse 100% 80% at 50% 20%, black 20%, rgba(0,0,0,0.6) 50%, transparent 80%)",
        opacity: 0.6,
      }} />

      {/* Layer 6 — bottom fade for content clarity */}
      <div className="absolute inset-x-0 bottom-0 h-2/5" style={{
        background: "linear-gradient(to top, #020714 0%, rgba(2, 7, 20, 0.8) 30%, transparent 100%)",
      }} />

      {/* Layer 7 — top vignette for polish */}
      <div className="absolute inset-x-0 top-0 h-1/3" style={{
        background: "radial-gradient(ellipse 100% 100% at 50% 0%, rgba(0,0,0,0) 0%, rgba(0,0,0,0.3) 100%)",
      }} />
    </div>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ message, type, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3500);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div className={`fixed top-5 right-5 z-[200] flex items-center gap-3 px-5 py-3.5
                    bg-white/10 backdrop-blur-2xl border border-white/15 rounded-xl
                    shadow-2xl text-sm font-medium max-w-sm fade-up ${
      type === "error" ? "text-red-300" : "text-emerald-300"
    }`}>
      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
        type === "error" ? "bg-red-400" : "bg-emerald-400"
      }`} />
      <span className="flex-1">{message}</span>
      <button onClick={onDismiss}
        className="text-white/40 hover:text-white/80 transition-colors ml-2 w-5 h-5 flex items-center justify-center [&>svg]:w-4 [&>svg]:h-4">
        {Icons.x}
      </button>
    </div>
  );
}

// ── QR Modal ──────────────────────────────────────────────────────────────────

function QRModal({ shortUrl, qrCode, onClose }) {
  return (
    <div className="modal modal-open">
      <div className="modal-box bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-3xl border border-white/15
                      rounded-3xl shadow-3xl max-w-sm p-8 flex flex-col items-center gap-6">
        <div className="w-full flex justify-between items-center mb-2">
          <h3 className="font-black text-2xl text-white">QR Code</h3>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-white/50
                       hover:text-white hover:bg-white/10 transition-colors [&>svg]:w-4 [&>svg]:h-4">
            {Icons.x}
          </button>
        </div>
        <p className="text-white/30 text-xs">Scan with your phone to visit this link</p>
        
        <div className="bg-white p-5 rounded-2xl shadow-2xl">
          <img src={qrCode} alt="QR Code" className="w-56 h-56 block" />
        </div>
        
        <div className="w-full bg-white/5 border border-white/10 rounded-xl p-4">
          <p className="text-white/40 text-[10px] uppercase tracking-widest mb-1.5 font-bold">Short URL</p>
          <p className="text-white/80 text-sm font-mono break-all">{shortUrl}</p>
        </div>
        
        <a href={qrCode} download="qr-code.png"
           className="w-full text-center py-3 bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-400 hover:to-rose-400
                      text-white rounded-xl text-sm font-bold transition-colors">
          ⬇️ Download PNG
        </a>
      </div>
      <div className="modal-backdrop bg-black/60" onClick={onClose} />
    </div>
  );
}

// ── Stats Modal ───────────────────────────────────────────────────────────────

function StatsModal({ shortId, onClose }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    axios.get(`${API}/stats/${shortId}`)
      .then((r) => setData(r.data))
      .catch(() => setError("Failed to load stats"))
      .finally(() => setLoading(false));
  }, [shortId]);

  return (
    <div className="modal modal-open">
      <div className="modal-box bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-3xl border border-white/15
                      rounded-3xl shadow-3xl max-w-md p-8">
        <div className="flex justify-between items-center mb-7">
          <h3 className="font-black text-2xl text-white">📊 Analytics</h3>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-white/50
                       hover:text-white hover:bg-white/10 transition-colors [&>svg]:w-5 [&>svg]:h-5">
            {Icons.x}
          </button>
        </div>

        {loading && (
          <div className="flex justify-center py-12">
            <span className="loading loading-spinner loading-lg text-orange-400" />
          </div>
        )}
        {error && <p className="text-red-400 text-sm text-center py-6 font-medium">{error}</p>}

        {data && (
          <div className="flex flex-col gap-4">
            {/* Total Clicks */}
            <div className="bg-gradient-to-br from-white/8 to-white/4 border border-white/12 rounded-2xl p-6">
              <p className="text-white/40 text-xs uppercase tracking-widest font-bold mb-2">Total Clicks</p>
              <p className="text-5xl font-black text-white leading-none">{data.clicks.toLocaleString()}</p>
              {data.lastClickAt && (
                <p className="text-white/35 text-xs mt-3 font-medium">Last click {timeAgo(data.lastClickAt)}</p>
              )}
            </div>

            {/* Short URL */}
            <div className="bg-white/5 border border-white/10 rounded-2xl px-5 py-4">
              <p className="text-white/40 text-xs uppercase tracking-widest mb-2 font-bold">Short URL</p>
              <a href={data.shortUrl} target="_blank" rel="noreferrer"
                 className="text-orange-400 font-bold hover:text-orange-300 transition-colors block break-all text-sm">
                {data.shortUrl}
                {data.isCustomAlias && (
                  <span className="ml-2 text-xs bg-orange-500/20 text-orange-300 px-2 py-1 rounded-full font-medium inline">
                    custom
                  </span>
                )}
              </a>
            </div>

            {/* Original URL */}
            <div className="bg-white/5 border border-white/10 rounded-2xl px-5 py-4">
              <p className="text-white/40 text-xs uppercase tracking-widest mb-2 font-bold">Original URL</p>
              <p className="text-white/50 text-xs break-all font-mono">{data.originalUrl}</p>
            </div>

            {/* Created & Expiry */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-4">
                <p className="text-white/40 text-xs uppercase tracking-widest mb-1.5 font-bold">Created</p>
                <p className="text-white/80 text-sm font-medium">{new Date(data.createdAt).toLocaleDateString()}</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-4">
                <p className="text-white/40 text-xs uppercase tracking-widest mb-1.5 font-bold">Expires</p>
                <p className="text-white/80 text-sm font-medium">{formatExpiry(data.expiresAt) ?? "Never"}</p>
              </div>
            </div>
          </div>
        )}

        <button onClick={onClose}
          className="w-full mt-6 py-3 bg-white/6 hover:bg-white/10 border border-white/10
                     text-white/70 rounded-xl text-sm font-bold transition-colors">
          Close
        </button>
      </div>
      <div className="modal-backdrop bg-black/60" onClick={onClose} />
    </div>
  );
}

// ── History Item ──────────────────────────────────────────────────────────────

function HistoryItem({ item, onCopy, onQR, onStats, onDelete }) {
  const expired = item.expiresAt && new Date(item.expiresAt) < new Date();
  const [justCopied, setJustCopied] = useState(false);

  const copy = () => {
    onCopy(item.shortUrl);
    setJustCopied(true);
    setTimeout(() => setJustCopied(false), 2000);
  };

  return (
    <div className={`group flex items-center gap-3 px-5 py-4 transition-colors hover:bg-white/6 ${expired ? "opacity-40" : ""}`}>
      <span className={`w-2 h-2 rounded-full shrink-0 ${expired ? "bg-red-400/40" : "bg-gradient-to-r from-orange-400 to-rose-400"}`} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <a href={item.shortUrl} target="_blank" rel="noreferrer"
             className="text-white/90 font-bold text-sm hover:text-orange-400 transition-colors">
            {item.shortUrl.replace(/^https?:\/\//, "")}
          </a>
          {item.expiresAt && !expired && (
            <span className="text-[10px] text-amber-300 bg-amber-400/15 px-2 py-0.5 rounded-full font-medium">
              {formatExpiry(item.expiresAt)}
            </span>
          )}
          {expired && (
            <span className="text-[10px] text-red-400 bg-red-400/15 px-2 py-0.5 rounded-full font-medium">expired</span>
          )}
        </div>
        <p className="text-white/30 text-xs truncate">{item.originalUrl}</p>
      </div>

      <span className="text-white/25 text-xs hidden md:block shrink-0 font-medium">{timeAgo(item.createdAt)}</span>

      <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
        {[
          { icon: justCopied ? Icons.check : Icons.copy, title: "Copy",       fn: copy,                         active: justCopied },
          ...(item.qrCode ? [{ icon: Icons.qr,     title: "QR Code",    fn: () => onQR(item) }] : []),
          { icon: Icons.chart,                           title: "Analytics", fn: () => onStats(item.shortId) },
          { icon: Icons.x,                               title: "Remove",    fn: () => onDelete(item.shortId), danger: true },
        ].map(({ icon, title, fn, danger, active }) => (
          <button key={title} onClick={fn} title={title}
            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors [&>svg]:w-3.5 [&>svg]:h-3.5 ${
              active  ? "text-emerald-400 bg-emerald-400/15"
              : danger  ? "text-white/20 hover:text-red-400 hover:bg-red-400/15"
                        : "text-white/30 hover:text-white/75 hover:bg-white/10"
            }`}>
            {icon}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [url,        setUrl]        = useState("");
  const [alias,      setAlias]      = useState("");
  const [expiry,     setExpiry]     = useState("");
  const [showAdv,    setShowAdv]    = useState(false);
  const [result,     setResult]     = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [copied,     setCopied]     = useState(false);
  const [toast,      setToast]      = useState(null);
  const [history,    setHistory]    = useState(getHistory);
  const [qrModal,    setQrModal]    = useState(null);
  const [statsModal, setStatsModal] = useState(null);
  const [theme,      setTheme]      = useState(
    () => localStorage.getItem(THEME_KEY) || "dark"
  );

  const inputRef = useRef(null);
  const isDark   = theme === "dark";

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const showToast = useCallback((msg, type = "success") => setToast({ message: msg, type }), []);

  const handleShorten = async () => {
    if (!url.trim() || loading) return;
    try { new URL(url.trim()); }
    catch {
      showToast("Enter a valid URL — must start with http:// or https://", "error");
      return;
    }
    if (alias && !/^[a-zA-Z0-9_-]{3,30}$/.test(alias)) {
      showToast("Alias: 3–30 chars, letters / numbers / - _ only", "error");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await axios.post(`${API}/shorten`, {
        originalUrl: url.trim(),
        ...(alias  ? { alias }  : {}),
        ...(expiry ? { expiry } : {}),
      });
      const data = res.data;
      setResult(data);
      const newItem = {
        shortUrl: data.shortUrl, shortId: data.shortId,
        originalUrl: url.trim(), qrCode: data.qrCode,
        expiresAt: data.expiresAt, createdAt: new Date().toISOString(),
      };
      const updated = [newItem, ...history.filter((h) => h.shortId !== data.shortId)].slice(0, 15);
      setHistory(updated);
      saveHistory(updated);
      showToast("Link shortened!");
    } catch (err) {
      showToast(err.response?.data?.error ?? "Something went wrong. Try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = useCallback((text) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    showToast("Copied!");
    setTimeout(() => setCopied(false), 2000);
  }, [showToast]);

  const deleteItem = useCallback((shortId) => {
    const updated = history.filter((h) => h.shortId !== shortId);
    setHistory(updated);
    saveHistory(updated);
  }, [history]);

  // ── Glass style helpers ──
  const glass     = "bg-white/7 backdrop-blur-2xl border border-white/10";
  const glassHover = "hover:bg-white/10";
  const actionBtn  = `h-8 px-4 rounded-xl text-xs font-medium transition-all border
                      border-white/10 text-white/50 hover:bg-white/8 hover:text-white/80`;

  return (
    <div className={`min-h-screen flex flex-col relative ${isDark ? "text-white" : "bg-white text-gray-900"}`}>
      {isDark && <BreathingBg />}

      {toast    && <Toast    message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
      {qrModal  && <QRModal  shortUrl={qrModal.shortUrl} qrCode={qrModal.qrCode} onClose={() => setQrModal(null)} />}
      {statsModal && <StatsModal shortId={statsModal} onClose={() => setStatsModal(null)} />}

      {/* ── Nav ───────────────────────────────────────────────────────────── */}
      <header className={`h-16 flex items-center justify-between px-6 sticky top-0 z-50 ${
        isDark
          ? "bg-black/20 border-b border-white/5 backdrop-blur-xl"
          : "bg-white/80 border-b border-gray-100 backdrop-blur-xl"
      }`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-rose-500 flex items-center justify-center text-white font-bold text-lg">
            ⚡
          </div>
          <div className="flex flex-col">
            <span className={`font-black tracking-tight text-sm ${isDark ? "text-white" : "text-gray-900"}`}>
              ShortLink
            </span>
            <span className={`text-[10px] ${isDark ? "text-white/35" : "text-gray-400"}`}>
              URL Shortener
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all ${
              isDark
                ? "text-white/50 hover:text-white/90 hover:bg-white/10"
                : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            }`}
            title="Toggle theme"
          >
            {isDark ? "☀️" : "🌙"}
          </button>
        </div>
      </header>

      {/* ── Main ──────────────────────────────────────────────────────────── */}
      <main className={`flex-1 flex flex-col items-center px-4 py-12 ${isDark ? "bg-transparent" : "bg-gray-50"}`}>
        <div className="w-full max-w-2xl flex flex-col items-center gap-10">

          {/* ── Hero Section ────────────────────────────────────────────────── */}
          <div className="text-center space-y-6 pt-6">
            <div className="inline-block">
              <span className={`inline-block px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wide ${
                isDark
                  ? "bg-gradient-to-r from-orange-500/20 to-rose-500/20 text-orange-300 border border-orange-500/30"
                  : "bg-orange-100 text-orange-700 border border-orange-200"
              }`}>
                ✨ Free & Fast Link Shortener
              </span>
            </div>
            
            <h1 className={`text-6xl md:text-7xl font-black tracking-tight leading-[1.0] ${
              isDark
                ? "bg-gradient-to-r from-white via-orange-200 to-orange-300 bg-clip-text text-transparent"
                : "text-gray-900"
            }`}>
              Shorten URLs with Ease
            </h1>
            
            <p className={`text-lg md:text-xl max-w-md mx-auto ${
              isDark ? "text-white/50" : "text-gray-500"
            }`}>
              Generate QR codes, track clicks, and customize your links—all in one place.
            </p>
          </div>

          {/* ── Input Card ────────────────────────────────────────────────────── */}
          <div className={`w-full rounded-3xl p-6 md:p-8 shadow-2xl backdrop-blur-xl ${
            isDark
              ? "bg-gradient-to-br from-white/8 to-white/5 border border-white/10"
              : "bg-white border border-gray-200"
          }`}>
            
            {/* URL Input Row */}
            <div className="flex gap-3 mb-5">
              <div className="relative flex-1">
                <input
                  ref={inputRef}
                  type="url"
                  className={`w-full h-12 pl-5 pr-12 rounded-xl text-sm outline-none font-medium ${
                    isDark
                      ? "bg-white/8 border border-white/15 text-white placeholder-white/30 focus:border-orange-400/50 focus:bg-white/12"
                      : "bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                  }`}
                  placeholder="Paste your long URL here..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleShorten()}
                  autoFocus
                />
                {url && (
                  <button
                    onClick={() => { setUrl(""); inputRef.current?.focus(); }}
                    className={`absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full transition-colors [&>svg]:w-3.5 [&>svg]:h-3.5 ${
                      isDark ? "text-white/35 hover:text-white/60" : "text-gray-300 hover:text-gray-500"
                    }`}
                  >
                    {Icons.x}
                  </button>
                )}
              </div>

              <button
                onClick={handleShorten}
                disabled={loading || !url.trim()}
                className={`h-12 px-7 rounded-xl font-bold text-sm text-white transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shrink-0 shadow-xl ${
                  isDark
                    ? "bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-400 hover:to-rose-400 shadow-orange-600/30"
                    : "bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600 shadow-orange-600/20"
                }`}
              >
                {loading ? (
                  <>
                    <span className="loading loading-spinner loading-xs" />
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <span>⚡</span>
                    <span>Shorten</span>
                  </>
                )}
              </button>
            </div>

            {/* Advanced Options Toggle */}
            <button
              onClick={() => setShowAdv((v) => !v)}
              className={`flex items-center gap-2 text-xs font-medium transition-colors select-none ${
                isDark
                  ? "text-white/35 hover:text-white/60"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className={`w-3 h-3 transition-transform duration-300 ${showAdv ? "rotate-90" : ""}`}>
                <path d="M8 5l8 7-8 7"/>
              </svg>
              <span>Advanced Options</span>
            </button>

            {/* Advanced Options */}
            {showAdv && (
              <div className={`mt-6 pt-6 border-t grid grid-cols-1 sm:grid-cols-2 gap-5 ${
                isDark ? "border-white/8" : "border-gray-200"
              }`}>
                {/* Custom Alias */}
                <div className="space-y-2">
                  <label className={`block text-xs font-bold uppercase tracking-widest ${
                    isDark ? "text-white/40" : "text-gray-500"
                  }`}>
                    Custom Alias
                  </label>
                  <div className={`flex items-center h-10 px-4 rounded-lg text-sm transition-all ${
                    isDark
                      ? "bg-white/6 border border-white/12 focus-within:border-orange-400/50"
                      : "bg-gray-50 border border-gray-200 focus-within:border-orange-400"
                  }`}>
                    <span className={`shrink-0 mr-2 text-sm font-medium ${isDark ? "text-white/25" : "text-gray-400"}`}>
                      short.ly/
                    </span>
                    <input
                      type="text"
                      className={`flex-1 min-w-0 outline-none bg-transparent text-sm font-medium ${
                        isDark ? "text-white placeholder-white/20" : "text-gray-900 placeholder-gray-400"
                      }`}
                      placeholder="my-link"
                      value={alias}
                      onChange={(e) => setAlias(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
                      maxLength={30}
                    />
                  </div>
                  <p className={`text-xs ${isDark ? "text-white/25" : "text-gray-400"}`}>
                    3–30 characters (letters, numbers, dash, underscore)
                  </p>
                </div>

                {/* Link Expiry */}
                <div className="space-y-2">
                  <label className={`block text-xs font-bold uppercase tracking-widest ${
                    isDark ? "text-white/40" : "text-gray-500"
                  }`}>
                    Link Expiry
                  </label>
                  <select
                    className={`w-full h-10 px-4 rounded-lg text-sm outline-none font-medium transition-all cursor-pointer ${
                      isDark
                        ? "bg-white/6 border border-white/12 text-white focus:border-orange-400/50"
                        : "bg-gray-50 border border-gray-200 text-gray-900 focus:border-orange-400"
                    }`}
                    value={expiry}
                    onChange={(e) => setExpiry(e.target.value)}
                  >
                    {EXPIRY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <p className={`text-xs ${isDark ? "text-white/25" : "text-gray-400"}`}>
                    Links automatically stop working after this period
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ── Result Card ────────────────────────────────────────────────────── */}
          {result && (
            <div className={`w-full rounded-3xl overflow-hidden border shadow-2xl fade-up ${
              isDark
                ? "bg-gradient-to-br from-white/8 to-white/5 border-white/10"
                : "bg-white border-gray-200"
            }`}>
              
              {/* Header */}
              <div className={`flex items-center gap-3 px-6 py-4 border-b ${
                isDark ? "bg-white/4 border-white/8" : "bg-gray-50 border-gray-100"
              }`}>
                <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-emerald-400 to-teal-400 pulse-soft" />
                <span className={`text-xs font-bold uppercase tracking-widest ${
                  isDark ? "text-white/40" : "text-gray-500"
                }`}>
                  ✓ Short link ready
                </span>
              </div>

              <div className="px-6 py-6 space-y-5">
                
                {/* Short URL Display */}
                <div
                  className={`group flex items-center gap-4 rounded-2xl px-5 py-4 cursor-pointer transition-all ${
                    isDark ? "bg-white/6 hover:bg-white/10" : "bg-gray-50 hover:bg-gray-100"
                  }`}
                  onClick={() => handleCopy(result.shortUrl)}
                  title="Click to copy"
                >
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold uppercase tracking-widest mb-1 ${
                      isDark ? "text-white/35" : "text-gray-500"
                    }`}>
                      Your Short URL
                    </p>
                    <p className={`text-2xl md:text-3xl font-black break-all group-hover:text-orange-400 transition-colors ${
                      isDark ? "text-white" : "text-gray-900"
                    }`}>
                      {result.shortUrl.replace(/^https?:\/\//, "")}
                    </p>
                  </div>
                  <button
                    className={`shrink-0 h-10 px-4 rounded-lg text-xs font-bold pointer-events-none transition-all border flex items-center gap-2 ${
                      copied
                        ? isDark
                          ? "bg-emerald-400/15 text-emerald-400 border-emerald-400/30"
                          : "bg-emerald-100 text-emerald-700 border-emerald-200"
                        : isDark
                          ? "bg-white/6 text-white/50 border-white/10"
                          : "bg-white text-gray-500 border-gray-200"
                    }`}
                  >
                    <span className="[&>svg]:w-3.5 [&>svg]:h-3.5">{copied ? Icons.check : Icons.copy}</span>
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>

                {/* Info Row */}
                <div className={`flex flex-wrap gap-4 text-xs px-1 font-medium ${
                  isDark ? "text-white/40" : "text-gray-500"
                }`}>
                  <span>🕐 {result.expiresAt ? formatExpiry(result.expiresAt) : "Never expires"}</span>
                  <span>•</span>
                  <span>👁️ 0 clicks</span>
                  {alias && <><span>•</span><span className="text-orange-400 font-bold">⭐ Custom alias</span></>}
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-3 gap-3 pt-2">
                  <button
                    onClick={() => setQrModal({ shortUrl: result.shortUrl, qrCode: result.qrCode })}
                    className={`h-10 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-2 ${
                      isDark
                        ? "bg-white/6 text-white/70 border border-white/10 hover:bg-white/10 hover:text-white"
                        : "bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200"
                    }`}
                  >
                    📱 QR Code
                  </button>
                  <button
                    onClick={() => setStatsModal(result.shortId)}
                    className={`h-10 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-2 ${
                      isDark
                        ? "bg-white/6 text-white/70 border border-white/10 hover:bg-white/10 hover:text-white"
                        : "bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200"
                    }`}
                  >
                    📊 Stats
                  </button>
                  <a
                    href={result.shortUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={`h-10 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-2 ${
                      isDark
                        ? "bg-gradient-to-r from-orange-500/20 to-rose-500/20 text-orange-300 border border-orange-500/30 hover:from-orange-500/30 hover:to-rose-500/30"
                        : "bg-orange-100 text-orange-700 border border-orange-200 hover:bg-orange-200"
                    }`}
                  >
                    🔗 Open
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* ── Feature Grid ────────────────────────────────────────────────── */}
          <div className="w-full">
            <h2 className={`text-xs font-bold uppercase tracking-widest mb-4 ${
              isDark ? "text-white/35" : "text-gray-500"
            }`}>
              Why Choose ShortLink?
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {FEATURES.map(({ icon, label, ring, bg, text }) => (
                <div key={label}
                  className={`group p-4 rounded-2xl border transition-all cursor-default ${
                    isDark
                      ? `bg-white/4 border-white/8 hover:bg-white/8 hover:border-white/12`
                      : `bg-gray-50 border-gray-100 hover:bg-gray-100`
                  }`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mb-3 ring-1 transition-all group-hover:scale-110 ${ring} ${bg} ${text} [&>svg]:w-5 [&>svg]:h-5`}>
                    {icon}
                  </div>
                  <span className={`text-xs font-bold leading-tight ${
                    isDark ? "text-white/65" : "text-gray-700"
                  }`}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Recent Links ────────────────────────────────────────────────── */}
          {history.length > 0 && (
            <div className="w-full">
              <div className="flex items-center justify-between mb-4 px-1">
                <h2 className={`text-xs font-bold uppercase tracking-widest ${
                  isDark ? "text-white/35" : "text-gray-500"
                }`}>
                  📋 Recent Links
                </h2>
                <button
                  onClick={() => { setHistory([]); saveHistory([]); }}
                  className={`text-xs font-medium transition-colors ${
                    isDark ? "text-white/25 hover:text-red-400" : "text-gray-400 hover:text-red-500"
                  }`}
                >
                  Clear
                </button>
              </div>
              <div className={`rounded-2xl overflow-hidden border ${
                isDark
                  ? `bg-white/4 border-white/8 divide-y divide-white/5`
                  : "bg-white border-gray-200 shadow-sm divide-y divide-gray-50"
              }`}>
                {history.slice(0, 8).map((item) => (
                  <HistoryItem
                    key={item.shortId}
                    item={item}
                    onCopy={handleCopy}
                    onQR={(i) => setQrModal({ shortUrl: i.shortUrl, qrCode: i.qrCode })}
                    onStats={(id) => setStatsModal(id)}
                    onDelete={deleteItem}
                  />
                ))}
              </div>
            </div>
          )}

        </div>
      </main>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className={`py-8 text-center text-xs border-t ${
        isDark ? "text-white/18 border-white/5 bg-black/20" : "text-gray-400 border-gray-100"
      }`}>
        <p className="mb-2 font-semibold">ShortLink • Express · MongoDB · Redis · React</p>
        <p className={isDark ? "text-white/12" : "text-gray-400"}>Made with ❤️ for faster sharing</p>
      </footer>
    </div>
  );
}
