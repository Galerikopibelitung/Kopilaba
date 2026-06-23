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
  const [screen, setScreen] = useState("login");
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [token, setToken] = useState(null);
  const [tab, setTab] = useState("dashboard");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [networkError, setNetworkError] = useState(false);

  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [regForm, setRegForm] = useState({ nama: "", email: "", password: "", role: "pemilik", namaKafe: "", alamatKafe: "" });

  const [transaksi, setTransaksi] = useState([]);
  const [menu, setMenu] = useState([]);
  const [kafe, setKafe] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addType, setAddType] = useState("masuk");
  const [addForm, setAddForm] = useState({ item: "", qty: "1", total: "" });
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [menuForm, setMenuForm] = useState({ nama: "", harga: "", hpp: "" });

  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(""), 3000);
      return () => clearTimeout(t);
    }
  }, [success]);

  const loadData = async (tok, prof) => {
    try {
      const kafeData = await api(`/rest/v1/kafe?pemilik_id=eq.${prof.id}&limit=1`, "GET", null, tok);
      const k = Array.isArray(kafeData) ? kafeData[0] : null;
      if (!k && prof.kafe_id) {
        const k2 = await api(`/rest/v1/kafe?id=eq.${prof.kafe_id}&limit=1`, "GET", null, tok);
        setKafe(Array.isArray(k2) ? k2[0] : null);
        await loadTransaksi(tok, prof.kafe_id);
        await loadMenu(tok, prof.kafe_id);
      } else if (k) {
        setKafe(k);
        await loadTransaksi(tok, k.id);
        await loadMenu(tok, k.id);
      }
    } catch (err) {
      console.error("Load data error:", err);
      setNetworkError(true);
      setError("Gagal memuat data. Periksa koneksi.");
    }
  };

  const loadTransaksi = async (tok, kafeId) => {
    try {
      const data = await api(`/rest/v1/transaksi?kafe_id=eq.${kafeId}&order=created_at.desc&limit=20`, "GET", null, tok);
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
    if (regForm.role === "pemilik" && !regForm.namaKafe) {
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

        if (regForm.role === "pemilik") {
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
        }

        try {
          await api("/rest/v1/profiles", "POST", {
            id: u.id,
            nama: regForm.nama,
            role: regForm.role,
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
        tipe: addType
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

      await api("/rest/v1/menu", "POST", {
        kafe_id: kafeId,
        nama: menuForm.nama,
        harga: parseInt(menuForm.harga),
        hpp: parseInt(menuForm.hpp)
      }, token);

      setMenuForm({ nama: "", harga: "", hpp: "" });
      setShowAddMenu(false);
      setSuccess("Menu ditambahkan!");
      await loadMenu(token, kafeId);
    } catch (err) {
      console.error("Add menu error:", err);
      setError("Gagal menambahkan menu. Coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  const totalMasuk = transaksi.filter(t => t.tipe === "masuk").reduce((a, b) => a + b.total, 0);
  const totalKeluar = transaksi.filter(t => t.tipe === "keluar").reduce((a, b) => a + b.total, 0);
  const laba = totalMasuk - totalKeluar;

  const s = {
    wrap: { fontFamily: "'Inter',system-ui,sans-serif", background: "#0F0A06", minHeight: "100vh", color: "#F5EFE6", maxWidth: 430, margin: "0 auto", position: "relative" },
    card: { background: "#1A1208", border: "1px solid #2A1F10", borderRadius: 16, padding: 18, marginBottom: 14 },
    input: { width: "100%", background: "#0F0A06", border: "1px solid #2A1F10", borderRadius: 12, padding: "12px", color: "#F5EFE6", fontSize: 14, boxSizing: "border-box", marginBottom: 10 },
    btn: { width: "100%", padding: 16, borderRadius: 14, border: "none", background: "#C8822A", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" },
    btnSm: { padding: "8px 16px", borderRadius: 10, border: "none", background: "#C8822A", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" },
    label: { fontSize: 12, color: "#8B7355", marginBottom: 4, display: "block" },
  };

  if (screen === "login") return (
    <div style={s.wrap}>
      <div style={{ padding: "60px 24px 24px" }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 4 }}>Kopi<span style={{ color: "#C8822A" }}>Laba</span></h1>
        <p style={{ color: "#8B7355", marginBottom: 32 }}>Manajemen keuangan kafe kopi</p>
        {error && <div style={{ background: "#2A1A1A", border: "1px solid #5A2A2A", borderRadius: 12, padding: 12, marginBottom: 14, fontSize: 13, color: "#EF8080" }}>{error}</div>}
        {success && <div style={{ background: "#1A2A1A", border: "1px solid #2A5A2A", borderRadius: 12, padding: 12, marginBottom: 14, fontSize: 13, color: "#6DBF5A" }}>{success}</div>}
        <label style={s.label}>Email</label>
        <input style={s.input} type="email" placeholder="email@kamu.com" value={loginForm.email} onChange={e => setLoginForm({ ...loginForm, email: e.target.value })} />
        <label style={s.label}>Password</label>
        <input style={s.input} type="password" placeholder="••••••••" value={loginForm.password} onChange={e => setLoginForm({ ...loginForm, password: e.target.value })} />
        <button style={s.btn} onClick={handleLogin} disabled={loading}>{loading ? "Masuk..." : "Masuk"}</button>
        <p style={{ textAlign: "center", marginTop: 20, color: "#8B7355", fontSize: 14 }}>
          Belum punya akun? <span style={{ color: "#C8822A", cursor: "pointer", fontWeight: 600 }} onClick={() => { setScreen("register"); setError(""); }}>Daftar</span>
        </p>
      </div>
    </div>
  );

  if (screen === "register") return (
    <div style={s.wrap}>
      <div style={{ padding: "50px 24px 24px" }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Daftar Akun</h2>
        <p style={{ color: "#8B7355", marginBottom: 24 }}>Buat akun KopiLaba baru</p>
        {error && <div style={{ background: "#2A1A1A", border: "1px solid #5A2A2A", borderRadius: 12, padding: 12, marginBottom: 14, fontSize: 13, color: "#EF8080" }}>{error}</div>}
        <label style={s.label}>Nama Lengkap</label>
        <input style={s.input} placeholder="Nama kamu" value={regForm.nama} onChange={e => setRegForm({ ...regForm, nama: e.target.value })} />
        <label style={s.label}>Email</label>
        <input style={s.input} type="email" placeholder="email@kamu.com" value={regForm.email} onChange={e => setRegForm({ ...regForm, email: e.target.value })} />
        <label style={s.label}>Password</label>
        <input style={s.input} type="password" placeholder="Min. 6 karakter" value={regForm.password} onChange={e => setRegForm({ ...regForm, password: e.target.value })} />
        <label style={s.label}>Role</label>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          {["pemilik", "barista"].map(r => (
            <button key={r} onClick={() => setRegForm({ ...regForm, role: r })} style={{ flex: 1, padding: 12, borderRadius: 12, border: "none", background: regForm.role === r ? "#C8822A" : "#1A1208", color: regForm.role === r ? "#fff" : "#8B7355", fontWeight: 600, cursor: "pointer", textTransform: "capitalize" }}>{r}</button>
          ))}
        </div>
        {regForm.role === "pemilik" && <>
          <label style={s.label}>Nama Kafe</label>
          <input style={s.input} placeholder="Nama kafe kamu" value={regForm.namaKafe} onChange={e => setRegForm({ ...regForm, namaKafe: e.target.value })} />
          <label style={s.label}>Alamat Kafe</label>
          <input style={s.input} placeholder="Alamat kafe" value={regForm.alamatKafe} onChange={e => setRegForm({ ...regForm, alamatKafe: e.target.value })} />
        </>}
        <button style={s.btn} onClick={handleRegister} disabled={loading}>{loading ? "Mendaftar..." : "Daftar Sekarang"}</button>
        <p style={{ textAlign: "center", marginTop: 20, color: "#8B7355", fontSize: 14 }}>
          Sudah punya akun? <span style={{ color: "#C8822A", cursor: "pointer", fontWeight: 600 }} onClick={() => { setScreen("login"); setError(""); }}>Masuk</span>
        </p>
      </div>
    </div>
  );

  const tabs = [
    { id: "dashboard", icon: "⊞", label: "Ringkasan" },
    { id: "transaksi", icon: "↕", label: "Transaksi" },
    { id: "menu", icon: "☕", label: "Menu" },
  ];

  return (
    <div style={s.wrap}>
      <div style={{ padding: "48px 20px 16px", background: "#1A0F07" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Kopi<span style={{ color: "#C8822A" }}>Laba</span></h1>
            <p style={{ margin: 0, fontSize: 12, color: "#8B7355" }}>{kafe?.nama || "Kafe kamu"} · {profile?.role}</p>
          </div>
          <button onClick={() => { setUser(null); setToken(null); setProfile(null); setScreen("login"); }} style={{ background: "#2A1F10", border: "none", borderRadius: 10, padding: "8px 14px", color: "#8B7355", fontSize: 12, cursor: "pointer" }}>Keluar</button>
        </div>
      </div>

      {success && <div style={{ margin: "0 20px", background: "#1A2A1A", border: "1px solid #2A5A2A", borderRadius: 12, padding: "10px 14px", fontSize: 13, color: "#6DBF5A" }}>{success}</div>}
      {error && <div style={{ margin: "0 20px", background: "#2A1A1A", border: "1px solid #5A2A2A", borderRadius: 12, padding: "10px 14px", fontSize: 13, color: "#EF8080" }} onClick={() => setError("")}>{error}</div>}
      {networkError && (
        <div style={{ margin: "0 20px 10px", background: "#2A1A1A", border: "1px solid #5A2A2A", borderRadius: 12, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, color: "#EF8080" }}>⚠️ {error || "Koneksi bermasalah"}</span>
          <button onClick={() => { setNetworkError(false); if (token && profile) loadData(token, profile); }} style={{ background: "#C8822A", border: "none", borderRadius: 8, padding: "4px 12px", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 12 }}>Coba Lagi</button>
        </div>
      )}

      <div style={{ padding: "14px 20px 100px" }}>
        {tab === "dashboard" && <>
          <div style={{ background: "linear-gradient(135deg,#C8822A,#8B5A1A)", borderRadius: 20, padding: 24, marginBottom: 14, position: "relative", overflow: "hidden" }}>
            <p style={{ margin: "0 0 4px", fontSize: 12, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Laba Bersih</p>
            <p style={{ margin: "0 0 16px", fontSize: 30, fontWeight: 800 }}>{fmt(laba)}</p>
            <div style={{ display: "flex", gap: 16 }}>
              <div><p style={{ margin: 0, fontSize: 10, color: "rgba(255,255,255,0.6)" }}>Pemasukan</p><p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{fmt(totalMasuk)}</p></div>
              <div style={{ width: 1, background: "rgba(255,255,255,0.2)" }}></div>
              <div><p style={{ margin: 0, fontSize: 10, color: "rgba(255,255,255,0.6)" }}>Pengeluaran</p><p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{fmt(totalKeluar)}</p></div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
            <button onClick={() => { setShowAdd(true); setAddType("masuk"); }} style={{ background: "#1A2A1A", border: "1px solid #2A4A2A", borderRadius: 14, padding: 16, cursor: "pointer", textAlign: "left" }}>
              <p style={{ margin: "0 0 4px", fontSize: 20 }}>💰</p>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#6DBF5A" }}>Catat Pemasukan</p>
            </button>
            <button onClick={() => { setShowAdd(true); setAddType("keluar"); }} style={{ background: "#2A1A1A", border: "1px solid #4A2A2A", borderRadius: 14, padding: 16, cursor: "pointer", textAlign: "left" }}>
              <p style={{ margin: "0 0 4px", fontSize: 20 }}>🧾</p>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#EF8080" }}>Catat Pengeluaran</p>
            </button>
          </div>

          <div style={s.card}>
            <p style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 600 }}>Transaksi Terbaru</p>
            {transaksi.length === 0 && <p style={{ color: "#5A4535", fontSize: 13 }}>Belum ada transaksi. Yuk catat yang pertama!</p>}
            {transaksi.slice(0, 5).map(t => (
              <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 10, marginBottom: 10, borderBottom: "1px solid #1F1710" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: t.tipe === "masuk" ? "#1A2A1A" : "#2A1A1A", display: "flex", alignItems: "center", justifyContent: "center", color: t.tipe === "masuk" ? "#6DBF5A" : "#EF8080" }}>{t.tipe === "masuk" ? "↑" : "↓"}</div>
                  <div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{t.item}</p>
                    <p style={{ margin: 0, fontSize: 11, color: "#5A4535" }}>Qty {t.qty}</p>
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: t.tipe === "masuk" ? "#6DBF5A" : "#EF8080" }}>{t.tipe === "masuk" ? "+" : "-"}{fmt(t.total)}</p>
              </div>
            ))}
          </div>
        </>}

        {tab === "transaksi" && <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Semua Transaksi</p>
            <button style={s.btnSm} onClick={() => setShowAdd(true)}>+ Tambah</button>
          </div>
          <div style={s.card}>
            {transaksi.length === 0 && <p style={{ color: "#5A4535", fontSize: 13 }}>Belum ada transaksi.</p>}
            {transaksi.map((t, i) => (
              <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 12, marginBottom: 12, borderBottom: i < transaksi.length - 1 ? "1px solid #1F1710" : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 12, background: t.tipe === "masuk" ? "#1A2A1A" : "#2A1A1A", display: "flex", alignItems: "center", justifyContent: "center", color: t.tipe === "masuk" ? "#6DBF5A" : "#EF8080", fontSize: 16 }}>{t.tipe === "masuk" ? "↑" : "↓"}</div>
                  <div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{t.item}</p>
                    <p style={{ margin: 0, fontSize: 11, color: "#5A4535" }}>Qty {t.qty} · {new Date(t.created_at).toLocaleDateString("id-ID")}</p>
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: t.tipe === "masuk" ? "#6DBF5A" : "#EF8080" }}>{t.tipe === "masuk" ? "+" : "-"}{fmt(t.total)}</p>
              </div>
            ))}
          </div>
        </>}

        {tab === "menu" && <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Menu & HPP</p>
            {profile?.role === "pemilik" && <button style={s.btnSm} onClick={() => setShowAddMenu(true)}>+ Tambah</button>}
          </div>
          {menu.length === 0 && <div style={s.card}><p style={{ color: "#5A4535", fontSize: 13 }}>Belum ada menu. Tambahkan menu pertama kamu!</p></div>}
          {menu.map(m => {
            const margin = m.harga ? (((m.harga - m.hpp) / m.harga) * 100).toFixed(1) : 0;
            return (
              <div key={m.id} style={s.card}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>☕ {m.nama}</p>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#C8822A" }}>{fmt(m.harga)}</p>
                </div>
                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                  <div style={{ flex: 1, background: "#0F0A06", borderRadius: 10, padding: "8px 12px" }}>
                    <p style={{ margin: 0, fontSize: 10, color: "#8B7355" }}>HPP</p>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#EF8080" }}>{fmt(m.hpp)}</p>
                  </div>
                  <div style={{ flex: 1, background: "#0F0A06", borderRadius: 10, padding: "8px 12px" }}>
                    <p style={{ margin: 0, fontSize: 10, color: "#8B7355" }}>Laba/cup</p>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#6DBF5A" }}>{fmt(m.harga - m.hpp)}</p>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ flex: 1, height: 6, background: "#0F0A06", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: margin + "%", background: margin > 65 ? "#6DBF5A" : "#C8822A", borderRadius: 3 }}></div>
                  </div>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: margin > 65 ? "#6DBF5A" : "#C8822A" }}>{margin}%</p>
                </div>
              </div>
            );
          })}
        </>}
      </div>

      {showAdd && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "flex-end", zIndex: 50 }} onClick={() => setShowAdd(false)}>
          <div style={{ background: "#1A1208", borderRadius: "20px 20px 0 0", padding: 24, width: "100%", maxWidth: 430, margin: "0 auto" }} onClick={e => e.stopPropagation()}>
            <p style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700 }}>Tambah Transaksi</p>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {["masuk", "keluar"].map(t => (
                <button key={t} onClick={() => setAddType(t)} style={{ flex: 1, padding: 12, borderRadius: 12, border: "none", background: addType === t ? (t === "masuk" ? "#1A2A1A" : "#2A1A1A") : "#0F0A06", color: addType === t ? (t === "masuk" ? "#6DBF5A" : "#EF8080") : "#5A4535", fontWeight: 700, cursor: "pointer" }}>
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
            <button style={{ ...s.btn, background: addType === "masuk" ? "#2D5A2D" : "#5A2D2D" }} onClick={handleTambahTransaksi}>Simpan</button>
          </div>
        </div>
      )}

      {showAddMenu && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "flex-end", zIndex: 50 }} onClick={() => setShowAddMenu(false)}>
          <div style={{ background: "#1A1208", borderRadius: "20px 20px 0 0", padding: 24, width: "100%", maxWidth: 430, margin: "0 auto" }} onClick={e => e.stopPropagation()}>
            <p style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700 }}>Tambah Menu</p>
            <label style={s.label}>Nama Menu</label>
            <input style={s.input} placeholder="cth: Cappuccino" value={menuForm.nama} onChange={e => setMenuForm({ ...menuForm, nama: e.target.value })} />
            <label style={s.label}>Harga Jual (Rp)</label>
            <input style={s.input} type="number" placeholder="45000" value={menuForm.harga} onChange={e => setMenuForm({ ...menuForm, harga: e.target.value })} />
            <label style={s.label}>HPP / Harga Modal (Rp)</label>
            <input style={s.input} type="number" placeholder="15000" value={menuForm.hpp} onChange={e => setMenuForm({ ...menuForm, hpp: e.target.value })} />
            <button style={s.btn} onClick={handleTambahMenu}>Simpan Menu</button>
          </div>
        </div>
      )}

      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, background: "#1A1208", borderTop: "1px solid #2A1F10", display: "flex", padding: "8px 0 20px" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", padding: "8px 0" }}>
            <span style={{ fontSize: 20 }}>{t.icon}</span>
            <span style={{ fontSize: 10, color: tab === t.id ? "#C8822A" : "#5A4535", fontWeight: tab === t.id ? 700 : 400 }}>{t.label}</span>
            {tab === t.id && <div style={{ width: 4, height: 4, background: "#C8822A", borderRadius: "50%" }}></div>}
          </button>
        ))}
      </div>
    </div>
  );
}
