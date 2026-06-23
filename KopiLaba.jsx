import { useState, useEffect } from "react";

const SUPABASE_URL = "https://mxylkyoehzpbbsxgyhcx.supabase.co";
const SUPABASE_KEY = "sb_publishable_JSxrkF5z0bI9aJtl3eucag_OX7GN06D";

const api = async (endpoint, method = "GET", body = null, token = null) => {
  try {
    const headers = {
      "Content-Type": "application/json",
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${token || SUPABASE_KEY}`,
      "Prefer": "return=representation"
    };
    const res = await fetch(`${SUPABASE_URL}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null
    });
    if (!res.ok) {
      throw new Error(`Gagal: ${res.status} ${res.statusText}`);
    }
    return await res.json();
  } catch (error) {
    console.error("API Error:", error);
    throw error;
  }
};

const authApi = async (endpoint, body) => {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_KEY
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error_description || "Auth gagal");
    }
    return await res.json();
  } catch (error) {
    console.error("Auth Error:", error);
    throw error;
  }
};

const fmt = (n) => "Rp " + Number(n || 0).toLocaleString("id-ID");

export default function KopiLaba() {
  // ============ STATE ============
  const [screen, setScreen] = useState("login");
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [token, setToken] = useState(null);
  const [tab, setTab] = useState("dashboard");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [networkError, setNetworkError] = useState(false);
  const [darkMode, setDarkMode] = useState(true);

  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [regForm, setRegForm] = useState({ nama: "", email: "", password: "", namaKafe: "", alamatKafe: "" });

  // Data states
  const [transaksi, setTransaksi] = useState([]);
  const [menu, setMenu] = useState([]);
  const [karyawan, setKaryawan] = useState([]);
  const [kafe, setKafe] = useState(null);

  // Modal states
  const [showAdd, setShowAdd] = useState(false);
  const [addType, setAddType] = useState("masuk");
  const [addForm, setAddForm] = useState({ item: "", qty: "1", total: "" });

  const [showAddMenu, setShowAddMenu] = useState(false);
  const [menuForm, setMenuForm] = useState({ nama: "", harga: "", hpp: "", stok: "" });
  const [editMenuId, setEditMenuId] = useState(null);

  const [showAddKaryawan, setShowAddKaryawan] = useState(false);
  const [karyawanForm, setKaryawanForm] = useState({ nama: "", email: "", password: "" });
  const [editKaryawanId, setEditKaryawanId] = useState(null);

  const [showLaporan, setShowLaporan] = useState(false);
  const [filterPeriode, setFilterPeriode] = useState("hari");

  // ============ STATE BARU ============
  const [keranjang, setKeranjang] = useState([]);
  const [showKasir, setShowKasir] = useState(false);
  const [pembayaran, setPembayaran] = useState("tunai");
  const [statusFilter, setStatusFilter] = useState("semua");
  const [selectedTransaksi, setSelectedTransaksi] = useState(null);
  const [showTambahStok, setShowTambahStok] = useState(false);
  const [stokForm, setStokForm] = useState({ id: "", stok: "" });

  // ============ THEME ============
  const theme = darkMode ? {
    bg: "#0F0A06",
    card: "#1A1208",
    cardBorder: "#2A1F10",
    text: "#F5EFE6",
    textMuted: "#8B7355",
    input: "#0F0A06",
    inputBorder: "#2A1F10",
    gold: "#C8822A",
    goldLight: "#D4AF37",
    success: "#6DBF5A",
    danger: "#EF8080",
    headerBg: "#1A0F07",
  } : {
    bg: "#F8F4F0",
    card: "#FFFFFF",
    cardBorder: "#E8E0D8",
    text: "#1A1208",
    textMuted: "#6B5A4A",
    input: "#F8F4F0",
    inputBorder: "#D0C8C0",
    gold: "#B8860B",
    goldLight: "#D4AF37",
    success: "#2E7D32",
    danger: "#C62828",
    headerBg: "#F0EAE4",
  };

  const s = {
    wrap: {
      fontFamily: "'Inter',system-ui,sans-serif",
      background: theme.bg,
      minHeight: "100vh",
      color: theme.text,
      maxWidth: 430,
      margin: "0 auto",
      position: "relative",
      transition: "all 0.3s ease"
    },
    card: {
      background: theme.card,
      border: `1px solid ${theme.cardBorder}`,
      borderRadius: 16,
      padding: 18,
      marginBottom: 14,
      transition: "all 0.3s ease"
    },
    input: {
      width: "100%",
      background: theme.input,
      border: `1px solid ${theme.inputBorder}`,
      borderRadius: 12,
      padding: "12px",
      color: theme.text,
      fontSize: 14,
      boxSizing: "border-box",
      marginBottom: 10,
      transition: "all 0.3s ease"
    },
    btn: {
      width: "100%",
      padding: 16,
      borderRadius: 14,
      border: "none",
      background: theme.gold,
      color: darkMode ? "#fff" : "#1A1208",
      fontSize: 15,
      fontWeight: 700,
      cursor: "pointer",
      transition: "all 0.3s ease"
    },
    btnSm: {
      padding: "8px 16px",
      borderRadius: 10,
      border: "none",
      background: theme.gold,
      color: darkMode ? "#fff" : "#1A1208",
      fontSize: 13,
      fontWeight: 600,
      cursor: "pointer",
      transition: "all 0.3s ease"
    },
    label: {
      fontSize: 12,
      color: theme.textMuted,
      marginBottom: 4,
      display: "block",
      transition: "all 0.3s ease"
    },
  };

  // ============ EFFECTS ============
  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(""), 3000);
      return () => clearTimeout(t);
    }
  }, [success]);

  // ============ LOAD DATA ============
  const loadData = async (tok, prof) => {
    try {
      const kafeData = await api(`/rest/v1/kafe?pemilik_id=eq.${prof.id}&limit=1`, "GET", null, tok);
      const k = Array.isArray(kafeData) ? kafeData[0] : null;
      if (!k && prof.kafe_id) {
        const k2 = await api(`/rest/v1/kafe?id=eq.${prof.kafe_id}&limit=1`, "GET", null, tok);
        setKafe(Array.isArray(k2) ? k2[0] : null);
        await loadTransaksi(tok, prof.kafe_id);
        await loadMenu(tok, prof.kafe_id);
        await loadKaryawan(tok, prof.kafe_id);
      } else if (k) {
        setKafe(k);
        await loadTransaksi(tok, k.id);
        await loadMenu(tok, k.id);
        await loadKaryawan(tok, k.id);
      }
    } catch (err) {
      console.error("Load data error:", err);
      setNetworkError(true);
      setError("Gagal memuat data. Periksa koneksi.");
    }
  };

  const loadTransaksi = async (tok, kafeId) => {
    try {
      const data = await api(`/rest/v1/transaksi?kafe_id=eq.${kafeId}&order=created_at.desc&limit=50`, "GET", null, tok);
      setTransaksi(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Load transaksi error:", err);
      setTransaksi([]);
    }
  };

  const loadMenu = async (tok, kafeId) => {
    try {
      const data = await api(`/rest/v1/menu?kafe_id=eq.${kafeId}`, "GET", null, tok);
      setMenu(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Load menu error:", err);
      setMenu([]);
    }
  };

  const loadKaryawan = async (tok, kafeId) => {
    try {
      const data = await api(`/rest/v1/profiles?kafe_id=eq.${kafeId}&role=eq.barista`, "GET", null, tok);
      setKaryawan(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Load karyawan error:", err);
      setKaryawan([]);
    }
  };

  // ============ AUTH ============
  const handleLogin = async () => {
    setLoading(true);
    setError("");
    setNetworkError(false);

    try {
      const data = await authApi("/token?grant_type=password", loginForm);
      if (data.access_token) {
        const tok = data.access_token;
        const u = data.user;
        setToken(tok);
        setUser(u);
        const prof = await api(`/rest/v1/profiles?id=eq.${u.id}&limit=1`, "GET", null, tok);
        const p = Array.isArray(prof) ? prof[0] : null;
        if (p) {
          setProfile(p);
          await loadData(tok, p);
          setScreen("app");
        } else {
          setError("Profil tidak ditemukan.");
        }
      } else {
        setError(data.error_description || "Login gagal. Cek email & password.");
      }
    } catch (err) {
      console.error("Login error:", err);
      if (err.message.includes("Failed to fetch") || err.message.includes("Network")) {
        setNetworkError(true);
        setError("Koneksi internet bermasalah. Periksa jaringan Anda.");
      } else {
        setError("Terjadi kesalahan. Coba lagi.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setLoading(true);
    setError("");
    setNetworkError(false);

    if (!regForm.nama || !regForm.email || !regForm.password) {
      setError("Semua kolom wajib diisi!");
      setLoading(false);
      return;
    }
    if (!regForm.namaKafe) {
      setError("Nama kafe wajib diisi!");
      setLoading(false);
      return;
    }
    if (regForm.password.length < 6) {
      setError("Password minimal 6 karakter!");
      setLoading(false);
      return;
    }

    try {
      const data = await authApi("/signup", {
        email: regForm.email,
        password: regForm.password
      });

      if (data.user) {
        const u = data.user;
        const tok = data.access_token || SUPABASE_KEY;
        let kafeId = null;

        try {
          const k = await api("/rest/v1/kafe", "POST", {
            nama: regForm.namaKafe,
            alamat: regForm.alamatKafe,
            pemilik_id: u.id
          }, tok);
          kafeId = Array.isArray(k) ? k[0]?.id : k?.id;
        } catch (kafeErr) {
          console.error("Create kafe error:", kafeErr);
          setError("Gagal membuat kafe. Coba lagi.");
          setLoading(false);
          return;
        }

        try {
          await api("/rest/v1/profiles", "POST", {
            id: u.id,
            nama: regForm.nama,
            role: "pemilik",
            kafe_id: kafeId
          }, tok);
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
      if (err.message.includes("Failed to fetch") || err.message.includes("Network")) {
        setError("Koneksi internet bermasalah. Periksa jaringan Anda.");
      } else if (err.message.includes("email")) {
        setError("Email sudah terdaftar. Gunakan email lain.");
      } else {
        setError("Terjadi kesalahan saat pendaftaran. Coba lagi.");
      }
    } finally {
      setLoading(false);
    }
  };

  // ============ TRANSAKSI ============
  const handleTambahTransaksi = async () => {
    if (!addForm.item || !addForm.total) {
      setError("Isi semua kolom!");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const kafeId = kafe?.id || profile?.kafe_id;
      if (!kafeId) {
        setError("Kafe tidak ditemukan. Hubungi admin.");
        setLoading(false);
        return;
      }

      await api("/rest/v1/transaksi", "POST", {
        kafe_id: kafeId,
        item: addForm.item,
        qty: parseInt(addForm.qty) || 1,
        total: parseInt(addForm.total),
        tipe: addType,
        status: "lunas"
      }, token);

      setAddForm({ item: "", qty: "1", total: "" });
      setShowAdd(false);
      setSuccess("Transaksi tersimpan!");
      await loadTransaksi(token, kafeId);
    } catch (err) {
      console.error("Add transaksi error:", err);
      setError("Gagal menyimpan transaksi. Coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  // ============ MENU ============
  const handleTambahMenu = async () => {
    if (!menuForm.nama || !menuForm.harga || !menuForm.hpp) {
      setError("Isi semua kolom!");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const kafeId = kafe?.id || profile?.kafe_id;
      if (!kafeId) {
        setError("Kafe tidak ditemukan. Hubungi admin.");
        setLoading(false);
        return;
      }

      const stokValue = parseInt(menuForm.stok) || 0;

      if (editMenuId) {
        await api(`/rest/v1/menu?id=eq.${editMenuId}`, "PATCH", {
          nama: menuForm.nama,
          harga: parseInt(menuForm.harga),
          hpp: parseInt(menuForm.hpp),
          stok: stokValue
        }, token);
        setSuccess("Menu diupdate!");
      } else {
        await api("/rest/v1/menu", "POST", {
          kafe_id: kafeId,
          nama: menuForm.nama,
          harga: parseInt(menuForm.harga),
          hpp: parseInt(menuForm.hpp),
          stok: stokValue
        }, token);
        setSuccess("Menu ditambahkan!");
      }

      setMenuForm({ nama: "", harga: "", hpp: "", stok: "" });
      setEditMenuId(null);
      setShowAddMenu(false);
      await loadMenu(token, kafeId);
    } catch (err) {
      console.error("Add/edit menu error:", err);
      setError("Gagal menyimpan menu. Coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  const handleEditMenu = (item) => {
    setMenuForm({ 
      nama: item.nama, 
      harga: String(item.harga), 
      hpp: String(item.hpp),
      stok: String(item.stok || 0)
    });
    setEditMenuId(item.id);
    setShowAddMenu(true);
  };

  const handleHapusMenu = async (id) => {
    if (!confirm("Yakin hapus menu ini?")) return;
    try {
      await api(`/rest/v1/menu?id=eq.${id}`, "DELETE", null, token);
      setSuccess("Menu dihapus!");
      await loadMenu(token, kafe?.id || profile?.kafe_id);
    } catch (err) {
      setError("Gagal hapus menu.");
    }
  };

  // ============ KARYAWAN ============
  const handleTambahKaryawan = async () => {
    if (!karyawanForm.nama || !karyawanForm.email || !karyawanForm.password) {
      setError("Semua kolom wajib diisi!");
      return;
    }
    if (karyawanForm.password.length < 6) {
      setError("Password minimal 6 karakter!");
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

      if (editKaryawanId) {
        await api(`/rest/v1/profiles?id=eq.${editKaryawanId}`, "PATCH", {
          nama: karyawanForm.nama
        }, token);
        setSuccess("Karyawan diupdate!");
      } else {
        const authData = await authApi("/signup", {
          email: karyawanForm.email,
          password: karyawanForm.password
        });

        if (authData.user) {
          await api("/rest/v1/profiles", "POST", {
            id: authData.user.id,
            nama: karyawanForm.nama,
            role: "barista",
            kafe_id: kafeId
          }, token);
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
      console.error("Add/edit karyawan error:", err);
      setError("Gagal menyimpan karyawan. Coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  const handleEditKaryawan = (item) => {
    setKaryawanForm({ nama: item.nama, email: item.email || "", password: "" });
    setEditKaryawanId(item.id);
    setShowAddKaryawan(true);
  };

  const handleHapusKaryawan = async (id) => {
    if (!confirm("Yakin hapus karyawan ini?")) return;
    try {
      await api(`/rest/v1/profiles?id=eq.${id}`, "DELETE", null, token);
      setSuccess("Karyawan dihapus!");
      await loadKaryawan(token, kafe?.id || profile?.kafe_id);
    } catch (err) {
      setError("Gagal hapus karyawan.");
    }
  };

  // ============ KERANJANG & KASIR ============
  const tambahKeKeranjang = (menuItem) => {
    if (menuItem.stok !== undefined && menuItem.stok <= 0) {
      setError(`Stok ${menuItem.nama} habis!`);
      return;
    }
    setKeranjang(prev => {
      const existing = prev.find(item => item.id === menuItem.id);
      if (existing) {
        if (existing.qty >= (menuItem.stok || 999)) {
          setError(`Stok ${menuItem.nama} tidak mencukupi!`);
          return prev;
        }
        return prev.map(item =>
          item.id === menuItem.id ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [...prev, { ...menuItem, qty: 1 }];
    });
    setSuccess(`${menuItem.nama} ditambahkan!`);
  };

  const kurangiDariKeranjang = (id) => {
    setKeranjang(prev => {
      const existing = prev.find(item => item.id === id);
      if (existing && existing.qty > 1) {
        return prev.map(item =>
          item.id === id ? { ...item, qty: item.qty - 1 } : item
        );
      }
      return prev.filter(item => item.id !== id);
    });
  };

  const hapusDariKeranjang = (id) => {
    setKeranjang(prev => prev.filter(item => item.id !== id));
  };

  const totalKeranjang = keranjang.reduce((sum, item) => sum + (item.harga * item.qty), 0);

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

      const itemNames = keranjang.map(item => `${item.nama} x${item.qty}`).join(", ");
      const total = totalKeranjang;

      await api("/rest/v1/transaksi", "POST", {
        kafe_id: kafeId,
        item: itemNames,
        qty: keranjang.reduce((sum, item) => sum + item.qty, 0),
        total: total,
        tipe: "masuk",
        status: pembayaran === "tunai" ? "lunas" : "belum_lunas"
      }, token);

      // Kurangi stok
      for (const item of keranjang) {
        const newStok = (item.stok || 0) - item.qty;
        await api(`/rest/v1/menu?id=eq.${item.id}`, "PATCH", {
          stok: newStok
        }, token);
      }

      setKeranjang([]);
      setShowKasir(false);
      setSuccess("Transaksi berhasil!");
      await loadTransaksi(token, kafeId);
      await loadMenu(token, kafeId);
    } catch (err) {
      console.error("Checkout error:", err);
      setError("Gagal menyimpan transaksi. Coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  // ============ LAPORAN ============
  const getFilteredTransaksi = () => {
    const now = new Date();
    let start = new Date();
    if (filterPeriode === "hari") {
      start.setHours(0, 0, 0, 0);
    } else if (filterPeriode === "minggu") {
      start.setDate(now.getDate() - 7);
    } else if (filterPeriode === "bulan") {
      start.setMonth(now.getMonth() - 1);
    } else if (filterPeriode === "tahun") {
      start.setFullYear(now.getFullYear() - 1);
    }
    let filtered = transaksi.filter(t => new Date(t.created_at) >= start);
    
    if (statusFilter === "lunas") {
      filtered = filtered.filter(t => t.status === "lunas");
    } else if (statusFilter === "belum_lunas") {
      filtered = filtered.filter(t => t.status === "belum_lunas");
    }
    
    return filtered;
  };

  const filtered = getFilteredTransaksi();
  const totalMasuk = filtered.filter(t => t.tipe === "masuk").reduce((a, b) => a + b.total, 0);
  const totalKeluar = filtered.filter(t => t.tipe === "keluar").reduce((a, b) => a + b.total, 0);
  const laba = totalMasuk - totalKeluar;

  const totalStok = menu.reduce((sum, item) => sum + (item.stok || 0), 0);

  // ============ RENDER LOGIN ============
  if (screen === "login") return (
    <div style={s.wrap}>
      <div style={{ padding: "60px 24px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 60, marginBottom: 8 }}>☕</div>
        <h1 style={{ fontSize: 36, fontWeight: 800, marginBottom: 4, letterSpacing: 2 }}>
          <span style={{ color: theme.gold }}>KOPI</span>
          <span style={{ color: theme.text }}>LABA</span>
        </h1>
        <div style={{ width: 60, height: 3, background: theme.gold, margin: "8px auto 16px", borderRadius: 2 }}></div>
        <p style={{ color: theme.textMuted, marginBottom: 32 }}>Manajemen Keuangan Kafe Premium</p>
        {error && <div style={{ background: darkMode ? "#2A1A1A" : "#FFEBEE", border: `1px solid ${theme.danger}`, borderRadius: 12, padding: 12, marginBottom: 14, fontSize: 13, color: theme.danger }}>{error}</div>}
        {success && <div style={{ background: darkMode ? "#1A2A1A" : "#E8F5E9", border: `1px solid ${theme.success}`, borderRadius: 12, padding: 12, marginBottom: 14, fontSize: 13, color: theme.success }}>{success}</div>}
        <label style={s.label}>Email</label>
        <input style={s.input} type="email" placeholder="email@kamu.com" value={loginForm.email} onChange={e => setLoginForm({ ...loginForm, email: e.target.value })} />
        <label style={s.label}>Password</label>
        <input style={s.input} type="password" placeholder="••••••••" value={loginForm.password} onChange={e => setLoginForm({ ...loginForm, password: e.target.value })} />
        <button style={s.btn} onClick={handleLogin} disabled={loading}>{loading ? "Masuk..." : "Masuk"}</button>
        <p style={{ textAlign: "center", marginTop: 20, color: theme.textMuted, fontSize: 14 }}>
          Belum punya akun? <span style={{ color: theme.gold, cursor: "pointer", fontWeight: 600 }} onClick={() => { setScreen("register"); setError(""); }}>Daftar</span>
        </p>
        <div style={{ marginTop: 30, display: "flex", justifyContent: "center", gap: 12 }}>
          <button onClick={() => setDarkMode(true)} style={{ padding: "6px 16px", borderRadius: 20, border: darkMode ? `2px solid ${theme.gold}` : `1px solid ${theme.textMuted}`, background: "transparent", color: darkMode ? theme.gold : theme.textMuted, cursor: "pointer", fontSize: 12 }}>🌙 Dark</button>
          <button onClick={() => setDarkMode(false)} style={{ padding: "6px 16px", borderRadius: 20, border: !darkMode ? `2px solid ${theme.gold}` : `1px solid ${theme.textMuted}`, background: "transparent", color: !darkMode ? theme.gold : theme.textMuted, cursor: "pointer", fontSize: 12 }}>☀️ Light</button>
        </div>
      </div>
    </div>
  );

  // ============ RENDER REGISTER ============
  if (screen === "register") return (
    <div style={s.wrap}>
      <div style={{ padding: "50px 24px 24px" }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4, textAlign: "center" }}>
          <span style={{ color: theme.gold }}>KOPI</span>
          <span style={{ color: theme.text }}>LABA</span>
        </h2>
        <p style={{ color: theme.textMuted, marginBottom: 24, textAlign: "center" }}>Buat akun baru</p>
        {error && <div style={{ background: darkMode ? "#2A1A1A" : "#FFEBEE", border: `1px solid ${theme.danger}`, borderRadius: 12, padding: 12, marginBottom: 14, fontSize: 13, color: theme.danger }}>{error}</div>}
        <label style={s.label}>Nama Lengkap</label>
        <input style={s.input} placeholder="Nama kamu" value={regForm.nama} onChange={e => setRegForm({ ...regForm, nama: e.target.value })} />
        <label style={s.label}>Email</label>
        <input style={s.input} type="email" placeholder="email@kamu.com" value={regForm.email} onChange={e => setRegForm({ ...regForm, email: e.target.value })} />
        <label style={s.label}>Password</label>
        <input style={s.input} type="password" placeholder="Min. 6 karakter" value={regForm.password} onChange={e => setRegForm({ ...regForm, password: e.target.value })} />
        <div style={{ background: theme.card, borderRadius: 12, padding: "12px 16px", marginBottom: 10, border: `1px solid ${theme.cardBorder}` }}>
          <p style={{ margin: 0, fontSize: 14, color: theme.gold, fontWeight: 600 }}>🏠 Pemilik Kafe</p>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: theme.textMuted }}>Anda akan membuat dan mengelola kafe</p>
        </div>
        <label style={s.label}>Nama Kafe</label>
        <input style={s.input} placeholder="Nama kafe kamu" value={regForm.namaKafe} onChange={e => setRegForm({ ...regForm, namaKafe: e.target.value })} />
        <label style={s.label}>Alamat Kafe</label>
        <input style={s.input} placeholder="Alamat kafe" value={regForm.alamatKafe} onChange={e => setRegForm({ ...regForm, alamatKafe: e.target.value })} />
        <button style={s.btn} onClick={handleRegister} disabled={loading}>{loading ? "Mendaftar..." : "Daftar Sekarang"}</button>
        <p style={{ textAlign: "center", marginTop: 20, color: theme.textMuted, fontSize: 14 }}>
          Sudah punya akun? <span style={{ color: theme.gold, cursor: "pointer", fontWeight: 600 }} onClick={() => { setScreen("login"); setError(""); }}>Masuk</span>
        </p>
      </div>
    </div>
  );

  // ============ MAIN APP ============
  const tabs = [
    { id: "dashboard", icon: "⊞", label: "Ringkasan" },
    { id: "transaksi", icon: "↕", label: "Transaksi" },
    { id: "menu", icon: "☕", label: "Menu" },
    { id: "karyawan", icon: "👤", label: "Karyawan" },
    { id: "laporan", icon: "📊", label: "Laporan" },
    { id: "struk", icon: "🧾", label: "Struk" },
  ];

  return (
    <div style={s.wrap}>
      {/* HEADER */}
      <div style={{ padding: "48px 20px 16px", background: theme.headerBg, transition: "all 0.3s ease" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>
              <span style={{ color: theme.gold }}>KOPI</span>
              <span style={{ color: theme.text }}>LABA</span>
            </h1>
            <p style={{ margin: 0, fontSize: 12, color: theme.textMuted }}>{kafe?.nama || "Kafe kamu"} · {profile?.role}</p>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button onClick={() => setShowKasir(true)} style={{ background: theme.gold, border: "none", borderRadius: 10, padding: "6px 14px", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
              🛒 Kasir
            </button>
            <button onClick={() => setDarkMode(!darkMode)} style={{ background: "transparent", border: "none", fontSize: 20, cursor: "pointer" }}>
              {darkMode ? "☀️" : "🌙"}
            </button>
            <button onClick={() => { setUser(null); setToken(null); setProfile(null); setScreen("login"); }} style={{ background: theme.card, border: `1px solid ${theme.cardBorder}`, borderRadius: 10, padding: "6px 14px", color: theme.textMuted, fontSize: 12, cursor: "pointer" }}>Keluar</button>
          </div>
        </div>
      </div>

      {/* TOAST */}
      {success && <div style={{ margin: "0 20px", background: darkMode ? "#1A2A1A" : "#E8F5E9", border: `1px solid ${theme.success}`, borderRadius: 12, padding: "10px 14px", fontSize: 13, color: theme.success }}>{success}</div>}
      {error && <div style={{ margin: "0 20px", background: darkMode ? "#2A1A1A" : "#FFEBEE", border: `1px solid ${theme.danger}`, borderRadius: 12, padding: "10px 14px", fontSize: 13, color: theme.danger }} onClick={() => setError("")}>{error}</div>}
      {networkError && (
        <div style={{ margin: "0 20px 10px", background: darkMode ? "#2A1A1A" : "#FFEBEE", border: `1px solid ${theme.danger}`, borderRadius: 12, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, color: theme.danger }}>⚠️ {error || "Koneksi bermasalah"}</span>
          <button onClick={() => { setNetworkError(false); if (token && profile) loadData(token, profile); }} style={{ background: theme.gold, border: "none", borderRadius: 8, padding: "4px 12px", color: darkMode ? "#fff" : "#1A1208", fontWeight: 600, cursor: "pointer", fontSize: 12 }}>Coba Lagi</button>
        </div>
      )}

      <div style={{ padding: "14px 20px 100px" }}>

        {/* ===== DASHBOARD ===== */}
        {tab === "dashboard" && <>
          <div style={{ background: `linear-gradient(135deg,${theme.gold},${darkMode ? "#8B5A1A" : "#B8860B"})`, borderRadius: 20, padding: 24, marginBottom: 14, position: "relative", overflow: "hidden" }}>
            <p style={{ margin: "0 0 4px", fontSize: 12, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Laba Bersih</p>
            <p style={{ margin: "0 0 16px", fontSize: 30, fontWeight: 800, color: "#fff" }}>{fmt(laba)}</p>
            <div style={{ display: "flex", gap: 16 }}>
              <div><p style={{ margin: 0, fontSize: 10, color: "rgba(255,255,255,0.6)" }}>Pemasukan</p><p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#fff" }}>{fmt(totalMasuk)}</p></div>
              <div style={{ width: 1, background: "rgba(255,255,255,0.2)" }}></div>
              <div><p style={{ margin: 0, fontSize: 10, color: "rgba(255,255,255,0.6)" }}>Pengeluaran</p><p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#fff" }}>{fmt(totalKeluar)}</p></div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
            <button onClick={() => { setShowAdd(true); setAddType("masuk"); }} style={{ background: darkMode ? "#1A2A1A" : "#E8F5E9", border: `1px solid ${darkMode ? "#2A4A2A" : "#A5D6A7"}`, borderRadius: 14, padding: 16, cursor: "pointer", textAlign: "left" }}>
              <p style={{ margin: "0 0 4px", fontSize: 20 }}>💰</p>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: theme.success }}>Catat Pemasukan</p>
            </button>
            <button onClick={() => { setShowAdd(true); setAddType("keluar"); }} style={{ background: darkMode ? "#2A1A1A" : "#FFEBEE", border: `1px solid ${darkMode ? "#4A2A2A" : "#EF9A9A"}`, borderRadius: 14, padding: 16, cursor: "pointer", textAlign: "left" }}>
              <p style={{ margin: "0 0 4px", fontSize: 20 }}>🧾</p>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: theme.danger }}>Catat Pengeluaran</p>
            </button>
          </div>

          <div style={s.card}>
            <p style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 600 }}>Transaksi Terbaru</p>
            {transaksi.length === 0 && <p style={{ color: theme.textMuted, fontSize: 13 }}>Belum ada transaksi.</p>}
            {transaksi.slice(0, 5).map(t => (
              <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 10, marginBottom: 10, borderBottom: `1px solid ${theme.cardBorder}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: t.tipe === "masuk" ? (darkMode ? "#1A2A1A" : "#E8F5E9") : (darkMode ? "#2A1A1A" : "#FFEBEE"), display: "flex", alignItems: "center", justifyContent: "center", color: t.tipe === "masuk" ? theme.success : theme.danger }}>{t.tipe === "masuk" ? "↑" : "↓"}</div>
                  <div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{t.item}</p>
                    <p style={{ margin: 0, fontSize: 11, color: theme.textMuted }}>Qty {t.qty} · {t.status === "belum_lunas" ? "🔴 Piutang" : "✅ Lunas"}</p>
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: t.tipe === "masuk" ? theme.success : theme.danger }}>{t.tipe === "masuk" ? "+" : "-"}{fmt(t.total)}</p>
              </div>
            ))}
          </div>

          <div style={s.card}>
            <p style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 600 }}>📦 Stok Produk</p>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <p style={{ margin: 0, fontSize: 12, color: theme.textMuted }}>Total Stok</p>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: theme.gold }}>{totalStok} item</p>
            </div>
            {menu.filter(m => (m.stok || 0) < 5).length > 0 && (
              <div style={{ marginTop: 8, background: theme.danger, borderRadius: 8, padding: "8px 12px" }}>
                <p style={{ margin: 0, fontSize: 11, color: "#fff" }}>⚠️ {menu.filter(m => (m.stok || 0) < 5).length} menu stok menipis!</p>
              </div>
            )}
          </div>
        </>}

        {/* ===== TRANSAKSI ===== */}
        {tab === "transaksi" && <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Semua Transaksi</p>
            <button style={s.btnSm} onClick={() => setShowAdd(true)}>+ Tambah</button>
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            {["semua", "lunas", "belum_lunas"].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)} style={{ flex: 1, padding: "8px 12px", borderRadius: 10, border: "none", background: statusFilter === s ? theme.gold : theme.input, color: statusFilter === s ? (darkMode ? "#fff" : "#1A1208") : theme.textMuted, fontWeight: statusFilter === s ? 700 : 400, cursor: "pointer", fontSize: 12, textTransform: "capitalize" }}>
                {s === "semua" ? "Semua" : s === "lunas" ? "✅ Lunas" : "🔴 Piutang"}
              </button>
            ))}
          </div>
          <div style={s.card}>
            {transaksi.length === 0 && <p style={{ color: theme.textMuted, fontSize: 13 }}>Belum ada transaksi.</p>}
            {transaksi.map((t, i) => (
              <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 12, marginBottom: 12, borderBottom: i < transaksi.length - 1 ? `1px solid ${theme.cardBorder}` : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 12, background: t.tipe === "masuk" ? (darkMode ? "#1A2A1A" : "#E8F5E9") : (darkMode ? "#2A1A1A" : "#FFEBEE"), display: "flex", alignItems: "center", justifyContent: "center", color: t.tipe === "masuk" ? theme.success : theme.danger, fontSize: 16 }}>{t.tipe === "masuk" ? "↑" : "↓"}</div>
                  <div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{t.item}</p>
                    <p style={{ margin: 0, fontSize: 11, color: theme.textMuted }}>Qty {t.qty} · {new Date(t.created_at).toLocaleDateString("id-ID")} · {t.status === "belum_lunas" ? "🔴 Piutang" : "✅ Lunas"}</p>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: t.tipe === "masuk" ? theme.success : theme.danger }}>{t.tipe === "masuk" ? "+" : "-"}{fmt(t.total)}</p>
                  <button onClick={() => { setSelectedTransaksi(t); setTab("struk"); }} style={{ background: theme.gold, border: "none", borderRadius: 6, padding: "4px 8px", color: "#fff", fontSize: 10, cursor: "pointer" }}>🧾</button>
                </div>
              </div>
            ))}
          </div>
        </>}

        {/* ===== MENU ===== */}
        {tab === "menu" && <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Menu & Stok</p>
            {profile?.role === "pemilik" && <button style={s.btnSm} onClick={() => { setEditMenuId(null); setMenuForm({ nama: "", harga: "", hpp: "", stok: "" }); setShowAddMenu(true); }}>+ Tambah</button>}
          </div>
          {menu.length === 0 && <div style={s.card}><p style={{ color: theme.textMuted, fontSize: 13 }}>Belum ada menu.</p></div>}
          {menu.map(m => {
            const margin = m.harga ? (((m.harga - m.hpp) / m.harga) * 100).toFixed(1) : 0;
            const stok = m.stok || 0;
            return (
              <div key={m.id} style={s.card}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>☕ {m.nama}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: stok < 5 ? theme.danger : theme.textMuted }}>📦 Stok: {stok} {stok < 5 && "⚠️"}</p>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: theme.gold }}>{fmt(m.harga)}</p>
                    {profile?.role === "pemilik" && (
                      <>
                        <button onClick={() => handleEditMenu(m)} style={{ background: "transparent", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: 14 }}>✏️</button>
                        <button onClick={() => handleHapusMenu(m.id)} style={{ background: "transparent", border: "none", color: theme.danger, cursor: "pointer", fontSize: 14 }}>🗑️</button>
                      </>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                  <div style={{ flex: 1, background: theme.input, borderRadius: 10, padding: "8px 12px" }}>
                    <p style={{ margin: 0, fontSize: 10, color: theme.textMuted }}>HPP</p>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: theme.danger }}>{fmt(m.hpp)}</p>
                  </div>
                  <div style={{ flex: 1, background: theme.input, borderRadius: 10, padding: "8px 12px" }}>
                    <p style={{ margin: 0, fontSize: 10, color: theme.textMuted }}>Laba/cup</p>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: theme.success }}>{fmt(m.harga - m.hpp)}</p>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ flex: 1, height: 6, background: theme.input, borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: margin + "%", background: margin > 65 ? theme.success : theme.gold, borderRadius: 3 }}></div>
                  </div>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: margin > 65 ? theme.success : theme.gold }}>{margin}%</p>
                </div>
                <button onClick={() => tambahKeKeranjang(m)} style={{ ...s.btnSm, marginTop: 8, width: "100%", background: stok <= 0 ? theme.textMuted : theme.gold }} disabled={stok <= 0}>
                  {stok <= 0 ? "Stok Habis" : "🛒 Tambah ke Kasir"}
                </button>
              </div>
            );
          })}
        </>}

        {/* ===== KARYAWAN ===== */}
        {tab === "karyawan" && <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Daftar Karyawan</p>
            {profile?.role === "pemilik" && <button style={s.btnSm} onClick={() => { setEditKaryawanId(null); setKaryawanForm({ nama: "", email: "", password: "" }); setShowAddKaryawan(true); }}>+ Tambah</button>}
          </div>
          {karyawan.length === 0 && <div style={s.card}><p style={{ color: theme.textMuted, fontSize: 13 }}>Belum ada karyawan.</p></div>}
          {karyawan.map(k => (
            <div key={k.id} style={s.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{k.nama}</p>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: theme.textMuted }}>{k.email || "Barista"}</p>
                </div>
                {profile?.role === "pemilik" && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => handleEditKaryawan(k)} style={{ background: "transparent", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: 14 }}>✏️</button>
                    <button onClick={() => handleHapusKaryawan(k.id)} style={{ background: "transparent", border: "none", color: theme.danger, cursor: "pointer", fontSize: 14 }}>🗑️</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </>}

        {/* ===== LAPORAN ===== */}
        {tab === "laporan" && <>
          <div style={s.card}>
            <p style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700 }}>Laporan Keuangan</p>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {["hari", "minggu", "bulan", "tahun"].map(p => (
                <button key={p} onClick={() => setFilterPeriode(p)} style={{ flex: 1, padding: "8px 12px", borderRadius: 10, border: "none", background: filterPeriode === p ? theme.gold : theme.input, color: filterPeriode === p ? (darkMode ? "#fff" : "#1A1208") : theme.textMuted, fontWeight: filterPeriode === p ? 700 : 400, cursor: "pointer", fontSize: 12, textTransform: "capitalize" }}>
                  {p}
                </button>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ background: theme.input, borderRadius: 12, padding: 12 }}>
                <p style={{ margin: 0, fontSize: 10, color: theme.textMuted }}>Total Transaksi</p>
                <p style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{filtered.length}</p>
              </div>
              <div style={{ background: theme.input, borderRadius: 12, padding: 12 }}>
                <p style={{ margin: 0, fontSize: 10, color: theme.textMuted }}>Laba Bersih</p>
                <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: laba >= 0 ? theme.success : theme.danger }}>{fmt(laba)}</p>
              </div>
              <div style={{ background: theme.input, borderRadius: 12, padding: 12 }}>
                <p style={{ margin: 0, fontSize: 10, color: theme.textMuted }}>Total Pemasukan</p>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: theme.success }}>{fmt(totalMasuk)}</p>
              </div>
              <div style={{ background: theme.input, borderRadius: 12, padding: 12 }}>
                <p style={{ margin: 0, fontSize: 10, color: theme.textMuted }}>Total Pengeluaran</p>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: theme.danger }}>{fmt(totalKeluar)}</p>
              </div>
            </div>
          </div>
          <div style={s.card}>
            <p style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 600 }}>Detail Transaksi</p>
            {filtered.length === 0 && <p style={{ color: theme.textMuted, fontSize: 13 }}>Tidak ada transaksi di periode ini.</p>}
            {filtered.slice(0, 10).map(t => (
              <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 8, marginBottom: 8, borderBottom: `1px solid ${theme.cardBorder}` }}>
                <div>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>{t.item}</p>
                  <p style={{ margin: 0, fontSize: 10, color: theme.textMuted }}>{new Date(t.created_at).toLocaleDateString("id-ID")} · {t.status === "belum_lunas" ? "🔴 Piutang" : "✅ Lunas"}</p>
                </div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: t.tipe === "masuk" ? theme.success : theme.danger }}>{t.tipe === "masuk" ? "+" : "-"}{fmt(t.total)}</p>
              </div>
            ))}
          </div>
        </>}

        {/* ===== STRUK ===== */}
        {tab === "struk" && (
          <div style={s.card}>
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: theme.gold }}>☕ KOPI LABA</h2>
              <p style={{ margin: 0, fontSize: 11, color: theme.textMuted }}>{kafe?.nama || "Kafe Kamu"}</p>
              <p style={{ margin: 0, fontSize: 10, color: theme.textMuted }}>{kafe?.alamat || ""}</p>
              <div style={{ width: "100%", height: 1, background: theme.cardBorder, margin: "10px 0" }}></div>
            </div>

            {selectedTransaksi ? (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, fontSize: 12, marginBottom: 12 }}>
                  <p style={{ margin: 0, color: theme.textMuted }}>No. Transaksi</p>
                  <p style={{ margin: 0, fontWeight: 600, textAlign: "right" }}>{selectedTransaksi.id?.slice(0, 12) || "N/A"}</p>
                  <p style={{ margin: 0, color: theme.textMuted }}>Tanggal</p>
                  <p style={{ margin: 0, fontWeight: 600, textAlign: "right" }}>{new Date(selectedTransaksi.created_at).toLocaleString("id-ID")}</p>
                  <p style={{ margin: 0, color: theme.textMuted }}>Kasir</p>
                  <p style={{ margin: 0, fontWeight: 600, textAlign: "right" }}>{profile?.nama || "Admin"}</p>
                  <p style={{ margin: 0, color: theme.textMuted }}>Tipe</p>
                  <p style={{ margin: 0, fontWeight: 600, textAlign: "right", color: selectedTransaksi.tipe === "masuk" ? theme.success : theme.danger }}>
                    {selectedTransaksi.tipe === "masuk" ? "Pemasukan" : "Pengeluaran"}
                  </p>
                  <p style={{ margin: 0, color: theme.textMuted }}>Status</p>
                  <p style={{ margin: 0, fontWeight: 600, textAlign: "right", color: selectedTransaksi.status === "belum_lunas" ? theme.danger : theme.success }}>
                    {selectedTransaksi.status === "belum_lunas" ? "🔴 Piutang" : "✅ Lunas"}
                  </p>
                </div>

                <div style={{ width: "100%", height: 1, background: theme.cardBorder, margin: "8px 0" }}></div>

                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 14 }}>
                  <span>{selectedTransaksi.item}</span>
                  <span>Qty: {selectedTransaksi.qty}</span>
                </div>

                <div style={{ width: "100%", height: 1, background: theme.cardBorder, margin: "8px 0" }}></div>

                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 700, padding: "8px 0" }}>
                  <span>Total</span>
                  <span style={{ color: selectedTransaksi.tipe === "masuk" ? theme.success : theme.danger }}>
                    {fmt(selectedTransaksi.total)}
                  </span>
                </div>

                <div style={{ textAlign: "center", marginTop: 16, fontSize: 10, color: theme.textMuted }}>
                  <p style={{ margin: 0 }}>Terima kasih telah berkunjung!</p>
                  <p style={{ margin: 0 }}>☕ KopiLaba - Manajemen Keuangan Kafe</p>
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                  <button onClick={() => window.print()} style={{ ...s.btn, flex: 1 }}>
                    🖨️ Cetak Struk
                  </button>
                  <button onClick={() => { setSelectedTransaksi(null); setTab("transaksi"); }} style={{ ...s.btn, background: theme.card, border: `1px solid ${theme.cardBorder}`, color: theme.text, flex: 1 }}>
                    Kembali
                  </button>
                </div>
              </>
            ) : (
              <div style={{ textAlign: "center", padding: 30 }}>
                <p style={{ color: theme.textMuted }}>Pilih transaksi untuk melihat struk</p>
                <button onClick={() => setTab("transaksi")} style={s.btnSm}>Ke Transaksi</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ===== MODAL TRANSAKSI ===== */}
      {showAdd && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "flex-end", zIndex: 50 }} onClick={() => setShowAdd(false)}>
          <div style={{ background: theme.card, borderRadius: "20px 20px 0 0", padding: 24, width: "100%", maxWidth: 430, margin: "0 auto" }} onClick={e => e.stopPropagation()}>
            <p style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: theme.text }}>Tambah Transaksi</p>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {["masuk", "keluar"].map(t => (
                <button key={t} onClick={() => setAddType(t)} style={{ flex: 1, padding: 12, borderRadius: 12, border: "none", background: addType === t ? (t === "masuk" ? (darkMode ? "#1A2A1A" : "#E8F5E9") : (darkMode ? "#2A1A1A" : "#FFEBEE")) : theme.input, color: addType === t ? (t === "masuk" ? theme.success : theme.danger) : theme.textMuted, fontWeight: 700, cursor: "pointer" }}>
                  {t === "masuk" ? "💰 Pemasukan" : "🧾 Pengeluaran"}
                </button>
              ))}
            </div>
            <label style={s.label}>Nama Item</label>
            <input style={s.input} placeholder={addType === "masuk" ? "cth: Cappuccino" : "cth: Biji Kopi"} value={addForm.item} onChange={e => setAddForm({ ...addForm, item: e.target.value })} />
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={s.label}>Jumlah</label>
                <input style={s.input} type="number" placeholder="1" value={addForm.qty} onChange={e => setAddForm({ ...addForm, qty: e.target.value })} />
              </div>
              <div style={{ flex: 2 }}>
                <label style={s.label}>Total (Rp)</label>
                <input style={s.input} type="number" placeholder="45000" value={addForm.total} onChange={e => setAddForm({ ...addForm, total: e.target.value })} />
              </div>
            </div>
            <button style={{ ...s.btn, background: addType === "masuk" ? (darkMode ? "#2D5A2D" : "#2E7D32") : (darkMode ? "#5A2D2D" : "#C62828"), color: "#fff" }} onClick={handleTambahTransaksi}>Simpan</button>
          </div>
        </div>
      )}

      {/* ===== MODAL MENU ===== */}
      {showAddMenu && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "flex-end", zIndex: 50 }} onClick={() => setShowAddMenu(false)}>
          <div style={{ background: theme.card, borderRadius: "20px 20px 0 0", padding: 24, width: "100%", maxWidth: 430, margin: "0 auto" }} onClick={e => e.stopPropagation()}>
            <p style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: theme.text }}>{editMenuId ? "Edit Menu" : "Tambah Menu"}</p>
            <label style={s.label}>Nama Menu</label>
            <input style={s.input} placeholder="cth: Cappuccino" value={menuForm.nama} onChange={e => setMenuForm({ ...menuForm, nama: e.target.value })} />
            <label style={s.label}>Harga Jual (Rp)</label>
            <input style={s.input} type="number" placeholder="45000" value={menuForm.harga} onChange={e => setMenuForm({ ...menuForm, harga: e.target.value })} />
            <label style={s.label}>HPP / Harga Modal (Rp)</label>
            <input style={s.input} type="number" placeholder="15000" value={menuForm.hpp} onChange={e => setMenuForm({ ...menuForm, hpp: e.target.value })} />
            <label style={s.label}>Stok Awal</label>
            <input style={s.input} type="number" placeholder="50" value={menuForm.stok} onChange={e => setMenuForm({ ...menuForm, stok: e.target.value })} />
            <button style={s.btn} onClick={handleTambahMenu}>{editMenuId ? "Update Menu" : "Simpan Menu"}</button>
          </div>
        </div>
      )}

      {/* ===== MODAL KARYAWAN ===== */}
      {showAddKaryawan && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "flex-end", zIndex: 50 }} onClick={() => setShowAddKaryawan(false)}>
          <div style={{ background: theme.card, borderRadius: "20px 20px 0 0", padding: 24, width: "100%", maxWidth: 430, margin: "0 auto" }} onClick={e => e.stopPropagation()}>
            <p style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: theme.text }}>{editKaryawanId ? "Edit Karyawan" : "Tambah Karyawan"}</p>
            <label style={s.label}>Nama Lengkap</label>
            <input style={s.input} placeholder="Nama karyawan" value={karyawanForm.nama} onChange={e => setKaryawanForm({ ...karyawanForm, nama: e.target.value })} />
            {!editKaryawanId && (
              <>
                <label style={s.label}>Email</label>
                <input style={s.input} type="email" placeholder="email@karyawan.com" value={karyawanForm.email} onChange={e => setKaryawanForm({ ...karyawanForm, email: e.target.value })} />
                <label style={s.label}>Password</label>
                <input style={s.input} type="password" placeholder="Min. 6 karakter" value={karyawanForm.password} onChange={e => setKaryawanForm({ ...karyawanForm, password: e.target.value })} />
              </>
            )}
            <button style={s.btn} onClick={handleTambahKaryawan}>{editKaryawanId ? "Update Karyawan" : "Tambah Karyawan"}</button>
          </div>
        </div>
      )}

      {/* ===== MODAL KASIR ===== */}
      {showKasir && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "flex-end", zIndex: 50 }} onClick={() => setShowKasir(false)}>
          <div style={{ background: theme.card, borderRadius: "20px 20px 0 0", padding: 24, width: "100%", maxWidth: 430, margin: "0 auto" }} onClick={e => e.stopPropagation()}>
            <p style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: theme.text }}>🛒 Keranjang Kasir</p>
            {keranjang.length === 0 && <p style={{ color: theme.textMuted, fontSize: 13 }}>Keranjang kosong. Tambahkan dari menu!</p>}
            {keranjang.map((item, idx) => (
              <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 8, marginBottom: 8, borderBottom: `1px solid ${theme.cardBorder}` }}>
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{item.nama}</p>
                  <p style={{ margin: 0, fontSize: 11, color: theme.textMuted }}>{fmt(item.harga)} x {item.qty}</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: theme.gold }}>{fmt(item.harga * item.qty)}</p>
                  <button onClick={() => kurangiDariKeranjang(item.id)} style={{ background: "transparent", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: 16 }}>➖</button>
                  <button onClick={() => hapusDariKeranjang(item.id)} style={{ background: "transparent", border: "none", color: theme.danger, cursor: "pointer", fontSize: 14 }}>🗑️</button>
                </div>
              </div>
            ))}
            {keranjang.length > 0 && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderTop: `2px solid ${theme.cardBorder}` }}>
                  <p style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Total</p>
                  <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: theme.gold }}>{fmt(totalKeranjang)}</p>
                </div>
                <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                  {["tunai", "piutang"].map(p => (
                    <button key={p} onClick={() => setPembayaran(p)} style={{ flex: 1, padding: 12, borderRadius: 12, border: "none", background: pembayaran === p ? theme.gold : theme.input, color: pembayaran === p ? (darkMode ? "#fff" : "#1A1208") : theme.textMuted, fontWeight: pembayaran === p ? 700 : 400, cursor: "pointer", textTransform: "capitalize" }}>
                      {p === "tunai" ? "💰 Tunai" : "📝 Piutang"}
                    </button>
                  ))}
                </div>
                <button style={s.btn} onClick={handleCheckout} disabled={loading}>
                  {loading ? "Memproses..." : "✅ Bayar"}
                </button>
              </>
            )}
            <button onClick={() => setShowKasir(false)} style={{ ...s.btn, background: theme.card, border: `1px solid ${theme.cardBorder}`, color: theme.text, marginTop: 8 }}>Tutup</button>
          </div>
        </div>
      )}

      {/* ===== BOTTOM NAV ===== */}
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, background: theme.card, borderTop: `1px solid ${theme.cardBorder}`, display: "flex", padding: "8px 0 20px", transition: "all 0.3s ease" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", padding: "8px 0" }}>
            <span style={{ fontSize: 20 }}>{t.icon}</span>
            <span style={{ fontSize: 10, color: tab === t.id ? theme.gold : theme.textMuted, fontWeight: tab === t.id ? 700 : 400 }}>{t.label}</span>
            {tab === t.id && <div style={{ width: 4, height: 4, background: theme.gold, borderRadius: "50%" }}></div>}
          </button>
        ))}
      </div>
    </div>
  );
}
