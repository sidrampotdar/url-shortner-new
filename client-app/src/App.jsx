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
  clock: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M5 22h14M5 2h14l.001-3a2 2 0 0 0-.586-1.414L12 11l-6.415 6.414A2 2 0 0 0 5 18.828zM12 11L5.585 4.586A2 2 0 0 1 5 3.172V2h14v1.172a2 2 0 0 1-.586 1.414L12 11z"/></svg>,
  qr:     <Svg><rect x="3"  y="3"  width="7" height="7" rx="1"/><rect x="14" y="3"  width="7" height="7" rx="1"/><rect x="3"  y="14" width="7" height="7" rx="1"/><rect x="4"  y="4"  width="5" height="5" rx="0.5" fill="currentColor" className="opacity-60"/><rect x="15" y="4"  width="5" height="5" rx="0.5" fill="currentColor" className="opacity-60"/><rect x="4"  y="15" width="5" height="5" rx="0.5" fill="currentColor" className="opacity-60"/><rect x="14" y="14" width="3" height="3" rx="0.5"/><rect x="19" y="14" width="2" height="2" rx="0.5"/><rect x="19" y="18" width="2" height="2" rx="0.5"/><rect x="14" y="19" width="3" height="2" rx="0.5"/></Svg>,
  pencil: <Svg><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></Svg>,
  copy:   <Svg><rect x="9" y="9" width="13" height="13" rx="2" strokeWidth="0"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></Svg>,
  check:  <Svg><path d="M20 6 9 17l-5-5"/></Svg>,
  x:      <Svg><path d="M18 6 6 18M6 6l12 12"/></Svg>,
};

const FEATURES = [
  { icon: Icons.bolt,   label: "Sub-100ms redirects", ring: "", bg: "bg-blue-500/10",    text: "text-blue-400 border border-blue-500/20"    },
  { icon: Icons.shield, label: "SSRF protected",       ring: "", bg: "bg-amber-500/10",  text: "text-amber-500 border border-amber-500/20"  },
  { icon: Icons.chart,  label: "Click analytics",      ring: "", bg: "bg-emerald-500/10", text: "text-emerald-500 border border-emerald-500/20" },
  { icon: Icons.clock,  label: "Link expiry",           ring: "", bg: "bg-purple-500/10",  text: "text-purple-400 border border-purple-500/20"  },
  { icon: Icons.qr,     label: "QR codes",              ring: "", bg: "bg-cyan-500/10",   text: "text-cyan-400 border border-cyan-500/20"   },
  { icon: Icons.pencil, label: "Custom aliases",        ring: "", bg: "bg-yellow-500/10",  text: "text-yellow-500 border border-yellow-500/20"  },
];

// ── Breathing background ──────────────────────────────────────────────────────

function BreathingBg() {
  return (
    <div className="fixed inset-0 -z-10 bg-[#161722] overflow-hidden">
      <div className="absolute inset-0" style={{
        background: "radial-gradient(circle at 30% 40%, rgba(60,40,110,0.5) 0%, transparent 50%), radial-gradient(circle at 70% 60%, rgba(40,50,90,0.4) 0%, transparent 60%)"
      }} />
      <div className="absolute right-0 top-0 bottom-0 w-[50%] opacity-20 pointer-events-none" style={{
        backgroundImage: "url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSI0MCI+PHBhdGggZD0iTTEyIDBMIDI0IDEwTCAyNCAzMEwgMTIgNDBMIDAgMzBMIDAgMTBaIiBmaWxsPSJub25lIiBzdHJva2U9InJnYmEoMjU1LDI1NSwyNTUsMC4xNSkiIHN0cm9rZS13aWR0aD0iMSIvPjwvc3ZnPg==')",
        backgroundSize: "40px",
        maskImage: "linear-gradient(to right, transparent, black 80%)"
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
  const [theme]             = useState(
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



  return (
    <div className={`min-h-screen flex flex-col relative text-white selection:bg-purple-500/30 overflow-x-hidden ${isDark ? "dark" : ""}`}>
      <BreathingBg />

      {toast    && <Toast    message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
      {qrModal  && <QRModal  shortUrl={qrModal.shortUrl} qrCode={qrModal.qrCode} onClose={() => setQrModal(null)} />}
      {statsModal && <StatsModal shortId={statsModal} onClose={() => setStatsModal(null)} />}

      <header className="w-full flex items-center justify-between px-6 md:px-10 h-24 z-50">
        <div className="flex items-center gap-2">
          <div className="text-white/70">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
            </svg>
          </div>
          <span className="font-bold text-lg tracking-wide text-gray-100">ShortLink</span>
        </div>
        <button className="px-5 py-2 rounded-full border border-white/20 text-xs font-semibold text-white/90 hover:bg-white/5 transition-colors">
          More tools soon
        </button>
      </header>

      <main className="flex-1 w-full flex flex-col items-center pt-8 md:pt-16 pb-20 px-4 md:px-8 z-10">
        
        <div className="text-center mb-10 max-w-4xl px-4">
          <h1 className="text-5xl md:text-[56px] font-bold tracking-tight mb-5 text-white/95">
            Shorten. <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">Share.</span> Track.
          </h1>
          <p className="text-gray-400 text-lg md:text-[17px] font-medium leading-relaxed">
            Clean short links with QR codes and click analytics.
          </p>
        </div>

        <div className="w-full max-w-[700px] bg-white/[0.04] backdrop-blur-2xl border border-white/10 rounded-2xl p-5 mb-14 shadow-2xl relative">
          
          <div className="flex flex-col sm:flex-row gap-3 mb-4 w-full justify-center text-center">
            <div className="flex flex-col sm:flex-row gap-3 w-full max-w-[650px] mx-auto">
                <input
                  ref={inputRef}
                  type="url"
                  className="flex-1 w-full md:w-auto h-11 bg-white/5 border border-white/10 rounded-lg px-4 text-sm outline-none text-white placeholder-white/30 focus:border-purple-500/50 focus:bg-white/10 transition-all shadow-inner"
                  placeholder="https://example.com/paste-your-long-link-here"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleShorten()}
                  autoFocus
                />
                
                <button
                  onClick={handleShorten}
                  disabled={loading || !url.trim()}
                  className="h-11 px-6 rounded-lg font-bold text-[13px] text-white transition-all bg-gradient-to-r from-[rgba(168,85,247,0.85)] to-[rgba(236,72,153,0.85)] hover:opacity-90 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 whitespace-nowrap md:w-auto w-full shadow-lg border border-white/10"
                >
                  {loading ? (
                    <span className="loading loading-spinner loading-xs" />
                  ) : (
                    <>Shorten &rarr;</>
                  )}
                </button>
            </div>
          </div>

          <div className="flex justify-center mb-1">
            <button
              onClick={() => setShowAdv((v) => !v)}
              className="px-4 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-[11px] font-semibold text-white/60 transition-colors flex items-center gap-2 shadow-sm"
            >
              Advanced options
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`w-3 h-3 transition-transform ${showAdv ? 'rotate-180' : ''}`}><polyline points="6 9 12 15 18 9"></polyline></svg>
            </button>
          </div>
          
          {showAdv && (
            <div className="mt-5 mb-1 mx-2 p-5 border border-white/5 bg-black/10 rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-8 text-left">
              <div className="space-y-2.5">
                <label className="block text-[10px] font-bold uppercase tracking-[0.1em] text-white/50">
                  CUSTOM ALIAS
                </label>
                <div className="flex bg-white/5 border border-white/10 rounded-md h-[42px] items-center px-3 focus-within:border-purple-500/50 transition-colors">
                  <span className="text-white/40 text-[13px] font-medium mr-1 select-none">shert.ly/</span>
                  <input
                    type="text"
                    className="flex-1 bg-transparent border-none outline-none text-[13px] text-white placeholder-white/30 w-full"
                    placeholder="my-link"
                    value={alias}
                    onChange={(e) => setAlias(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
                  />
                </div>
                <p className="text-[10px] text-white/40 font-medium tracking-wide">Letters, numbers, _ (3-30 chars)</p>
              </div>
              
              <div className="space-y-2.5">
                <label className="block text-[10px] font-bold uppercase tracking-[0.1em] text-white/50">
                  LINK EXPIRY
                </label>
                <div className="relative">
                  <select
                    className="w-full bg-white/5 border border-white/10 rounded-md h-[42px] px-3 pr-8 text-[13px] text-white outline-none appearance-none focus:border-purple-500/50 transition-colors cursor-pointer"
                    value={expiry}
                    onChange={(e) => setExpiry(e.target.value)}
                  >
                    {EXPIRY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value} className="bg-[#1a1b26] text-white">{o.label}</option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-white/40">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-[14px] h-[14px]"><polyline points="6 9 12 15 18 9"></polyline></svg>
                  </div>
                </div>
                <p className="text-[10px] text-white/40 font-medium tracking-wide">After this, link stops working</p>
              </div>
            </div>
          )}

        </div>

        {/* Features grid exactly like image */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-12 sm:gap-x-16 gap-y-10 mb-10 w-full max-w-[800px] justify-center text-center sm:text-left self-center">
          {FEATURES.map((feat) => (
            <div key={feat.label} className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 sm:justify-start">
              <div className={`w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0 ${feat.bg} ${feat.text} shadow-sm`}>
                 {feat.icon}
              </div>
              <span className="text-[14px] font-semibold text-white/90 whitespace-nowrap">
                {feat.label}
              </span>
            </div>
          ))}
        </div>

        {/* Modals & History (invisible until used) */}
        {result && (
          <div className="mt-8 bg-white/5 border border-white/10 rounded-2xl p-5 mb-8 text-center max-w-sm mx-auto shadow-2xl">
            <p className="text-xs font-bold text-emerald-400 mb-2 uppercase tracking-wider">Ready!</p>
            <p className="text-xl font-bold text-white mb-4">{result.shortUrl}</p>
            <div className="flex gap-2 justify-center">
               <button onClick={() => handleCopy(result.shortUrl)} className="px-4 py-1.5 bg-white/10 rounded text-xs font-semibold hover:bg-white/20 transition-colors">{copied ? "Copied" : "Copy"}</button>
               <button onClick={() => setQrModal({ shortUrl: result.shortUrl, qrCode: result.qrCode })} className="px-4 py-1.5 bg-white/10 rounded text-xs font-semibold hover:bg-white/20 transition-colors">QR Code</button>
            </div>
          </div>
        )}

      </main>

      <footer className="w-full text-center pb-6 md:pb-8 pt-4">
        <p className="text-white/30 text-[11px] font-medium tracking-widest">
          ShortLink · Express · MongoDB · Redis · React
        </p>
      </footer>



    </div>
  );
}
