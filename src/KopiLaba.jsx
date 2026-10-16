import { useState, useEffect, useRef, useMemo } from "react";

// KopiLaba styles are kept in this file so layout and behavior have one source of truth.


// ============================================================
// KONFIGURASI
// ============================================================
const SUPABASE_URL = "https://mxylkyoehzpbbsxgyhcx.supabase.co";
const SUPABASE_KEY = "sb_publishable_JSxrkF5z0bI9aJtl3eucag_OX7GN06D";
const ADMIN_EMAIL = "kopigaleri77@gmail.com";

// ============================================================
// HELPER: FORMAT & UTIL
// ============================================================
const compressImage = async (file, { maxDimension = 1280, maxBytes = 280 * 1024, quality = 0.78 } = {}) => {
  if (!file || !file.type?.startsWith("image/")) return file;
  if (!("createImageBitmap" in window)) return file;

  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    let width = Math.max(1, Math.round(bitmap.width * scale));
    let height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) { bitmap.close?.(); return file; }

    let blob = null;
    let currentQuality = quality;
    for (let attempt = 0; attempt < 5; attempt++) {
      canvas.width = width;
      canvas.height = height;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(bitmap, 0, 0, width, height);
      blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", currentQuality));
      if (!blob) break;
      if (blob.size <= maxBytes) break;
      currentQuality = Math.max(0.52, currentQuality - 0.09);
      if (attempt >= 2) {
        width = Math.max(1, Math.round(width * 0.82));
        height = Math.max(1, Math.round(height * 0.82));
      }
    }
    bitmap.close?.();
    if (!blob || blob.size >= file.size) return file;
    const baseName = (file.name || "foto").replace(/\.[^.]+$/, "") || "foto";
    return new File([blob], baseName + ".webp", {
      type: "image/webp",
      lastModified: Date.now(),
    });
  } catch (error) {
    bitmap?.close?.();
    console.warn("Kompresi gambar dilewati:", error);
    return file;
  }
};

const fmt = (n) => "Rp " + Number(n || 0).toLocaleString("id-ID");
const escapeHTML = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);

// Normalisasi timestamp agar tanggal dan jam konsisten dengan kalender WIB.
const parseTimestampWIB = (value) => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  let text = String(value).trim();
  if (!/(Z|[+-]\d{2}:?\d{2})$/i.test(text)) text += "Z";
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
};
const dateKeyWIB = (value) => {
  const date = parseTimestampWIB(value);
  if (!date) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(date);
  const part = (type) => parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
};
const todayWIB = () => dateKeyWIB(new Date());
const shiftDateKey = (dateKey, days) => {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};
const shiftMonthKey = (dateKey, months) => {
  const [year, month, day] = dateKey.split("-").map(Number);
  const targetMonth = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(targetMonth.getUTCFullYear(), targetMonth.getUTCMonth() + 1, 0)).getUTCDate();
  targetMonth.setUTCDate(Math.min(day, lastDay));
  return targetMonth.toISOString().slice(0, 10);
};

// Parse field item (JSON baru atau string lama "nama x2, ...")
const parseItems = (itemStr) => {
  if (!itemStr) return [];
  try {
    const items = JSON.parse(itemStr);
    if (Array.isArray(items)) return items;
  } catch (e) {}
  return itemStr.split(", ").map((part) => {
    const [nama, qtyStr] = part.split(" x");
    const qty = parseInt(qtyStr) || 1;
    return { nama, qty, harga: 0, total: 0 };
  });
};

const formatJamWIB = (value) => {
  const date = parseTimestampWIB(value);
  if (!date) return "-";
  return date.toLocaleTimeString("id-ID", {
    timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  });
};

const formatTanggalWIB = (value) => {
  const date = parseTimestampWIB(value);
  if (!date) return "-";
  return date.toLocaleDateString("id-ID", {
    timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit"
  });
};

const formatDateTimeWIB = (value) => {
  const date = parseTimestampWIB(value);
  if (!date) return "-";
  return date.toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta", day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  });
};

// ============================================================
// PRINT RECEIPT (KUITANSI)
// ============================================================
const buildReceiptHTML = (data, printerSettings = {}) => {
  const {
    namaKafe, alamatKafe, teleponKafe,
    nomorTrx, tanggal, kasir, kasirRole,
    items, subtotal, pajak, pajakPersen,
    total, bayar, kembalian, metode, status, bayarTunai, bayarQris,
  } = data;
  const paperWidth = printerSettings.paper === "80" ? "72mm" : printerSettings.paper === "A4" ? "190mm" : printerSettings.paper === "58" ? "48mm" : "100%";
  const receiptFontSize = printerSettings.fontSize === "compact" ? "10px" : printerSettings.fontSize === "large" ? "13px" : "12px";
  const printMargin = ["2", "4", "6"].includes(String(printerSettings.margin)) ? printerSettings.margin + "mm" : "4mm";

  const itemRows = (items || [])
    .map(
      (it) => `
    <tr>
      <td style="padding:2px 0; vertical-align:top;">${escapeHTML(it.nama)}${it.catatan ? `<div style="font-size:10px;color:#555">Catatan: ${escapeHTML(it.catatan)}</div>` : ""}${it.nomor_antrean ? `<div style="font-size:10px;color:#555">Antrean: ${escapeHTML(it.nomor_antrean)}</div>` : ""}</td>
      <td style="text-align:right; padding:2px 0;">${fmt(it.harga ?? (Number(it.qty) ? Number(it.total || 0) / Number(it.qty) : 0))}</td>
      <td style="text-align:center; padding:2px 0;">${escapeHTML(it.qty)}</td>
      <td style="text-align:right; padding:2px 0;">${fmt(it.total)}</td>
    </tr>`
    )
    .join("");

  const isLunas = status === "lunas";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Struk ${escapeHTML(nomorTrx || "")}</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: ${receiptFontSize};
    padding: 4px;
    color: #000;
    background: #fff;
    width: ${paperWidth};
    max-width: 100%;
    margin: 0 auto;
  }
  .center { text-align: center; }
  .dashed { border-top: 1px dashed #000; margin: 6px 0; }
  .solid  { border-top: 1px solid  #000; margin: 6px 0; }
  table   { width: 100%; border-collapse: collapse; }
  .name   { font-size: 15px; font-weight: bold; letter-spacing: 1px; }
  .row    { display: flex; justify-content: space-between; padding: 1px 0; gap: 8px; }
  .row span:last-child { text-align: right; }
  .total-row { font-weight: bold; font-size: 13px; }
  .footer { font-size: 10px; color: #333; }
  @media print {
    body { padding: 0; width: ${paperWidth}; max-width: 100%; }
    @page { size: ${printerSettings.paper === "A4" ? "A4" : "auto"}; margin: ${printMargin}; }
  }
</style>
</head>
<body>
  <div class="center">
    <div class="name">${escapeHTML(namaKafe || "KAFE")}</div>
    ${printerSettings.showAddress === false ? "" : (alamatKafe ? `<div>${escapeHTML(alamatKafe)}</div>` : "")}
    ${printerSettings.showPhone === false ? "" : (teleponKafe ? `<div>Telp: ${escapeHTML(teleponKafe)}</div>` : "")}
  </div>
  <div class="dashed"></div>
  <div class="row"><span>No</span><span>${escapeHTML(nomorTrx || "-")}</span></div>
  <div class="row"><span>Tgl</span><span>${escapeHTML(tanggal || "-")}</span></div>
  <div class="row"><span>Kasir</span><span>${escapeHTML(kasir || "Admin")}${kasirRole ? ` (${escapeHTML(kasirRole)})` : ""}</span></div>
  <div class="dashed"></div>
  <table>
    <thead>
      <tr>
        <th style="text-align:left; font-weight:normal;">Item</th>
        <th style="text-align:right; font-weight:normal;">Harga</th>
        <th style="text-align:center; font-weight:normal;">Qty</th>
        <th style="text-align:right; font-weight:normal;">Total</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>
  <div class="dashed"></div>
  <div class="row"><span>Subtotal</span><span>${fmt(subtotal)}</span></div>
  ${pajak > 0 ? `<div class="row"><span>Pajak (${pajakPersen || 0}%)</span><span>${fmt(pajak)}</span></div>` : ""}
  <div class="solid"></div>
  <div class="row total-row"><span>TOTAL BIAYA</span><span>${fmt(total)}</span></div>
  <div class="solid"></div>
  <div class="row"><span>Jumlah Bayar (${escapeHTML(metode || "Tunai")})</span><span>${fmt(bayar)}</span></div>
  ${Number(bayarTunai || 0) > 0 && Number(bayarQris || 0) > 0 ? `<div class="row"><span>Bagian Tunai</span><span>${fmt(bayarTunai)}</span></div><div class="row"><span>Bagian QRIS</span><span>${fmt(bayarQris)}</span></div>` : ""}
  <div class="row"><span>Kembalian</span><span>${fmt(kembalian)}</span></div>
  <div class="solid"></div>
  <div class="center" style="font-weight:bold;">${isLunas ? "LUNAS" : "** BELUM LUNAS **"}</div>
  <div class="dashed"></div>
  <div class="center footer" style="margin-top:6px;">
    <div>Powered by KopiLaba</div>
    <div>Manajemen Keuangan Kafe</div>
  </div>
</body>
</html>`;
};

const receiptTextForBluetooth = (data) => {
  const lines = [
    String(data.namaKafe || "KOPILABA"),
    data.alamatKafe || "",
    data.teleponKafe || "",
    "--------------------------------",
    "No: " + (data.nomorTrx || "-"),
    "Tanggal: " + (data.tanggal || "-"),
    "Kasir: " + (data.kasir || "-"),
    "--------------------------------",
    ...(data.items || []).map((it) => {
      const name = String(it.nama || it.name || "Item").replace(/[^\x20-\x7E]/g, "?");
      const qty = Number(it.qty || 1);
      const price = Number(it.total ?? (Number(it.harga || 0) * qty));
      return [name, "  " + qty + " x Rp" + Number(it.harga || 0).toLocaleString("id-ID"), "  = Rp" + price.toLocaleString("id-ID")].join("\n");
    }),
    "--------------------------------",
    "Subtotal: Rp" + Number(data.subtotal || 0).toLocaleString("id-ID"),
    ...(Number(data.pajak || 0) > 0 ? ["Pajak: Rp" + Number(data.pajak).toLocaleString("id-ID")] : []),
    "TOTAL: Rp" + Number(data.total || 0).toLocaleString("id-ID"),
    "Bayar: Rp" + Number(data.bayar || 0).toLocaleString("id-ID"),
    "Kembali: Rp" + Number(data.kembalian || 0).toLocaleString("id-ID"),
    "Metode: " + (data.metode || "-"),
    "",
    "Terima kasih",
    "Powered by KopiLaba",
    "",
    ""
  ];
  return lines.join("\n").replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "?") + "\n";
};

const printReceipt = (data, printerSettings = {}) => {
  try {
    if (typeof window !== "undefined" && typeof window.__kopilabaActivePrint === "function") {
      window.__kopilabaActivePrint(data).catch((err) => alert("Gagal mencetak melalui koneksi yang dipilih: " + (err?.message || err)));
      return;
    }
    if (typeof window !== "undefined" && typeof window.__kopilabaBlePrint === "function") {
      window.__kopilabaBlePrint(data).catch((err) => alert("Gagal mencetak melalui Bluetooth BLE: " + (err?.message || err)));
      return;
    }
    if (typeof window !== "undefined" && typeof window.__kopilabaUsbPrint === "function") {
      window.__kopilabaUsbPrint(data).catch((err) => alert("Gagal mencetak melalui USB: " + (err?.message || err)));
      return;
    }
    if (typeof window !== "undefined" && typeof window.__kopilabaSerialPrint === "function") {
      window.__kopilabaSerialPrint(data).catch((err) => alert("Gagal mencetak melalui Bluetooth klasik/serial: " + (err?.message || err)));
      return;
    }
    const html = buildReceiptHTML(data, printerSettings);
    const w = window.open("", "_blank", "width=420,height=680");
    if (!w) {
      alert("Popup diblokir oleh browser. Izinkan popup untuk mencetak struk.");
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => {
      try { w.print(); } catch (e) { console.error("Print error:", e); }
    }, 400);
  } catch (err) {
    console.error("printReceipt error:", err);
    alert("Gagal membuka jendela print: " + err.message);
  }
};

// ============================================================
// API
// ============================================================
const api = async (endpoint, method = "GET", body = null, token = null) => {
  try {
    const headers = {
      "Content-Type": "application/json",
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${token || SUPABASE_KEY}`,
      Prefer: "return=representation",
    };
    const res = await fetch(`${SUPABASE_URL}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null,
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`HTTP ${res.status}: ${errText || res.statusText}`);
    }
    if (res.status === 204) return [];
    const responseText = await res.text();
    if (!responseText) return [];
    try {
      return JSON.parse(responseText);
    } catch (_) {
      throw new Error("Respons server tidak valid. Muat ulang aplikasi lalu coba lagi.");
    }
  } catch (error) {
    console.error("API Error:", error);
    throw error;
  }
};

const getApiErrorMessage = (error, fallback) => {
  const raw = String(error?.message || "").replace(/^HTTP \d+:\s*/, "").trim();
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    const detail = parsed?.message || parsed?.details || parsed?.hint || parsed?.error_description || parsed?.error;
    if (detail) return String(detail).slice(0, 220);
  } catch (_) {}
  return raw.slice(0, 220);
};

const getRetentionBrowserId = () => {
  const key = "kopilaba_retention_browser_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : "kl-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
    localStorage.setItem(key, id);
  }
  return id;
};

const getRetentionDeviceId = (profileId) => getRetentionBrowserId() + ":" + String(profileId || "unknown");

const retentionRequest = async (endpoint, method, body, token) => {
  const response = await fetch(`${SUPABASE_URL}${endpoint}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${token}`,
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: body ? JSON.stringify(body) : null,
  });
  if (!response.ok) throw new Error("HTTP " + response.status + ": " + (await response.text()));
  return response.status === 204 ? [] : await response.json();
};

const authApi = async (endpoint, body) => {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_KEY,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error_description || errorData.msg || "Auth gagal");
    }
    return await res.json();
  } catch (error) {
    console.error("Auth Error:", error);
    throw error;
  }
};

// ============================================================
// KOMPONEN UTAMA
// ============================================================

const AppIcon = ({ name, size = 20, strokeWidth = 1.8 }) => {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, focusable: "false" };
  const shapes = {
    crown: <><path d="m2 7 5 4 5-7 5 7 5-4-2 12H4L2 7Z" /><path d="M4 22h16" /></>,
    dashboard: <><rect x="3" y="3" width="8" height="8" rx="2" /><rect x="13" y="3" width="8" height="5" rx="2" /><rect x="13" y="10" width="8" height="11" rx="2" /><rect x="3" y="13" width="8" height="8" rx="2" /></>,
    receipt: <><path d="M4 3h16v18l-3-2-3 2-3-2-4 2-3-2V3Z" /><path d="M8 8h8M8 12h8M8 16h4" /></>,
    coffee: <><path d="M5 8h12v7a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5V8Z" /><path d="M17 10h1a3 3 0 0 1 0 6h-2M8 3c0 1 2 1 2 3M13 3c0 1 2 1 2 3M4 22h15" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    chart: <><path d="M3 3v18h18" /><path d="m7 14 4-4 4 3 6-7" /><path d="M17 6h4v4" /></>,
    wallet: <><rect x="3" y="5" width="18" height="15" rx="3" /><path d="M3 9h18M16 14h2" /><path d="M6 5V3h12v2" /></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6M8 13h8M8 17h8" /></>,
    qr: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3h-3zM20 14v2M17 20h4M20 18v3" /></>,
    database: <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></>,
    menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></>,
    moon: <path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z" />,
    key: <><circle cx="8" cy="15" r="5" /><path d="m11.5 11.5 9-9M17 6l3 3M14 9l3 3" /></>,
    close: <><path d="m18 6-12 12M6 6l12 12" /></>,
    logout: <><path d="M10 17l5-5-5-5M15 12H3" /><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" /></>,
    trash: <><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 10v6M14 10v6" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    cart: <><path d="M3 10h18l-2 10H5L3 10Z" /><path d="m8 10 4-7 4 7M8 14v3M12 14v3M16 14v3" /></>
  };
  return <svg {...common}>{shapes[name] || shapes.dashboard}</svg>;
};

export default function KopiLaba() {
  // ------------------------------------------------------------
  // STATE UMUM
  // ------------------------------------------------------------
  const [screen, setScreen] = useState("login");
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [token, setToken] = useState(null);
  const [tab, setTab] = useState("dashboard");
  const [printerSettings, setPrinterSettings] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("kopilaba_printer_settings") || "{}");
      return {
        paper: ["auto", "58", "80", "A4"].includes(String(saved.paper)) ? String(saved.paper) : "auto",
        fontSize: ["compact", "normal", "large"].includes(saved.fontSize) ? saved.fontSize : "normal",
        margin: ["2", "4", "6"].includes(String(saved.margin)) ? String(saved.margin) : "4",
        showAddress: saved.showAddress !== false,
        showPhone: saved.showPhone !== false,
      };
    } catch (_) {
      return { paper: "auto", fontSize: "normal", margin: "4", showAddress: true, showPhone: true };
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [networkError, setNetworkError] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    try {
      return window.localStorage.getItem("kopilaba_theme") === "dark";
    } catch (_) {
      return false;
    }
  });
  const [showLaba, setShowLaba] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const canManageCatalog = profile?.role === "pemilik" || isSuperAdmin;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(false);
  const sidebarRef = useRef(null);

  // Ref untuk swipe (agar tidak rebind tiap gerakan)
  const touchStartXRef = useRef(0);
  const touchCurrentXRef = useRef(0);
  const sidebarOpenRef = useRef(false);

  // ------------------------------------------------------------
  // SESSION PERSISTENCE
  // ------------------------------------------------------------
  useEffect(() => {
    const saved = localStorage.getItem("kopilaba_session");
    if (saved) {
      try {
        const session = JSON.parse(saved);
        if (session.profile && session.token) {
          setUser(session.user || null);
          setProfile(session.profile);
          setToken(session.token);
          setIsSuperAdmin(session.isSuperAdmin || false);
          setScreen("app");
          loadData(session.token, session.profile);
        }
      } catch (e) {
        console.warn("Session load error:", e);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (profile && token) {
      localStorage.setItem(
        "kopilaba_session",
        JSON.stringify({ user, profile, token, isSuperAdmin })
      );
    }
  }, [profile, token, user, isSuperAdmin]);

  useEffect(() => {
    const hashParams = new URLSearchParams((window.location.hash || "").replace(/^#/, ""));
    const queryParams = new URLSearchParams(window.location.search || "");
    const oauthError =
      hashParams.get("error_description") ||
      hashParams.get("error") ||
      queryParams.get("error_description") ||
      queryParams.get("error");
    const oauthToken = hashParams.get("access_token") || queryParams.get("access_token");

    if (oauthError) {
      window.history.replaceState({}, document.title, window.location.pathname);
      setError(oauthError.replace(/\+/g, " "));
      setScreen("login");
      setLoading(false);
      try { sessionStorage.removeItem("kopilaba_google_auth_origin"); } catch (_) {}
      return;
    }
    if (!oauthToken) return;

    // Remove OAuth tokens from the visible URL as soon as they are captured.
    window.history.replaceState({}, document.title, window.location.pathname);
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${oauthToken}`,
          },
        });
        const oauthUser = await response.json().catch(() => ({}));
        if (!response.ok || !oauthUser?.id) {
          const detail = oauthUser?.msg || oauthUser?.message || oauthUser?.error_description;
          throw new Error(detail || "Login Google gagal. Periksa konfigurasi Google OAuth di Supabase.");
        }
        if (!cancelled) await finishAuthenticatedSession(oauthUser, oauthToken);
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Login Google gagal. Coba ulangi.");
          setScreen("login");
          try { sessionStorage.removeItem("kopilaba_google_auth_origin"); } catch (_) {}
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // OAuth callback is handled once on mount; session completion uses current app functions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try { localStorage.setItem("kopilaba_printer_settings", JSON.stringify(printerSettings)); } catch (_) {}
  }, [printerSettings]);

  useEffect(() => {
    try {
      window.localStorage.setItem("kopilaba_theme", darkMode ? "dark" : "light");
    } catch (_) {
      // Tema tetap dapat dipakai untuk sesi ini jika penyimpanan browser diblokir.
    }
  }, [darkMode]);

  useEffect(() => {
    document.body.style.margin = "0";
    document.body.style.padding = "0";
    document.body.style.overflowX = "hidden";
    document.body.style.background = darkMode ? "#071C12" : "#F6F8F6";
    return () => {
      document.body.style.margin = "";
      document.body.style.padding = "";
      document.body.style.overflowX = "";
      document.body.style.background = "";
    };
  }, [darkMode]);

  useEffect(() => {
    sidebarOpenRef.current = sidebarOpen;
  }, [sidebarOpen]);

  // Swipe handler (fix: pakai ref, hanya dari tepi kiri)
  useEffect(() => {
    const onStart = (e) => {
      touchStartXRef.current = e.touches[0].clientX;
      touchCurrentXRef.current = e.touches[0].clientX;
    };
    const onMove = (e) => {
      touchCurrentXRef.current = e.touches[0].clientX;
    };
    const onEnd = () => {
      const delta = touchCurrentXRef.current - touchStartXRef.current;
      if (delta > 80 && touchStartXRef.current < 40 && !sidebarOpenRef.current) {
        setSidebarOpen(true);
      }
      if (delta < -80 && sidebarOpenRef.current) {
        setSidebarOpen(false);
      }
    };
    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: true });
    document.addEventListener("touchend", onEnd);
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
    };
  }, []);

  // ------------------------------------------------------------
  // STATE LOGIN / REGISTER
  // ------------------------------------------------------------
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [regForm, setRegForm] = useState({
    nama: "",
    email: "",
    password: "",
    namaKafe: "",
    alamatKafe: "",
    telepon: "",
  });

  // ------------------------------------------------------------
  // STATE DATA UTAMA
  // ------------------------------------------------------------
  const [transaksi, setTransaksi] = useState([]);
  const [menu, setMenu] = useState([]);
  const [kategori, setKategori] = useState([]);
  const [karyawan, setKaryawan] = useState([]);
  const [kafe, setKafe] = useState(null);
  const [absensi, setAbsensi] = useState([]);
  const [allOwners, setAllOwners] = useState([]);
  const [allTransaksi, setAllTransaksi] = useState([]);

  // ------------------------------------------------------------
  // STATE PERIODE FILTER
  // ------------------------------------------------------------
  const [periodeFilter, setPeriodeFilter] = useState("hari");

  // ------------------------------------------------------------
  // STATE QRIS
  // ------------------------------------------------------------
  const [qrisUrl, setQrisUrl] = useState("");
  const [uploadingQris, setUploadingQris] = useState(false);
  const fileInputRef = useRef(null);

  // ------------------------------------------------------------
  // STATE FILTER KATEGORI DI MENU
  // ------------------------------------------------------------
  const [selectedKategori, setSelectedKategori] = useState("");

  // ------------------------------------------------------------
  // STATE MODAL TRANSAKSI
  // ------------------------------------------------------------
  const [showAdd, setShowAdd] = useState(false);
  const [addType, setAddType] = useState("masuk");
  const [addForm, setAddForm] = useState({
    item: "",
    qty: "1",
    total: "",
    kategori_id: "",
    menu_id: "",
  });
  const [pesananItems, setPesananItems] = useState([]);
  const [editTransaksiId, setEditTransaksiId] = useState(null);
  const [pajakEnabled, setPajakEnabled] = useState(() => localStorage.getItem("kopilaba_pajak_enabled") !== "false");
  const [backupImport, setBackupImport] = useState(null);
  const [backupPendingConfirmation, setBackupPendingConfirmation] = useState(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [taxSaving, setTaxSaving] = useState(false);
  const backupInputRef = useRef(null);
  const [persentasePajak, setPersentasePajak] = useState(() => {
    const saved = Number(localStorage.getItem("kopilaba_pajak_persen"));
    return Number.isFinite(saved) && saved >= 0 && saved <= 100 ? saved : 10;
  });

  useEffect(() => {
    localStorage.setItem("kopilaba_pajak_enabled", String(pajakEnabled));
  }, [pajakEnabled]);

  useEffect(() => {
    localStorage.setItem("kopilaba_pajak_persen", String(persentasePajak));
  }, [persentasePajak]);

  useEffect(() => {
    if (!kafe) return;
    if (typeof kafe.pajak_enabled === "boolean") setPajakEnabled(kafe.pajak_enabled);
    if (kafe.pajak_persen !== null && kafe.pajak_persen !== undefined) {
      const rate = Number(kafe.pajak_persen);
      if (Number.isFinite(rate) && rate >= 0 && rate <= 100) setPersentasePajak(rate);
    }
  }, [kafe?.id, kafe?.pajak_enabled, kafe?.pajak_persen]);

  const handleSaveTaxSettings = async () => {
    if (profile?.role !== "pemilik" || !kafe?.id || !token) {
      setError("Hanya pemilik kafe yang dapat menyimpan pengaturan pajak.");
      return;
    }
    setTaxSaving(true);
    setError("");
    setSuccess("");
    try {
      const result = await api(
        "/rest/v1/kafe?id=eq." + kafe.id,
        "PATCH",
        { pajak_enabled: pajakEnabled, pajak_persen: persentasePajak },
        token
      );
      if (!Array.isArray(result) || result.length === 0) {
        throw new Error("Pengaturan tidak tersimpan. Periksa izin pemilik kafe pada database.");
      }
      setKafe((prev) => ({ ...prev, ...result[0] }));
      setSuccess("Pengaturan pajak tersimpan untuk semua perangkat kafe.");
    } catch (err) {
      setError(err.message || "Gagal menyimpan pengaturan pajak.");
    } finally {
      setTaxSaving(false);
    }
  };
  
  const buildBackupPayload = (allTransactions) => ({
    app: "KopiLaba",
    formatVersion: 2,
    exportedAt: new Date().toISOString(),
    cafe: { id: kafe?.id || profile?.kafe_id || null, nama: kafe?.nama || "Kafe" },
    note: "Backup lengkap seluruh halaman transaksi yang berhasil diambil dari server saat ekspor.",
    data: { menu, transaksi: allTransactions, absensi },
    settings: { pajakEnabled, persentasePajak }
  });

  const handleBackupExport = async () => {
    if (!profile?.id || !["pemilik", "barista"].includes(profile?.role)) { setError("Sesi pengguna kafe tidak valid. Silakan masuk kembali."); return; }
    const kafeId = kafe?.id || profile?.kafe_id;
    if (!kafeId || !token) { setError("Sesi atau data kafe tidak tersedia. Silakan masuk kembali."); return; }
    setBackupBusy(true);
    setError("");
    setSuccess("");
    try {
      // Ambil transaksi per halaman agar backup tidak terbatas pada 500 data di layar.
      const pageSize = 1000;
      const allTransactions = [];
      for (let offset = 0; ; offset += pageSize) {
        const page = await api(
          `/rest/v1/transaksi?kafe_id=eq.${encodeURIComponent(kafeId)}&order=created_at.asc,id.asc&limit=${pageSize}&offset=${offset}`,
          "GET",
          null,
          token
        );
        if (!Array.isArray(page)) throw new Error("Server tidak mengembalikan daftar transaksi yang valid.");
        allTransactions.push(...page);
        if (page.length < pageSize) break;
      }
      const payload = buildBackupPayload(allTransactions);
      payload.backupScope = "complete";
      payload.counts = { menu: menu.length, transaksi: allTransactions.length, absensi: absensi.length };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "kopilaba-backup-" + kafeId + "-" + new Date().toISOString().slice(0, 10) + ".json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      const nextPeriod = retentionReminder?.date
        ? [retentionReminder.date.getFullYear(), String(retentionReminder.date.getMonth() + 1).padStart(2, "0"), String(retentionReminder.date.getDate()).padStart(2, "0")].join("-")
        : null;
      setBackupPendingConfirmation(nextPeriod ? { period: nextPeriod, transactionCount: allTransactions.length } : null);
      setSuccess(`Backup lengkap dibuat: ${allTransactions.length} transaksi, ${menu.length} menu, dan ${absensi.length} data absensi. Setelah memastikan file tersimpan, tekan tombol konfirmasi di bawah.`);
    } catch (err) {
      setError("Backup belum selesai. Tidak ada data yang dihapus. " + (err.message || "Periksa koneksi lalu coba lagi."));
    } finally {
      setBackupBusy(false);
    }
  };

  const retentionReminder = (() => {
    const now = new Date();
    const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    const upcoming = [
      new Date(now.getFullYear(), 0, 1),
      new Date(now.getFullYear(), 6, 1),
      new Date(now.getFullYear() + 1, 0, 1),
      new Date(now.getFullYear() + 1, 6, 1),
    ].filter((date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) >= todayUtc)
     .sort((a, b) => a - b)[0];
    if (!upcoming) return null;
    const days = Math.round((Date.UTC(upcoming.getFullYear(), upcoming.getMonth(), upcoming.getDate()) - todayUtc) / 86400000);
    return { days, date: upcoming, show: [0, 1, 4, 7].includes(days) };
  })();

  const registerRetentionDevice = async (tok, prof, cafeId) => {
    if (!tok || !prof?.id || !cafeId) return;
    const deviceId = getRetentionDeviceId(prof.id);
    try {
      await retentionRequest("/rest/v1/kopilaba_retention_devices?on_conflict=kafe_id,device_id", "POST", {
        kafe_id: cafeId,
        device_id: deviceId,
        user_id: prof.id,
        last_seen: new Date().toISOString(),
      }, tok);
    } catch (err) {
      // Retention tracking must never prevent the normal app from opening.
      console.warn("Retention device registration skipped:", err);
    }
  };

  const handleConfirmRetentionBackup = async () => {
    if (!backupPendingConfirmation || !token || !profile?.id || !kafe?.id) return;
    setBackupBusy(true);
    setError("");
    try {
      const deviceId = getRetentionDeviceId(profile.id);
      const result = await api(
        "/rest/v1/kopilaba_retention_devices?kafe_id=eq." + encodeURIComponent(kafe.id) +
          "&device_id=eq." + encodeURIComponent(deviceId),
        "PATCH",
        {
          backup_period: backupPendingConfirmation.period,
          backup_at: new Date().toISOString(),
          backup_transaction_count: backupPendingConfirmation.transactionCount,
          last_seen: new Date().toISOString(),
        },
        token
      );
      if (!Array.isArray(result) || result.length === 0) {
        throw new Error("Konfirmasi backup tidak tersimpan. Muat ulang aplikasi dan coba lagi.");
      }
      setSuccess("Konfirmasi backup perangkat tersimpan untuk jadwal " + new Date(backupPendingConfirmation.period + "T12:00:00").toLocaleDateString("id-ID") + ".");
      setBackupPendingConfirmation(null);
    } catch (err) {
      setError(err.message || "Konfirmasi backup gagal tersimpan.");
    } finally {
      setBackupBusy(false);
    }
  };

  const handleBackupFile = async (e) => {
    if (profile?.role !== "pemilik") { setError("Hanya pemilik kafe yang boleh memulihkan backup."); return; }
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      if (file.size > 15 * 1024 * 1024) throw new Error("File backup maksimal 15 MB.");
      const parsed = JSON.parse(await file.text());
      if (parsed?.app !== "KopiLaba" || ![1, 2].includes(parsed?.formatVersion) || !parsed?.data || !parsed?.cafe?.id) {
        throw new Error("Format file bukan backup KopiLaba yang didukung.");
      }
      if (String(parsed.cafe.id) !== String(kafe?.id || profile?.kafe_id)) {
        throw new Error("Backup ini berasal dari kafe berbeda. Impor dibatalkan demi keamanan data.");
      }
      for (const key of ["menu", "transaksi", "absensi"]) {
        if (!Array.isArray(parsed.data[key])) throw new Error("Data " + key + " di dalam backup tidak valid.");
        if (parsed.data[key].some((row) => String(row.kafe_id) !== String(kafe?.id || profile?.kafe_id))) {
          throw new Error("Backup berisi data di luar kafe ini. Impor dibatalkan.");
        }
      }
      setBackupImport({ fileName: file.name, payload: parsed });
      setSuccess("File backup valid. Periksa jumlah data sebelum memulihkan.");
    } catch (err) {
      setBackupImport(null);
      setError(err.message || "File backup tidak dapat dibaca.");
    }
  };

  const handleBackupRestore = async () => {
    if (profile?.role !== "pemilik") { setError("Hanya pemilik kafe yang boleh memulihkan backup."); return; }
    if (!backupImport?.payload || !token) return;
    const payload = backupImport.payload;
    const counts = ["menu", "transaksi", "absensi"].reduce((a, key) => a + payload.data[key].length, 0);
    if (!window.confirm("Pulihkan " + counts + " baris data dari " + backupImport.fileName + "? Data dengan ID sama akan diperbarui; data yang tidak ada di backup tidak dihapus.")) return;
    setBackupBusy(true);
    setError("");
    setSuccess("");
    try {
      const kafeId = kafe?.id || profile?.kafe_id;
      const restoreTable = async (table, rows) => {
        if (!rows.length) return;
        const safeRows = rows.filter((row) => String(row.kafe_id) === String(kafeId));
        for (let i = 0; i < safeRows.length; i += 100) {
          const res = await fetch(SUPABASE_URL + "/rest/v1/" + table + "?on_conflict=id", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: SUPABASE_KEY,
              Authorization: "Bearer " + token,
              Prefer: "resolution=merge-duplicates,return=minimal"
            },
            body: JSON.stringify(safeRows.slice(i, i + 100))
          });
          if (!res.ok) throw new Error("Gagal memulihkan " + table + " (HTTP " + res.status + "). Pastikan izin database mengizinkan pemulihan.");
        }
      };
      await restoreTable("menu", payload.data.menu);
      await restoreTable("transaksi", payload.data.transaksi);
      await restoreTable("absensi", payload.data.absensi);
      if (payload.settings) {
        const taxEnabled = typeof payload.settings.pajakEnabled === "boolean" ? payload.settings.pajakEnabled : pajakEnabled;
        const taxRate = Number.isFinite(payload.settings.persentasePajak) ? Math.max(0, Math.min(100, payload.settings.persentasePajak)) : persentasePajak;
        const taxResult = await api(
          "/rest/v1/kafe?id=eq." + kafeId,
          "PATCH",
          { pajak_enabled: taxEnabled, pajak_persen: taxRate },
          token
        );
        if (Array.isArray(taxResult) && taxResult[0]) setKafe((prev) => ({ ...prev, ...taxResult[0] }));
        setPajakEnabled(taxEnabled);
        setPersentasePajak(taxRate);
      }
      await loadData(token, profile);
      setBackupImport(null);
      setSuccess("Pemulihan selesai. Periksa menu, transaksi, dan absensi.");
    } catch (err) {
      setError(err.message || "Pemulihan backup gagal. Sebagian data mungkin sudah dipulihkan; ekspor backup terbaru sebelum mencoba lagi.");
    } finally {
      setBackupBusy(false);
    }
  };


  // ------------------------------------------------------------
  // STATE MODAL MENU
  // ------------------------------------------------------------
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [menuForm, setMenuForm] = useState({
    nama: "",
    harga: "",
    hpp: "",
    stok: "",
    kategori_id: "",
    foto: "",
    qty: "",
  });
  const [editMenuId, setEditMenuId] = useState(null);
  const [menuFile, setMenuFile] = useState(null);

  // ------------------------------------------------------------
  // STATE MODAL KATEGORI
  // ------------------------------------------------------------
  const [showAddKategori, setShowAddKategori] = useState(false);
  const [kategoriForm, setKategoriForm] = useState({ nama: "" });
  const [editKategoriId, setEditKategoriId] = useState(null);

  // ------------------------------------------------------------
  // STATE MODAL KARYAWAN
  // ------------------------------------------------------------
  const [showAddKaryawan, setShowAddKaryawan] = useState(false);
  const [karyawanForm, setKaryawanForm] = useState({ nama: "", email: "", password: "" });
  const [editKaryawanId, setEditKaryawanId] = useState(null);

  // ------------------------------------------------------------
  // STATE MODAL STOK
  // ------------------------------------------------------------
  const [showStok, setShowStok] = useState(false);
  const [stokForm, setStokForm] = useState({ menu_id: "", stok: "" });

  // ------------------------------------------------------------
  // STATE GANTI PASSWORD (hanya untuk diri sendiri)
  // ------------------------------------------------------------
  const [showGantiPassword, setShowGantiPassword] = useState(false);
  const [gantiPasswordForm, setGantiPasswordForm] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  // ------------------------------------------------------------
  // STATE ABSENSI
  // ------------------------------------------------------------
  const [showAbsensi, setShowAbsensi] = useState(false);
  const [absensiForm, setAbsensiForm] = useState({
    pegawai_id: "",
    tanggal: "",
    jam_masuk: "",
    jam_keluar: "",
  });
  const [filterNama, setFilterNama] = useState("");
  const [filterTglMulaiAbsen, setFilterTglMulaiAbsen] = useState("");
  const [filterTglSelesaiAbsen, setFilterTglSelesaiAbsen] = useState("");
  const [baristaAbsenLoading, setBaristaAbsenLoading] = useState(false);

  // ------------------------------------------------------------
  // STATE KASIR & JUMLAH MAP
  // ------------------------------------------------------------
  const [keranjang, setKeranjang] = useState([]);
  // Antrean tersimpan lokal per kafe/perangkat agar nomor dan pesanan tetap ada setelah halaman dimuat ulang.
  const [antrean, setAntrean] = useState([]);
  const [antreanNama, setAntreanNama] = useState("");
  const [antreanJenis, setAntreanJenis] = useState("bawa_pulang");
  const [antreanCatatan, setAntreanCatatan] = useState("");
  const [antreanMenuId, setAntreanMenuId] = useState("");
  const [antreanQty, setAntreanQty] = useState("1");
  const [antreanItemCatatan, setAntreanItemCatatan] = useState("");
  const [antreanItems, setAntreanItems] = useState([]);
  const antreanStorageKey = `kopilaba_antrean_${kafe?.id || profile?.kafe_id || "default"}`;
  useEffect(() => {
    try {
      const saved = localStorage.getItem(antreanStorageKey);
      setAntrean(saved ? JSON.parse(saved) : []);
    } catch (_) {
      setAntrean([]);
    }
  }, [antreanStorageKey]);
  const simpanAntrean = (next) => {
    setAntrean(next);
    try { localStorage.setItem(antreanStorageKey, JSON.stringify(next)); } catch (_) {}
  };
  const cetakAntrean = (order, mode = "slip") => {
    try {
      const w = window.open("", "_blank", "width=420,height=680");
      if (!w) { alert("Popup diblokir. Izinkan popup untuk mencetak antrean."); return; }
      const daftar = mode === "daftar";
      const orders = daftar ? (order || []) : [order];
      const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
      const paperWidth = printerSettings.paper === "80" ? "72mm" : printerSettings.paper === "A4" ? "190mm" : "48mm";
      const queueFont = printerSettings.fontSize === "compact" ? "10px" : printerSettings.fontSize === "large" ? "13px" : "12px";
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>Antrean KopiLaba</title>
      <style>body{font-family:Arial,sans-serif;color:#111;margin:0 auto;font-size:${queueFont};padding:3px;width:${paperWidth};max-width:100%}h2,p{margin:3px 0;text-align:center}.line{border-top:1px dashed #555;margin:8px 0}.row{display:flex;justify-content:space-between;gap:8px}.big{font-size:28px;font-weight:bold;text-align:center;margin:8px 0}.muted{font-size:10px}.item{margin:5px 0}@page{size:${printerSettings.paper === "A4" ? "A4" : "auto"};margin:${printerSettings.margin}mm}</style></head><body>
      <h2>${esc(kafe?.nama || "KOPILABA")}</h2><p>${daftar ? "DAFTAR ANTREAN & PESANAN" : "BUKTI ANTREAN PESANAN"}</p><div class="line"></div>
      ${orders.map((o) => `<section><div class="big">NO. ${esc(o.nomor)}</div><p><b>${esc(o.nama || "Pelanggan")}</b></p><p>${o.jenis === "makan_di_tempat" ? "Makan di tempat" : "Bawa pulang"}</p><p class="muted">${esc(o.waktu || "")}</p><div class="line"></div>
      ${(o.items || []).map((it) => `<div class="item"><div class="row"><span>${esc(it.nama)} x${esc(it.qty)}</span><span>${fmt((Number(it.harga)||0)*(Number(it.qty)||0))}</span></div>${it.catatan ? `<div class="muted">Catatan: ${esc(it.catatan)}</div>` : ""}</div>`).join("")}
      <div class="line"></div><div class="row"><b>Total</b><b>${fmt((o.items||[]).reduce((sum,it)=>sum+(Number(it.harga)||0)*(Number(it.qty)||0),0))}</b></div>
      ${o.catatan ? `<p style="text-align:left;margin-top:8px"><b>Catatan pesanan:</b> ${esc(o.catatan)}</p>` : ""}
      <p class="muted">Status: ${esc(o.status || "menunggu")}</p><div class="line"></div></section>`).join(daftar ? '<div style="page-break-after:always"></div>' : "")}
      <p class="muted">Dicetak dari KopiLaba</p><script>window.onload=()=>setTimeout(()=>window.print(),250)<\/script></body></html>`;
      w.document.open(); w.document.write(html); w.document.close();
    } catch (err) { alert("Gagal mencetak antrean: " + err.message); }
  };
  const tambahItemAntrean = () => {
    const item = menu.find((m) => String(m.id) === String(antreanMenuId));
    if (!item) { setError("Pilih menu terlebih dahulu."); return; }
    const qty = Math.max(1, parseInt(antreanQty, 10) || 1);
    setAntreanItems((prev) => {
      const same = prev.find((p) => String(p.id) === String(item.id) && (p.catatan || "") === antreanItemCatatan.trim());
      return same
        ? prev.map((p) => p === same ? { ...p, qty: p.qty + qty } : p)
        : [...prev, { id: item.id, nama: item.nama, harga: Number(item.harga) || 0, qty, catatan: antreanItemCatatan.trim() }];
    });
    setAntreanMenuId("");
    setAntreanQty("1");
    setAntreanItemCatatan("");
    setError("");
  };
  const buatAntrean = () => {
    if (!antreanItems.length) { setError("Tambahkan minimal satu menu ke pesanan."); return; }
    const cafeKey = kafe?.id || profile?.kafe_id || "default";
    const todayKey = new Date().toLocaleDateString("en-CA");
    const seqKey = `kopilaba_antrean_seq_${cafeKey}_${todayKey}`;
    let seq = 1;
    try { seq = (parseInt(localStorage.getItem(seqKey) || "0", 10) || 0) + 1; localStorage.setItem(seqKey, String(seq)); } catch (_) {}
    const order = {
      id: `antrean-${Date.now()}`,
      nomor: `A${String(seq).padStart(3, "0")}`,
      nama: antreanNama.trim() || "Pelanggan",
      jenis: antreanJenis,
      catatan: antreanCatatan.trim(),
      items: antreanItems.map((it) => ({ ...it })),
      waktu: new Date().toLocaleString("id-ID"),
      status: "Menunggu",
    };
    simpanAntrean([order, ...antrean]);
    setAntreanNama("");
    setAntreanJenis("bawa_pulang");
    setAntreanCatatan("");
    setAntreanItems([]);
    setError("");
    setSuccess(`Antrean ${order.nomor} tersimpan. Periksa pesanan sebelum diteruskan ke keranjang.`);
  };
  const [pajakCheckoutEnabled, setPajakCheckoutEnabled] = useState(pajakEnabled);
  useEffect(() => {
    setPajakCheckoutEnabled(
      typeof kafe?.pajak_enabled === "boolean" ? kafe.pajak_enabled : pajakEnabled
    );
  }, [kafe?.id, kafe?.pajak_enabled, pajakEnabled]);
  const [showKasir, setShowKasir] = useState(false);
  const [pembayaran, setPembayaran] = useState("tunai");
  const [bayarAmount, setBayarAmount] = useState("");
  const [splitTunaiAmount, setSplitTunaiAmount] = useState("");
  const [jumlahMap, setJumlahMap] = useState({});
  const [lastReceipt, setLastReceipt] = useState(null); // struk setelah checkout

  // ------------------------------------------------------------
  // STATE LAPORAN & AI
  // ------------------------------------------------------------
  const [filterTglMulai, setFilterTglMulai] = useState("");
  const [filterTglSelesai, setFilterTglSelesai] = useState("");
  const [filterStatus, setFilterStatus] = useState("semua");
  const [selectedTransaksi, setSelectedTransaksi] = useState(null);
  const [laporanStokOn, setLaporanStokOn] = useState(true);
  const [aiQuery, setAiQuery] = useState("");
  const [aiAnswer, setAiAnswer] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  // Refresh tanggal kalender WIB setiap menit agar ringkasan tidak tertinggal saat lewat tengah malam.
  const [wibDayKey, setWibDayKey] = useState(() => todayWIB());
  useEffect(() => {
    const refreshWibDay = () => {
      const currentDay = todayWIB();
      setWibDayKey((previousDay) => previousDay === currentDay ? previousDay : currentDay);
    };
    const intervalId = setInterval(refreshWibDay, 60000);
    return () => clearInterval(intervalId);
  }, []);

  // ------------------------------------------------------------
  // STATE SUPER ADMIN FILTER
  // ------------------------------------------------------------
  const [adminFilterPeriode, setAdminFilterPeriode] = useState("minggu");
  const [adminFilterOwner, setAdminFilterOwner] = useState("");
  const [adminSearchOwner, setAdminSearchOwner] = useState("");

  // ------------------------------------------------------------
  // EFFECTS
  // ------------------------------------------------------------
  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(""), 3000);
      return () => clearTimeout(t);
    }
  }, [success]);

  // Auto-clear error
  useEffect(() => {
    if (error) {
      const t = setTimeout(() => setError(""), 5000);
      return () => clearTimeout(t);
    }
  }, [error]);

  // Auto-hit total ketika menu/qty berubah (hanya untuk pemasukan)
  useEffect(() => {
    if (addType === "masuk" && addForm.menu_id && addForm.qty) {
      const selectedMenu = menu.find((m) => m.id === addForm.menu_id);
      if (selectedMenu) {
        const qty = parseInt(addForm.qty) || 1;
        const harga = selectedMenu.harga || 0;
        setAddForm((prev) => ({ ...prev, total: String(qty * harga) }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addForm.qty, addForm.menu_id, addType]);

  // ============================================================
  // FUNGSI BANTU PERIODE
  // ============================================================
  const getDateRange = (periode) => {
    const today = todayWIB();
    let startDate = "1970-01-01";
    if (periode === "hari") startDate = today;
    else if (periode === "minggu") startDate = shiftDateKey(today, -7);
    else if (periode === "bulan") startDate = shiftMonthKey(today, -1);
    else if (periode === "tahun") startDate = shiftMonthKey(today, -12);
    return {
      start: new Date(`${startDate}T00:00:00+07:00`),
      end: new Date()
    };
  };

  const filterTransaksiByPeriode = (data, periode) => {
    const { start } = getDateRange(periode);
    const startKey = dateKeyWIB(start);
    const endKey = todayWIB();
    return data.filter((t) => {
      const day = dateKeyWIB(t.created_at);
      if (!day || day < startKey || day > endKey) return false;
      return profile?.role !== "barista" || day === endKey;
    });
  };

  // ============================================================
  // LOAD DATA
  // ============================================================
  const loadData = async (tok, prof) => {
    try {
      if (prof?.role === "super_admin") {
        await loadAllData(tok);
        return;
      }

      const kafeData = await api(
        `/rest/v1/kafe?pemilik_id=eq.${prof.id}&limit=1`,
        "GET",
        null,
        tok
      );
      let kafeObj = Array.isArray(kafeData) ? kafeData[0] : null;

      if (!kafeObj && prof.kafe_id) {
        const fallbackData = await api(
          `/rest/v1/kafe?id=eq.${prof.kafe_id}&limit=1`,
          "GET",
          null,
          tok
        );
        kafeObj = Array.isArray(fallbackData) ? fallbackData[0] : null;
      }

      setKafe(kafeObj || null);
      setQrisUrl(kafeObj?.qris_url || "");
      const kafeId = kafeObj?.id || prof.kafe_id;
      if (!kafeId) return;
      await registerRetentionDevice(tok, prof, kafeId);

      // These requests are independent; run them together instead of waiting
      // for each network round-trip before starting the next one.
      await Promise.all([
        loadTransaksi(tok, kafeId),
        loadMenu(tok, kafeId),
        loadKategori(tok, kafeId),
        loadKaryawan(tok, kafeId),
        loadAbsensi(tok, kafeId),
      ]);
    } catch (err) {
      console.error("Load data error:", err);
      setNetworkError(true);
      setError("Gagal memuat data. Periksa koneksi.");
    }
  };

  const loadAllData = async (tok) => {
    try {
      // Fetch independent admin datasets concurrently to reduce startup wait.
      const results = await Promise.allSettled([
        api("/rest/v1/profiles?role=eq.pemilik", "GET", null, tok),
        api("/rest/v1/transaksi?order=created_at.desc&limit=1000", "GET", null, tok),
        api("/rest/v1/menu", "GET", null, tok),
        api("/rest/v1/kategori", "GET", null, tok),
        api("/rest/v1/profiles?role=eq.barista", "GET", null, tok),
      ]);
      const [ownersResult, transaksiResult, menuResult, kategoriResult, karyawanResult] = results;
      const asArray = (result) =>
        result.status === "fulfilled" && Array.isArray(result.value) ? result.value : [];

      const owners = asArray(ownersResult);
      const allTrans = asArray(transaksiResult);
      setAllOwners(owners);
      setAllTransaksi(allTrans);
      setTransaksi(allTrans);
      setMenu(asArray(menuResult));
      setKategori(asArray(kategoriResult));
      setKaryawan(asArray(karyawanResult));

      if (results.some((result) => result.status === "rejected")) {
        throw new Error("Sebagian data admin gagal dimuat");
      }
    } catch (err) {
      console.error("Load all data error:", err);
      setError("Gagal memuat data super admin.");
    }
  };

  const loadTransaksi = async (tok, kafeId) => {
    try {
      const data = await api(
        `/rest/v1/transaksi?kafe_id=eq.${kafeId}&order=created_at.desc&limit=500`,
        "GET",
        null,
        tok
      );
      setTransaksi(Array.isArray(data) ? data : []);
    } catch (err) {
      setTransaksi([]);
    }
  };

  const loadMenu = async (tok, kafeId) => {
    try {
      const data = await api(`/rest/v1/menu?kafe_id=eq.${kafeId}`, "GET", null, tok);
      setMenu(Array.isArray(data) ? data : []);
    } catch (err) {
      setMenu([]);
    }
  };

  const loadKategori = async (tok, kafeId = null) => {
    try {
      // Pemilik/barista hanya memuat kategori milik kafenya; super admin dapat melihat semuanya.
      if (!kafeId && profile?.role !== "super_admin") {
        setKategori([]);
        return;
      }
      const endpoint = kafeId
        ? `/rest/v1/kategori?kafe_id=eq.${encodeURIComponent(kafeId)}&order=nama.asc`
        : "/rest/v1/kategori?order=nama.asc";
      const data = await api(endpoint, "GET", null, tok);
      setKategori(Array.isArray(data) ? data : []);
    } catch (err) {
      setKategori([]);
    }
  };

  const loadKaryawan = async (tok, kafeId) => {
    try {
      const data = await api(
        `/rest/v1/profiles?kafe_id=eq.${kafeId}&role=eq.barista`,
        "GET",
        null,
        tok
      );
      setKaryawan(Array.isArray(data) ? data : []);
    } catch (err) {
      setKaryawan([]);
    }
  };

  const loadAbsensi = async (tok, kafeId) => {
    try {
      const data = await api(
        `/rest/v1/absensi?kafe_id=eq.${kafeId}&order=tanggal.desc`,
        "GET",
        null,
        tok
      );
      setAbsensi(Array.isArray(data) ? data : []);
    } catch (err) {
      setAbsensi([]);
    }
  };

  // ============================================================
  // AUTH
  // ============================================================
  const startGoogleAuth = () => {
    setError("");
    setSuccess("");
    setNetworkError(false);
    setLoading(true);

    // Use the canonical site origin as the OAuth return URL.
    // The publishable key is safe for browser use and helps gateways that
    // require an API key on a top-level browser navigation.
    const redirectTo = `${window.location.origin}/`;
    const authUrl = new URL(`${SUPABASE_URL}/auth/v1/authorize`);
    authUrl.searchParams.set("provider", "google");
    authUrl.searchParams.set("redirect_to", redirectTo);
    authUrl.searchParams.set("apikey", SUPABASE_KEY);
    authUrl.searchParams.set("flow_type", "implicit");
    authUrl.searchParams.set("prompt", "select_account");

    try {
      sessionStorage.setItem("kopilaba_google_auth_origin", screen === "register" ? "register" : "login");
    } catch (_) {}
    window.location.assign(authUrl.toString());
  };

  const finishAuthenticatedSession = async (u, tok) => {
    if (!u || !tok) throw new Error("Sesi login tidak lengkap. Silakan coba lagi.");
    setToken(tok);
    setUser(u);
    const email = String(u.email || "").trim().toLowerCase();
    let p = null;
    try {
      const prof = await api(`/rest/v1/profiles?id=eq.${u.id}&limit=1`, "GET", null, tok);
      p = Array.isArray(prof) ? prof[0] : null;
    } catch (profileErr) {
      throw new Error("Gagal memuat profil. Coba lagi.");
    }

    if (email === ADMIN_EMAIL) {
      const googleVerified = u.app_metadata?.provider === "google" ||
        (Array.isArray(u.identities) && u.identities.some((identity) => identity.provider === "google"));
      const emailVerified = Boolean(u.email_confirmed_at || u.confirmed_at || googleVerified);
      if (!emailVerified) {
        setScreen("login");
        throw new Error("Email Super Admin belum terverifikasi. Verifikasi email terlebih dahulu.");
      }
      if (!p) {
        const created = await api("/rest/v1/profiles", "POST", {
          id: u.id, nama: "Galeri Kopi", role: "super_admin", kafe_id: null, telepon: ""
        }, tok);
        p = Array.isArray(created) ? created[0] : created;
      } else if (p.role !== "super_admin" || p.kafe_id) {
        const updated = await api(`/rest/v1/profiles?id=eq.${u.id}`, "PATCH", {
          role: "super_admin", kafe_id: null
        }, tok);
        p = { ...p, role: "super_admin", kafe_id: null };
        if (Array.isArray(updated) && updated[0]) p = updated[0];
      }
    }

    if (!p) {
      setRegForm((prev) => ({
        ...prev,
        nama: u.user_metadata?.full_name || u.user_metadata?.name || prev.nama || "",
        email: u.email || prev.email,
      }));
      setSuccess("Google berhasil terhubung. Lengkapi data kafe untuk menyelesaikan pendaftaran.");
      setScreen("register");
      return;
    }

    setProfile(p);
    setNetworkError(false);
    if (p.role === "super_admin") {
      setIsSuperAdmin(true);
      await loadAllData(tok);
    } else {
      setIsSuperAdmin(false);
      await loadData(tok, p);
    }
    setScreen("app");
    setSuccess("Login berhasil!");
  };

  const handleLogin = async () => {
    setLoading(true);
    setError("");
    setSuccess("");
    setNetworkError(false);
    try {
      const data = await authApi("/token?grant_type=password", loginForm);
      if (data.access_token && data.user) {
        await finishAuthenticatedSession(data.user, data.access_token);
      } else {
        setError(data.error_description || "Login gagal. Cek email & password.");
      }
    } catch (err) {
      console.error("Login error:", err);
      setError(err.message || "Terjadi kesalahan. Coba lagi.");
      if (err.message?.includes("Failed to fetch") || err.message?.includes("Network")) {
        setNetworkError(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setLoading(true);
    setError("");
    setNetworkError(false);
    const isAdminRegistration = String(regForm.email || "").trim().toLowerCase() === ADMIN_EMAIL;
    const isExistingGoogleSession = Boolean(user?.id && token && String(user.email || "").toLowerCase() === String(regForm.email || "").toLowerCase());
    if (!regForm.email || (!isExistingGoogleSession && !regForm.password) || (!isAdminRegistration && (!regForm.nama || !regForm.namaKafe))) {
      setError(isAdminRegistration ? "Email dan password wajib diisi." : "Nama, email, dan nama kafe wajib diisi. Password hanya diperlukan untuk pendaftaran email.");
      setLoading(false);
      return;
    }
    if (!isExistingGoogleSession && regForm.password.length < 6) {
      setError("Password minimal 6 karakter!");
      setLoading(false);
      return;
    }
    try {
      const data = isExistingGoogleSession
        ? { user, access_token: token }
        : await authApi("/signup", {
            email: regForm.email,
            password: regForm.password,
          });
      if (data.user) {
        const u = data.user;
        if (isAdminRegistration) {
          setSuccess("Akun Super Admin berhasil dibuat. Jika diminta, konfirmasi email terlebih dahulu, lalu masuk dengan email ini.");
          setScreen("login");
          setLoginForm({ email: ADMIN_EMAIL, password: regForm.password });
          setLoading(false);
          return;
        }
        // When email confirmation is enabled, Supabase creates the auth user
        // but intentionally does not issue a session yet. Never use the public
        // anon key as a substitute for a user token to create private records.
        if (!data.access_token && !isExistingGoogleSession) {
          setSuccess("Akun berhasil dibuat. Silakan konfirmasi email jika diminta, lalu login. Setelah login, lengkapi data kafe untuk menyelesaikan pendaftaran.");
          setLoginForm({ email: regForm.email, password: regForm.password });
          setScreen("login");
          setLoading(false);
          return;
        }
        const tok = data.access_token || token;
        if (!tok || tok === SUPABASE_KEY) {
          throw new Error("Sesi pendaftaran belum aktif. Silakan login terlebih dahulu untuk melanjutkan.");
        }
        let kafeId = null;
        try {
          const k = await api(
            "/rest/v1/kafe",
            "POST",
            {
              nama: regForm.namaKafe,
              alamat: regForm.alamatKafe,
              pemilik_id: u.id,
              telepon: regForm.telepon || "",
              qris_url: "",
            },
            tok
          );
          kafeId = Array.isArray(k) ? k[0]?.id : k?.id;
        } catch (kafeErr) {
          console.error("Create kafe error:", kafeErr);
          setError("Gagal membuat kafe. Coba lagi.");
          setLoading(false);
          return;
        }
        try {
          await api(
            "/rest/v1/profiles",
            "POST",
            {
              id: u.id,
              nama: regForm.nama,
              role: "pemilik",
              kafe_id: kafeId,
              telepon: regForm.telepon || "",
            },
            tok
          );
        } catch (profileErr) {
          console.error("Create profile error:", profileErr);
          setError("Gagal membuat profil. Coba lagi.");
          setLoading(false);
          return;
        }
        setSuccess("Daftar berhasil! Silakan login.");
        setScreen("login");
      } else {
        setError(data.error_description || "Gagal daftar. Coba lagi.");
      }
    } catch (err) {
      console.error("Register error:", err);
      if (err.message.includes("email")) {
        setError("Email sudah terdaftar.");
      } else {
        setError("Gagal daftar. Coba lagi.");
      }
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // GANTI PASSWORD (hanya untuk diri sendiri, verifikasi password lama)
  // ============================================================
  const handleGantiPassword = async () => {
    const { oldPassword, newPassword, confirmPassword } = gantiPasswordForm;
    if (!oldPassword || !newPassword || !confirmPassword) {
      setError("Semua kolom wajib diisi!");
      return;
    }
    if (newPassword.length < 6) {
      setError("Password minimal 6 karakter!");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Password baru dan konfirmasi tidak sama!");
      return;
    }
    setLoading(true);
    setError("");
    try {
      // 1. Verifikasi password lama dengan mencoba login ulang
      if (user?.email) {
        try {
          await authApi("/token?grant_type=password", {
            email: user.email,
            password: oldPassword,
          });
        } catch (verr) {
          setError("Password lama salah.");
          setLoading(false);
          return;
        }
      }

      // 2. Update password via Supabase Auth
      const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password: newPassword }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.msg || errData.message || "Gagal ganti password");
      }

      setSuccess("Password berhasil diubah!");
      setGantiPasswordForm({ oldPassword: "", newPassword: "", confirmPassword: "" });
      setShowGantiPassword(false);
    } catch (err) {
      console.error("Ganti password error:", err);
      setError(err.message || "Gagal mengganti password. Coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // QRIS UPLOAD
  // ============================================================
  const handleQrisUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (profile?.role !== "pemilik" && profile?.role !== "super_admin") {
      setError("Hanya pemilik yang bisa upload QRIS.");
      return;
    }
    setUploadingQris(true);
    setError("");

    try {
      const kafeId = kafe?.id || profile?.kafe_id;
      if (!kafeId) {
        setError("Kafe tidak ditemukan.");
        setUploadingQris(false);
        return;
      }
      if (!token) {
        setError("Sesi login berakhir. Silakan login ulang.");
        setUploadingQris(false);
        return;
      }

      // Compress locally before upload to reduce mobile data and Supabase Storage usage.
      // QRIS uses higher quality and a larger canvas to keep the code readable when scanned.
      const uploadFile = await compressImage(file, {
        maxDimension: 1800,
        maxBytes: 500 * 1024,
        quality: 0.92,
      });
      const qrisFileName = `${Date.now()}_${uploadFile.name || "qris.webp"}`;
      const uploadRes = await fetch(
        `${SUPABASE_URL}/storage/v1/object/qris/${kafeId}/${qrisFileName}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": uploadFile.type || "image/png",
            "x-upsert": "true",
          },
          body: uploadFile,
        }
      );

      if (!uploadRes.ok) {
        const errText = await uploadRes.text();
        throw new Error(`Upload gagal: ${errText}`);
      }

      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/qris/${kafeId}/${qrisFileName}`;

      await api(`/rest/v1/kafe?id=eq.${kafeId}`, "PATCH", { qris_url: publicUrl }, token);
      setQrisUrl(publicUrl);
      setSuccess("QRIS berhasil diupload!");
    } catch (err) {
      console.error("QRIS upload error:", err);
      setError("Gagal upload QRIS. Coba lagi.");
    } finally {
      setUploadingQris(false);
    }
  };

  const triggerQrisUpload = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  // ============================================================
  // UPLOAD FOTO MENU
  // ============================================================
  const uploadMenuFoto = async (file, kafeId) => {
    if (!token) throw new Error("Sesi login berakhir.");
    // Menu photos are resized/compressed on the device before using mobile data.
    const uploadFile = await compressImage(file, {
      maxDimension: 1280,
      maxBytes: 280 * 1024,
      quality: 0.78,
    });
    const fileName = `${Date.now()}_${uploadFile.name || "foto.webp"}`;
    const path = `menu/${kafeId}/${fileName}`;
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/menu/${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": uploadFile.type || "image/jpeg",
        "x-upsert": "true",
      },
      body: uploadFile,
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Upload foto gagal: ${err}`);
    }
    return `${SUPABASE_URL}/storage/v1/object/public/menu/${path}`;
  };

  // ============================================================
  // CRUD TRANSAKSI
  // ============================================================
  const tambahItemPesanan = () => {
    if (addType === "keluar") {
      if (!addForm.item || !addForm.total) {
        setError("Isi nama barang dan total!");
        return;
      }
      const newItem = {
        menu_id: null,
        nama: addForm.item,
        qty: parseInt(addForm.qty) || 1,
        harga: 0,
        total: parseInt(addForm.total) || 0,
      };
      setPesananItems((prev) => [...prev, newItem]);
      setAddForm({ item: "", qty: "1", total: "", kategori_id: "", menu_id: "" });
      setSuccess("Item pengeluaran ditambahkan!");
      return;
    }
    if (!addForm.menu_id) {
      setError("Pilih menu terlebih dahulu!");
      return;
    }
    const selectedMenu = menu.find((m) => m.id === addForm.menu_id);
    if (!selectedMenu) return;
    const qty = parseInt(addForm.qty) || 1;
    const total = qty * selectedMenu.harga;
    const newItem = {
      menu_id: selectedMenu.id,
      nama: selectedMenu.nama,
      qty: qty,
      harga: selectedMenu.harga,
      total: total,
    };
    setPesananItems((prev) => [...prev, newItem]);
    setAddForm({ item: "", qty: "1", total: "", kategori_id: "", menu_id: "" });
    setSuccess("Item ditambahkan ke pesanan!");
  };

  const hapusItemPesanan = (idx) => {
    setPesananItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleTambahTransaksi = async () => {
    if (pesananItems.length === 0) {
      setError("Tambahkan minimal satu item!");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const kafeId = kafe?.id || profile?.kafe_id;
      if (!kafeId) {
        setError("Kafe tidak ditemukan.");
        setLoading(false);
        return;
      }
      const totalQty = pesananItems.reduce((sum, p) => sum + p.qty, 0);
      const subtotal = pesananItems.reduce((sum, p) => sum + p.total, 0);
      let pajak = 0;
      if (pajakEnabled && addType === "masuk") {
        pajak = Math.round(subtotal * (persentasePajak / 100));
      }
      const grandTotal = subtotal + pajak;

      const itemsDetail = pesananItems.map((p) => ({
        nama: p.nama,
        qty: p.qty,
        harga: p.harga,
        total: p.total,
      }));
      const itemStr = JSON.stringify(itemsDetail);

      const payload = {
        kafe_id: kafeId,
        item: itemStr,
        qty: totalQty,
        total: grandTotal,
        tipe: addType,
        status: editTransaksiId
          ? (transaksi.find((t) => t.id === editTransaksiId)?.status || "lunas")
          : "lunas",
        subtotal: subtotal,
        pajak: pajak,
        pajak_enabled: pajakEnabled && addType === "masuk",
        pajak_persen: pajakEnabled && addType === "masuk" ? persentasePajak : 0,
      };

      if (editTransaksiId) {
        // 1. Ambil transaksi lama
        const oldT = transaksi.find((t) => t.id === editTransaksiId);

        // 2. Update transaksi
        await api(`/rest/v1/transaksi?id=eq.${editTransaksiId}`, "PATCH", payload, token);

        // 3. Sesuaikan stok
        if (oldT && oldT.tipe === "masuk") {
          const oldItems = parseItems(oldT.item);
          // Kembalikan stok lama
          for (const oi of oldItems) {
            const m = menu.find((x) => x.nama === oi.nama);
            if (m) {
              await api(
                `/rest/v1/menu?id=eq.${m.id}`,
                "PATCH",
                { stok: (m.stok || 0) + oi.qty },
                token
              );
            }
          }
        }
        if (addType === "masuk") {
          // Kurangi stok baru
          for (const item of pesananItems) {
            let m = null;
            if (item.menu_id) {
              m = menu.find((x) => x.id === item.menu_id);
            }
            if (!m) {
              m = menu.find((x) => x.nama === item.nama);
            }
            if (m) {
              await api(
                `/rest/v1/menu?id=eq.${m.id}`,
                "PATCH",
                { stok: Math.max(0, (m.stok || 0) - item.qty) },
                token
              );
            }
          }
        }
        setSuccess("Transaksi diupdate!");
        setEditTransaksiId(null);
      } else {
        // Transaksi baru
        await api("/rest/v1/transaksi", "POST", payload, token);
        setSuccess("Transaksi tersimpan!");

        if (addType === "masuk") {
          for (const item of pesananItems) {
            if (item.menu_id) {
              const selectedMenu = menu.find((m) => m.id === item.menu_id);
              if (selectedMenu) {
                const newStok = (selectedMenu.stok || 0) - item.qty;
                await api(
                  `/rest/v1/menu?id=eq.${item.menu_id}`,
                  "PATCH",
                  { stok: Math.max(0, newStok) },
                  token
                );
              }
            }
          }
        }
      }
      setPesananItems([]);
      setShowAdd(false);
      await loadTransaksi(token, kafeId);
      await loadMenu(token, kafeId);
    } catch (err) {
      console.error("Transaksi error:", err);
      setError("Gagal menyimpan transaksi.");
    } finally {
      setLoading(false);
    }
  };

  const handleEditTransaksi = (t) => {
    if (profile?.role !== "pemilik" && profile?.role !== "super_admin") {
      setError("Hanya pemilik atau admin yang bisa mengedit transaksi.");
      return;
    }
    setEditTransaksiId(t.id);
    setAddType(t.tipe);
    const items = parseItems(t.item);
    setPesananItems(
      items.map((item) => ({
        menu_id: null,
        nama: item.nama,
        qty: item.qty,
        harga: item.harga || 0,
        total: item.total || 0,
      }))
    );
    setShowAdd(true);
  };

  const handleHapusTransaksi = async (id) => {
    if (profile?.role !== "pemilik" && profile?.role !== "super_admin") {
      setError("Hanya pemilik atau admin yang bisa menghapus transaksi.");
      return;
    }
    if (!confirm("Yakin hapus transaksi ini?")) return;
    try {
      const t = transaksi.find((x) => x.id === id);
      // Kembalikan stok untuk transaksi masuk
      if (t && t.tipe === "masuk") {
        const items = parseItems(t.item);
        for (const it of items) {
          const m = menu.find((x) => x.nama === it.nama);
          if (m) {
            await api(
              `/rest/v1/menu?id=eq.${m.id}`,
              "PATCH",
              { stok: (m.stok || 0) + it.qty },
              token
            );
          }
        }
      }
      await api(`/rest/v1/transaksi?id=eq.${id}`, "DELETE", null, token);
      setSuccess("Transaksi dihapus!");
      await loadTransaksi(token, kafe?.id || profile?.kafe_id);
      await loadMenu(token, kafe?.id || profile?.kafe_id);
    } catch (err) {
      setError("Gagal hapus transaksi.");
    }
  };

  // ============================================================
  // CRUD MENU
  // ============================================================
  const handleTambahMenu = async () => {
    if (!canManageCatalog) {
      setError("Hanya pemilik atau admin yang bisa menambah menu.");
      return;
    }
    if (!menuForm.nama || !menuForm.harga || !menuForm.hpp) {
      setError("Nama, harga, dan HPP wajib diisi!");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const kafeId = kafe?.id || profile?.kafe_id;
      if (!kafeId && profile?.role !== "super_admin") {
        setError("Kafe tidak ditemukan.");
        setLoading(false);
        return;
      }
      const stokValue = parseInt(menuForm.stok) || 0;
      const qtyValue = parseInt(menuForm.qty) || 0;

      let fotoUrl = menuForm.foto || "";
      if (menuFile) {
        fotoUrl = await uploadMenuFoto(menuFile, kafeId);
      }

      const payload = {
        nama: menuForm.nama.trim(),
        harga: Number.parseInt(menuForm.harga, 10),
        hpp: Number.parseInt(menuForm.hpp, 10),
        stok: stokValue + qtyValue,
        kategori_id: menuForm.kategori_id || null,
        foto: fotoUrl,
      };
      if (editMenuId) {
        const menuScope = kafeId ? `&kafe_id=eq.${encodeURIComponent(kafeId)}` : "";
        const updated = await api(`/rest/v1/menu?id=eq.${encodeURIComponent(editMenuId)}${menuScope}`, "PATCH", payload, token);
        if (!Array.isArray(updated) || updated.length === 0) {
          throw new Error("Menu tidak berubah. Periksa hak akses pemilik kafe dan pastikan menu masih ada.");
        }
        setSuccess("Menu berhasil diperbarui.");
        setEditMenuId(null);
      } else {
        if (kafeId) payload.kafe_id = kafeId;
        else if (profile?.role !== "super_admin") throw new Error("Kafe tidak ditemukan. Muat ulang lalu login kembali.");
        const created = await api("/rest/v1/menu", "POST", payload, token);
        if (!Array.isArray(created) || created.length === 0) {
          throw new Error("Menu tidak tersimpan. Periksa hak akses dan data kafe.");
        }
        setSuccess("Menu berhasil ditambahkan.");
      }
      setMenuForm({ nama: "", harga: "", hpp: "", stok: "", kategori_id: "", foto: "", qty: "" });
      setMenuFile(null);
      setShowAddMenu(false);
      await loadMenu(token, kafeId);
    } catch (err) {
      console.error("Menu error:", err);
      setError("Gagal menyimpan menu: " + getApiErrorMessage(err, "Periksa koneksi dan izin akun."));
    } finally {
      setLoading(false);
    }
  };

  const handleEditMenu = (m) => {
    if (!canManageCatalog) {
      setError("Hanya pemilik atau admin yang bisa mengedit menu.");
      return;
    }
    setEditMenuId(m.id);
    setMenuForm({
      nama: m.nama,
      harga: String(m.harga),
      hpp: String(m.hpp),
      stok: String(m.stok || 0),
      kategori_id: m.kategori_id || "",
      foto: m.foto || "",
      qty: "",
    });
    setMenuFile(null);
    setShowAddMenu(true);
  };

  const handleHapusMenu = async (id) => {
    if (!canManageCatalog) {
      setError("Hanya pemilik atau admin yang bisa menghapus menu.");
      return;
    }
    if (!confirm("Yakin hapus menu ini?")) return;
    try {
      await api(`/rest/v1/menu?id=eq.${id}`, "DELETE", null, token);
      setSuccess("Menu dihapus!");
      await loadMenu(token, kafe?.id || profile?.kafe_id);
    } catch (err) {
      setError("Gagal hapus menu.");
    }
  };

  // ============================================================
  // CRUD KATEGORI
  // ============================================================
  const handleTambahKategori = async () => {
    if (!canManageCatalog) {
      setError("Hanya pemilik atau admin yang bisa menambah kategori.");
      return;
    }
    if (!kategoriForm.nama) {
      setError("Nama kategori wajib diisi!");
      return;
    }
    setLoading(true);
    setError("");
    try {
      if (editKategoriId) {
        const updated = await api(
          `/rest/v1/kategori?id=eq.${encodeURIComponent(editKategoriId)}${(kafe?.id || profile?.kafe_id) ? `&kafe_id=eq.${encodeURIComponent(kafe?.id || profile?.kafe_id)}` : ""}`,
          "PATCH",
          { nama: kategoriForm.nama.trim() },
          token
        );
        if (!Array.isArray(updated) || updated.length === 0) {
          throw new Error("Kategori tidak berubah. Periksa hak akses pemilik kafe dan pastikan kategori masih ada.");
        }
        setSuccess("Kategori berhasil diperbarui.");
        setEditKategoriId(null);
      } else {
        const kafeId = kafe?.id || profile?.kafe_id || null;
        if (!kafeId && !isSuperAdmin) throw new Error("Kafe tidak ditemukan. Muat ulang lalu login kembali.");
        const created = await api("/rest/v1/kategori", "POST", { nama: kategoriForm.nama.trim(), kafe_id: kafeId }, token);
        if (!Array.isArray(created) || created.length === 0) throw new Error("Kategori tidak tersimpan. Periksa hak akses dan data kafe.");
        setSuccess("Kategori berhasil ditambahkan.");
      }
      setKategoriForm({ nama: "" });
      setShowAddKategori(false);
      await loadKategori(token, kafe?.id || profile?.kafe_id);
    } catch (err) {
      console.error("Kategori error:", err);
      setError("Gagal menyimpan kategori: " + getApiErrorMessage(err, "Periksa koneksi dan izin akun."));
    } finally {
      setLoading(false);
    }
  };

  const handleHapusKategori = async (id) => {
    if (profile?.role !== "pemilik" && profile?.role !== "super_admin") return;
    if (!confirm("Yakin hapus kategori ini?")) return;
    try {
      await api(`/rest/v1/kategori?id=eq.${id}`, "DELETE", null, token);
      setSuccess("Kategori dihapus!");
      await loadKategori(token, kafe?.id || profile?.kafe_id);
    } catch (err) {
      setError("Gagal hapus kategori.");
    }
  };

  // ============================================================
  // CRUD KARYAWAN
  // ============================================================
  const handleTambahKaryawan = async () => {
    if (profile?.role !== "pemilik" && profile?.role !== "super_admin") {
      setError("Hanya pemilik atau admin yang bisa mengelola karyawan.");
      return;
    }
    if (!karyawanForm.nama || (!editKaryawanId && (!karyawanForm.email || !karyawanForm.password))) {
      setError("Semua kolom wajib diisi!");
      return;
    }
    if (!editKaryawanId && karyawanForm.password.length < 6) {
      setError("Password minimal 6 karakter!");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const kafeId = kafe?.id || profile?.kafe_id;
      if (!kafeId && profile?.role !== "super_admin") {
        setError("Kafe tidak ditemukan.");
        setLoading(false);
        return;
      }
      if (editKaryawanId) {
        await api(
          `/rest/v1/profiles?id=eq.${editKaryawanId}`,
          "PATCH",
          { nama: karyawanForm.nama },
          token
        );
        setSuccess("Karyawan diupdate!");
        setEditKaryawanId(null);
      } else {
        const authData = await authApi("/signup", {
          email: karyawanForm.email,
          password: karyawanForm.password,
        });
        if (authData.user) {
          await api(
            "/rest/v1/profiles",
            "POST",
            {
              id: authData.user.id,
              nama: karyawanForm.nama,
              role: "barista",
              kafe_id: kafeId,
            },
            token
          );
          setSuccess("Karyawan ditambahkan!");
        } else {
          setError("Gagal membuat akun karyawan.");
          setLoading(false);
          return;
        }
      }
      setKaryawanForm({ nama: "", email: "", password: "" });
      setEditKaryawanId(null);
      setShowAddKaryawan(false);
      await loadKaryawan(token, kafeId);
    } catch (err) {
      console.error("Karyawan error:", err);
      setError("Gagal menyimpan karyawan.");
    } finally {
      setLoading(false);
    }
  };

  const handleEditKaryawan = (k) => {
    if (profile?.role !== "pemilik" && profile?.role !== "super_admin") return;
    setEditKaryawanId(k.id);
    setKaryawanForm({ nama: k.nama, email: k.email || "", password: "" });
    setShowAddKaryawan(true);
  };

  const handleHapusKaryawan = async (id) => {
    if (profile?.role !== "pemilik" && profile?.role !== "super_admin") return;
    if (!confirm("Yakin hapus karyawan ini?")) return;
    try {
      await api(`/rest/v1/profiles?id=eq.${id}`, "DELETE", null, token);
      setSuccess("Karyawan dihapus!");
      await loadKaryawan(token, kafe?.id || profile?.kafe_id);
    } catch (err) {
      setError("Gagal hapus karyawan.");
    }
  };

  // ============================================================
  // STOK
  // ============================================================
  const handleUpdateStok = async () => {
    if (profile?.role !== "pemilik" && profile?.role !== "super_admin") {
      setError("Hanya pemilik atau admin yang bisa mengelola stok.");
      return;
    }
    if (!stokForm.menu_id || stokForm.stok === "") {
      setError("Pilih menu dan isi stok!");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await api(
        `/rest/v1/menu?id=eq.${stokForm.menu_id}`,
        "PATCH",
        { stok: parseInt(stokForm.stok) || 0 },
        token
      );
      setSuccess("Stok diupdate!");
      setStokForm({ menu_id: "", stok: "" });
      setShowStok(false);
      await loadMenu(token, kafe?.id || profile?.kafe_id);
    } catch (err) {
      setError("Gagal update stok.");
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // ABSENSI
  // ============================================================
  const handleAbsenMasuk = async () => {
    if (profile?.role !== "pemilik" && profile?.role !== "super_admin") {
      setError("Hanya pemilik atau admin yang bisa melakukan absensi.");
      return;
    }
    if (!absensiForm.pegawai_id) {
      setError("Pilih pegawai!");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const kafeId = kafe?.id || profile?.kafe_id;
      const now = new Date().toISOString();
      await api(
        "/rest/v1/absensi",
        "POST",
        {
          pegawai_id: absensiForm.pegawai_id,
          kafe_id: kafeId,
          tanggal: todayWIB(),
          jam_masuk: now,
          jam_keluar: null,
        },
        token
      );
      setSuccess("Absen masuk berhasil!");
      setAbsensiForm({ pegawai_id: "", tanggal: "", jam_masuk: "", jam_keluar: "" });
      setShowAbsensi(false);
      await loadAbsensi(token, kafeId);
    } catch (err) {
      console.error("Absen masuk error:", err);
      setError("Gagal absen masuk.");
    } finally {
      setLoading(false);
    }
  };

  const handleAbsenKeluar = async (id) => {
    if (profile?.role !== "pemilik" && profile?.role !== "super_admin") {
      setError("Hanya pemilik atau admin yang bisa mengupdate absensi.");
      return;
    }
    if (!confirm("Absen keluar untuk pegawai ini?")) return;
    setLoading(true);
    setError("");
    try {
      const now = new Date().toISOString();
      await api(`/rest/v1/absensi?id=eq.${id}`, "PATCH", { jam_keluar: now }, token);
      setSuccess("Absen keluar berhasil!");
      await loadAbsensi(token, kafe?.id || profile?.kafe_id);
    } catch (err) {
      console.error("Absen keluar error:", err);
      setError("Gagal absen keluar.");
    } finally {
      setLoading(false);
    }
  };

  const handleBaristaAbsenMasuk = async () => {
    if (profile?.role !== "barista") {
      setError("Hanya barista yang bisa menggunakan fitur ini.");
      return;
    }
    setBaristaAbsenLoading(true);
    setError("");
    try {
      const kafeId = kafe?.id || profile?.kafe_id;
      if (!kafeId) {
        setError("Kafe tidak ditemukan.");
        setBaristaAbsenLoading(false);
        return;
      }
      const today = todayWIB();
      const existing = absensi.find((a) => a.pegawai_id === profile.id && a.tanggal === today);
      if (existing && existing.jam_masuk) {
        setError("Anda sudah absen masuk hari ini.");
        setBaristaAbsenLoading(false);
        return;
      }
      const now = new Date().toISOString();
      await api(
        "/rest/v1/absensi",
        "POST",
        {
          pegawai_id: profile.id,
          kafe_id: kafeId,
          tanggal: today,
          jam_masuk: now,
          jam_keluar: null,
        },
        token
      );
      setSuccess("Absen masuk berhasil!");
      await loadAbsensi(token, kafeId);
    } catch (err) {
      console.error("Barista absen masuk error:", err);
      setError("Gagal absen masuk.");
    } finally {
      setBaristaAbsenLoading(false);
    }
  };

  const handleBaristaAbsenKeluar = async () => {
    if (profile?.role !== "barista") {
      setError("Hanya barista yang bisa menggunakan fitur ini.");
      return;
    }
    setBaristaAbsenLoading(true);
    setError("");
    try {
      const kafeId = kafe?.id || profile?.kafe_id;
      if (!kafeId) {
        setError("Kafe tidak ditemukan.");
        setBaristaAbsenLoading(false);
        return;
      }
      const today = todayWIB();
      const existing = absensi.find((a) => a.pegawai_id === profile.id && a.tanggal === today);
      if (!existing || !existing.jam_masuk) {
        setError("Anda belum absen masuk hari ini.");
        setBaristaAbsenLoading(false);
        return;
      }
      if (existing.jam_keluar) {
        setError("Anda sudah absen keluar hari ini.");
        setBaristaAbsenLoading(false);
        return;
      }
      const now = new Date().toISOString();
      await api(`/rest/v1/absensi?id=eq.${existing.id}`, "PATCH", { jam_keluar: now }, token);
      setSuccess("Absen keluar berhasil!");
      await loadAbsensi(token, kafeId);
    } catch (err) {
      console.error("Barista absen keluar error:", err);
      setError("Gagal absen keluar.");
    } finally {
      setBaristaAbsenLoading(false);
    }
  };

  const filteredAbsensi = absensi.filter((a) => {
    let match = true;
    if (filterNama) {
      const pegawai = karyawan.find((k) => k.id === a.pegawai_id);
      match = match && (pegawai?.nama || "").toLowerCase().includes(filterNama.toLowerCase());
    }
    if (filterTglMulaiAbsen) {
      match = match && new Date(a.tanggal) >= new Date(filterTglMulaiAbsen);
    }
    if (filterTglSelesaiAbsen) {
      match = match && new Date(a.tanggal) <= new Date(filterTglSelesaiAbsen);
    }
    return match;
  });

  // ============================================================
  // KASIR
  // ============================================================
  const handleJumlah = (id, newVal) => {
    let val = parseInt(newVal);
    if (isNaN(val) || val < 1) val = 1;
    setJumlahMap((prev) => ({ ...prev, [id]: val }));
  };

  const tambahKeKeranjang = (item, qty = 1) => {
    if (item.stok !== undefined && item.stok <= 0) {
      setError(`⚠️ Stok ${item.nama} sedang 0, tetapi tetap bisa dipesan.`);
    }
    setKeranjang((prev) => {
      const existing = prev.find((p) => p.id === item.id && (p.catatan || "") === (item.catatan || "") && (p.antreanNomor || "") === (item.antreanNomor || ""));
      if (existing) {
        return prev.map((p) => (p.id === item.id ? { ...p, qty: p.qty + qty } : p));
      }
      return [...prev, { ...item, qty: qty }];
    });
    setSuccess(`${item.nama} x${qty} ditambahkan ke keranjang!`);
    setJumlahMap((prev) => ({ ...prev, [item.id]: 1 }));
  };

  const kurangiDariKeranjang = (id) => {
    setKeranjang((prev) => {
      const existing = prev.find((p) => p.id === id);
      if (existing && existing.qty > 1) {
        return prev.map((p) => (p.id === id ? { ...p, qty: p.qty - 1 } : p));
      }
      return prev.filter((p) => p.id !== id);
    });
  };

  const hapusDariKeranjang = (id) => {
    setKeranjang((prev) => prev.filter((p) => p.id !== id));
  };

  const totalKeranjang = useMemo(
    () => keranjang.reduce((sum, item) => sum + (Number(item.harga) || 0) * (Number(item.qty) || 0), 0),
    [keranjang]
  );

  const handleCheckout = async () => {
    if (keranjang.length === 0) {
      setError("Keranjang kosong!");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const kafeId = kafe?.id || profile?.kafe_id;
      if (!kafeId) {
        setError("Kafe tidak ditemukan.");
        setLoading(false);
        return;
      }
      const subtotal = totalKeranjang;
      let pajak = 0;
      if (pajakCheckoutEnabled) {
        pajak = Math.round(subtotal * (persentasePajak / 100));
      }
      const grandTotal = subtotal + pajak;

      const itemsDetail = keranjang.map((item) => ({
        nama: item.nama,
        qty: item.qty,
        harga: item.harga,
        total: item.harga * item.qty,
        ...(item.catatan ? { catatan: item.catatan } : {}),
        ...(item.antreanNomor ? { nomor_antrean: item.antreanNomor } : {}),
      }));
      const itemStr = JSON.stringify(itemsDetail);

      const tunaiMasuk = pembayaran === "tunai"
        ? (parseInt(bayarAmount, 10) || grandTotal)
        : pembayaran === "split" ? (parseInt(splitTunaiAmount, 10) || 0) : 0;
      if (pembayaran === "tunai" && tunaiMasuk < grandTotal) {
        setError("Jumlah uang tunai kurang dari total tagihan.");
        setLoading(false);
        return;
      }
      if (pembayaran === "split" && (tunaiMasuk <= 0 || tunaiMasuk >= grandTotal)) {
        setError("Untuk split payment, nominal tunai harus lebih dari 0 dan kurang dari total tagihan.");
        setLoading(false);
        return;
      }
      const qrisMasuk = pembayaran === "qris" ? grandTotal : pembayaran === "split" ? grandTotal - tunaiMasuk : 0;
      const bayarInt = pembayaran === "piutang" ? 0 : pembayaran === "tunai" ? tunaiMasuk : grandTotal;
      const kembalianInt = pembayaran === "tunai" ? Math.max(0, tunaiMasuk - grandTotal) : 0;
      const status = pembayaran === "piutang" ? "belum_lunas" : "lunas";

      const basePayload = {
        kafe_id: kafeId,
        item: itemStr,
        qty: keranjang.reduce((sum, item) => sum + item.qty, 0),
        total: grandTotal,
        tipe: "masuk",
        status: status,
        subtotal: subtotal,
        pajak: pajak,
        pajak_enabled: pajakCheckoutEnabled,
        pajak_persen: pajakCheckoutEnabled ? persentasePajak : 0,
      };

      // Simpan transaksi sekali saja; QRIS tetap dikonfirmasi manual oleh kasir.
      await api(
          "/rest/v1/transaksi",
          "POST",
          {
            ...basePayload,
            bayar: bayarInt,
            kembalian: kembalianInt,
            metode: pembayaran,
            bayar_tunai: tunaiMasuk,
            bayar_qris: qrisMasuk,
          },
          token
        );

      // Simpan struk ke state untuk langsung print
      const receipt = {
        namaKafe: (kafe?.nama || "KAFE").toUpperCase(),
        alamatKafe: kafe?.alamat || "",
        teleponKafe: kafe?.telepon || "",
        nomorTrx: "NEW-" + Date.now().toString().slice(-8),
        tanggal: formatDateTimeWIB(new Date().toISOString()),
        kasir: profile?.nama || "Admin",
        kasirRole: profile?.role || "",
        items: itemsDetail,
        subtotal,
        pajak,
        pajakPersen: pajakCheckoutEnabled ? persentasePajak : 0,
        total: grandTotal,
        bayar: bayarInt,
        kembalian: kembalianInt,
        bayarTunai: tunaiMasuk,
        bayarQris: qrisMasuk,
        metode: pembayaran === "tunai" ? "Tunai" : pembayaran === "qris" ? "QRIS" : pembayaran === "split" ? "Tunai + QRIS" : "Piutang",
        status,
      };
      setLastReceipt(receipt);

      // Kurangi stok
      for (const item of keranjang) {
        const newStok = (item.stok || 0) - item.qty;
        await api(
          `/rest/v1/menu?id=eq.${item.id}`,
          "PATCH",
          { stok: Math.max(0, newStok) },
          token
        );
      }

      setKeranjang([]);
      setPajakCheckoutEnabled(pajakEnabled);
      setBayarAmount("");
      setSplitTunaiAmount("");
      setPembayaran("tunai");
      setSuccess("Transaksi berhasil!");
      await loadTransaksi(token, kafeId);
      await loadMenu(token, kafeId);
    } catch (err) {
      console.error("Checkout error:", err);
      setError("Gagal checkout: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // PRINT STRUK DARI TAB STRUK
  // ============================================================
  const handlePrintStruk = () => {
    if (!selectedTransaksi) {
      setError("Pilih transaksi dulu.");
      return;
    }
    const items = parseItems(selectedTransaksi.item);
    const subtotal = selectedTransaksi.subtotal || selectedTransaksi.total;
    const pajak = selectedTransaksi.pajak || 0;
    const total = selectedTransaksi.total;
    const bayar =
      selectedTransaksi.bayar !== null && selectedTransaksi.bayar !== undefined
        ? selectedTransaksi.bayar
        : total;
    const kembalian =
      selectedTransaksi.kembalian !== null && selectedTransaksi.kembalian !== undefined
        ? selectedTransaksi.kembalian
        : 0;
    const metode =
      selectedTransaksi.metode ||
      (selectedTransaksi.status === "belum_lunas" ? "Piutang" : "Tunai");

    printReceipt({
      namaKafe: (kafe?.nama || "KAFE").toUpperCase(),
      alamatKafe: kafe?.alamat || "",
      teleponKafe: kafe?.telepon || "",
      nomorTrx: (selectedTransaksi.id || "N/A").slice(0, 12),
      tanggal: formatDateTimeWIB(selectedTransaksi.created_at),
      kasir: profile?.nama || "Admin",
      kasirRole: profile?.role || "",
      items: items.map((it) => ({
        nama: it.nama,
        qty: it.qty,
        harga: Number(it.harga) || (Number(it.qty) ? Number(it.total || 0) / Number(it.qty) : 0),
        total: it.total || it.harga * it.qty || 0,
      })),
      subtotal,
      pajak,
      pajakPersen: persentasePajak,
      total,
      bayar,
      kembalian,
      metode,
      status: selectedTransaksi.status || "lunas",
    }, printerSettings);
  };

  // ============================================================
  // LAPORAN + GRAFIK + EXPORT
  // ============================================================
  const getFilteredTransaksi = () => {
    if (profile?.role === "barista") {
      const today = todayWIB();
      return transaksi.filter((t) => dateKeyWIB(t.created_at) === today);
    }
    let filtered = [...transaksi];
    if (filterTglMulai) {
      filtered = filtered.filter((t) => {
        const day = dateKeyWIB(t.created_at);
        return day && day >= filterTglMulai;
      });
    }
    if (filterTglSelesai) {
      filtered = filtered.filter((t) => {
        const day = dateKeyWIB(t.created_at);
        return day && day <= filterTglSelesai;
      });
    }
    if (!filterTglMulai && !filterTglSelesai) {
      filtered = filterTransaksiByPeriode(filtered, periodeFilter);
    }
    if (filterStatus === "lunas") {
      filtered = filtered.filter((t) => t.status === "lunas");
    } else if (filterStatus === "belum_lunas") {
      filtered = filtered.filter((t) => t.status === "belum_lunas");
    }
    return filtered;
  };

  const getDashboardData = () => {
    const data = filterTransaksiByPeriode(transaksi, periodeFilter);
    let masuk = 0;
    let keluar = 0;
    for (const t of data) {
      const total = Number(t.total) || 0;
      if (t.tipe === "masuk") masuk += total;
      else if (t.tipe === "keluar") keluar += total;
    }
    return { totalMasuk: masuk, totalKeluar: keluar, laba: masuk - keluar, count: data.length };
  };

  const filtered = useMemo(
    () => getFilteredTransaksi(),
    [transaksi, profile?.role, filterTglMulai, filterTglSelesai, filterStatus, periodeFilter, wibDayKey]
  );
  const dashboardData = useMemo(
    () => getDashboardData(),
    [transaksi, periodeFilter, profile?.role, wibDayKey]
  );
  const { totalMasuk, totalKeluar } = useMemo(() => {
    let masuk = 0;
    let keluar = 0;
    for (const t of filtered) {
      const total = Number(t.total) || 0;
      if (t.tipe === "masuk") masuk += total;
      else if (t.tipe === "keluar") keluar += total;
    }
    return { totalMasuk: masuk, totalKeluar: keluar };
  }, [filtered]);
  const laba = totalMasuk - totalKeluar;
  const totalStok = useMemo(
    () => menu.reduce((sum, item) => sum + (Number(item.stok) || 0), 0),
    [menu]
  );

  // Report data is the heaviest derived work. Keep it cached while users type,
  // edit a cart, or switch unrelated UI state.
  const reportData = useMemo(() => {
    const chartData = {};
    // Reuse formatter; constructing one for every transaction is unnecessary work.
    const reportDateFormatter = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta" });
    const laporanStokData = menu.map((m) => ({ ...m, terjual: 0, sisa: Number(m.stok) || 0 }));
    const stockByName = new Map(laporanStokData.map((m) => [m.nama, m]));
    const kategoriById = new Map(kategori.map((k) => [k.id, k.nama || "Umum"]));
    const menuByName = new Map(menu.map((m) => [m.nama, m]));
    const kategoriPenjualan = {};
    const produkPerKategori = {};
    const produkTerjual = {};

    menu.forEach((m) => {
      const katNama = kategoriById.get(m.kategori_id) || "Umum";
      if (!produkPerKategori[katNama]) produkPerKategori[katNama] = [];
      produkPerKategori[katNama].push(m);
    });

    filtered.forEach((t) => {
      if (t.tipe === "masuk") {
        const date = reportDateFormatter.format(new Date(t.created_at));
        if (!chartData[date]) chartData[date] = { masuk: 0, keluar: 0 };
        chartData[date].masuk += Number(t.total) || 0;
      } else {
        const date = reportDateFormatter.format(new Date(t.created_at));
        if (!chartData[date]) chartData[date] = { masuk: 0, keluar: 0 };
        chartData[date].keluar += Number(t.total) || 0;
      }

      // Keep product-level report data available to reports and assistant queries.
      if (t.tipe !== "masuk" || !t.item) return;
      const items = parseItems(t.item);
      items.forEach((item) => {
        const stockItem = stockByName.get(item.nama);
        if (stockItem) {
          stockItem.terjual = (stockItem.terjual || 0) + item.qty;
          stockItem.sisa = (Number(stockItem.stok) || 0) - stockItem.terjual;
        }
        const menuItem = menuByName.get(item.nama);
        if (menuItem) {
          const katNama = kategoriById.get(menuItem.kategori_id) || "Umum";
          kategoriPenjualan[katNama] = (kategoriPenjualan[katNama] || 0) + item.qty;
        }
        produkTerjual[item.nama] = (produkTerjual[item.nama] || 0) + item.qty;
      });
    });

    return { chartData, laporanStokData, kategoriPenjualan, produkPerKategori, produkTerjual };
  }, [filtered, menu, kategori]);
  const { chartData, laporanStokData, kategoriPenjualan, produkPerKategori, produkTerjual } = reportData;
  const chartLabels = Object.keys(chartData).slice(-7);
  const chartMasuk = chartLabels.map((d) => chartData[d].masuk);
  const chartKeluar = chartLabels.map((d) => chartData[d].keluar);
  const maxChart = Math.max(1, ...chartMasuk, ...chartKeluar);
  const sortedKategori = Object.entries(kategoriPenjualan).sort((a, b) => b[1] - a[1]);
  const top5Kategori = sortedKategori.slice(0, 5);
  const bottom5Kategori = sortedKategori.slice(-5).reverse();

  const exportExcel = () => {
    // Quote every CSV cell so commas in item names/details never create extra columns.
    const csvCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const header = ["Tanggal", "Item", "Qty", "Total", "Tipe", "Status"]
      .map(csvCell)
      .join(",");
    const rows = filtered.map((t) => {
      const items = parseItems(t.item);
      const itemDisplay = items.map((i) => `${i.nama} x${i.qty}`).join(" | ");
      return [
        formatTanggalWIB(t.created_at),
        itemDisplay,
        t.qty,
        t.total,
        t.tipe,
        t.status || "lunas",
      ].map(csvCell).join(",");
    });
    // BOM + CRLF improves UTF-8 and column recognition in Microsoft Excel.
    const csv = "\uFEFF" + [header, ...rows].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `laporan_keuangan_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    setSuccess("Laporan berhasil di-download!");
  };

  // ============================================================
  // AI AGENT (keyword-based)
  // ============================================================
  const handleAiQuery = async () => {
    if (!aiQuery.trim()) {
      setAiAnswer("Silakan tulis pertanyaan Anda.");
      return;
    }
    setAiLoading(true);
    const q = aiQuery.toLowerCase().trim();

    const totalTransaksi = transaksi.length;
    const totalPemasukan = transaksi.filter((t) => t.tipe === "masuk").reduce((a, b) => a + b.total, 0);
    const totalPengeluaran = transaksi.filter((t) => t.tipe === "keluar").reduce((a, b) => a + b.total, 0);
    const labaBersih = totalPemasukan - totalPengeluaran;
    const totalMenu = menu.length;
    const totalKategori = kategori.length;
    const totalKaryawan = karyawan.length;
    const totalStokAll = menu.reduce((sum, m) => sum + (m.stok || 0), 0);
    const today = todayWIB();
    const todayAbsen = absensi.filter((a) => a.tanggal === today);
    const top5 = Object.entries(produkTerjual || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    let answer = "";

    if (q.includes("total penjualan") || q.includes("omzet") || q.includes("total pemasukan")) {
      answer = `💰 Total pemasukan (omzet) seluruh periode: ${fmt(totalPemasukan)}`;
    } else if (q.includes("laba") || q.includes("keuntungan")) {
      answer = `📈 Laba bersih: ${fmt(labaBersih)} (Pemasukan ${fmt(totalPemasukan)}, Pengeluaran ${fmt(totalPengeluaran)})`;
    } else if (q.includes("stok") && (q.includes("menipis") || q.includes("habis") || q.includes("kurang"))) {
      const low = menu.filter((m) => (m.stok || 0) < 5);
      if (low.length === 0) answer = "✅ Semua stok produk aman (>=5).";
      else
        answer = `⚠️ Produk dengan stok menipis (kurang dari 5):\n${low
          .map((m) => `- ${m.nama}: ${m.stok || 0} item`)
          .join("\n")}`;
    } else if (q.includes("total stok") || q.includes("jumlah stok")) {
      answer = `📦 Total stok seluruh produk: ${totalStokAll} item`;
    } else if (q.includes("karyawan") || q.includes("pegawai") || q.includes("staff")) {
      answer = `👤 Jumlah karyawan: ${totalKaryawan} orang.`;
    } else if (q.includes("absensi") || q.includes("kehadiran")) {
      if (todayAbsen.length === 0) answer = "📋 Belum ada absensi hari ini.";
      else {
        const hadir = todayAbsen.filter((a) => a.jam_masuk).length;
        answer = `📋 Absensi hari ini: ${hadir} orang masuk.`;
      }
    } else if (q.includes("produk terlaris") || q.includes("terbanyak") || q.includes("best seller")) {
      if (top5.length === 0) answer = "❌ Belum ada data penjualan produk.";
      else
        answer = `🏆 Top 5 produk terlaris:\n${top5
          .map(([nama, qty]) => `- ${nama}: ${qty} item`)
          .join("\n")}`;
    } else if (q.includes("kategori") && (q.includes("terlaris") || q.includes("terbanyak"))) {
      const sorted = Object.entries(kategoriPenjualan).sort((a, b) => b[1] - a[1]);
      const top = sorted.slice(0, 5);
      if (top.length === 0) answer = "❌ Belum ada data kategori.";
      else
        answer = `🏷️ Top 5 kategori terlaris:\n${top
          .map(([kat, qty]) => `- ${kat}: ${qty} item`)
          .join("\n")}`;
    } else if (q.includes("total transaksi") || q.includes("jumlah transaksi")) {
      answer = `📝 Total transaksi: ${totalTransaksi} transaksi.`;
    } else if (q.includes("super admin") || q.includes("admin")) {
      answer = "👑 Super Admin: login via email";
    } else if (
      q.includes("cuaca") ||
      q.includes("ekonomi") ||
      q.includes("politik") ||
      q.includes("gempa") ||
      q.includes("dunia") ||
      q.includes("nasional")
    ) {
      answer =
        "🌤️ Saya tidak memiliki akses ke data real-time. Saya hanya bisa menjawab pertanyaan seputar data di aplikasi KopiLaba.\n\n💡 Coba tanyakan: total penjualan, laba, stok menipis, produk terlaris, absensi hari ini, dll.";
    } else {
      answer = `📊 **Ringkasan Data KopiLaba:**\n- Total transaksi: ${totalTransaksi}\n- Total pemasukan: ${fmt(totalPemasukan)}\n- Total pengeluaran: ${fmt(totalPengeluaran)}\n- Laba bersih: ${fmt(labaBersih)}\n- Total menu: ${totalMenu}\n- Total kategori: ${totalKategori}\n- Total karyawan: ${totalKaryawan}\n- Total stok: ${totalStokAll} item\n${top5.length > 0 ? `- Produk terlaris: ${top5[0][0]} (${top5[0][1]} item)` : ""}\n\n💡 Coba tanyakan: "total penjualan", "laba", "stok menipis", "produk terlaris", "absensi hari ini".`;
    }

    setAiAnswer(answer);
    setAiLoading(false);
  };

  // ============================================================
  // SUPER ADMIN DASHBOARD
  // ============================================================
  const getAdminFilteredTransaksi = () => {
    let filtered = [...allTransaksi];
    const { start } = getDateRange(adminFilterPeriode);
    const startKey = dateKeyWIB(start);
    const endKey = todayWIB();
    filtered = filtered.filter((t) => {
      const day = dateKeyWIB(t.created_at);
      return day && day >= startKey && day <= endKey;
    });
    if (adminFilterOwner) {
      const ownerKafe = allOwners.find((o) => o.id === adminFilterOwner);
      if (ownerKafe) {
        filtered = filtered.filter((t) => t.kafe_id === ownerKafe.kafe_id);
      }
    }
    return filtered;
  };

  const adminFiltered = useMemo(
    () => getAdminFilteredTransaksi(),
    [allTransaksi, adminFilterPeriode, adminFilterOwner, allOwners]
  );
  const { adminTotalPemasukan, adminTotalPengeluaran } = useMemo(() => {
    let masuk = 0;
    let keluar = 0;
    for (const t of adminFiltered) {
      const total = Number(t.total) || 0;
      if (t.tipe === "masuk") masuk += total;
      else if (t.tipe === "keluar") keluar += total;
    }
    return { adminTotalPemasukan: masuk, adminTotalPengeluaran: keluar };
  }, [adminFiltered]);
  const adminLaba = adminTotalPemasukan - adminTotalPengeluaran;

  // ============================================================
  // THEME & STYLES
  // ============================================================
  const theme = darkMode
    ? {
        bg: "#071C12",
        card: "#10291C",
        cardBorder: "rgba(37, 211, 102, 0.20)",
        text: "#F5FBF7",
        textMuted: "#A8BDB0",
        input: "#0B2116",
        inputBorder: "rgba(37, 211, 102, 0.28)",
        gold: "#128C4A",
        success: "#128C4A",
        danger: "#F87171",
        headerBg: "#0B2418",
        shadow: "0 10px 32px rgba(0,0,0,0.22)",
        blur: "blur(20px)",
      }
    : {
        bg: "#F6F8F6",
        card: "#FFFFFF",
        cardBorder: "#E1E9E3",
        text: "#18251D",
        textMuted: "#65756A",
        input: "#FFFFFF",
        inputBorder: "#D6E2D9",
        gold: "#128C4A",
        success: "#128C4A",
        danger: "#C62828",
        headerBg: "rgba(255, 255, 255, 0.97)",
        shadow: "0 6px 24px rgba(19, 54, 32, 0.07)",
        blur: "blur(20px)",
      };

  const s = {
    wrap: {
      fontFamily: "'Inter',system-ui,sans-serif",
      background: theme.bg,
      minHeight: "100vh",
      width: "100%",
      maxWidth: "100%",
      margin: 0,
      padding: 0,
      color: theme.text,
      position: "relative",
      transition: "all 0.3s ease",
      display: "flex",
      flexDirection: "column",
      boxSizing: "border-box",
      overflowX: "hidden",
    },
    card: {
      background: theme.card,
      backdropFilter: theme.blur,
      WebkitBackdropFilter: theme.blur,
      border: `1px solid ${theme.cardBorder}`,
      borderRadius: 20,
      padding: 18,
      marginBottom: 14,
      transition: "all 0.3s ease",
      boxShadow: theme.shadow,
    },
    input: {
      width: "100%",
      background: theme.input,
      backdropFilter: "blur(10px)",
      WebkitBackdropFilter: "blur(10px)",
      border: `1px solid ${theme.inputBorder}`,
      borderRadius: 12,
      padding: "12px",
      color: theme.text,
      fontSize: 14,
      boxSizing: "border-box",
      marginBottom: 10,
      transition: "all 0.3s ease",
    },
    btn: {
      width: "100%",
      padding: 16,
      borderRadius: 14,
      border: "none",
      background: theme.gold,
      color: darkMode ? "#fff" : "#18251D",
      fontSize: 15,
      fontWeight: 700,
      cursor: "pointer",
      transition: "all 0.3s ease",
      boxShadow: "0 4px 12px rgba(18,140,74,0.22)",
    },
    btnSm: {
      padding: "8px 16px",
      borderRadius: 10,
      border: "none",
      background: theme.gold,
      color: darkMode ? "#fff" : "#18251D",
      fontSize: 13,
      fontWeight: 600,
      cursor: "pointer",
      transition: "all 0.3s ease",
    },
    label: {
      fontSize: 12,
      color: theme.textMuted,
      marginBottom: 4,
      display: "block",
      transition: "all 0.3s ease",
    },
  };

  // Cache derived lists and reports so opening the drawer/cart or changing a form
  // does not repeatedly recalculate analytics for every transaction.
  const tabs = useMemo(() => isSuperAdmin
    ? [
        { id: "admin", icon: "crown", label: "Admin" },
        { id: "dashboard", icon: "dashboard", label: "Ringkasan" },
        { id: "transaksi", icon: "receipt", label: "Transaksi" },
        { id: "antrean", icon: "list-ordered", label: "Antrean & Pesanan" },
        { id: "menu", icon: "coffee", label: "Menu" },
        { id: "karyawan", icon: "users", label: "Karyawan" },
        { id: "laporan", icon: "chart", label: "Laporan" },
        { id: "pembayaran", icon: "wallet", label: "Analitik Bayar" },
        { id: "struk", icon: "file", label: "Struk" },
        { id: "printer", icon: "file", label: "Pengaturan Printer" },
        { id: "qris", icon: "qr", label: "QRIS" },
      ]
    : [
        { id: "dashboard", icon: "dashboard", label: "Ringkasan" },
        { id: "transaksi", icon: "receipt", label: "Transaksi" },
        { id: "antrean", icon: "list-ordered", label: "Antrean & Pesanan" },
        { id: "menu", icon: "coffee", label: "Menu" },
        { id: "karyawan", icon: "users", label: "Karyawan" },
        { id: "laporan", icon: "chart", label: "Laporan" },
        { id: "pembayaran", icon: "wallet", label: "Analitik Bayar" },
        { id: "struk", icon: "file", label: "Struk" },
        { id: "printer", icon: "file", label: "Pengaturan Printer" },
        { id: "qris", icon: "qr", label: "QRIS" },
        ...(profile?.role === "pemilik" ? [{ id: "backup", icon: "database", label: "Backup Data" }] : []),
      ], [isSuperAdmin, profile?.role]);

  const filteredMenu = useMemo(
    () => selectedKategori ? menu.filter((m) => m.kategori_id === selectedKategori) : menu,
    [selectedKategori, menu]
  );
  const analyticsDayKey = wibDayKey;
  const [analyticsStartDate, setAnalyticsStartDate] = useState(() => todayWIB());
  const [analyticsEndDate, setAnalyticsEndDate] = useState(() => todayWIB());
  const analyticsDatesManuallySelected = useRef(false);
  useEffect(() => {
    if (analyticsDatesManuallySelected.current) return;
    setAnalyticsStartDate(analyticsDayKey);
    setAnalyticsEndDate(analyticsDayKey);
  }, [analyticsDayKey]);
  const {
    transaksiMasuk, pembayaranTunaiTotal, pembayaranQrisTotal,
    tanggalAnalitik, transaksiPerHari, transaksiPerJam, maxPerJam, garisJam
  } = useMemo(() => {
    const isBaristaAnalytics = profile?.role === "barista";
    const selectedStart = isBaristaAnalytics ? analyticsDayKey : (analyticsStartDate || analyticsDayKey);
    const selectedEnd = isBaristaAnalytics ? analyticsDayKey : (analyticsEndDate || analyticsDayKey);
    const rangeStart = selectedStart <= selectedEnd ? selectedStart : selectedEnd;
    const rangeEnd = selectedStart <= selectedEnd ? selectedEnd : selectedStart;
    const dayFormatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit"
    });
    const hourFormatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Jakarta", hour: "2-digit", hourCycle: "h23"
    });
    const days = [];
    const cursor = new Date(rangeStart + "T12:00:00+07:00");
    const lastDay = new Date(rangeEnd + "T12:00:00+07:00");
    for (let guard = 0; cursor <= lastDay && guard < 366; guard++) {
      days.push(dayFormatter.format(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    if (days.length === 0) days.push(analyticsDayKey);
    const byDay = Object.fromEntries(days.map((day) => [day, { tunai: 0, qris: 0 }]));
    const byHour = Array.from({ length: 24 }, (_, hour) => ({ hour, total: 0, count: 0 }));
    const incoming = [];
    let cashTotal = 0;
    let qrisTotal = 0;
    // Satu lintasan transaksi untuk filter tanggal, total pembayaran, grafik harian,
    // dan grafik per jam; menghindari filter + dua reduce + lintasan ulang.
    for (const t of transaksi) {
      if (t.tipe !== "masuk") continue;
      const date = parseTimestampWIB(t.created_at || Date.now());
      if (!date) continue;
      const day = dayFormatter.format(date);
      if (day < rangeStart || day > rangeEnd) continue;
      incoming.push(t);
      const tunai = Number(t.bayar_tunai || 0) || (t.metode === "tunai" ? Number(t.bayar || t.total || 0) : 0);
      const qris = Number(t.bayar_qris || 0) || (t.metode === "qris" ? Number(t.bayar || t.total || 0) : 0);
      cashTotal += tunai;
      qrisTotal += qris;
      if (byDay[day]) {
        byDay[day].tunai += tunai;
        byDay[day].qris += qris;
      }
      const hour = Number(hourFormatter.format(date));
      if (byHour[hour]) {
        byHour[hour].total += Number(t.total || 0);
        byHour[hour].count += 1;
      }
    }
    const perDay = days.map((day) => ({
      day, label: day.slice(8, 10) + "/" + day.slice(5, 7),
      tunai: byDay[day].tunai, qris: byDay[day].qris
    }));
    const maxHour = Math.max(1, ...byHour.map((x) => x.total));
    const line = byHour.map((x, i) => (20 + i * (260 / 23)) + "," + (100 - (x.total / maxHour) * 78)).join(" ");
    return {
      transaksiMasuk: incoming,
      pembayaranTunaiTotal: cashTotal,
      pembayaranQrisTotal: qrisTotal,
      tanggalAnalitik: days,
      transaksiPerHari: perDay,
      transaksiPerJam: byHour,
      maxPerJam: maxHour,
      garisJam: line
    };
  }, [transaksi, analyticsDayKey, analyticsStartDate, analyticsEndDate, profile?.role]);

  // ============================================================
  // RENDER LOGIN
  // ============================================================
  if (screen === "login")
    return (
      <div
        className="kl-login-screen"
        style={{
          ...s.wrap,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          padding: "20px",
          margin: 0,
          background: darkMode ? "#071C12" : "#F6F8F6",
          width: "100%",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 400,
            padding: "24px",
            textAlign: "left",
            background: theme.card,
            backdropFilter: theme.blur,
            WebkitBackdropFilter: theme.blur,
            borderRadius: 32,
            border: `1px solid ${theme.cardBorder}`,
            boxShadow: theme.shadow,
          }}
        >
          <h1
            style={{
              fontSize: 44,
              fontWeight: 900,
              marginBottom: 4,
              letterSpacing: 4,
              fontFamily: "'Inter',system-ui,sans-serif",
              textAlign: "center",
            }}
          >
            <span
              style={{
                color: theme.gold,
                textShadow: darkMode
                  ? "0 0 40px rgba(18,140,74,0.3)"
                  : "0 0 40px rgba(18,140,74,0.15)",
              }}
            >
              KOPI
            </span>
            <span style={{ color: theme.text }}>LABA</span>
          </h1>
          <div
            style={{
              width: 80,
              height: 3,
              background: `linear-gradient(90deg, transparent, #128C4A, transparent)`,
              margin: "8px auto 16px",
              borderRadius: 2,
            }}
          ></div>
          <p
            style={{
              color: theme.textMuted,
              marginBottom: 40,
              fontSize: 14,
              letterSpacing: 1,
              fontWeight: 300,
              textAlign: "center",
            }}
          >
            Manajemen Keuangan Kafe
          </p>
          {error && (
            <div
              style={{
                background: darkMode ? "rgba(42,26,26,0.8)" : "rgba(255,235,238,0.8)",
                border: `1px solid ${theme.danger}`,
                borderRadius: 12,
                padding: 12,
                marginBottom: 14,
                fontSize: 13,
                color: theme.danger,
              }}
            >
              {error}
            </div>
          )}
          {success && (
            <div
              style={{
                background: darkMode ? "rgba(26,42,26,0.8)" : "rgba(232,245,233,0.8)",
                border: `1px solid ${theme.success}`,
                borderRadius: 12,
                padding: 12,
                marginBottom: 14,
                fontSize: 13,
                color: theme.success,
              }}
            >
              {success}
            </div>
          )}
          <label style={s.label}>Email</label>
          <input
            style={s.input}
            type="email"
            placeholder="email@kamu.com"
            value={loginForm.email}
            onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
          />
          <label style={s.label}>Password</label>
          <input
            style={s.input}
            type="password"
            placeholder="Masukkan password"
            value={loginForm.password}
            onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
          />
          <button style={s.btn} onClick={handleLogin} disabled={loading}>
            {loading ? "Masuk..." : "Masuk"}
          </button>
          <button type="button" className="kl-google-button" style={{ ...s.btn, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 12, color: darkMode ? "#fff" : "#18251D" }} onClick={startGoogleAuth} disabled={loading}>
            <svg style={{ width: 20, height: 20, minWidth: 20, flex: "0 0 20px", display: "block" }} viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.01 13.22l7.98 6.19C11.89 13.72 17.48 9.5 24 9.5Z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.76 7.18l7.73 6C44.42 37.98 46.98 31.96 46.98 24.55Z"/><path fill="#FBBC05" d="M9.99 28.59A14.4 14.4 0 0 1 9.2 24c0-1.59.28-3.13.79-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.87.93 7.52 2.01 10.78l7.98-6.19Z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.9 2.3-8.18 2.3-6.52 0-12.11-4.22-14.01-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"/></svg>
            Lanjutkan dengan Google
          </button>
          <p style={{ textAlign: "center", marginTop: 20, color: theme.textMuted, fontSize: 14 }}>
            Belum punya akun?{" "}
            <span
              style={{ color: theme.gold, cursor: "pointer", fontWeight: 600 }}
              onClick={() => {
                setScreen("register");
                setError("");
              }}
            >
              Daftar
            </span>
          </p>
          <div style={{ marginTop: 30, display: "flex", justifyContent: "center", gap: 12 }}>
            <button
              onClick={() => setDarkMode(true)}
              style={{
                padding: "6px 20px",
                borderRadius: 20,
                border: darkMode ? "2px solid #128C4A" : `1px solid ${theme.textMuted}`,
                background: "transparent",
                color: darkMode ? "#128C4A" : theme.textMuted,
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              🌙 Dark
            </button>
            <button
              onClick={() => setDarkMode(false)}
              style={{
                padding: "6px 20px",
                borderRadius: 20,
                border: !darkMode ? "2px solid #128C4A" : `1px solid ${theme.textMuted}`,
                background: "transparent",
                color: !darkMode ? "#128C4A" : theme.textMuted,
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              ☀️ Light
            </button>
          </div>
        </div>
      </div>
    );

  // ============================================================
  // RENDER REGISTER
  // ============================================================
  if (screen === "register")
    return (
      <div className="kl-register-screen" style={{ ...s.wrap, padding: "20px" }}>
        <div
          style={{
            width: "100%",
            maxWidth: 400,
            margin: "0 auto",
            padding: "24px",
            background: theme.card,
            backdropFilter: theme.blur,
            WebkitBackdropFilter: theme.blur,
            borderRadius: 32,
            border: `1px solid ${theme.cardBorder}`,
            boxShadow: theme.shadow,
          }}
        >
          <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4, textAlign: "center" }}>
            <span style={{ color: theme.gold }}>KOPI</span>
            <span style={{ color: theme.text }}>LABA</span>
          </h2>
          <p style={{ color: theme.textMuted, marginBottom: 24, textAlign: "center" }}>
            Buat akun baru
          </p>
          {error && (
            <div
              style={{
                background: darkMode ? "rgba(42,26,26,0.8)" : "rgba(255,235,238,0.8)",
                border: `1px solid ${theme.danger}`,
                borderRadius: 12,
                padding: 12,
                marginBottom: 14,
                fontSize: 13,
                color: theme.danger,
              }}
            >
              {error}
            </div>
          )}
          <label style={s.label}>Nama Lengkap</label>
          <input
            style={s.input}
            placeholder="Nama kamu"
            value={regForm.nama}
            onChange={(e) => setRegForm({ ...regForm, nama: e.target.value })}
          />
          <label style={s.label}>Email</label>
          <input
            style={s.input}
            type="email"
            placeholder="email@kamu.com"
            value={regForm.email}
            onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
          />
          <label style={s.label}>Password</label>
          <input
            style={s.input}
            type="password"
            placeholder="Min. 6 karakter"
            value={regForm.password}
            onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
          />
          <label style={s.label}>Telepon</label>
          <input
            style={s.input}
            type="tel"
            placeholder="08xxxxxxxxxx"
            value={regForm.telepon}
            onChange={(e) => setRegForm({ ...regForm, telepon: e.target.value })}
          />
          <div
            style={{
              background: theme.input,
              borderRadius: 12,
              padding: "12px 16px",
              marginBottom: 10,
              border: `1px solid ${theme.cardBorder}`,
            }}
          >
            <p style={{ margin: 0, fontSize: 14, color: theme.gold, fontWeight: 600 }}>
              🏠 Pemilik Kafe
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: theme.textMuted }}>
              Anda akan membuat dan mengelola kafe
            </p>
          </div>
          <label style={s.label}>Nama Kafe</label>
          <input
            style={s.input}
            placeholder="Nama kafe kamu"
            value={regForm.namaKafe}
            onChange={(e) => setRegForm({ ...regForm, namaKafe: e.target.value })}
          />
          <label style={s.label}>Alamat Kafe</label>
          <input
            style={s.input}
            placeholder="Alamat kafe"
            value={regForm.alamatKafe}
            onChange={(e) => setRegForm({ ...regForm, alamatKafe: e.target.value })}
          />
          <button type="button" className="kl-google-button kl-google-register" style={{ ...s.btn, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 12, color: darkMode ? "#fff" : "#18251D" }} onClick={startGoogleAuth} disabled={loading}>
            <svg style={{ width: 20, height: 20, minWidth: 20, flex: "0 0 20px", display: "block" }} viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.01 13.22l7.98 6.19C11.89 13.72 17.48 9.5 24 9.5Z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.76 7.18l7.73 6C44.42 37.98 46.98 31.96 46.98 24.55Z"/><path fill="#FBBC05" d="M9.99 28.59A14.4 14.4 0 0 1 9.2 24c0-1.59.28-3.13.79-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.87.93 7.52 2.01 10.78l7.98-6.19Z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.9 2.3-8.18 2.3-6.52 0-12.11-4.22-14.01-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"/></svg>
            Daftar dengan Google
          </button>
          <div className="kl-auth-divider"><span>atau daftar dengan email</span></div>
          <button style={s.btn} onClick={handleRegister} disabled={loading}>
            {loading ? "Mendaftar..." : "Daftar Sekarang"}
          </button>
          <p style={{ textAlign: "center", marginTop: 20, color: theme.textMuted, fontSize: 14 }}>
            Sudah punya akun?{" "}
            <span
              style={{ color: theme.gold, cursor: "pointer", fontWeight: 600 }}
              onClick={() => {
                setScreen("login");
                setError("");
              }}
            >
              Masuk
            </span>
          </p>
        </div>
      </div>
    );

  // ============================================================
  // MAIN APP
  // ============================================================
  const isPemilik = profile?.role === "pemilik" || isSuperAdmin;
  const isBarista = profile?.role === "barista";


  return (
    <div className={desktopSidebarCollapsed ? "kl-app-shell kl-desktop-sidebar-collapsed" : "kl-app-shell"} style={s.wrap} data-theme={darkMode ? "dark" : "light"}>
      
      <style>{`
        .kl-topbar .kl-kasir-toggle {
          display:inline-flex !important;
          flex-direction:row !important;
          flex-wrap:nowrap !important;
          align-items:center !important;
          justify-content:center !important;
          gap:8px !important;
          white-space:nowrap !important;
          word-break:keep-all !important;
          overflow:visible !important;
          background:var(--kl-accent,#128C4A) !important;
          color:var(--kl-ink,#24180f) !important;
          border:1px solid var(--kl-accent,#128C4A) !important;
          box-sizing:border-box !important;
        }
        .kl-topbar .kl-kasir-toggle > span {
          display:flex !important;
          white-space:nowrap !important;
          word-break:keep-all !important;
          line-height:1 !important;
        }
        .kl-topbar .kl-kasir-toggle svg {
          display:block !important;
          flex:0 0 19px !important;
          width:19px !important;
          height:19px !important;
        }
        @media(max-width:560px) {
          .kl-topbar .kl-kasir-toggle {
            min-width:44px !important;
            width:44px !important;
            max-width:44px !important;
            min-height:44px !important;
            padding:0 !important;
            font-size:0 !important;
          }
        }
      `}</style>
      <style>{`\n        /* Performance: avoid expensive backdrop filters on small touch devices. */\n        @media (max-width:640px) {\n          .kl-topbar, .kl-bottom-nav, .kl-kasir-overlay, .kl-login-screen > div {\n            backdrop-filter:none !important;\n            -webkit-backdrop-filter:none !important;\n          }\n          .kl-topbar { background:rgba(255,253,250,.98) !important; }\n          .kl-bottom-nav { background:rgba(255,255,255,.98) !important; }\n        }\n      `}</style>
      <style>{`
        /* Lightweight header: avoid costly blur and animated layout. */
        .kl-topbar, .kl-bottom-nav, .kl-kasir-overlay, .kl-login-screen > div {
          backdrop-filter:none !important;
          -webkit-backdrop-filter:none !important;
        }
        .kl-topbar { transition:none !important; box-shadow:0 1px 4px rgba(45,30,18,.035) !important; }
        .kl-topbar button, .kl-sidebar button, .kl-content button { transition:none !important; }
        .kl-cafe-identity {
          display:flex !important; align-items:center !important; flex-wrap:wrap !important;
          gap:5px 7px !important; margin-top:5px !important; max-width:100%;
          font-size:11px !important; line-height:1.25 !important; font-weight:600;
        }
        .kl-identity-cafe, .kl-identity-role, .kl-identity-super {
          display:inline-flex; align-items:center; gap:4px; min-width:0;
        }
        .kl-identity-cafe { color:var(--kl-primary-strong,#166534); max-width:100%; }
        .kl-identity-cafe-name { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:min(42vw,280px); }
        .kl-identity-role, .kl-identity-super {
          color:var(--kl-success,#128C4A); font-size:10px; font-weight:750;
          padding:3px 7px; border:1px solid rgba(36,122,81,.18); border-radius:999px;
          background:rgba(36,122,81,.06); white-space:nowrap;
        }
        .kl-identity-separator { color:var(--kl-muted,#65756A); }
        .kl-topbar .kl-brand-lockup { align-items:center; }
        @media(max-width:560px) {
          .kl-topbar { padding:10px 12px !important; min-height:64px !important; }
          .kl-topbar > div { gap:8px !important; }
          .kl-brand-lockup { gap:8px !important; }
          .kl-brand-mark { width:36px !important; height:36px !important; border-radius:11px !important; }
          .kl-topbar h1 { font-size:19px !important; line-height:1.05 !important; }
          .kl-brand-caption { font-size:7px !important; letter-spacing:1px !important; margin-top:3px !important; }
          .kl-cafe-identity { gap:4px 6px !important; font-size:10px !important; }
          .kl-identity-cafe-name { max-width:48vw; }
        }
      `}</style>
      <style>{`
        /* Final palette pass: explicitly cover header, cart button and burger drawer. */
        .kl-app-shell[data-theme="light"] .kl-topbar {
          background: rgba(246,248,246,.98) !important;
          color: #18251D !important;
          border-bottom-color: #E1E9E3 !important;
        }
        .kl-app-shell[data-theme="dark"] .kl-topbar {
          background: rgba(11,36,24,.98) !important;
          color: #F5FBF7 !important;
          border-bottom-color: rgba(37,211,102,.20) !important;
        }
        .kl-app-shell .kl-menu-toggle {
          color: #FFFFFF !important;
          background: #128C4A !important;
          border: 1px solid #128C4A !important;
          border-radius: 10px !important;
          width: 44px !important;
          height: 44px !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          flex: 0 0 44px !important;
        }
        .kl-app-shell[data-theme="dark"] .kl-menu-toggle {
          color: #071C12 !important;
          background: #128C4A !important;
          border-color: #128C4A !important;
        }
        .kl-app-shell .kl-sidebar button[aria-current="page"] { background: #128C4A !important; color: #FFFFFF !important; }
        .kl-app-shell[data-theme="dark"] .kl-sidebar button[aria-current="page"] { background: #128C4A !important; color: #FFFFFF !important; }
        .kl-app-shell .kl-topbar .kl-kasir-toggle {
          background: #128C4A !important;
          border-color: #128C4A !important;
          color: #FFFFFF !important;
          box-shadow: 0 3px 8px rgba(18,140,74,.20) !important;
        }
        .kl-app-shell[data-theme="dark"] .kl-topbar .kl-kasir-toggle {
          background: #128C4A !important;
          border-color: #128C4A !important;
          color: #071C12 !important;
        }
        .kl-app-shell .kl-topbar .kl-kasir-toggle svg { color: inherit !important; stroke: currentColor !important; }
        .kl-app-shell .kl-sidebar {
          background: #FFFFFF !important;
          color: #18251D !important;
          border-right-color: #E1E9E3 !important;
        }
        .kl-app-shell[data-theme="dark"] .kl-sidebar {
          background: #10291C !important;
          color: #F5FBF7 !important;
          border-right-color: rgba(37,211,102,.20) !important;
        }
        .kl-app-shell .kl-sidebar-brand { color: inherit !important; }
        .kl-app-shell .kl-brand-mark {
          color: #128C4A !important;
          background: #EAF6EE !important;
          border-color: #CDE8D5 !important;
        }
        .kl-app-shell[data-theme="dark"] .kl-brand-mark {
          color: #128C4A !important;
          background: #0B2116 !important;
          border-color: rgba(37,211,102,.28) !important;
        }
        .kl-app-shell .kl-sidebar button { transition: background-color .15s ease, color .15s ease; }
        @media (max-width:640px) {
          .kl-app-shell[data-theme="light"] .kl-topbar { background: rgba(246,248,246,.98) !important; }
          .kl-app-shell[data-theme="dark"] .kl-topbar { background: rgba(11,36,24,.98) !important; }
        }

        /* Palet tunggal KopiLaba: WhatsApp green, netral terang, dan hijau gelap. */
        .kl-app-shell, .kl-login-screen, .kl-register-screen {
          --kl-green: #128C4A;
          --kl-green-soft: #EAF6EE;
          --kl-ink: #18251D;
          --kl-muted: #65756A;
          --kl-border: #E1E9E3;
          --kl-surface: #FFFFFF;
          --kl-surface-alt: #F6F8F6;
          --kl-selected-bg: #0B5D32;
          --kl-selected-text: #FFFFFF;
          --kl-border-soft: #CDE8D5;
          --kl-primary-strong: #166534;
          --kl-success: #128C4A;
        }
        .kl-app-shell[data-theme="dark"] {
          --kl-green-soft: #183D2A;
          --kl-ink: #F5FBF7;
          --kl-muted: #A8BDB0;
          --kl-border: rgba(37,211,102,.20);
          --kl-surface: #10291C;
          --kl-surface-alt: #0B2116;
          --kl-selected-bg: #183D2A;
          --kl-selected-text: #D8F3E1;
          --kl-border-soft: rgba(37,211,102,.28);
          --kl-primary-strong: #B9E8C9;
          --kl-success: #62D68F;
        }
        .kl-login-screen, .kl-register-screen { color: var(--kl-ink) !important; }
        .kl-login-screen input, .kl-register-screen input,
        .kl-app-shell input, .kl-app-shell textarea, .kl-app-shell select {
          accent-color: var(--kl-green);
        }
        .kl-login-screen button:not(.kl-google-button),
        .kl-register-screen button,
        .kl-app-shell .kl-menu-toggle,
        .kl-app-shell .kl-topbar .kl-kasir-toggle {
          background-color: var(--kl-green) !important;
          border-color: var(--kl-green) !important;
        }
        .kl-login-screen button:not(.kl-google-button),
        .kl-register-screen button,
        .kl-app-shell .kl-menu-toggle,
        .kl-app-shell .kl-topbar .kl-kasir-toggle { color: #FFFFFF !important; }
        .kl-login-screen .kl-google-button {
          background: #FFFFFF !important;
          border: 1px solid var(--kl-border) !important;
          color: var(--kl-ink) !important;
        }
        .kl-app-shell .kl-sidebar { background: var(--kl-surface) !important; color: var(--kl-ink) !important; }
        .kl-app-shell .kl-sidebar .kl-sidebar-item { color: var(--kl-ink) !important; background: var(--kl-surface) !important; }
        .kl-app-shell .kl-sidebar .kl-sidebar-item .kl-nav-icon { color: var(--kl-green) !important; }
        .kl-app-shell .kl-sidebar .kl-sidebar-item.is-active { background: var(--kl-green) !important; color: #FFFFFF !important; font-weight: 750 !important; }
        .kl-app-shell .kl-sidebar .kl-sidebar-item.is-active .kl-nav-icon { color: #FFFFFF !important; }
        .kl-app-shell .kl-sidebar .kl-sidebar-logout { color: var(--kl-green) !important; }
        .kl-app-shell .kl-sidebar .kl-sidebar-item:hover,
        .kl-app-shell .kl-sidebar .kl-sidebar-logout:hover { background: var(--kl-surface-alt) !important; color: var(--kl-green) !important; }
        .kl-app-shell .kl-brand-mark { color: var(--kl-green) !important; }
        .kl-app-shell .kl-topbar { border-bottom-color: var(--kl-border) !important; }
        .kl-app-shell[data-theme="dark"] .kl-sidebar { background: #10291C !important; color: #F5FBF7 !important; }
        .kl-app-shell[data-theme="dark"] .kl-sidebar .kl-sidebar-item { color: #D6E8DC !important; background: #0B2116 !important; }
         .kl-app-shell[data-theme="dark"] .kl-sidebar .kl-sidebar-item .kl-nav-icon { color: #62D68F !important; }
        .kl-app-shell[data-theme="dark"] .kl-sidebar .kl-sidebar-item.is-active { background: var(--kl-green) !important; color: #FFFFFF !important; }
        .kl-app-shell[data-theme="dark"] .kl-sidebar .kl-sidebar-item.is-active .kl-nav-icon { color: #FFFFFF !important; }
         .kl-app-shell[data-theme="dark"] .kl-sidebar .kl-sidebar-logout { color: #62D68F !important; }
        .kl-app-shell[data-theme="dark"] .kl-sidebar .kl-sidebar-item:hover,
        .kl-app-shell[data-theme="dark"] .kl-sidebar .kl-sidebar-logout:hover { background: #0B2116 !important; color: #FFFFFF !important; }
        .kl-app-shell[data-theme="dark"] .kl-menu-toggle,
        .kl-app-shell[data-theme="dark"] .kl-topbar .kl-kasir-toggle { background: var(--kl-green) !important; color: #FFFFFF !important; border-color: var(--kl-green) !important; }
        .kl-app-shell .kl-menu-toggle { width: 44px !important; height: 44px !important; border-radius: 10px !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; }
         /* Palet seragam untuk Ringkasan dan Backup Data */
         .kl-app-shell .kl-dashboard-range button { border: 1px solid var(--kl-border) !important; }
         .kl-app-shell .kl-dashboard-range button:focus { outline: none !important; }
         .kl-app-shell .kl-dashboard-range button:focus-visible { outline: 2px solid var(--kl-green) !important; outline-offset: 2px !important; }
          .kl-app-shell .kl-dashboard-actions button:first-child { background: var(--kl-surface) !important; border-color: var(--kl-border) !important; }
         .kl-app-shell .kl-dashboard-actions button:first-child p { color: var(--kl-green) !important; }
         .kl-app-shell .kl-backup-page { color: var(--kl-ink); }
         .kl-app-shell .kl-backup-page .kl-backup-card { background: var(--kl-surface) !important; border-color: var(--kl-border) !important; color: var(--kl-ink) !important; }
         .kl-app-shell .kl-backup-page .kl-backup-icon { background: var(--kl-green-soft) !important; color: var(--kl-green) !important; border-color: var(--kl-border-soft) !important; }
         .kl-app-shell .kl-backup-page .kl-primary-action { background: var(--kl-green) !important; color: #FFFFFF !important; border-color: var(--kl-green) !important; }
         .kl-app-shell .kl-backup-page .kl-secondary-action { background: var(--kl-surface) !important; color: var(--kl-green) !important; border-color: var(--kl-green) !important; }
         .kl-app-shell .kl-backup-page .kl-status-pill { background: var(--kl-green-soft) !important; color: var(--kl-green) !important; border-color: #CDE8D5 !important; }
         .kl-app-shell .kl-backup-page .kl-counts span { background: var(--kl-green-soft) !important; border-color: var(--kl-border-soft) !important; }
         .kl-app-shell .kl-backup-page .kl-counts b { color: var(--kl-green) !important; }
         .kl-app-shell .kl-backup-page .kl-backup-warning { background: var(--kl-green-soft) !important; color: var(--kl-ink) !important; border-color: var(--kl-border-soft) !important; }
         .kl-app-shell .kl-backup-page .kl-backup-warning b { color: var(--kl-green) !important; }
         .kl-app-shell[data-theme="dark"] .kl-backup-page .kl-backup-card { background: #10291C !important; border-color: rgba(18,140,74,.32) !important; color: #F5FBF7 !important; }
          .kl-app-shell[data-theme="dark"] .kl-backup-page .kl-secondary-action { background: #0B2116 !important; color: #62D68F !important; border-color: #62D68F !important; }
         .kl-app-shell[data-theme="dark"] .kl-backup-page .kl-status-pill,
         .kl-app-shell[data-theme="dark"] .kl-backup-page .kl-counts span,
         .kl-app-shell[data-theme="dark"] .kl-backup-page .kl-backup-warning { background: #183D2A !important; color: #F5FBF7 !important; border-color: rgba(18,140,74,.32) !important; }
          .kl-app-shell[data-theme="dark"] .kl-backup-page .kl-backup-warning b,
         .kl-app-shell[data-theme="dark"] .kl-backup-page .kl-counts b { color: #62D68F !important; }

      `}
</style>
      {/* HEADER */}
      <div
        className="kl-topbar"
        style={{
          padding: "16px 20px",
          background: theme.headerBg,
          backdropFilter: theme.blur,
          WebkitBackdropFilter: theme.blur,
          transition: "all 0.3s ease",
          width: "100%",
          boxSizing: "border-box",
          position: "sticky",
          top: 0,
          zIndex: 20,
          borderBottom: `1px solid ${theme.cardBorder}`,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              className="kl-menu-toggle"
              onClick={() => {
                if (window.innerWidth >= 1000) {
                  setDesktopSidebarCollapsed((collapsed) => !collapsed);
                } else {
                  setSidebarOpen((open) => !open);
                }
              }}
              aria-label="Buka atau tutup menu samping"
              aria-expanded={typeof window !== "undefined" && window.innerWidth >= 1000 ? !desktopSidebarCollapsed : sidebarOpen}
              style={{
                background: "transparent",
                border: "none",
                fontSize: 24,
                cursor: "pointer",
                color: theme.text,
                padding: 4,
              }}
            >
              ☰
            </button>
            <div>
              <div className="kl-brand-lockup">
              <span className="kl-brand-mark"><AppIcon name="coffee" size={23} strokeWidth={2} /></span>
              <div className="kl-brand-copy"><h1 className="kl-brand-title" style={{ margin: 0, fontSize: 22, fontWeight: 850, letterSpacing: "-.9px" }}>
                <span style={{ color: theme.gold }}>KOPI</span><span style={{ color: theme.text }}>LABA</span>
              </h1><p className="kl-brand-caption">CAFE MANAGEMENT</p></div>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            {!isSuperAdmin && (
              <button
                className="kl-kasir-toggle"
                onClick={() => setShowKasir(true)}
                aria-label="Buka Kasir"
                style={{
                  position: "relative",
                  display: "inline-flex",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  flexWrap: "nowrap",
                  gap: 0,
                  boxSizing: "border-box",
                  width: 44,
                  minWidth: 44,
                  maxWidth: 44,
                  minHeight: 44,
                  padding: 0,
                  background: theme.gold,
                  border: `1px solid ${theme.gold}`,
                  borderRadius: 12,
                  color: "#24180f",
                  fontWeight: 750,
                  fontSize: 14,
                  lineHeight: 1,
                  whiteSpace: "nowrap",
                  cursor: "pointer",
                  boxShadow: "0 3px 8px rgba(112,66,34,.16)",
                }}
              >
                <AppIcon name="cart" size={21} />
                {keranjang.length > 0 && (
                  <span
                    style={{
                      position: "absolute",
                      top: -6,
                      right: -6,
                      background: theme.danger,
                      borderRadius: "50%",
                      width: 18,
                      height: 18,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 10,
                      color: "#fff",
                    }}
                  >
                    {keranjang.length}
                  </span>
                )}
              </button>
            )}
            <button
              onClick={() => setDarkMode(!darkMode)}
              style={{ background: "transparent", border: "none", fontSize: 20, cursor: "pointer" }}
            >
              <AppIcon name={darkMode ? "sun" : "moon"} size={19} />
            </button>
            <button className="kl-header-action" type="button" aria-label="Ganti password" title="Ganti password" onClick={() => setShowGantiPassword(true)}>
              <AppIcon name="key" size={18} />
            </button>
            <button
              className="kl-header-action kl-header-logout"
              type="button"
              aria-label="Keluar dari akun"
              title="Keluar"
              onClick={() => {
                localStorage.removeItem("kopilaba_session");
                setUser(null);
                setToken(null);
                setProfile(null);
                setIsSuperAdmin(false);
                setScreen("login");
              }}
            >
              <AppIcon name="logout" size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* SIDEBAR */}
      <div
        ref={sidebarRef}
        className="kl-sidebar"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          height: "100dvh",
          maxHeight: "100dvh",
          width: "280px",
          background: theme.card,
          borderRight: `1px solid ${theme.cardBorder}`,
          boxShadow: theme.shadow,
          transform: (typeof window !== "undefined" && window.innerWidth >= 1000 ? desktopSidebarCollapsed : !sidebarOpen) ? "translateX(-110%)" : "translateX(0)",
          transition: "transform 0.18s ease-out",
          willChange: "transform",
          zIndex: 100,
          padding: "20px 16px",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 30,
          }}
        >
          <h2 className="kl-sidebar-brand" style={{ margin: 0, fontSize: 20, fontWeight: 750 }}><span className="kl-brand-mark"><AppIcon name="coffee" size={20} /></span><span>Menu <small>WORKSPACE</small></span></h2>
          <button
            onClick={() => setSidebarOpen(false)}
            style={{
              background: "transparent",
              border: "none",
              fontSize: 24,
              cursor: "pointer",
              color: theme.text,
            }}
          >
            ✕
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {tabs.map((t) => (
            <button
              key={t.id}
              className={`kl-sidebar-item ${tab === t.id ? "is-active" : ""}`}
              onClick={() => {
                setTab(t.id);
                setSidebarOpen(false);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "12px 16px",
                borderRadius: 12,
                border: "none",
                background: tab === t.id ? theme.gold : "transparent",
                color: tab === t.id ? "#FFFFFF" : theme.textMuted,
                fontWeight: tab === t.id ? 700 : 400,
                fontSize: 15,
                cursor: "pointer",
                transition: "all 0.2s",
                width: "100%",
              }}
            >
              <span className="kl-nav-icon"><AppIcon name={t.icon} size={19} /></span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
        <div
          style={{
            marginTop: "auto",
            borderTop: `1px solid ${theme.cardBorder}`,
            paddingTop: 16,
          }}
        >
          <button
            className="kl-sidebar-logout"
            onClick={() => {
              localStorage.removeItem("kopilaba_session");
              setUser(null);
              setToken(null);
              setProfile(null);
              setIsSuperAdmin(false);
              setScreen("login");
              setSidebarOpen(false);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 16px",
              borderRadius: 12,
              border: "none",
              background: "transparent",
              color: theme.danger,
              fontSize: 15,
              cursor: "pointer",
              width: "100%",
            }}
          >
            🚪 Logout
          </button>
          <div
            className="kl-sidebar-identity"
            style={{
              marginTop: 12,
              paddingTop: 12,
              borderTop: `1px solid ${theme.cardBorder}`,
              color: theme.textMuted,
              fontSize: 12,
            }}
          >
            <p style={{ margin: "0 0 7px", fontSize: 10, fontWeight: 800, letterSpacing: ".08em", color: "#c6a98d" }}>
              IDENTITAS KAFE
            </p>
            <div className="kl-cafe-identity" style={{ justifyContent: "flex-start", flexWrap: "wrap", gap: "6px 8px", margin: 0, color: "#f6e8d9", whiteSpace: "normal" }}>
              {isSuperAdmin ? (
                <span className="kl-identity-role kl-identity-super"><AppIcon name="crown" size={13} />Super Admin</span>
              ) : (
                <>
                  <span className="kl-identity-cafe"><AppIcon name="coffee" size={13} /><span className="kl-identity-cafe-name" style={{ maxWidth: "100%", overflowWrap: "anywhere" }}>{kafe?.nama || "Kafe kamu"}</span></span>
                  <span className="kl-identity-separator" aria-hidden="true">·</span>
                  <span className="kl-identity-role"><AppIcon name="users" size={13} />{profile?.role === "pemilik" ? "Pemilik" : profile?.role === "barista" ? "Barista" : profile?.role || "Pengguna"}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* OVERLAY */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            zIndex: 99,
            transition: "opacity 0.15s",
          }}
        />
      )}

      {/* TOAST */}
      {success && (
        <div
          style={{
            margin: "0 20px 10px",
            background: darkMode ? "rgba(26,42,26,0.8)" : "rgba(232,245,233,0.8)",
            backdropFilter: "blur(10px)",
            border: `1px solid ${theme.success}`,
            borderRadius: 12,
            padding: "10px 14px",
            fontSize: 13,
            color: theme.success,
          }}
        >
          {success}
        </div>
      )}
      {error && (
        <div
          style={{
            margin: "0 20px 10px",
            background: darkMode ? "rgba(42,26,26,0.8)" : "rgba(255,235,238,0.8)",
            backdropFilter: "blur(10px)",
            border: `1px solid ${theme.danger}`,
            borderRadius: 12,
            padding: "10px 14px",
            fontSize: 13,
            color: theme.danger,
          }}
          onClick={() => setError("")}
        >
          {error}
        </div>
      )}
      {networkError && (
        <div
          style={{
            margin: "0 20px 10px",
            background: darkMode ? "rgba(42,26,26,0.8)" : "rgba(255,235,238,0.8)",
            backdropFilter: "blur(10px)",
            border: `1px solid ${theme.danger}`,
            borderRadius: 12,
            padding: "10px 14px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 13, color: theme.danger }}>
            ⚠️ {error || "Koneksi bermasalah"}
          </span>
          <button
            onClick={() => {
              setNetworkError(false);
              if (token && profile) loadData(token, profile);
            }}
            style={{
              background: theme.gold,
              border: "none",
              borderRadius: 8,
              padding: "4px 12px",
              color: darkMode ? "#fff" : "#18251D",
              fontWeight: 600,
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* CONTENT */}
      <div className="kl-content" style={{ padding: "24px 28px 100px", width: "100%", boxSizing: "border-box", flex: 1 }}>
        {/* SUPER ADMIN DASHBOARD */}
        {isSuperAdmin && tab === "admin" && (
          <div className="kl-admin-dashboard" style={s.card}>
            <p className="kl-admin-title" style={{ fontSize: 16, fontWeight: 700, marginBottom: 10, color: theme.gold }}>
              👑 Super Admin Dashboard
            </p>
            <p className="kl-admin-subtitle" style={{ fontSize: 12, color: theme.textMuted, marginBottom: 14 }}>
              Pantau performa semua kedai, owner, dan aktivitas penjualan dari satu tempat.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
              <select
                className="kl-admin-filter"
                style={s.input}
                value={adminFilterOwner}
                onChange={(e) => setAdminFilterOwner(e.target.value)}
              >
                <option value="">Semua Owner</option>
                {allOwners.filter((o) => [o.nama, o.email, o.kafe_id].some((v) => String(v || "").toLowerCase().includes(adminSearchOwner.toLowerCase()))).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nama} - {o.kafe_id || "Tidak ada toko"}
                  </option>
                ))}
              </select>
              <select
                className="kl-admin-filter"
                style={s.input}
                value={adminFilterPeriode}
                onChange={(e) => setAdminFilterPeriode(e.target.value)}
              >
                <option value="hari">Hari Ini</option>
                <option value="minggu">Minggu Ini</option>
                <option value="bulan">Bulan Ini</option>
                <option value="tahun">Tahun Ini</option>
                <option value="semua">Semua Waktu</option>
              </select>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
                marginBottom: 14,
              }}
            >
              <div className="kl-admin-stat" style={{ background: theme.input, borderRadius: 12, padding: 12 }}>
                <p style={{ margin: 0, fontSize: 10, color: theme.textMuted }}>Total Transaksi</p>
                <p style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{adminFiltered.length}</p>
              </div>
              <div className="kl-admin-stat" style={{ background: theme.input, borderRadius: 12, padding: 12 }}>
                <p style={{ margin: 0, fontSize: 10, color: theme.textMuted }}>Keuntungan</p>
                <p
                  style={{
                    margin: 0,
                    fontSize: 18,
                    fontWeight: 700,
                    color: adminLaba >= 0 ? theme.success : theme.danger,
                  }}
                >
                  {fmt(adminLaba)}
                </p>
              </div>
              <div className="kl-admin-stat" style={{ background: theme.input, borderRadius: 12, padding: 12 }}>
                <p style={{ margin: 0, fontSize: 10, color: theme.textMuted }}>Pemasukan</p>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: theme.success }}>
                  {fmt(adminTotalPemasukan)}
                </p>
              </div>
              <div className="kl-admin-stat" style={{ background: theme.input, borderRadius: 12, padding: 12 }}>
                <p style={{ margin: 0, fontSize: 10, color: theme.textMuted }}>Pengeluaran</p>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: theme.danger }}>
                  {fmt(adminTotalPengeluaran)}
                </p>
              </div>
              <div className="kl-admin-stat" style={{ background: theme.input, borderRadius: 12, padding: 12 }}>
                <p style={{ margin: 0, fontSize: 10, color: theme.textMuted }}>Total Owner</p>
                <p style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{allOwners.length}</p>
              </div>
              <div className="kl-admin-stat" style={{ background: theme.input, borderRadius: 12, padding: 12 }}>
                <p style={{ margin: 0, fontSize: 10, color: theme.textMuted }}>Owner dengan Kedai</p>
                <p style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{allOwners.filter((o) => !!o.kafe_id).length}</p>
              </div>
            </div>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>📋 Daftar Owner & Toko</p>
            <input
              className="kl-owner-search"
              aria-label="Cari owner atau kedai"
              placeholder="Cari nama, email, atau ID kedai…"
              value={adminSearchOwner}
              onChange={(e) => setAdminSearchOwner(e.target.value)}
              style={{ ...s.input, marginBottom: 10, background: theme.card }}
            />
            <div style={s.card}>
              {allOwners.length === 0 && (
                <p style={{ color: theme.textMuted }}>Belum ada owner terdaftar.</p>
              )}
              {allOwners.map((o) => (
                <div
                  key={o.id}
                  className="kl-owner-row"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 12,
                    paddingBottom: 4,
                    borderBottom: `1px solid ${theme.cardBorder}`,
                    marginBottom: 4,
                  }}
                >
                  <span>
                    <strong>{o.nama}</strong> ({o.email})
                  </span>
                  <span>{o.kafe_id ? "🏠 Ada toko" : "🚫 Tidak ada toko"}</span>
                </div>
              ))}
            </div>
          </div>
        )}


        {/* BACKUP DATA */}
        {!isSuperAdmin && tab === "backup" && (
          <div className="kl-backup-page">
            <div className="kl-page-heading">
              <div>
                <div className="kl-eyebrow">KEAMANAN DATA</div>
                <h2 style={{ margin: "4px 0", fontSize: 24, color: theme.text }}>Backup & Pemulihan</h2>
                <p style={{ margin: "4px 0 0", color: theme.textMuted, fontSize: 13 }}>Simpan salinan data kafe ke perangkat, lalu pulihkan bila diperlukan.</p>
              </div>
              <span className="kl-status-pill">Kafe: {kafe?.nama || "Aktif"}</span>
            </div>
            <div className="kl-backup-grid">
              <section className="kl-backup-card">
                <div className="kl-backup-icon">⬇</div>
                <h3>1. Unduh backup</h3>
                <p>File JSON mencakup seluruh halaman transaksi di server, menu, absensi, serta pengaturan pajak. Simpan file di perangkat ini dan buat salinan tambahan di tempat aman.</p>
                <div className="kl-counts">
                  <span><b>{menu.length}</b> menu</span>
                  <span><b>{transaksi.length}</b> transaksi</span>
                  <span><b>{absensi.length}</b> absensi</span>
                </div>
                <button type="button" className="kl-primary-action" disabled={backupBusy} onClick={handleBackupExport}>{backupBusy ? "Mengambil seluruh transaksi…" : "Unduh backup lengkap"}</button>
                {backupPendingConfirmation && <div style={{ marginTop: 10 }}>
                  <p style={{ fontSize: 12, color: theme.textMuted }}>Setelah memastikan file backup sudah tersimpan di perangkat ini, konfirmasikan untuk membuka gerbang retensi tanggal {new Date(backupPendingConfirmation.period + "T12:00:00").toLocaleDateString("id-ID")}.</p>
                  <button type="button" className="kl-secondary-action" disabled={backupBusy} onClick={handleConfirmRetentionBackup}>{backupBusy ? "Menyimpan konfirmasi…" : "Saya sudah menyimpan file backup"}</button>
                </div>}
              </section>
              <section className="kl-backup-card">
                <div className="kl-backup-icon">↥</div>
                <h3>2. Pulihkan backup</h3>
                <p>Pilih file backup KopiLaba dari kafe yang sama. Data dengan ID yang sama akan diperbarui; data yang tidak ada di file tidak akan dihapus.</p>
                <input ref={backupInputRef} type="file" accept=".json,application/json" onChange={handleBackupFile} style={{ display: "none" }} />
                <button type="button" className="kl-secondary-action" onClick={() => backupInputRef.current?.click()}>Pilih file JSON</button>
                {backupImport && (
                  <div className="kl-import-preview">
                    <b>{backupImport.fileName}</b>
                    <span>Diekspor: {new Date(backupImport.payload.exportedAt).toLocaleString("id-ID")}</span>
                    <span>{backupImport.payload.data.menu.length} menu · {backupImport.payload.data.transaksi.length} transaksi · {backupImport.payload.data.absensi.length} absensi</span>
                    <button type="button" className="kl-primary-action" disabled={backupBusy} onClick={handleBackupRestore}>{backupBusy ? "Memulihkan…" : "Konfirmasi pemulihan"}</button>
                  </div>
                )}
              </section>
            </div>
            {retentionReminder?.show && ["pemilik", "barista"].includes(profile?.role) && <div className="kl-backup-warning" role="status"><b>Pengingat backup transaksi</b><p>{retentionReminder.days === 0 ? "Jadwal retensi hari ini." : "Jadwal retensi dalam " + retentionReminder.days + " hari."} Jadwal yang direncanakan: {retentionReminder.date.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}. Unduh backup lengkap sekarang dan pastikan file tersimpan. Penghapusan otomatis belum akan berjalan tanpa verifikasi backup yang aman.</p></div>}
            <div className="kl-backup-warning"><b>Jadwal retensi data</b><p>Rencana penghapusan hanya pada 1 Januari dan 1 Juli. Menu, foto produk, QRIS, pengaturan pajak, dan akun tidak termasuk. Penghapusan transaksi tetap dinonaktifkan sampai proses backup semua perangkat dan pemulihan teruji aman.</p></div>
          </div>
        )}

        {/* DASHBOARD */}
        {!isSuperAdmin && tab === "dashboard" && (
          <>
            {retentionReminder?.show && ["pemilik", "barista"].includes(profile?.role) && <div className="kl-backup-warning" role="status" style={{ marginBottom: 14 }}>
              <b>Pengingat backup transaksi</b>
              <p style={{ marginBottom: 0 }}>{retentionReminder.days === 0 ? "Jadwal retensi hari ini." : "Jadwal retensi dalam " + retentionReminder.days + " hari."} Jadwal berikutnya {retentionReminder.date.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}. Buka menu Backup, unduh backup lengkap di perangkat ini, lalu konfirmasikan file tersimpan. Jika backup semua perangkat belum dikonfirmasi dalam 7 hari terakhir, sistem akan melewati penghapusan.</p>
            </div>}
            {!isBarista && (
              <div className="kl-dashboard-range" style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                {["hari", "minggu", "bulan", "tahun", "semua"].map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriodeFilter(p)}
                    style={{
                      padding: "6px 16px",
                      borderRadius: 20,
                      border: "none",
                      background: periodeFilter === p ? "var(--kl-selected-bg)" : "var(--kl-surface)",
                      color:
                        periodeFilter === p ? "var(--kl-selected-text)" : theme.textMuted,
                      fontWeight: periodeFilter === p ? 700 : 400,
                      cursor: "pointer",
                      fontSize: 12,
                    }}
                  >
                    {p === "hari"
                      ? "Hari Ini"
                      : p === "minggu"
                      ? "Minggu Ini"
                      : p === "bulan"
                      ? "Bulan Ini"
                      : p === "tahun"
                      ? "Tahun Ini"
                      : "Semua"}
                  </button>
                ))}
              </div>
            )}

            <div
              className="kl-dashboard-hero"
              style={{
                background: darkMode ? "#183D2A" : "#0B5D32",
                borderRadius: 24,
                padding: 24,
                marginBottom: 14,
                boxShadow: theme.shadow,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <p style={{ margin: 0, fontSize: 12, color: "#F5FBF7" }}>Laba Bersih</p>
                <button
                  onClick={() => setShowLaba(!showLaba)}
                  style={{
                    background: "transparent",
                    border: "none",
                    fontSize: 18,
                    cursor: "pointer",
                    color: "#F5FBF7",
                    transition: "all 0.3s",
                  }}
                >
                  {showLaba ? "❖" : "✕"}
                </button>
              </div>
              <p
                style={{
                  margin: "0 0 16px",
                  fontSize: 30,
                  fontWeight: 800,
                  color: "#F5FBF7",
                  filter: showLaba ? "none" : "blur(8px)",
                  transition: "filter 0.3s",
                }}
              >
                {showLaba ? fmt(dashboardData.laba) : "••••••••"}
              </p>
              <div style={{ display: "flex", gap: 16 }}>
                <div>
                  <p style={{ margin: 0, fontSize: 10, color: darkMode ? "#B9E8C9" : "rgba(255,255,255,0.72)" }}>Pemasukan</p>
                  <p
                    className="kl-summary-money"
                    style={{
                      margin: 0,
                      fontSize: 14,
                      fontWeight: 700,
                      color: "#F5FBF7",
                      filter: showLaba ? "none" : "blur(6px)",
                      transition: "filter 0.3s",
                    }}
                  >
                    {showLaba ? fmt(dashboardData.totalMasuk) : "••••••••"}
                  </p>
                </div>
                
                <div>
                  <p style={{ margin: 0, fontSize: 10, color: darkMode ? "#B9E8C9" : "rgba(255,255,255,0.72)" }}>
                    Pengeluaran
                  </p>
                  <p
                    className="kl-summary-money"
                    style={{
                      margin: 0,
                      fontSize: 14,
                      fontWeight: 700,
                      color: "#F5FBF7",
                      filter: showLaba ? "none" : "blur(6px)",
                      transition: "filter 0.3s",
                      whiteSpace: "nowrap",
                      overflowWrap: "normal",
                      letterSpacing: "-0.025em",
                    }}
                  >
                    {showLaba ? fmt(dashboardData.totalKeluar) : "••••••••"}
                  </p>
                </div>
              </div>
            </div>

            <div
              className="kl-dashboard-actions"
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
                marginBottom: 14,
              }}
            >
              <button
                onClick={() => {
                  setShowAdd(true);
                  setAddType("masuk");
                  setEditTransaksiId(null);
                  setPesananItems([]);
                  setAddForm({ item: "", qty: "1", total: "", kategori_id: "", menu_id: "" });
                }}
                style={{
                  background: darkMode ? "rgba(26,42,26,0.5)" : "rgba(232,245,233,0.5)",
                  backdropFilter: "blur(10px)",
                  border: `1px solid ${darkMode ? "rgba(42,74,42,0.3)" : "rgba(165,214,167,0.3)"}`,
                  borderRadius: 14,
                  padding: 16,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <p style={{ margin: "0 0 4px", fontSize: 20 }}>💰</p>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#0B5D32" }}>
                  Catat Pemasukan
                </p>
              </button>
              <button
                onClick={() => {
                  setShowAdd(true);
                  setAddType("keluar");
                  setEditTransaksiId(null);
                  setPesananItems([]);
                  setAddForm({ item: "", qty: "1", total: "", kategori_id: "", menu_id: "" });
                }}
                style={{
                  background: darkMode ? "rgba(42,26,26,0.5)" : "rgba(255,235,238,0.5)",
                  backdropFilter: "blur(10px)",
                  border: `1px solid ${
                    darkMode ? "rgba(74,42,42,0.3)" : "rgba(239,154,154,0.3)"
                  }`,
                  borderRadius: 14,
                  padding: 16,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <p style={{ margin: "0 0 4px", fontSize: 20 }}>🧾</p>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: theme.danger }}>
                  Catat Pengeluaran
                </p>
              </button>
            </div>

            <div className="kl-dashboard-recent" style={s.card}>
              <p style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 600 }}>Transaksi Terbaru</p>
              {transaksi.length === 0 && (
                <p style={{ color: theme.textMuted, fontSize: 13 }}>Belum ada transaksi.</p>
              )}
              {transaksi.slice(0, 5).map((t) => {
                const items = parseItems(t.item);
                const display = items.map((i) => `${i.nama} x${i.qty}`).join(", ");
                return (
                  <div
                    key={t.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      paddingBottom: 10,
                      marginBottom: 10,
                      borderBottom: `1px solid ${theme.cardBorder}`,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 10,
                          background:
                            t.tipe === "masuk"
                              ? darkMode
                                ? "#1A2A1A"
                                : "#E8F5E9"
                              : darkMode
                              ? "#2A1A1A"
                              : "#FFEBEE",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: t.tipe === "masuk" ? theme.success : theme.danger,
                        }}
                      >
                        {t.tipe === "masuk" ? "↑" : "↓"}
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{display}</p>
                        <p style={{ margin: 0, fontSize: 11, color: theme.textMuted }}>
                          Qty {t.qty} · {t.status === "belum_lunas" ? "🔴 Piutang" : "✅ Lunas"}
                        </p>
                      </div>
                    </div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 14,
                        fontWeight: 700,
                        color: t.tipe === "masuk" ? theme.success : theme.danger,
                      }}
                    >
                      {t.tipe === "masuk" ? "+" : "-"}
                      {fmt(t.total)}
                    </p>
                  </div>
                );
              })}
            </div>

            <div style={s.card}>
              <p style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 600 }}>📦 Stok Produk</p>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <p style={{ margin: 0, fontSize: 12, color: theme.textMuted }}>Total Stok</p>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: theme.gold }}>
                  {totalStok} item
                </p>
              </div>
              {menu.filter((m) => (m.stok || 0) < 5).length > 0 && (
                <div
                  style={{
                    marginTop: 8,
                    background: theme.danger,
                    borderRadius: 8,
                    padding: "8px 12px",
                  }}
                >
                  <p style={{ margin: 0, fontSize: 11, color: "#fff" }}>
                    ⚠️ {menu.filter((m) => (m.stok || 0) < 5).length} menu stok menipis!
                  </p>
                </div>
              )}
              {isPemilik && (
                <button onClick={() => setShowStok(true)} style={{ ...s.btnSm, marginTop: 10, width: "100%" }}>
                  Kelola Stok
                </button>
              )}
            </div>
          </>
        )}

        {/* TRANSAKSI */}
        {tab === "transaksi" && (
          <>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 14,
              }}
            >
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Semua Transaksi</p>
              {!isSuperAdmin && (
                <button
                  style={s.btnSm}
                  onClick={() => {
                    setShowAdd(true);
                    setEditTransaksiId(null);
                    setPesananItems([]);
                    setAddForm({ item: "", qty: "1", total: "", kategori_id: "", menu_id: "" });
                  }}
                >
                  + Tambah
                </button>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {["semua", "lunas", "belum_lunas"].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilterStatus(f)}
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    borderRadius: 10,
                    border: "none",
                    background: filterStatus === f ? theme.gold : theme.input,
                    color: filterStatus === f ? (darkMode ? "#fff" : "#18251D") : theme.textMuted,
                    fontWeight: filterStatus === f ? 700 : 400,
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                >
                  {f === "semua" ? "Semua" : f === "lunas" ? "✅ Lunas" : "🔴 Piutang"}
                </button>
              ))}
            </div>
            <div style={s.card}>
              {transaksi.length === 0 && (
                <p style={{ color: theme.textMuted, fontSize: 13 }}>Belum ada transaksi.</p>
              )}
              {transaksi.map((t, i) => {
                const items = parseItems(t.item);
                const display = items.map((it) => `${it.nama} x${it.qty}`).join(", ");
                return (
                  <div
                    key={t.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      paddingBottom: 12,
                      marginBottom: 12,
                      borderBottom: i < transaksi.length - 1 ? `1px solid ${theme.cardBorder}` : "none",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 12,
                          background:
                            t.tipe === "masuk"
                              ? darkMode
                                ? "#1A2A1A"
                                : "#E8F5E9"
                              : darkMode
                              ? "#2A1A1A"
                              : "#FFEBEE",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: t.tipe === "masuk" ? theme.success : theme.danger,
                          fontSize: 16,
                        }}
                      >
                        {t.tipe === "masuk" ? "↑" : "↓"}
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{display}</p>
                        <p style={{ margin: 0, fontSize: 11, color: theme.textMuted }}>
                          Qty {t.qty} · {formatTanggalWIB(t.created_at)} · {formatJamWIB(t.created_at)} ·{" "}
                          {t.status === "belum_lunas" ? "🔴 Piutang" : "✅ Lunas"}
                        </p>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <p
                        style={{
                          margin: 0,
                          fontSize: 14,
                          fontWeight: 700,
                          color: t.tipe === "masuk" ? theme.success : theme.danger,
                        }}
                      >
                        {t.tipe === "masuk" ? "+" : "-"}
                        {fmt(t.total)}
                      </p>
                      {isPemilik && (
                        <>
                          <button
                            onClick={() => handleEditTransaksi(t)}
                            style={{
                              background: "transparent",
                              border: "none",
                              color: theme.textMuted,
                              cursor: "pointer",
                              fontSize: 14,
                            }}
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleHapusTransaksi(t.id)}
                            style={{
                              background: "transparent",
                              border: "none",
                              color: theme.danger,
                              cursor: "pointer",
                              fontSize: 14,
                            }}
                          >
                            🗑️
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => {
                          setSelectedTransaksi(t);
                          setTab("struk");
                        }}
                        style={{
                          background: theme.gold,
                          border: "none",
                          borderRadius: 6,
                          padding: "4px 8px",
                          color: "#fff",
                          fontSize: 10,
                          cursor: "pointer",
                        }}
                      >
                        🧾
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ANTREAN & PESANAN */}
        {!isSuperAdmin && tab === "antrean" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,320px),1fr))", gap: 14, alignItems: "start" }}>
            <section style={s.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <div><p style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Antrean & Pesanan</p><p style={{ margin: "4px 0 0", color: theme.textMuted, fontSize: 12 }}>Buat nomor, cek ulang pesanan, lalu cetak atau kirim ke keranjang.</p></div>
                <span style={{ background: "#25D366", color: "#073B1A", padding: "7px 10px", borderRadius: 12, fontWeight: 800 }}>#{antrean.filter((a) => a.status === "Menunggu").length}</span>
              </div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 5 }}>Nama pelanggan (opsional)</label>
              <input style={s.input} value={antreanNama} onChange={(e) => setAntreanNama(e.target.value)} placeholder="Nama pelanggan" />
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 5 }}>Jenis pesanan</label>
              <select style={s.input} value={antreanJenis} onChange={(e) => setAntreanJenis(e.target.value)}>
                <option value="bawa_pulang">Bawa pulang</option><option value="makan_di_tempat">Makan di tempat</option>
              </select>
              <div style={{ border: `1px solid ${theme.cardBorder}`, borderRadius: 14, padding: 12, marginBottom: 12 }}>
                <p style={{ margin: "0 0 10px", fontWeight: 800, fontSize: 13 }}>Tambah menu pesanan</p>
                <select style={s.input} value={antreanMenuId} onChange={(e) => setAntreanMenuId(e.target.value)}>
                  <option value="">Pilih menu...</option>{menu.map((m) => <option key={m.id} value={m.id}>{m.nama} — {fmt(m.harga)}</option>)}
                </select>
                <div style={{ display: "grid", gridTemplateColumns: "100px minmax(0,1fr)", gap: 8 }}>
                  <input style={s.input} type="number" min="1" value={antreanQty} onChange={(e) => setAntreanQty(e.target.value)} aria-label="Jumlah menu" />
                  <input style={s.input} value={antreanItemCatatan} onChange={(e) => setAntreanItemCatatan(e.target.value)} placeholder="Catatan menu, mis. less sugar" />
                </div>
                <button style={{ ...s.btnSm, width: "100%" }} onClick={tambahItemAntrean}>＋ Tambahkan ke pesanan</button>
              </div>
              <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 800 }}>Periksa pesanan sebelum dibuat</p>
              {antreanItems.length === 0 ? <p style={{ color: theme.textMuted, fontSize: 13 }}>Belum ada menu. Pilih menu di atas untuk mulai.</p> : antreanItems.map((it, idx) => (
                <div key={`${it.id}-${idx}`} style={{ display: "flex", justifyContent: "space-between", gap: 8, borderBottom: `1px solid ${theme.cardBorder}`, padding: "9px 0" }}>
                  <div style={{ minWidth: 0, flex: 1 }}><b>{it.nama} × {it.qty}</b><div style={{ color: theme.textMuted, fontSize: 12 }}>{it.catatan || "Tanpa catatan menu"}</div><div style={{ fontSize: 12 }}>{fmt(it.harga * it.qty)}</div></div>
                  <button style={{ ...s.btnSm, alignSelf: "center", padding: "6px 10px" }} onClick={() => setAntreanItems((prev) => prev.filter((_, i) => i !== idx))}>Hapus</button>
                </div>
              ))}
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, margin: "12px 0 5px" }}>Catatan tambahan seluruh pesanan</label>
              <textarea style={{ ...s.input, minHeight: 74, resize: "vertical" }} value={antreanCatatan} onChange={(e) => setAntreanCatatan(e.target.value)} placeholder="Contoh: pesanan dibungkus terpisah, alergi, atau permintaan pelanggan" />
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "10px 0", borderTop: `1px solid ${theme.cardBorder}`, fontWeight: 800 }}><span>Total pesanan</span><span>{fmt(antreanItems.reduce((sum, it) => sum + it.harga * it.qty, 0))}</span></div>
              <button style={{ ...s.btn, background: "#25D366", color: "#073B1A" }} onClick={buatAntrean}>✓ Verifikasi & Buat Nomor Antrean</button>
            </section>
            <section style={s.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <div><p style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Daftar antrean</p><p style={{ margin: "4px 0 0", fontSize: 12, color: theme.textMuted }}>Tersimpan di perangkat ini untuk kafe yang sedang aktif.</p></div>
                <button style={s.btnSm} disabled={!antrean.length} onClick={() => cetakAntrean(antrean, "daftar")}>🖨 Cetak daftar</button>
              </div>
              {!antrean.length ? <div style={{ textAlign: "center", padding: 24, color: theme.textMuted }}>Belum ada antrean. Buat pesanan dari panel sebelah.</div> : antrean.map((o) => (
                <article key={o.id} style={{ border: `1px solid ${theme.cardBorder}`, borderRadius: 14, padding: 12, marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "start" }}>
                    <div><div style={{ fontSize: 20, fontWeight: 900, color: "#128C3A" }}>{o.nomor}</div><b>{o.nama}</b><div style={{ fontSize: 11, color: theme.textMuted }}>{o.waktu} · {o.jenis === "makan_di_tempat" ? "Makan di tempat" : "Bawa pulang"}</div></div>
                    <span style={{ borderRadius: 20, padding: "5px 8px", background: o.status === "Menunggu" ? "#E9FCEB" : "#F0F3F0", color: o.status === "Menunggu" ? "#075E2E" : "#526052", fontSize: 11, fontWeight: 800 }}>{o.status}</span>
                  </div>
                  <div style={{ marginTop: 10, fontSize: 13 }}>{(o.items || []).map((it, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 8, margin: "5px 0" }}><span>{it.nama} × {it.qty}{it.catatan ? <small style={{ display: "block", color: theme.textMuted }}>Catatan: {it.catatan}</small> : null}</span><b>{fmt(it.harga * it.qty)}</b></div>)}</div>
                  {o.catatan && <p style={{ margin: "8px 0", fontSize: 12, color: theme.textMuted }}>Catatan pesanan: {o.catatan}</p>}
                  <div style={{ borderTop: `1px solid ${theme.cardBorder}`, paddingTop: 9, marginTop: 9, display: "flex", justifyContent: "space-between", fontWeight: 800 }}><span>Total</span><span>{fmt((o.items || []).reduce((sum, it) => sum + (Number(it.harga) || 0) * (Number(it.qty) || 0), 0))}</span></div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                    <button style={s.btnSm} onClick={() => cetakAntrean(o)}>🖨 Cetak antrean</button>
                    <button style={s.btnSm} onClick={() => cetakAntrean(o)}>🧾 Cetak pesanan</button>
                    {o.status === "Menunggu" && <button style={{ ...s.btnSm, background: "#25D366", color: "#073B1A" }} onClick={() => {
                      (o.items || []).forEach((it) => {
                        const source = menu.find((m) => String(m.id) === String(it.id)) || it;
                        tambahKeKeranjang({ ...source, catatan: it.catatan || "", antreanNomor: o.nomor }, it.qty);
                      });
                      simpanAntrean(antrean.map((a) => a.id === o.id ? { ...a, status: "Masuk keranjang" } : a));
                      setLastReceipt(null);
                      setShowKasir(true);
                    }}>→ Lanjut ke keranjang</button>}
                    {o.status !== "Selesai" && <button style={s.btnSm} onClick={() => simpanAntrean(antrean.map((a) => a.id === o.id ? { ...a, status: "Selesai" } : a))}>Tandai selesai</button>}
                    <button style={{ ...s.btnSm, color: "#B83E35" }} onClick={() => { if (window.confirm(`Hapus antrean ${o.nomor}?`)) simpanAntrean(antrean.filter((a) => a.id !== o.id)); }}>Hapus</button>
                  </div>
                </article>
              ))}
            </section>
          </div>
        )}

        {/* MENU */}
        {tab === "menu" && (
          <>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 14,
              }}
            >
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Menu & Kategori</p>
              <div style={{ display: "flex", gap: 8 }}>
                {isPemilik && (
                  <>
                    <button
                      style={s.btnSm}
                      onClick={() => {
                        setEditKategoriId(null);
                        setKategoriForm({ nama: "" });
                        setShowAddKategori(true);
                      }}
                    >
                      🏷️
                    </button>
                    <button
                      style={s.btnSm}
                      onClick={() => {
                        setEditMenuId(null);
                        setMenuForm({
                          nama: "",
                          harga: "",
                          hpp: "",
                          stok: "",
                          kategori_id: "",
                          foto: "",
                          qty: "",
                        });
                        setMenuFile(null);
                        setShowAddMenu(true);
                      }}
                    >
                      + Tambah
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="kl-menu-categories" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
              <button
                onClick={() => setSelectedKategori("")}
                style={{
                  padding: "6px 16px",
                  borderRadius: 20,
                  border: "none",
                  background: selectedKategori === "" ? theme.gold : theme.input,
                  color: selectedKategori === "" ? (darkMode ? "#fff" : "#18251D") : theme.textMuted,
                  fontWeight: selectedKategori === "" ? 700 : 400,
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                Semua
              </button>
              {kategori.map((k) => {
                const isSelected = selectedKategori === k.id;
                return (
                  <div key={k.id} className={`kl-category-chip-wrap ${isSelected ? "is-selected" : ""}`}>
                    <button className={`kl-category-chip ${isSelected ? "is-selected" : ""}`} aria-pressed={isSelected} onClick={() => setSelectedKategori(isSelected ? "" : k.id)}>
                      <span>{k.nama}</span>
                      {isSelected && <AppIcon name="check" size={14} />}
                    </button>
                    {isPemilik && isSelected && (
                      <button className="kl-category-delete" type="button" aria-label={`Hapus kategori ${k.nama}`} title={`Hapus kategori ${k.nama}`} onClick={() => handleHapusKategori(k.id)}>
                        <AppIcon name="trash" size={13} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {filteredMenu.length === 0 && (
              <div style={s.card}>
                <p style={{ color: theme.textMuted, fontSize: 13 }}>Tidak ada menu di kategori ini.</p>
              </div>
            )}
            <div className="kl-menu-grid">
            {filteredMenu.map((m) => {
              const margin = m.harga ? (((m.harga - m.hpp) / m.harga) * 100).toFixed(1) : 0;
              const stok = m.stok || 0;
              const kategoriNama = kategori.find((k) => k.id === m.kategori_id)?.nama || "Umum";
              const icon =
                kategoriNama === "Minuman"
                  ? "🥤"
                  : kategoriNama === "Makanan"
                  ? "🍔"
                  : kategoriNama === "Snack"
                  ? "🍿"
                  : "☕";
              return (
                <div key={m.id} className="kl-menu-admin-card" style={s.card}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {m.foto && (
                        <img
                          className="kl-menu-photo"
                          src={m.foto}
                          alt={m.nama}
                          style={{ width: 50, height: 50, objectFit: "cover", borderRadius: 8 }}
                        />
                      )}
                      <div>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>
                          {icon} {m.nama}
                        </p>
                        <p style={{ margin: "2px 0 0", fontSize: 11, color: theme.textMuted }}>
                          📦 Stok: {stok} {stok < 5 && "⚠️"} · {kategoriNama}
                        </p>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: theme.gold }}>
                        {fmt(m.harga)}
                      </p>
                      {isPemilik && (
                        <>
                          <button
                            onClick={() => handleEditMenu(m)}
                            style={{
                              background: "transparent",
                              border: "none",
                              color: theme.textMuted,
                              cursor: "pointer",
                              fontSize: 14,
                            }}
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleHapusMenu(m.id)}
                            style={{
                              background: "transparent",
                              border: "none",
                              color: theme.danger,
                              cursor: "pointer",
                              fontSize: 14,
                            }}
                          >
                            🗑️
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                    <div style={{ flex: 1, background: theme.input, borderRadius: 10, padding: "8px 12px" }}>
                      <p style={{ margin: 0, fontSize: 10, color: theme.textMuted }}>HPP</p>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: theme.danger }}>
                        {fmt(m.hpp)}
                      </p>
                    </div>
                    <div style={{ flex: 1, background: theme.input, borderRadius: 10, padding: "8px 12px" }}>
                      <p style={{ margin: 0, fontSize: 10, color: theme.textMuted }}>Laba/cup</p>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: theme.success }}>
                        {fmt(m.harga - m.hpp)}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div
                      style={{
                        flex: 1,
                        height: 6,
                        background: theme.input,
                        borderRadius: 3,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: margin + "%",
                          background: margin > 65 ? theme.success : theme.gold,
                          borderRadius: 3,
                        }}
                      ></div>
                    </div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 12,
                        fontWeight: 700,
                        color: margin > 65 ? theme.success : theme.gold,
                      }}
                    >
                      {margin}%
                    </p>
                  </div>

                  {!isSuperAdmin && (
                    <div className="kl-menu-actions">
                      <div className="kl-qty-controls" aria-label={`Jumlah ${m.nama}`}>
                        <button type="button" aria-label={`Kurangi ${m.nama}`} onClick={() => handleJumlah(m.id, (jumlahMap[m.id] || 1) - 1)} style={{ ...s.btnSm, padding: "6px 12px", minWidth: 42 }} disabled={(jumlahMap[m.id] || 1) <= 1}>−</button>
                        <input type="number" aria-label={`Jumlah ${m.nama}`} value={jumlahMap[m.id] || 1} onChange={(e) => handleJumlah(m.id, e.target.value)} style={{ width: 58, textAlign: "center", background: theme.input, border: `1px solid ${theme.inputBorder}`, borderRadius: 10, padding: "8px 0", color: theme.text, fontSize: 15, fontWeight: 700 }} min="1" />
                        <button type="button" aria-label={`Tambah jumlah ${m.nama}`} onClick={() => handleJumlah(m.id, (jumlahMap[m.id] || 1) + 1)} style={{ ...s.btnSm, padding: "6px 12px", minWidth: 42 }}>+</button>
                      </div>
                      <button className="kl-add-to-cart" onClick={() => tambahKeKeranjang(m, jumlahMap[m.id] || 1)} type="button">
                        <AppIcon name="cart" size={16} /> Tambah ke Keranjang
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            </div>
          </>
        )}

        {/* KARYAWAN & ABSENSI */}
        {tab === "karyawan" && (
          <>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 14,
              }}
            >
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Daftar Karyawan</p>
              {isPemilik && (
                <button
                  style={s.btnSm}
                  onClick={() => {
                    setEditKaryawanId(null);
                    setKaryawanForm({ nama: "", email: "", password: "" });
                    setShowAddKaryawan(true);
                  }}
                >
                  + Tambah
                </button>
              )}
            </div>
            {karyawan.length === 0 && (
              <div style={s.card}>
                <p style={{ color: theme.textMuted, fontSize: 13 }}>Belum ada karyawan.</p>
              </div>
            )}
            {karyawan.map((k) => (
              <div key={k.id} style={s.card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{k.nama}</p>
                    <p style={{ margin: "4px 0 0", fontSize: 12, color: theme.textMuted }}>
                      {k.email || "Barista"}
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {isPemilik && (
                      <>
                        <button
                          onClick={() => handleEditKaryawan(k)}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: theme.textMuted,
                            cursor: "pointer",
                            fontSize: 14,
                          }}
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleHapusKaryawan(k.id)}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: theme.danger,
                            cursor: "pointer",
                            fontSize: 14,
                          }}
                        >
                          🗑️
                        </button>
                      </>
                    )}
                    {isPemilik && (
                      <button
                        onClick={() => {
                          setAbsensiForm({ ...absensiForm, pegawai_id: k.id });
                          setShowAbsensi(true);
                        }}
                        style={{
                          background: theme.gold,
                          border: "none",
                          borderRadius: 6,
                          padding: "4px 10px",
                          color: "#fff",
                          fontSize: 11,
                          cursor: "pointer",
                        }}
                      >
                        Absen
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {profile?.role === "barista" && (
              <div style={s.card}>
                <p style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700 }}>📋 Absen Saya</p>
                <div style={{ display: "flex", gap: 10 }}>
                  {(() => {
                    const today = todayWIB();
                    const sudahMasuk = absensi.some(
                      (a) => a.pegawai_id === profile.id && a.tanggal === today && a.jam_masuk
                    );
                    const sudahKeluar = absensi.some(
                      (a) => a.pegawai_id === profile.id && a.tanggal === today && a.jam_keluar
                    );
                    return (
                      <>
                        <button
                          onClick={handleBaristaAbsenMasuk}
                          disabled={baristaAbsenLoading || sudahMasuk}
                          style={{
                            ...s.btnSm,
                            flex: 1,
                            background:
                              baristaAbsenLoading || sudahMasuk ? theme.textMuted : theme.success,
                          }}
                        >
                          {baristaAbsenLoading ? "..." : "✅ Absen Masuk"}
                        </button>
                        <button
                          onClick={handleBaristaAbsenKeluar}
                          disabled={baristaAbsenLoading || !sudahMasuk || sudahKeluar}
                          style={{
                            ...s.btnSm,
                            flex: 1,
                            background:
                              baristaAbsenLoading || !sudahMasuk || sudahKeluar
                                ? theme.textMuted
                                : theme.danger,
                          }}
                        >
                          {baristaAbsenLoading ? "..." : "❌ Absen Keluar"}
                        </button>
                      </>
                    );
                  })()}
                </div>
                {(() => {
                  const today = todayWIB();
                  const todayAbsen = absensi.find(
                    (a) => a.pegawai_id === profile.id && a.tanggal === today
                  );
                  if (todayAbsen) {
                    return (
                      <p style={{ marginTop: 10, fontSize: 13, color: theme.textMuted }}>
                        Status:{" "}
                        {todayAbsen.jam_masuk
                          ? `✅ Masuk ${formatJamWIB(todayAbsen.jam_masuk)}`
                          : "Belum masuk"}
                        {todayAbsen.jam_keluar && ` | Keluar ${formatJamWIB(todayAbsen.jam_keluar)}`}
                      </p>
                    );
                  }
                  return (
                    <p style={{ marginTop: 10, fontSize: 13, color: theme.textMuted }}>
                      Belum ada absensi hari ini.
                    </p>
                  );
                })()}
              </div>
            )}

            {isPemilik && (
              <div style={{ marginTop: 20 }}>
                <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>📋 Riwayat Absensi</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                  <input
                    style={s.input}
                    placeholder="Cari nama..."
                    value={filterNama}
                    onChange={(e) => setFilterNama(e.target.value)}
                  />
                  <input
                    style={s.input}
                    type="date"
                    value={filterTglMulaiAbsen}
                    onChange={(e) => setFilterTglMulaiAbsen(e.target.value)}
                  />
                  <input
                    style={s.input}
                    type="date"
                    value={filterTglSelesaiAbsen}
                    onChange={(e) => setFilterTglSelesaiAbsen(e.target.value)}
                  />
                  <button
                    style={s.btnSm}
                    onClick={() => {
                      setFilterNama("");
                      setFilterTglMulaiAbsen("");
                      setFilterTglSelesaiAbsen("");
                    }}
                  >
                    Reset
                  </button>
                </div>
                <div style={s.card}>
                  {filteredAbsensi.length === 0 && (
                    <p style={{ color: theme.textMuted, fontSize: 13 }}>Tidak ada data absensi.</p>
                  )}
                  {filteredAbsensi.map((a) => {
                    const pegawai = karyawan.find((k) => k.id === a.pegawai_id);
                    return (
                      <div
                        key={a.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          paddingBottom: 8,
                          marginBottom: 8,
                          borderBottom: `1px solid ${theme.cardBorder}`,
                        }}
                      >
                        <div>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>
                            {pegawai?.nama || "Tidak diketahui"}
                          </p>
                          <p style={{ margin: 0, fontSize: 11, color: theme.textMuted }}>
                            {formatTanggalWIB(a.tanggal)}
                          </p>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <p
                            style={{
                              margin: 0,
                              fontSize: 12,
                              color: a.jam_masuk ? theme.success : theme.danger,
                            }}
                          >
                            {a.jam_masuk ? `Masuk: ${formatJamWIB(a.jam_masuk)}` : "Belum masuk"}
                          </p>
                          {a.jam_masuk && (
                            <p
                              style={{
                                margin: 0,
                                fontSize: 12,
                                color: a.jam_keluar ? theme.textMuted : theme.gold,
                              }}
                            >
                              {a.jam_keluar ? `Keluar: ${formatJamWIB(a.jam_keluar)}` : "Belum keluar"}
                            </p>
                          )}
                          {isPemilik && a.jam_masuk && !a.jam_keluar && (
                            <button
                              onClick={() => handleAbsenKeluar(a.id)}
                              style={{ ...s.btnSm, fontSize: 10, padding: "4px 8px" }}
                            >
                              Absen Keluar
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* ANALITIK PEMBAYARAN */}
        {tab === "pembayaran" && (
          <div style={{ display: "grid", gap: 14 }}>
            <div style={s.card}>
              <p style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 800 }}>💳 Analitik Pembayaran</p>
              <p style={{ margin: 0, color: theme.textMuted, fontSize: 12 }}>Ringkasan transaksi masuk menurut metode pembayaran.</p>
              {isPemilik ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10, marginTop: 12, alignItems: "end" }}>
                  <div><label style={s.label}>Dari tanggal</label><input type="date" value={analyticsStartDate} max={analyticsDayKey} onChange={(e) => { analyticsDatesManuallySelected.current = true; setAnalyticsStartDate(e.target.value); }} style={{ ...s.input, width: "100%", minWidth: 0 }} /></div>
                  <div><label style={s.label}>Sampai tanggal</label><input type="date" value={analyticsEndDate} max={analyticsDayKey} onChange={(e) => { analyticsDatesManuallySelected.current = true; setAnalyticsEndDate(e.target.value); }} style={{ ...s.input, width: "100%", minWidth: 0 }} /></div>
                </div>
              ) : (
                <div style={{ marginTop: 10, padding: "8px 10px", borderRadius: 8, background: theme.input, color: theme.textMuted, fontSize: 12 }}>Data analitik hanya untuk hari ini ({analyticsDayKey}).</div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(135px,1fr))", gap: 10, marginTop: 14 }}>
                <div style={{ background: theme.input, borderRadius: 12, padding: 14 }}><div style={{ fontSize: 12, color: theme.textMuted }}>Total Tunai</div><div style={{ fontSize: 18, fontWeight: 800 }}>{fmt(pembayaranTunaiTotal)}</div></div>
                <div style={{ background: theme.input, borderRadius: 12, padding: 14 }}><div style={{ fontSize: 12, color: theme.textMuted }}>Total QRIS</div><div style={{ fontSize: 18, fontWeight: 800 }}>{fmt(pembayaranQrisTotal)}</div></div>
                <div style={{ background: theme.input, borderRadius: 12, padding: 14 }}><div style={{ fontSize: 12, color: theme.textMuted }}>Transaksi Masuk</div><div style={{ fontSize: 18, fontWeight: 800 }}>{transaksiMasuk.length}</div></div>
              </div>
            </div>
            <div style={s.card}>
              <p style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 800 }}>Tunai vs QRIS · {tanggalAnalitik[0]} sampai {tanggalAnalitik[tanggalAnalitik.length - 1]}</p>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12, marginBottom: 12 }}>
                <span><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 9, background: theme.gold, marginRight: 6 }} />Tunai</span>
                <span><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 9, background: theme.success, marginRight: 6 }} />QRIS</span>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "end", minHeight: 170, overflowX: "auto", paddingBottom: 4 }}>
                {transaksiPerHari.map((d) => {
                  const max = Math.max(1, ...transaksiPerHari.map((x) => Math.max(x.tunai, x.qris)));
                  return <div key={d.day} style={{ minWidth: 32, flex: "1 0 32px", textAlign: "center" }}>
                    <div style={{ height: 130, display: "flex", alignItems: "end", justifyContent: "center", gap: 3, borderBottom: "1px solid " + theme.cardBorder, paddingBottom: 3 }}>
                      <div title={"Tunai " + fmt(d.tunai)} style={{ width: "35%", maxWidth: 18, height: Math.max(3, d.tunai / max * 120) + "px", background: theme.gold, borderRadius: "5px 5px 0 0" }} />
                      <div title={"QRIS " + fmt(d.qris)} style={{ width: "35%", maxWidth: 18, height: Math.max(3, d.qris / max * 120) + "px", background: theme.success, borderRadius: "5px 5px 0 0" }} />
                    </div>
                    <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 6 }}>{d.label}</div>
                  </div>;
                })}
              </div>
              <p style={{ fontSize: 11, color: theme.textMuted, margin: "12px 0 0" }}>Transaksi lama tanpa rincian metode pembayaran mungkin belum muncul terpisah pada grafik ini.</p>
            </div>
            <div style={s.card}>
              <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 800 }}>Jam Transaksi Tersibuk</p>
              <p style={{ margin: "0 0 12px", fontSize: 12, color: theme.textMuted }}>Nilai transaksi per jam, berdasarkan waktu WIB.</p>
              <svg viewBox="0 0 300 125" role="img" aria-label="Grafik garis transaksi per jam" style={{ width: "100%", display: "block", overflow: "visible" }}>
                {[0, 1, 2, 3].map((n) => <line key={n} x1="20" x2="280" y1={22 + n * 26} y2={22 + n * 26} stroke={theme.cardBorder} strokeDasharray="3 4" />)}
                <polyline points={garisJam} fill="none" stroke={theme.gold} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                {transaksiPerJam.map((x, i) => <circle key={x.hour} cx={20 + i * (260 / 23)} cy={100 - (x.total / maxPerJam) * 78} r={x.total > 0 ? 2.7 : 1.5} fill={theme.gold}><title>{String(x.hour).padStart(2, "0") + ":00 — " + fmt(x.total) + " (" + x.count + " transaksi)"}</title></circle>)}
                {[0, 6, 12, 18, 23].map((h) => <text key={h} x={20 + h * (260 / 23)} y="119" fontSize="9" textAnchor="middle" fill={theme.textMuted}>{String(h).padStart(2, "0") + ":00"}</text>)}
              </svg>
              <div style={{ marginTop: 10, padding: 12, background: theme.input, borderRadius: 10, fontSize: 12 }}>Jam paling ramai: <strong>{String(transaksiPerJam.reduce((best, x) => x.count > best.count ? x : best, transaksiPerJam[0]).hour).padStart(2, "0")}:00 WIB</strong><span style={{ color: theme.textMuted }}> · {Math.max(...transaksiPerJam.map((x) => x.count))} transaksi</span></div>
            </div>
          </div>
        )}

        {/* LAPORAN */}
        {tab === "laporan" && (
          <div style={s.card}>
            <p style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700 }}>
              📊 Laporan Keuangan
            </p>

            {!isBarista && (
              <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                {["hari", "minggu", "bulan", "tahun", "semua"].map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriodeFilter(p)}
                    style={{
                      padding: "6px 16px",
                      borderRadius: 20,
                      border: "none",
                      background: periodeFilter === p ? "#128C4A" : (darkMode ? "#0B2116" : "#FFFFFF"),
                      color:
                        periodeFilter === p ? "#FFFFFF" : theme.textMuted,
                      fontWeight: periodeFilter === p ? 700 : 400,
                      cursor: "pointer",
                      fontSize: 12,
                    }}
                  >
                    {p === "hari"
                      ? "Hari Ini"
                      : p === "minggu"
                      ? "Minggu Ini"
                      : p === "bulan"
                      ? "Bulan Ini"
                      : p === "tahun"
                      ? "Tahun Ini"
                      : "Semua"}
                  </button>
                ))}
              </div>
            )}
            {isBarista && (
              <div
                style={{
                  marginBottom: 14,
                  padding: 10,
                  background: theme.input,
                  borderRadius: 8,
                  textAlign: "center",
                  color: theme.textMuted,
                  fontSize: 13,
                }}
              >
                📅 Laporan hanya menampilkan transaksi hari ini
              </div>
            )}

            <div
              style={{
                marginBottom: 16,
                padding: 12,
                background: theme.input,
                borderRadius: 12,
                border: `1px solid ${theme.gold}`,
              }}
            >
              <p style={{ fontWeight: 600, marginBottom: 6, color: theme.gold }}>
                🤖 AI Agent - Tanya apa saja
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  style={{ ...s.input, flex: 1, marginBottom: 0 }}
                  placeholder="Tanya: total penjualan, laba, stok..."
                  value={aiQuery}
                  onChange={(e) => setAiQuery(e.target.value)}
                />
                <button style={s.btnSm} onClick={handleAiQuery} disabled={aiLoading}>
                  {aiLoading ? "⏳" : "Tanya"}
                </button>
              </div>
              {aiAnswer && (
                <div
                  style={{
                    marginTop: 8,
                    padding: 8,
                    background: theme.card,
                    borderRadius: 8,
                    whiteSpace: "pre-wrap",
                    fontSize: 13,
                    color: theme.text,
                    maxHeight: 300,
                    overflowY: "auto",
                  }}
                >
                  {aiAnswer}
                </div>
              )}
            </div>

            {!isBarista && (
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                <div style={{ flex: 1 }}>
                  <label style={s.label}>Dari</label>
                  <input
                    style={s.input}
                    type="date"
                    value={filterTglMulai}
                    onChange={(e) => setFilterTglMulai(e.target.value)}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={s.label}>Sampai</label>
                  <input
                    style={s.input}
                    type="date"
                    value={filterTglSelesai}
                    onChange={(e) => setFilterTglSelesai(e.target.value)}
                  />
                </div>
                <button
                  style={{ ...s.btnSm, alignSelf: "flex-end" }}
                  onClick={() => {
                    setFilterTglMulai("");
                    setFilterTglSelesai("");
                  }}
                >
                  Reset
                </button>
              </div>
            )}

            <div
              style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}
            >
              <div style={{ background: theme.input, borderRadius: 12, padding: 12 }}>
                <p style={{ margin: 0, fontSize: 10, color: theme.textMuted }}>Total Transaksi</p>
                <p style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{filtered.length}</p>
              </div>
              <div style={{ background: theme.input, borderRadius: 12, padding: 12 }}>
                <p style={{ margin: 0, fontSize: 10, color: theme.textMuted }}>Laba Bersih</p>
                <p
                  style={{
                    margin: 0,
                    fontSize: 18,
                    fontWeight: 700,
                    color: laba >= 0 ? theme.success : theme.danger,
                  }}
                >
                  {fmt(laba)}
                </p>
              </div>
              <div style={{ background: theme.input, borderRadius: 12, padding: 12 }}>
                <p style={{ margin: 0, fontSize: 10, color: theme.textMuted }}>Pemasukan</p>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: theme.success }}>
                  {fmt(totalMasuk)}
                </p>
              </div>
              <div style={{ background: theme.input, borderRadius: 12, padding: 12 }}>
                <p style={{ margin: 0, fontSize: 10, color: theme.textMuted }}>Pengeluaran</p>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: theme.danger }}>
                  {fmt(totalKeluar)}
                </p>
              </div>
            </div>

            {chartLabels.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
                  📈 Grafik 7 Hari Terakhir
                </p>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 100 }}>
                  {chartLabels.map((label, idx) => {
                    const hMasuk = (chartMasuk[idx] / maxChart) * 80;
                    const hKeluar = (chartKeluar[idx] / maxChart) * 80;
                    return (
                      <div
                        key={label}
                        style={{
                          flex: 1,
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 2,
                        }}
                      >
                        <div
                          style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 80 }}
                        >
                          <div
                            style={{
                              width: 10,
                              height: Math.max(4, hMasuk),
                              background: theme.success,
                              borderRadius: "4px 4px 0 0",
                            }}
                          ></div>
                          <div
                            style={{
                              width: 10,
                              height: Math.max(4, hKeluar),
                              background: theme.danger,
                              borderRadius: "4px 4px 0 0",
                            }}
                          ></div>
                        </div>
                        <span style={{ fontSize: 8, color: theme.textMuted }}>
                          {label.slice(0, 5)}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 16,
                    justifyContent: "center",
                    fontSize: 10,
                    marginTop: 4,
                  }}
                >
                  <span>
                    <span style={{ color: theme.success }}>■</span> Pemasukan
                  </span>
                  <span>
                    <span style={{ color: theme.danger }}>■</span> Pengeluaran
                  </span>
                </div>
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <label style={s.label}>Tampilkan Laporan Stok</label>
              <button
                onClick={() => setLaporanStokOn(!laporanStokOn)}
                style={{ ...s.btnSm, padding: "4px 12px" }}
              >
                {laporanStokOn ? "ON" : "OFF"}
              </button>
            </div>
            {laporanStokOn && (
              <div style={{ marginBottom: 14 }}>
                <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  📦 Laporan Stok Per Produk
                </p>
                <div style={s.card}>
                  {laporanStokData.length === 0 && (
                    <p style={{ color: theme.textMuted }}>Belum ada produk.</p>
                  )}
                  {laporanStokData.map((m) => (
                    <div
                      key={m.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 12,
                        paddingBottom: 4,
                        borderBottom: `1px solid ${theme.cardBorder}`,
                      }}
                    >
                      <span>{m.nama}</span>
                      <span>
                        Stok: {m.stok || 0} | Terjual: {m.terjual || 0} | Sisa: {m.sisa || 0}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                🏷️ Top 5 Kategori Terlaris
              </p>
              <div style={s.card}>
                {top5Kategori.length === 0 ? (
                  <p style={{ color: theme.textMuted }}>Belum ada data.</p>
                ) : (
                  top5Kategori.map(([kat, qty]) => (
                    <div
                      key={kat}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 12,
                        paddingBottom: 4,
                        borderBottom: `1px solid ${theme.cardBorder}`,
                      }}
                    >
                      <span>{kat}</span>
                      <span>{qty} item</span>
                    </div>
                  ))
                )}
              </div>
              <p style={{ fontSize: 13, fontWeight: 600, marginTop: 10, marginBottom: 6 }}>
                📉 5 Kategori Terendah
              </p>
              <div style={s.card}>
                {bottom5Kategori.length === 0 ? (
                  <p style={{ color: theme.textMuted }}>Belum ada data.</p>
                ) : (
                  bottom5Kategori.map(([kat, qty]) => (
                    <div
                      key={kat}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 12,
                        paddingBottom: 4,
                        borderBottom: `1px solid ${theme.cardBorder}`,
                      }}
                    >
                      <span>{kat}</span>
                      <span>{qty} item</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                📌 Produk Terlaris per Kategori
              </p>
              {Object.keys(produkPerKategori).length === 0 && (
                <p style={{ color: theme.textMuted }}>Belum ada data produk per kategori.</p>
              )}
              {Object.keys(produkPerKategori).map((kat) => {
                const sorted = produkPerKategori[kat].sort(
                  (a, b) => (produkTerjual[b.nama] || 0) - (produkTerjual[a.nama] || 0)
                );
                const top = sorted.slice(0, 3);
                const bottom = sorted.slice(-3).reverse();
                return (
                  <div key={kat} style={s.card}>
                    <p style={{ fontWeight: 600 }}>{kat}</p>
                    <p style={{ fontSize: 12, marginBottom: 4 }}>🔥 Top 3:</p>
                    {top.map((m) => (
                      <div
                        key={m.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: 11,
                          paddingBottom: 2,
                        }}
                      >
                        <span>{m.nama}</span>
                        <span>{produkTerjual[m.nama] || 0} item</span>
                      </div>
                    ))}
                    <p style={{ fontSize: 12, marginTop: 6, marginBottom: 4 }}>📉 Bottom 3:</p>
                    {bottom.map((m) => (
                      <div
                        key={m.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: 11,
                          paddingBottom: 2,
                        }}
                      >
                        <span>{m.nama}</span>
                        <span>{produkTerjual[m.nama] || 0} item</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>

            {filtered.length > 0 && (
              <button
                onClick={exportExcel}
                style={{ ...s.btnSm, width: "100%", background: theme.gold, marginBottom: 14 }}
              >
                ⬇️ Download Excel (.csv)
              </button>
            )}

            <div>
              <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Detail Transaksi</p>
              {filtered.length === 0 && (
                <p style={{ color: theme.textMuted, fontSize: 13 }}>Tidak ada transaksi.</p>
              )}
              {filtered.slice(0, 10).map((t) => {
                const items = parseItems(t.item);
                const display = items.map((i) => `${i.nama} x${i.qty}`).join(", ");
                return (
                  <div
                    key={t.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      paddingBottom: 8,
                      marginBottom: 8,
                      borderBottom: `1px solid ${theme.cardBorder}`,
                    }}
                  >
                    <div>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>{display}</p>
                      <p style={{ margin: 0, fontSize: 10, color: theme.textMuted }}>
                        {formatTanggalWIB(t.created_at)} · {formatJamWIB(t.created_at)} ·{" "}
                        {t.status === "belum_lunas" ? "🔴 Piutang" : "✅ Lunas"}
                      </p>
                    </div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 13,
                        fontWeight: 700,
                        color: t.tipe === "masuk" ? theme.success : theme.danger,
                      }}
                    >
                      {t.tipe === "masuk" ? "+" : "-"}
                      {fmt(t.total)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* STRUK */}
        {tab === "struk" && (
          <div style={s.card}>
            {selectedTransaksi ? (
              <div
                style={{
                  fontFamily: "'Courier New', monospace",
                  fontSize: 13,
                  maxWidth: "100%",
                  wordWrap: "break-word",
                }}
              >
                <div style={{ textAlign: "center", marginBottom: 10 }}>
                  <h3 style={{ margin: 0, fontWeight: 800 }}>
                    {(kafe?.nama || "KAFE ANDA").toUpperCase()}
                  </h3>
                  {kafe?.alamat && <p style={{ margin: 0, fontSize: 11 }}>{kafe.alamat}</p>}
                  {kafe?.telepon && (
                    <p style={{ margin: 0, fontSize: 11 }}>Telp: {kafe.telepon}</p>
                  )}
                  <div style={{ borderTop: "1px dashed #888", margin: "8px 0" }}></div>
                  <p style={{ margin: 0, fontSize: 11 }}>
                    No: {selectedTransaksi.id?.slice(0, 12) || "N/A"}
                  </p>
                  <p style={{ margin: 0, fontSize: 11 }}>
                    Tanggal: {formatDateTimeWIB(selectedTransaksi.created_at)}
                  </p>
                  <p style={{ margin: 0, fontSize: 11 }}>
                    Kasir: {profile?.nama || "Admin"} ({profile?.role || "-"})
                  </p>
                  <div style={{ borderTop: "1px dashed #888", margin: "8px 0" }}></div>
                </div>

                <div>
                  {parseItems(selectedTransaksi.item).map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 12,
                        padding: "2px 0",
                      }}
                    >
                      <span>
                        {item.nama} x{item.qty}
                      </span>
                      <span>{fmt(item.total || item.harga * item.qty || 0)}</span>
                    </div>
                  ))}
                </div>

                <div style={{ borderTop: "1px dashed #888", margin: "8px 0" }}></div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span>Subtotal</span>
                  <span>{fmt(selectedTransaksi.subtotal || selectedTransaksi.total)}</span>
                </div>
                {selectedTransaksi.pajak_enabled && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <span>Pajak ({persentasePajak}%)</span>
                    <span>{fmt(selectedTransaksi.pajak || 0)}</span>
                  </div>
                )}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 14,
                    fontWeight: 700,
                    borderTop: "1px solid #888",
                    paddingTop: 6,
                    marginTop: 6,
                  }}
                >
                  <span>TOTAL BIAYA</span>
                  <span>{fmt(selectedTransaksi.total)}</span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 13,
                    marginTop: 6,
                  }}
                >
                  <span>
                    Jumlah Bayar (
                    {selectedTransaksi.metode ||
                      (selectedTransaksi.status === "belum_lunas" ? "Piutang" : "Tunai")}
                    )
                  </span>
                  <span>
                    {fmt(
                      selectedTransaksi.bayar !== null &&
                        selectedTransaksi.bayar !== undefined
                        ? selectedTransaksi.bayar
                        : selectedTransaksi.total
                    )}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span>Kembalian</span>
                  <span>
                    {fmt(
                      selectedTransaksi.kembalian !== null &&
                        selectedTransaksi.kembalian !== undefined
                        ? selectedTransaksi.kembalian
                        : 0
                    )}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 13,
                    marginTop: 6,
                  }}
                >
                  <span>Status</span>
                  <span
                    style={{
                      color:
                        selectedTransaksi.status === "belum_lunas"
                          ? theme.danger
                          : theme.success,
                    }}
                  >
                    {selectedTransaksi.status === "belum_lunas" ? "Belum Lunas" : "LUNAS"}
                  </span>
                </div>
                <div
                  style={{
                    textAlign: "center",
                    marginTop: 14,
                    fontSize: 11,
                    borderTop: "1px dashed #888",
                    paddingTop: 8,
                  }}
                >
                  <p style={{ margin: 0 }}>Powered by KopiLaba</p>
                  <p style={{ margin: 0 }}>Manajemen Keuangan Kafe</p>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: 30 }}>
                <p style={{ color: theme.textMuted }}>Pilih transaksi untuk lihat struk</p>
                <button onClick={() => setTab("transaksi")} style={s.btnSm}>
                  Ke Transaksi
                </button>
              </div>
            )}
            <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
              {selectedTransaksi && (
                <button onClick={handlePrintStruk} style={{ ...s.btn, flex: 1 }}>
                  🖨️ Cetak Struk
                </button>
              )}
              <button
                onClick={() => {
                  setSelectedTransaksi(null);
                  setTab("transaksi");
                }}
                style={{
                  ...s.btn,
                  background: theme.card,
                  border: `1px solid ${theme.cardBorder}`,
                  color: theme.text,
                  flex: 1,
                }}
              >
                Kembali
              </button>
            </div>
          </div>
        )}

        {/* QRIS */}
        {tab === "qris" && (
          <div style={s.card}>
            <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 10, color: theme.gold }}>
              📱 QRIS Pembayaran
            </p>
            <p style={{ fontSize: 12, color: theme.textMuted, marginBottom: 14 }}>
              {isPemilik
                ? "Upload QRIS untuk pembayaran non-tunai. Pelanggan bisa scan QRIS ini."
                : "Scan QRIS di bawah untuk melakukan pembayaran."}
            </p>

            {qrisUrl ? (
              <div style={{ textAlign: "center", marginBottom: 14 }}>
                <img
                  src={qrisUrl}
                  alt="QRIS"
                  style={{
                    maxWidth: "100%",
                    maxHeight: 300,
                    borderRadius: 12,
                    border: `1px solid ${theme.cardBorder}`,
                  }}
                />
                <p style={{ fontSize: 11, color: theme.textMuted, marginTop: 8 }}>
                  Scan QRIS untuk bayar
                </p>
              </div>
            ) : (
              <div
                style={{
                  textAlign: "center",
                  padding: 30,
                  background: theme.input,
                  borderRadius: 12,
                  border: `1px dashed ${theme.cardBorder}`,
                }}
              >
                <p style={{ fontSize: 14, color: theme.textMuted }}>Belum ada QRIS diupload</p>
                {isPemilik && (
                  <p style={{ fontSize: 12, color: theme.textMuted }}>
                    Upload gambar QRIS di bawah
                  </p>
                )}
              </div>
            )}

            {isPemilik && (
              <div style={{ marginTop: 10 }}>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleQrisUpload}
                  style={{ display: "none" }}
                />
                <button
                  onClick={triggerQrisUpload}
                  disabled={uploadingQris}
                  style={{ ...s.btnSm, width: "100%", background: theme.gold }}
                >
                  {uploadingQris ? "Uploading..." : "📤 Upload QRIS"}
                </button>
                {qrisUrl && (
                  <button
                    onClick={() => {
                      if (confirm("Hapus QRIS ini?")) {
                        setQrisUrl("");
                        api(
                          `/rest/v1/kafe?id=eq.${kafe?.id}`,
                          "PATCH",
                          { qris_url: "" },
                          token
                        );
                        setSuccess("QRIS dihapus!");
                      }
                    }}
                    style={{
                      ...s.btnSm,
                      width: "100%",
                      background: theme.danger,
                      marginTop: 8,
                    }}
                  >
                    🗑️ Hapus QRIS
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ===== MODAL: TRANSAKSI ===== */}
      {showAdd && !isSuperAdmin && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            alignItems: "flex-end",
            zIndex: 50,
          }}
          onClick={() => setShowAdd(false)}
        >
          <div
            style={{
              background: theme.card,
              backdropFilter: theme.blur,
              WebkitBackdropFilter: theme.blur,
              borderRadius: "20px 20px 0 0",
              padding: 24,
              width: "100%",
              maxWidth: 500,
              margin: "0 auto",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <p style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: theme.text }}>
              {editTransaksiId ? "Edit Transaksi" : "Tambah Transaksi"}
            </p>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {["masuk", "keluar"].map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setAddType(t);
                    setPesananItems([]);
                    setAddForm({ item: "", qty: "1", total: "", kategori_id: "", menu_id: "" });
                  }}
                  style={{
                    flex: 1,
                    padding: 12,
                    borderRadius: 12,
                    border: "none",
                    background:
                      addType === t
                        ? t === "masuk"
                          ? darkMode
                            ? "#1A2A1A"
                            : "#E8F5E9"
                          : darkMode
                          ? "#2A1A1A"
                          : "#FFEBEE"
                        : theme.input,
                    color:
                      addType === t
                        ? t === "masuk"
                          ? theme.success
                          : theme.danger
                        : theme.textMuted,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {t === "masuk" ? "💰 Pemasukan" : "🧾 Pengeluaran"}
                </button>
              ))}
            </div>

            {addType === "masuk" ? (
              <>
                <label style={s.label}>Kategori Menu</label>
                <select
                  style={s.input}
                  value={addForm.kategori_id}
                  onChange={(e) =>
                    setAddForm({ ...addForm, kategori_id: e.target.value, menu_id: "" })
                  }
                >
                  <option value="">-- Pilih Kategori --</option>
                  {kategori.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.nama}
                    </option>
                  ))}
                </select>
                <label style={s.label}>Pilih Menu</label>
                <select
                  style={s.input}
                  value={addForm.menu_id}
                  onChange={(e) => {
                    const selected = menu.find((m) => m.id === e.target.value);
                    if (selected) {
                      setAddForm({
                        ...addForm,
                        menu_id: selected.id,
                        item: selected.nama,
                        total: String(selected.harga),
                      });
                    } else {
                      setAddForm({ ...addForm, menu_id: "", item: "", total: "" });
                    }
                  }}
                >
                  <option value="">-- Pilih Menu --</option>
                  {menu
                    .filter((m) => m.kategori_id === addForm.kategori_id || !addForm.kategori_id)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nama} - {fmt(m.harga)} (stok: {m.stok || 0})
                      </option>
                    ))}
                </select>
              </>
            ) : (
              <>
                <label style={s.label}>Nama Barang</label>
                <input
                  style={s.input}
                  placeholder="cth: Gula, Kopi, Susu..."
                  value={addForm.item}
                  onChange={(e) => setAddForm({ ...addForm, item: e.target.value })}
                />
                <label style={s.label}>Total (Rp)</label>
                <input
                  style={s.input}
                  type="number"
                  placeholder="100000"
                  value={addForm.total}
                  onChange={(e) => setAddForm({ ...addForm, total: e.target.value })}
                />
              </>
            )}

            <label style={s.label}>Jumlah</label>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <button
                onClick={() =>
                  setAddForm({
                    ...addForm,
                    qty: String(Math.max(1, (parseInt(addForm.qty) || 1) - 1)),
                  })
                }
                style={{ ...s.btnSm, width: 40, padding: 8 }}
              >
                −
              </button>
              <input
                style={{ ...s.input, textAlign: "center", marginBottom: 0 }}
                type="number"
                value={addForm.qty}
                onChange={(e) => setAddForm({ ...addForm, qty: e.target.value })}
              />
              <button
                onClick={() =>
                  setAddForm({ ...addForm, qty: String((parseInt(addForm.qty) || 0) + 1) })
                }
                style={{ ...s.btnSm, width: 40, padding: 8 }}
              >
                +
              </button>
              <button onClick={tambahItemPesanan} style={{ ...s.btnSm, flex: 1 }}>
                Tambah Item
              </button>
            </div>

            {pesananItems.length > 0 && (
              <div style={s.card}>
                <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Item Pesanan:</p>
                {pesananItems.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 13,
                      paddingBottom: 4,
                      marginBottom: 4,
                      borderBottom: `1px solid ${theme.cardBorder}`,
                    }}
                  >
                    <span>
                      {item.nama} x{item.qty}
                    </span>
                    <span>{fmt(item.total)}</span>
                    <button
                      onClick={() => hapusItemPesanan(idx)}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: theme.danger,
                        cursor: "pointer",
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <div
                  style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, marginTop: 6 }}
                >
                  <span>Subtotal</span>
                  <span>{fmt(pesananItems.reduce((sum, i) => sum + i.total, 0))}</span>
                </div>
              </div>
            )}

            {addType === "masuk" && (
              <div className="kl-tax-panel" style={{ marginBottom: 14, padding: 14, borderRadius: 16, border: "1px solid " + theme.cardBorder, background: theme.input }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: theme.text }}>Pajak penjualan</div>
                    <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 3 }}>Pengaturan kafe · berlaku untuk semua perangkat setelah disimpan</div>
                  </div>
                  <button
                    type="button"
                    aria-pressed={pajakEnabled}
                    disabled={profile?.role !== "pemilik"}
                    onClick={() => setPajakEnabled(!pajakEnabled)}
                    style={{ ...s.btnSm, minWidth: 96, padding: "9px 14px", background: pajakEnabled ? theme.success : theme.textMuted, color: "#fff" }}
                  >
                    {pajakEnabled ? "✓ Aktif" : "Nonaktif"}
                  </button>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                  <label htmlFor="kl-tax-rate" style={{ ...s.label, margin: 0, fontSize: 12 }}>Tarif pajak (%)</label>
                  <input
                    id="kl-tax-rate"
                    aria-label="Tarif pajak dalam persen"
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={persentasePajak}
                    disabled={profile?.role !== "pemilik"}
                    onChange={(e) => setPersentasePajak(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                    style={{ ...s.input, width: 100, margin: 0, minHeight: 42, fontWeight: 700 }}
                  />
                </div>
                {profile?.role === "pemilik" && (
                  <button type="button" onClick={handleSaveTaxSettings} disabled={taxSaving} style={{ ...s.btnSm, width: "100%", marginTop: 12, padding: "10px 14px", background: theme.gold, color: "#fff" }}>
                    {taxSaving ? "Menyimpan…" : "Simpan pengaturan pajak"}
                  </button>
                )}
                <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: theme.card, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                  <div style={{ fontSize: 12, color: theme.textMuted }}>Contoh dari subtotal Rp50.000</div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 12, color: theme.textMuted }}>Pajak {pajakEnabled ? String(persentasePajak) + "%" : "nonaktif"}</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: theme.text }}>{fmt(pajakEnabled ? Math.round(50000 * persentasePajak / 100) : 0)}</div>
                    <div style={{ fontSize: 11, color: theme.textMuted }}>Total {fmt(50000 + (pajakEnabled ? Math.round(50000 * persentasePajak / 100) : 0))}</div>
                  </div>
                </div>
              </div>
            )}

            <button
              style={{
                ...s.btn,
                background:
                  addType === "masuk"
                    ? darkMode
                      ? "#128C4A"
                      : "#128C4A"
                    : darkMode
                    ? "#5A2D2D"
                    : "#C62828",
                color: "#fff",
              }}
              onClick={handleTambahTransaksi}
              disabled={loading}
            >
              {loading ? "Menyimpan..." : editTransaksiId ? "Update" : "Simpan Transaksi"}
            </button>
          </div>
        </div>
      )}

      {/* ===== MODAL: MENU ===== */}
      {showAddMenu && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            alignItems: "flex-end",
            zIndex: 50,
          }}
          onClick={() => setShowAddMenu(false)}
        >
          <div
            style={{
              background: theme.card,
              backdropFilter: theme.blur,
              WebkitBackdropFilter: theme.blur,
              borderRadius: "20px 20px 0 0",
              padding: 24,
              width: "100%",
              maxWidth: 500,
              margin: "0 auto",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <p style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: theme.text }}>
              {editMenuId ? "Edit Menu" : "Tambah Menu"}
            </p>
            <label style={s.label}>Nama Menu</label>
            <input
              style={s.input}
              placeholder="cth: Cappuccino"
              value={menuForm.nama}
              onChange={(e) => setMenuForm({ ...menuForm, nama: e.target.value })}
            />
            <label style={s.label}>Kategori</label>
            <select
              style={s.input}
              value={menuForm.kategori_id}
              onChange={(e) => setMenuForm({ ...menuForm, kategori_id: e.target.value })}
            >
              <option value="">-- Pilih Kategori --</option>
              {kategori.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.nama}
                </option>
              ))}
            </select>
            <label style={s.label}>Harga Jual (Rp)</label>
            <input
              style={s.input}
              type="number"
              placeholder="45000"
              value={menuForm.harga}
              onChange={(e) => setMenuForm({ ...menuForm, harga: e.target.value })}
            />
            <label style={s.label}>HPP (Rp)</label>
            <input
              style={s.input}
              type="number"
              placeholder="15000"
              value={menuForm.hpp}
              onChange={(e) => setMenuForm({ ...menuForm, hpp: e.target.value })}
            />
            <label style={s.label}>Stok Awal</label>
            <input
              style={s.input}
              type="number"
              placeholder="50"
              value={menuForm.stok}
              onChange={(e) => setMenuForm({ ...menuForm, stok: e.target.value })}
            />
            <label style={s.label}>Jumlah Tambahan</label>
            <input
              style={s.input}
              type="number"
              placeholder="0"
              value={menuForm.qty}
              onChange={(e) => setMenuForm({ ...menuForm, qty: e.target.value })}
            />
            <p style={{ fontSize: 11, color: theme.textMuted, marginTop: -6, marginBottom: 10 }}>
              Jumlah ini akan ditambahkan ke stok awal
            </p>
            <label style={s.label}>Upload Foto</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setMenuFile(e.target.files[0])}
              style={{ marginBottom: 10 }}
            />
            {menuForm.foto && (
              <img
                src={menuForm.foto}
                alt="preview"
                style={{ maxWidth: "100%", maxHeight: 100, borderRadius: 8, marginBottom: 10 }}
              />
            )}
            <label style={s.label}>URL Foto (opsional)</label>
            <input
              style={s.input}
              placeholder="https://..."
              value={menuForm.foto}
              onChange={(e) => setMenuForm({ ...menuForm, foto: e.target.value })}
            />
            <button style={s.btn} onClick={handleTambahMenu} disabled={loading}>
              {loading ? "Menyimpan..." : editMenuId ? "Update" : "Simpan"}
            </button>
          </div>
        </div>
      )}

      {/* ===== MODAL: KATEGORI ===== */}
      {showAddKategori && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            alignItems: "flex-end",
            zIndex: 50,
          }}
          onClick={() => setShowAddKategori(false)}
        >
          <div
            style={{
              background: theme.card,
              backdropFilter: theme.blur,
              WebkitBackdropFilter: theme.blur,
              borderRadius: "20px 20px 0 0",
              padding: 24,
              width: "100%",
              maxWidth: 500,
              margin: "0 auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <p style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: theme.text }}>
              {editKategoriId ? "Edit Kategori" : "Tambah Kategori"}
            </p>
            <label style={s.label}>Nama Kategori</label>
            <input
              style={s.input}
              placeholder="cth: Minuman"
              value={kategoriForm.nama}
              onChange={(e) => setKategoriForm({ ...kategoriForm, nama: e.target.value })}
            />
            <button style={s.btn} onClick={handleTambahKategori} disabled={loading}>
              {loading ? "Menyimpan..." : editKategoriId ? "Update" : "Simpan"}
            </button>
          </div>
        </div>
      )}

      {/* ===== MODAL: KARYAWAN ===== */}
      {showAddKaryawan && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            alignItems: "flex-end",
            zIndex: 50,
          }}
          onClick={() => setShowAddKaryawan(false)}
        >
          <div
            style={{
              background: theme.card,
              backdropFilter: theme.blur,
              WebkitBackdropFilter: theme.blur,
              borderRadius: "20px 20px 0 0",
              padding: 24,
              width: "100%",
              maxWidth: 500,
              margin: "0 auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <p style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: theme.text }}>
              {editKaryawanId ? "Edit Karyawan" : "Tambah Karyawan"}
            </p>
            <label style={s.label}>Nama Lengkap</label>
            <input
              style={s.input}
              placeholder="Nama karyawan"
              value={karyawanForm.nama}
              onChange={(e) => setKaryawanForm({ ...karyawanForm, nama: e.target.value })}
            />
            {!editKaryawanId && (
              <>
                <label style={s.label}>Email</label>
                <input
                  style={s.input}
                  type="email"
                  placeholder="email@karyawan.com"
                  value={karyawanForm.email}
                  onChange={(e) => setKaryawanForm({ ...karyawanForm, email: e.target.value })}
                />
                <label style={s.label}>Password</label>
                <input
                  style={s.input}
                  type="password"
                  placeholder="Min. 6 karakter"
                  value={karyawanForm.password}
                  onChange={(e) => setKaryawanForm({ ...karyawanForm, password: e.target.value })}
                />
              </>
            )}
            <button style={s.btn} onClick={handleTambahKaryawan} disabled={loading}>
              {loading ? "Menyimpan..." : editKaryawanId ? "Update" : "Tambah"}
            </button>
          </div>
        </div>
      )}

      {/* ===== MODAL: STOK ===== */}
      {showStok && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            alignItems: "flex-end",
            zIndex: 50,
          }}
          onClick={() => setShowStok(false)}
        >
          <div
            style={{
              background: theme.card,
              backdropFilter: theme.blur,
              WebkitBackdropFilter: theme.blur,
              borderRadius: "20px 20px 0 0",
              padding: 24,
              width: "100%",
              maxWidth: 500,
              margin: "0 auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <p style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: theme.text }}>
              Kelola Stok
            </p>
            <label style={s.label}>Pilih Menu</label>
            <select
              style={s.input}
              value={stokForm.menu_id}
              onChange={(e) => setStokForm({ ...stokForm, menu_id: e.target.value })}
            >
              <option value="">-- Pilih Menu --</option>
              {menu.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nama} (stok: {m.stok || 0})
                </option>
              ))}
            </select>
            <label style={s.label}>Stok Baru</label>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                onClick={() =>
                  setStokForm({
                    ...stokForm,
                    stok: String(Math.max(0, (parseInt(stokForm.stok) || 0) - 1)),
                  })
                }
                style={{ ...s.btnSm, width: 40, padding: 8 }}
              >
                −
              </button>
              <input
                style={{ ...s.input, textAlign: "center", marginBottom: 0 }}
                type="number"
                placeholder="0"
                value={stokForm.stok}
                onChange={(e) => setStokForm({ ...stokForm, stok: e.target.value })}
              />
              <button
                onClick={() =>
                  setStokForm({ ...stokForm, stok: String((parseInt(stokForm.stok) || 0) + 1) })
                }
                style={{ ...s.btnSm, width: 40, padding: 8 }}
              >
                +
              </button>
            </div>
            <button style={s.btn} onClick={handleUpdateStok} disabled={loading}>
              {loading ? "Menyimpan..." : "Update Stok"}
            </button>
          </div>
        </div>
      )}

      {/* ===== MODAL: GANTI PASSWORD ===== */}
      {showGantiPassword && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            alignItems: "flex-end",
            zIndex: 60,
          }}
          onClick={() => setShowGantiPassword(false)}
        >
          <div
            style={{
              background: theme.card,
              backdropFilter: theme.blur,
              WebkitBackdropFilter: theme.blur,
              borderRadius: "20px 20px 0 0",
              padding: 24,
              width: "100%",
              maxWidth: 500,
              margin: "0 auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <p style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: theme.text }}>
              Ganti Password
            </p>
            <label style={s.label}>Password Lama</label>
            <input
              style={s.input}
              type="password"
              placeholder="Password lama"
              value={gantiPasswordForm.oldPassword}
              onChange={(e) =>
                setGantiPasswordForm({ ...gantiPasswordForm, oldPassword: e.target.value })
              }
            />
            <label style={s.label}>Password Baru</label>
            <input
              style={s.input}
              type="password"
              placeholder="Min. 6 karakter"
              value={gantiPasswordForm.newPassword}
              onChange={(e) =>
                setGantiPasswordForm({ ...gantiPasswordForm, newPassword: e.target.value })
              }
            />
            <label style={s.label}>Konfirmasi Password</label>
            <input
              style={s.input}
              type="password"
              placeholder="Ulangi password baru"
              value={gantiPasswordForm.confirmPassword}
              onChange={(e) =>
                setGantiPasswordForm({ ...gantiPasswordForm, confirmPassword: e.target.value })
              }
            />
            <button style={s.btn} onClick={handleGantiPassword} disabled={loading}>
              {loading ? "Menyimpan..." : "Ganti Password"}
            </button>
            <button
              onClick={() => {
                setShowGantiPassword(false);
                setGantiPasswordForm({ oldPassword: "", newPassword: "", confirmPassword: "" });
              }}
              style={{
                ...s.btn,
                background: theme.card,
                border: `1px solid ${theme.cardBorder}`,
                color: theme.text,
                marginTop: 8,
              }}
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {/* ===== MODAL: ABSENSI ===== */}
      {showAbsensi && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            alignItems: "flex-end",
            zIndex: 50,
          }}
          onClick={() => setShowAbsensi(false)}
        >
          <div
            style={{
              background: theme.card,
              backdropFilter: theme.blur,
              WebkitBackdropFilter: theme.blur,
              borderRadius: "20px 20px 0 0",
              padding: 24,
              width: "100%",
              maxWidth: 500,
              margin: "0 auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <p style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: theme.text }}>
              Absensi Pegawai
            </p>
            <label style={s.label}>Pegawai</label>
            <select
              style={s.input}
              value={absensiForm.pegawai_id}
              onChange={(e) => setAbsensiForm({ ...absensiForm, pegawai_id: e.target.value })}
            >
              <option value="">-- Pilih Pegawai --</option>
              {karyawan.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.nama}
                </option>
              ))}
            </select>
            <button style={s.btn} onClick={handleAbsenMasuk} disabled={loading}>
              {loading ? "Menyimpan..." : "Absen Masuk"}
            </button>
          </div>
        </div>
      )}

      {/* ===== MODAL: KASIR ===== */}
      {showKasir && !isSuperAdmin && (
        <div
          className="kl-kasir-overlay"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            alignItems: "flex-end",
            zIndex: 50,
          }}
          onClick={() => {
            setShowKasir(false);
            setLastReceipt(null);
          }}
        >
          <div
            style={{
              background: theme.card,
              backdropFilter: theme.blur,
              WebkitBackdropFilter: theme.blur,
              borderRadius: "20px 20px 0 0",
              padding: 24,
              width: "100%",
              maxWidth: 500,
              margin: "0 auto",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {lastReceipt ? (
              <>
                <p
                  style={{
                    margin: "0 0 12px",
                    fontSize: 16,
                    fontWeight: 700,
                    color: theme.success,
                    textAlign: "center",
                  }}
                >
                  ✅ Transaksi Berhasil
                </p>
                <div
                  style={{
                    background: theme.input,
                    borderRadius: 12,
                    padding: 14,
                    marginBottom: 14,
                    fontSize: 13,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Subtotal</span>
                    <span>{fmt(lastReceipt.subtotal)}</span>
                  </div>
                  {lastReceipt.pajak > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Pajak ({lastReceipt.pajakPersen}%)</span>
                      <span>{fmt(lastReceipt.pajak)}</span>
                    </div>
                  )}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontWeight: 700,
                      borderTop: `1px solid ${theme.cardBorder}`,
                      marginTop: 6,
                      paddingTop: 6,
                    }}
                  >
                    <span>TOTAL BIAYA</span>
                    <span>{fmt(lastReceipt.total)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                    <span>Bayar ({lastReceipt.metode})</span>
                    <span>{fmt(lastReceipt.bayar)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Kembalian</span>
                    <span>{fmt(lastReceipt.kembalian)}</span>
                  </div>
                </div>
                <button
                  onClick={() => printReceipt(lastReceipt)}
                  style={{ ...s.btn, marginBottom: 8 }}
                >
                  🖨️ Cetak Struk
                </button>
                <button
                  onClick={() => {
                    setLastReceipt(null);
                    setShowKasir(false);
                  }}
                  style={{
                    ...s.btn,
                    background: theme.card,
                    border: `1px solid ${theme.cardBorder}`,
                    color: theme.text,
                  }}
                >
                  Tutup
                </button>
              </>
            ) : (
              <>
                <p style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: theme.text }}>
                  🛒 Keranjang Kasir
                </p>
                {keranjang.length === 0 && (
                  <p style={{ color: theme.textMuted, fontSize: 13 }}>Keranjang kosong.</p>
                )}
                {keranjang.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      paddingBottom: 8,
                      marginBottom: 8,
                      borderBottom: `1px solid ${theme.cardBorder}`,
                    }}
                  >
                    <div>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{item.nama}</p>
                      <p style={{ margin: 0, fontSize: 11, color: theme.textMuted }}>
                        {fmt(item.harga)} x {item.qty}
                      </p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: theme.gold }}>
                        {fmt(item.harga * item.qty)}
                      </p>
                      <button
                        onClick={() => kurangiDariKeranjang(item.id)}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: theme.textMuted,
                          cursor: "pointer",
                          fontSize: 16,
                        }}
                      >
                        ➖
                      </button>
                      <button
                        onClick={() => hapusDariKeranjang(item.id)}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: theme.danger,
                          cursor: "pointer",
                          fontSize: 14,
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
                {keranjang.length > 0 && (
                  <>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "12px 0",
                        borderTop: `2px solid ${theme.cardBorder}`,
                      }}
                    >
                      <p style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Subtotal</p>
                      <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: theme.gold }}>
                        {fmt(totalKeranjang)}
                      </p>
                    </div>
                    <div style={{ padding: "10px 0", borderTop: `1px solid ${theme.cardBorder}`, marginTop: 4 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>Pajak transaksi</div>
                          <div style={{ fontSize: 11, color: theme.textMuted }}>
                            {pajakCheckoutEnabled ? `Pajak ${persentasePajak}% untuk transaksi ini` : "Tidak ada pajak untuk transaksi ini"}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                          <button
                            type="button"
                            onClick={() => setPajakCheckoutEnabled(false)}
                            aria-pressed={!pajakCheckoutEnabled}
                            style={{ padding: "7px 10px", borderRadius: 9, border: `1px solid ${!pajakCheckoutEnabled ? theme.gold : theme.cardBorder}`, background: !pajakCheckoutEnabled ? theme.gold : theme.input, color: !pajakCheckoutEnabled ? (darkMode ? "#fff" : "#18251D") : theme.textMuted, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                          >Tanpa pajak</button>
                          <button
                            type="button"
                            onClick={() => setPajakCheckoutEnabled(true)}
                            aria-pressed={pajakCheckoutEnabled}
                            style={{ padding: "7px 10px", borderRadius: 9, border: `1px solid ${pajakCheckoutEnabled ? theme.gold : theme.cardBorder}`, background: pajakCheckoutEnabled ? theme.gold : theme.input, color: pajakCheckoutEnabled ? (darkMode ? "#fff" : "#18251D") : theme.textMuted, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                          >Pakai pajak</button>
                        </div>
                      </div>
                      {pajakCheckoutEnabled && (
                        <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13 }}>
                          <span>Pajak {persentasePajak}%</span>
                          <span>{fmt(Math.round((totalKeranjang * persentasePajak) / 100))}</span>
                        </div>
                      )}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "12px 0",
                        borderTop: `1px solid ${theme.cardBorder}`,
                      }}
                    >
                      <p style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>TOTAL BIAYA</p>
                      <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: theme.gold }}>
                        {fmt(
                          totalKeranjang +
                            (pajakCheckoutEnabled ? Math.round((totalKeranjang * persentasePajak) / 100) : 0)
                        )}
                      </p>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8, marginBottom: 14 }}>
                      {["tunai", "qris", "split", "piutang"].map((p) => (
                        <button
                          key={p}
                          onClick={() => setPembayaran(p)}
                          style={{
                            flex: 1,
                            padding: 12,
                            borderRadius: 12,
                            border: "none",
                            background: pembayaran === p ? theme.gold : theme.input,
                            color:
                              pembayaran === p
                                ? darkMode
                                  ? "#fff"
                                  : "#18251D"
                                : theme.textMuted,
                            fontWeight: pembayaran === p ? 700 : 400,
                            cursor: "pointer",
                          }}
                        >
                          {p === "tunai" ? "💵 Tunai" : p === "qris" ? "📱 QRIS" : p === "split" ? "💳 Tunai + QRIS" : "📝 Piutang"}
                        </button>
                      ))}
                    </div>
                    {pembayaran === "split" && (
                      <div style={{ marginBottom: 10, padding: 12, borderRadius: 12, background: theme.input, border: "1px solid " + theme.cardBorder }}>
                        <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Bagian dibayar tunai</label>
                        <input style={{ ...s.input, marginBottom: 8 }} type="number" min="1" max={Math.max(1, totalKeranjang - 1)} placeholder="Masukkan nominal tunai" value={splitTunaiAmount} onChange={(e) => setSplitTunaiAmount(e.target.value)} />
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12 }}><span style={{ color: theme.textMuted }}>Sisa dibayar QRIS</span><strong>{fmt(Math.max(0, totalKeranjang + (pajakEnabled ? Math.round(totalKeranjang * persentasePajak / 100) : 0) - (parseInt(splitTunaiAmount, 10) || 0)))}</strong></div>
                        <p style={{ margin: "6px 0 0", fontSize: 11, color: theme.textMuted }}>Pastikan pembayaran QRIS sudah diterima sebelum menekan Bayar.</p>
                      </div>
                    )}
                    {pembayaran === "qris" && <div style={{ marginBottom: 10, padding: 12, borderRadius: 12, background: theme.input, fontSize: 12, color: theme.textMuted }}>Konfirmasi bahwa pembayaran QRIS sudah diterima pelanggan. Aplikasi tidak memverifikasi pembayaran otomatis.</div>}
                    {pembayaran === "tunai" && (
                      <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center" }}>
                        <input
                          style={{ ...s.input, flex: 1, marginBottom: 0 }}
                          type="number"
                          placeholder="Jumlah bayar"
                          value={bayarAmount}
                          onChange={(e) => setBayarAmount(e.target.value)}
                        />
                        <span style={{ display: "flex", alignItems: "center", color: theme.textMuted, fontSize: 12 }}>
                          Kembali:{" "}
                          {bayarAmount
                            ? fmt(
                                parseInt(bayarAmount) -
                                  (totalKeranjang +
                                    (pajakEnabled
                                      ? Math.round((totalKeranjang * persentasePajak) / 100)
                                      : 0))
                              )
                            : fmt(0)}
                        </span>
                      </div>
                    )}
                    <button style={s.btn} onClick={handleCheckout} disabled={loading}>
                      {loading ? "Memproses..." : "✅ Bayar"}
                    </button>
                  </>
                )}
                <button
                  onClick={() => setShowKasir(false)}
                  style={{
                    ...s.btn,
                    background: theme.card,
                    border: `1px solid ${theme.cardBorder}`,
                    color: theme.text,
                    marginTop: 8,
                  }}
                >
                  Tutup
                </button>
              </>
            )}
          </div>
        </div>
      )}



      {tab === "printer" && (
        <div className="kl-printer-settings" style={{ maxWidth: 760, margin: "0 auto", width: "100%" }}>
          <div style={s.card}>
            <div style={{ fontSize: 19, fontWeight: 800, color: theme.text, marginBottom: 4 }}>🖨️ Pengaturan Printer</div>
            <p style={{ color: theme.textMuted, fontSize: 13, lineHeight: 1.5, marginTop: 0 }}>
              Pilih koneksi printer, lalu cetak struk uji.
            </p>
            <div style={{ border: "1px solid " + theme.cardBorder, borderRadius: 12, padding: 14, margin: "14px 0", background: theme.input }}>
              <div style={{ border: "1px solid " + theme.cardBorder, borderRadius: 10, padding: 12, margin: "0 0 12px", background: theme.card }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: theme.text, marginBottom: 6 }}>🔌 Hubungkan ke Printer</div>
              <p style={{ color: theme.textMuted, fontSize: 13, lineHeight: 1.5, margin: "0 0 10px" }}>
                Nyalakan printer, pilih koneksi, lalu tekan <b>Cetak Tes Printer</b>.
              </p>
              <button style={{ ...s.btn, width: "100%", minHeight: 48, background: "#16803D", color: "#fff", fontWeight: 800 }} onClick={async () => {
                if (!navigator.bluetooth || !navigator.bluetooth.requestDevice) {
                  alert("Browser ini belum mendukung koneksi printer Bluetooth langsung. Coba Google Chrome terbaru di Android. Printer Bluetooth klasik (SPP) umumnya perlu aplikasi Android penghubung; website hanya bisa mencoba printer Bluetooth BLE yang kompatibel.");
                  return;
                }
                try {
                  const device = await navigator.bluetooth.requestDevice({
                    acceptAllDevices: true,
                    optionalServices: [
                      "000018f0-0000-1000-8000-00805f9b34fb",
                      "0000ffe0-0000-1000-8000-00805f9b34fb",
                      "0000ae30-0000-1000-8000-00805f9b34fb",
                      "0000ff00-0000-1000-8000-00805f9b34fb",
                      "0000ff10-0000-1000-8000-00805f9b34fb",
                      "0000fff0-0000-1000-8000-00805f9b34fb",
                      "6e400001-b5a3-f393-e0a9-e50e24dcca9e",
                      "49535343-fe7d-4ae5-8fa9-9fafd205e455"
                    ]
                  });
                  if (!device.gatt) throw new Error("Perangkat ini tidak menyediakan koneksi Bluetooth BLE yang didukung browser.");
                  const server = await device.gatt.connect();
                  let writable = null;
                  const serviceIds = [
                    "000018f0-0000-1000-8000-00805f9b34fb",
                    "0000ffe0-0000-1000-8000-00805f9b34fb",
                    "0000ae30-0000-1000-8000-00805f9b34fb",
                    "0000ff00-0000-1000-8000-00805f9b34fb",
                    "0000ff10-0000-1000-8000-00805f9b34fb",
                    "0000fff0-0000-1000-8000-00805f9b34fb",
                    "6e400001-b5a3-f393-e0a9-e50e24dcca9e",
                    "49535343-fe7d-4ae5-8fa9-9fafd205e455"
                  ];
                  for (const id of serviceIds) {
                    try {
                      const service = await server.getPrimaryService(id);
                      const chars = await service.getCharacteristics();
                      writable = chars.find(c => c.properties.writeWithoutResponse) || chars.find(c => c.properties.write) || null;
                      if (writable) break;
                    } catch (_) {}
                  }
                  if (!writable) {
                    try {
                      const services = await server.getPrimaryServices();
                      for (const service of services) {
                        const chars = await service.getCharacteristics();
                        writable = chars.find(c => c.properties.writeWithoutResponse) || chars.find(c => c.properties.write) || null;
                        if (writable) break;
                      }
                    } catch (_) {}
                  }
                  if (!writable) {
                    try { device.gatt.disconnect(); } catch (_) {}
                    throw new Error("Printer ditemukan, tetapi tidak ada karakteristik BLE yang bisa ditulis. Printer mungkin memakai Bluetooth klasik atau protokol khusus.");
                  }
                  window.__kopilabaUsbPrint = undefined;
                  window.__kopilabaSerialPrint = undefined;
                  window.__kopilabaActivePrint = undefined;
                  window.__kopilabaBleDevice = device;
                  window.__kopilabaBlePrint = async (data) => {
                    if (!device.gatt.connected) await device.gatt.connect();
                    const bytes = new TextEncoder().encode("\x1B@"+receiptTextForBluetooth(data)+"\n\n\x1DVA\x00");
                    const chunkSize = 180;
                    for (let i = 0; i < bytes.length; i += chunkSize) {
                      const part = bytes.slice(i, i + chunkSize);
                      if (writable.properties.writeWithoutResponse && writable.writeValueWithoutResponse) await writable.writeValueWithoutResponse(part);
                      else await writable.writeValue(part);
                    }
                    alert("Struk dikirim ke printer Bluetooth BLE. Jika kertas tidak keluar, printer mungkin tidak kompatibel dengan mode BLE/ESC-POS ini.");
                  };
                  window.__kopilabaActivePrint = window.__kopilabaBlePrint;
                  alert("Perangkat BLE terhubung: " + (device.name || "Bluetooth") + ". Untuk mencetak, perangkat harus menyediakan layanan BLE tulis yang kompatibel ESC/POS. Earphone hanya untuk audio, bukan printer.");
                } catch (err) {
                  alert("Belum berhasil menghubungkan printer: " + (err?.message || err) + "\\nPastikan Bluetooth aktif, printer menyala, dan gunakan Chrome Android. Jika printer sudah dipasangkan tetapi tidak muncul, kemungkinan printer memakai Bluetooth klasik (SPP) yang tidak bisa diakses langsung dari website.");
                }
              }}>
                🔵 Hubungkan Bluetooth (BLE)
              </button>
              <button style={{ ...s.btn, width: "100%", minHeight: 48, marginTop: 8, background: "#16803D", color: "#fff", fontWeight: 800 }} onClick={async () => {
                if (!navigator.serial || !navigator.serial.requestPort) {
                  alert("Bluetooth klasik/SPP tidak tersedia untuk website pada Chrome Android. Di Android gunakan printer BLE yang kompatibel atau cetak lewat layanan cetak sistem setelah printer dipasangkan. Jalur serial Bluetooth klasik tersedia pada Chrome desktop yang mendukung Web Serial.");
                  return;
                }
                let port;
                try {
                  port = await navigator.serial.requestPort();
                  await port.open({ baudRate: 9600 });
                  window.__kopilabaBlePrint = undefined;
                  window.__kopilabaUsbPrint = undefined;
                  window.__kopilabaSerialPort = port;
                  window.__kopilabaSerialPrint = async (data) => {
                    if (!port.writable) throw new Error("Port serial tidak siap menerima data.");
                    const writer = port.writable.getWriter();
                    try {
                      const bytes = new TextEncoder().encode("\x1B@" + receiptTextForBluetooth(data) + "\n\n\x1DVA\x00");
                      await writer.write(bytes);
                    } finally { writer.releaseLock(); }
                    alert("Struk dikirim melalui port serial. Jika tidak tercetak, periksa baud rate/protokol printer.");
                  };
                  window.__kopilabaActivePrint = window.__kopilabaSerialPrint;
                  alert("Port serial terhubung. Pilih printer Bluetooth SPP/serial, bukan perangkat audio seperti earphone.");
                } catch (err) {
                  try { if (port) await port.close(); } catch (_) {}
                  alert("Koneksi Bluetooth klasik/serial gagal: " + (err?.message || err) + ". Fitur ini tidak tersedia di Chrome Android; dukungannya terutama di Chrome desktop.");
                }
              }}>
                Bluetooth Klasik (desktop)
              </button>
              <button style={{ ...s.btn, width: "100%", minHeight: 48, marginTop: 8, background: "#16803D", color: "#fff", fontWeight: 800 }} onClick={async () => {
                if (!navigator.usb || !navigator.usb.requestDevice) {
                  alert("Browser ini tidak menyediakan WebUSB. Buka KopiLaba melalui Google Chrome Android versi terbaru, pastikan alamat memakai HTTPS, lalu coba lagi.");
                  return;
                }
                let device;
                try {
                  device = await navigator.usb.requestDevice({ filters: [
                    { classCode: 7 },
                    { vendorId: 0x04b8 }, { vendorId: 0x0519 }, { vendorId: 0x154f },
                    { vendorId: 0x0fe6 }, { vendorId: 0x6868 }, { vendorId: 0x0483 },
                    { vendorId: 0x0416 }, { vendorId: 0x1fc9 }, { vendorId: 0x1a86 },
                    { vendorId: 0x067b }, { vendorId: 0x20d1 }, { vendorId: 0x28e9 },
                    { vendorId: 0x0dd4 }, { vendorId: 0x0525 }
                  ] });
                  await device.open();
                  if (!device.configuration) await device.selectConfiguration(1);
                  let output = null;
                  let iface = null;
                  let alternate = null;
                  for (const itf of device.configuration.interfaces) {
                    for (const alt of itf.alternates) {
                      const ep = alt.endpoints.find(e => e.direction === "out" && e.type !== "isochronous");
                      if (ep) { iface = itf; alternate = alt; output = ep; break; }
                    }
                    if (output) break;
                  }
                  if (!output) throw new Error("Printer USB terdeteksi tetapi tidak ditemukan endpoint data keluar yang didukung.");
                  await device.claimInterface(iface.interfaceNumber);
                  if (alternate.alternateSetting !== 0) {
                    try { await device.selectAlternateInterface(iface.interfaceNumber, alternate.alternateSetting); } catch (_) {}
                  }
                  window.__kopilabaBlePrint = undefined;
                  window.__kopilabaSerialPrint = undefined;
                  window.__kopilabaActivePrint = undefined;
                  window.__kopilabaUsbDevice = device;
                  window.__kopilabaUsbPrint = async (data) => {
                    if (!device.opened) await device.open();
                    const bytes = new TextEncoder().encode("\x1B@" + receiptTextForBluetooth(data) + "\n\n\x1DVA\x00");
                    const chunkSize = 180;
                    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
                      const result = await device.transferOut(output.endpointNumber, bytes.slice(offset, offset + chunkSize));
                      if (result.status !== "ok") throw new Error("Transfer USB gagal: " + result.status);
                    }
                    alert("Data struk telah dikirim melalui USB. Jika kertas tidak keluar, printer mungkin membutuhkan protokol/driver khusus.");
                  };
                  window.__kopilabaActivePrint = window.__kopilabaUsbPrint;
                  alert("Printer USB terhubung: " + (device.productName || "Printer USB") + ". Coba Cetak Tes Printer.");
                } catch (err) {
                  try { if (device?.opened) await device.close(); } catch (_) {}
                  alert("Belum berhasil menghubungkan printer USB: " + (err?.message || err) + "\\nPastikan printer tersambung lewat OTG, nyalakan printer, dan izinkan Chrome mengakses perangkat. Jika printer tidak muncul, kemungkinan perangkat tidak mengekspos antarmuka USB printer standar.");
                }
              }}>
                🔌 Hubungkan Printer USB
              </button>
              <button style={{ ...s.btn, width: "100%", minHeight: 46, marginTop: 8, background: "#16803D", color: "#fff", fontWeight: 800 }} onClick={() => printReceipt({
                namaKafe: (kafe?.nama || "KOPILABA").toUpperCase(),
                alamatKafe: kafe?.alamat || "",
                teleponKafe: kafe?.telepon || "",
                nomorTrx: "TES-KONEKSI-PRINTER",
                tanggal: formatDateTimeWIB(new Date()),
                kasir: profile?.nama || "Kasir",
                kasirRole: profile?.role || "",
                items: [{ nama: "Tes koneksi printer", harga: 1000, qty: 1, total: 1000 }],
                subtotal: 1000, pajak: 0, pajakPersen: 0, total: 1000, bayar: 1000,
                kembalian: 0, metode: "Tes", status: "tes"
              }, printerSettings)}>
                🧾 Cetak Tes Printer
              </button>
            </div>
            </div>
            <details style={{ marginTop: 12, border: "1px solid " + theme.cardBorder, borderRadius: 10, padding: 12 }}>
              <summary style={{ cursor: "pointer", fontWeight: 700, color: theme.text }}>Pengaturan lanjutan (opsional)</summary>
              <p style={{ color: theme.textMuted, fontSize: 12, lineHeight: 1.5 }}>Ubah hanya jika hasil cetak perlu disesuaikan.</p>
            <label style={s.label} htmlFor="kl-printer-paper">Ukuran kertas</label>
            <select id="kl-printer-paper" value={printerSettings.paper} onChange={(e) => setPrinterSettings(p => ({ ...p, paper: e.target.value }))} style={s.input}>
              <option value="auto">Ikuti pengaturan printer/perangkat (otomatis)</option>
              <option value="58">Thermal 58 mm (manual)</option>
              <option value="80">Thermal 80 mm (manual)</option>
              <option value="A4">A4 (manual)</option>
            </select>
            <label style={s.label} htmlFor="kl-printer-font">Ukuran tulisan</label>
            <select id="kl-printer-font" value={printerSettings.fontSize} onChange={(e) => setPrinterSettings(p => ({ ...p, fontSize: e.target.value }))} style={s.input}>
              <option value="compact">Kecil — hemat kertas</option>
              <option value="normal">Normal</option>
              <option value="large">Besar — mudah dibaca</option>
            </select>
            <label style={s.label} htmlFor="kl-printer-margin">Margin kertas</label>
            <select id="kl-printer-margin" value={printerSettings.margin} onChange={(e) => setPrinterSettings(p => ({ ...p, margin: e.target.value }))} style={s.input}>
              <option value="2">Sempit (2 mm)</option>
              <option value="4">Normal (4 mm)</option>
              <option value="6">Lebar (6 mm)</option>
            </select>
            <div style={{ borderTop: "1px solid " + theme.cardBorder, paddingTop: 12, marginTop: 4 }}>
              <label style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 13, marginBottom: 12, color: theme.text }}>
                <input type="checkbox" checked={printerSettings.showAddress} onChange={(e) => setPrinterSettings(p => ({ ...p, showAddress: e.target.checked }))} />
                Tampilkan alamat kafe pada struk
              </label>
              <label style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 13, marginBottom: 8, color: theme.text }}>
                <input type="checkbox" checked={printerSettings.showPhone} onChange={(e) => setPrinterSettings(p => ({ ...p, showPhone: e.target.checked }))} />
                Tampilkan nomor telepon kafe pada struk
              </label>
            </div>
            <button style={{ ...s.btn, marginTop: 8, background: theme.card, color: theme.text, border: "1px solid " + theme.cardBorder }} onClick={() => setPrinterSettings({ paper: "auto", fontSize: "normal", margin: "4", showAddress: true, showPhone: true })}>
              Kembalikan ke Pengaturan Awal
            </button>
            </details>
          </div>
        </div>
      )}
    </div>
  );
}

// Pengaturan printer diringkas; alur cetak kasir tetap dipertahankan.
