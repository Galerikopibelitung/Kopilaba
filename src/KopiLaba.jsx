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
      const errText = await res.text();
      throw new Error(`HTTP ${res.status}: ${errText || res.statusText}`);
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
  const [darkMode, setDarkMode] = useState(true);
  const [showLaba, setShowLaba] = useState(true);

  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [regForm, setRegForm] = useState({ nama: "", email: "", password: "", namaKafe: "", alamatKafe: "" });

  const [transaksi, setTransaksi] = useState([]);
  const [menu, setMenu] = useState([]);
  const [kategori, setKategori] = useState([]);
  const [karyawan, setKaryawan] = useState([]);
  const [kafe, setKafe] = useState(null);

  const [showAdd, setShowAdd] = useState(false);
  const [addType, setAddType] = useState("masuk");
  const [addForm, setAddForm] = useState({ item: "", qty: "1", total: "", kategori_id: "", menu_id: "" });
  const [editTransaksiId, setEditTransaksiId] = useState(null);

  const [showAddMenu, setShowAddMenu] = useState(false);
  const [menuForm, setMenuForm] = useState({ nama: "", harga: "", hpp: "", stok: "", kategori_id: "", foto: "" });
  const [editMenuId, setEditMenuId] = useState(null);

  const [showAddKategori, setShowAddKategori] = useState(false);
  const [kategoriForm, setKategoriForm] = useState({ nama: "" });
  const [editKategoriId, setEditKategoriId] = useState(null);

  const [showAddKaryawan, setShowAddKaryawan] = useState(false);
  const [karyawanForm, setKaryawanForm] = useState({ nama: "", email: "", password: "" });
  const [editKaryawanId, setEditKaryawanId] = useState(null);

  const [showStok, setShowStok] = useState(false);
  const [stokForm, setStokForm] = useState({ menu_id: "", stok: "" });

  const [keranjang, setKeranjang] = useState([]);
  const [showKasir, setShowKasir] = useState(false);
  const [pembayaran, setPembayaran] = useState("tunai");

  const [filterTglMulai, setFilterTglMulai] = useState("");
  const [filterTglSelesai, setFilterTglSelesai] = useState("");
  const [filterStatus, setFilterStatus] = useState("semua");
  const [selectedTransaksi, setSelectedTransaksi] = useState(null);

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
        await loadKategori(tok);
        await loadKaryawan(tok, prof.kafe_id);
      } else if (k) {
        setKafe(k);
        await loadTransaksi(tok, k.id);
        await loadMenu(tok, k.id);
        await loadKategori(tok);
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
      const data = await api(`/rest/v1/transaksi?kafe_id=eq.${kafeId}&order=created_at.desc&limit=200`, "GET", null, tok);
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

  const loadKategori = async (tok) => {
    try {
      const data = await api("/rest/v1/kategori?order=nama.asc", "GET", null, tok);
      setKategori(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Load kategori error:", err);
      setKategori([]);
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
        setError("Koneksi internet bermasalah.");
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

    if (!regForm.nama || !regForm.email || !regForm.password || !regForm.namaKafe) {
      setError("Semua kolom wajib diisi!");
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
      if (err.message.includes("email")) {
        setError("Email sudah terdaftar.");
      } else {
        setError("Gagal daftar. Coba lagi.");
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
        setError("Kafe tidak ditemukan.");
        setLoading(false);
        return;
      }

      const payload = {
        kafe_id: kafeId,
        item: addForm.item,
        qty: parseInt(addForm.qty) || 1,
        total: parseInt(addForm.total),
        tipe: addType,
        status: "lunas"
      };
      if (addForm.menu_id) payload.menu_id = addForm.menu_id;

      if (editTransaksiId) {
        await api(`/rest/v1/transaksi?id=eq.${editTransaksiId}`, "PATCH", payload, token);
        setSuccess("Transaksi diupdate!");
        setEditTransaksiId(null);
      } else {
        await api("/rest/v1/transaksi", "POST", payload, token);
        setSuccess("Transaksi tersimpan!");
      }

      setAddForm({ item: "", qty: "1", total: "", kategori_id: "", menu_id: "" });
      setShowAdd(false);
      await loadTransaksi(token, kafeId);
    } catch (err) {
      console.error("Transaksi error:", err);
      setError("Gagal menyimpan transaksi.");
    } finally {
      setLoading(false);
    }
  };

  const handleEditTransaksi = (t) => {
    if (profile?.role !== "pemilik") {
      setError("Hanya pemilik yang bisa mengedit transaksi.");
      return;
    }
    setEditTransaksiId(t.id);
    setAddType(t.tipe);
    setAddForm({
      item: t.item,
      qty: String(t.qty),
      total: String(t.total),
      kategori_id: "",
      menu_id: t.menu_id || ""
    });
    setShowAdd(true);
  };

  const handleHapusTransaksi = async (id) => {
    if (profile?.role !== "pemilik") {
      setError("Hanya pemilik yang bisa menghapus transaksi.");
      return;
    }
    if (!confirm("Yakin hapus transaksi ini?")) return;
    try {
      await api(`/rest/v1/transaksi?id=eq.${id}`, "DELETE", null, token);
      setSuccess("Transaksi dihapus!");
      await loadTransaksi(token, kafe?.id || profile?.kafe_id);
    } catch (err) {
      setError("Gagal hapus transaksi.");
    }
  };

  const handleTambahMenu = async () => {
    if (!menuForm.nama || !menuForm.harga || !menuForm.hpp) {
      setError("Nama, harga, dan HPP wajib diisi!");
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

      const payload = {
        kafe_id: kafeId,
        nama: menuForm.nama,
        harga: parseInt(menuForm.harga),
        hpp: parseInt(menuForm.hpp),
        stok: parseInt(menuForm.stok) || 0,
        kategori_id: menuForm.kategori_id || null,
        foto: menuForm.foto || ""
      };

      if (editMenuId) {
        await api(`/rest/v1/menu?id=eq.${editMenuId}`, "PATCH", payload, token);
        setSuccess("Menu diupdate!");
        setEditMenuId(null);
      } else {
        await api("/rest/v1/menu", "POST", payload, token);
        setSuccess("Menu ditambahkan!");
      }

      setMenuForm({ nama: "", harga: "", hpp: "", stok: "", kategori_id: "", foto: "" });
      setShowAddMenu(false);
      await loadMenu(token, kafeId);
    } catch (err) {
      console.error("Menu error:", err);
      setError("Gagal menyimpan menu.");
    } finally {
      setLoading(false);
    }
  };

  const handleEditMenu = (m) => {
    if (profile?.role !== "pemilik") {
      setError("Hanya pemilik yang bisa mengedit menu.");
      return;
    }
    setEditMenuId(m.id);
    setMenuForm({
      nama: m.nama,
      harga: String(m.harga),
      hpp: String(m.hpp),
      stok: String(m.stok || 0),
      kategori_id: m.kategori_id || "",
      foto: m.foto || ""
    });
    setShowAddMenu(true);
  };

  const handleHapusMenu = async (id) => {
    if (profile?.role !== "pemilik") {
      setError("Hanya pemilik yang bisa menghapus menu.");
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

  const handleTambahKategori = async () => {
    if (!kategoriForm.nama) {
      setError("Nama kategori wajib diisi!");
      return;
    }
    setLoading(true);
    setError("");

    try {
      if (editKategoriId) {
        await api(`/rest/v1/kategori?id=eq.${editKategoriId}`, "PATCH", { nama: kategoriForm.nama }, token);
        setSuccess("Kategori diupdate!");
        setEditKategoriId(null);
      } else {
        await api("/rest/v1/kategori", "POST", { nama: kategoriForm.nama }, token);
        setSuccess("Kategori ditambahkan!");
      }
      setKategoriForm({ nama: "" });
      setShowAddKategori(false);
      await loadKategori(token);
    } catch (err) {
      console.error("Kategori error:", err);
      setError("Gagal menyimpan kategori.");
    } finally {
      setLoading(false);
    }
  };

  const handleEditKategori = (k) => {
    if (profile?.role !== "pemilik") return;
    setEditKategoriId(k.id);
    setKategoriForm({ nama: k.nama });
    setShowAddKategori(true);
  };

  const handleHapusKategori = async (id) => {
    if (profile?.role !== "pemilik") return;
    if (!confirm("Yakin hapus kategori ini?")) return;
    try {
      await api(`/rest/v1/kategori?id=eq.${id}`, "DELETE", null, token);
      setSuccess("Kategori dihapus!");
      await loadKategori(token);
    } catch (err) {
      setError("Gagal hapus kategori.");
    }
  };

  const handleTambahKaryawan = async () => {
    if (profile?.role !== "pemilik") {
      setError("Hanya pemilik yang bisa mengelola karyawan.");
      return;
    }
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
        await api(`/rest/v1/profiles?id=eq.${editKaryawanId}`, "PATCH", { nama: karyawanForm.nama }, token);
        setSuccess("Karyawan diupdate!");
        setEditKaryawanId(null);
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
      console.error("Karyawan error:", err);
      setError("Gagal menyimpan karyawan.");
    } finally {
      setLoading(false);
    }
  };

  const handleEditKaryawan = (k) => {
    if (profile?.role !== "pemilik") return;
    setEditKaryawanId(k.id);
    setKaryawanForm({ nama: k.nama, email: k.email || "", password: "" });
    setShowAddKaryawan(true);
  };

  const handleHapusKaryawan = async (id) => {
    if (profile?.role !== "pemilik") return;
    if (!confirm("Yakin hapus karyawan ini?")) return;
    try {
      await api(`/rest/v1/profiles?id=eq.${id}`, "DELETE", null, token);
      setSuccess("Karyawan dihapus!");
      await loadKaryawan(token, kafe?.id || profile?.kafe_id);
    } catch (err) {
      setError("Gagal hapus karyawan.");
    }
  };

  const handleUpdateStok = async () => {
    if (!stokForm.menu_id || stokForm.stok === "") {
      setError("Pilih menu dan isi stok!");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await api(`/rest/v1/menu?id=eq.${stokForm.menu_id}`, "PATCH", { stok: parseInt(stokForm.stok) || 0 }, token);
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

  const tambahKeKeranjang = (item) => {
    if (item.stok !== undefined && item.stok <= 0) {
      setError(`Stok ${item.nama} habis!`);
      return;
    }
    setKeranjang(prev => {
      const existing = prev.find(p => p.id === item.id);
      if (existing) {
        if (existing.qty >= (item.stok || 999)) {
          setError(`Stok ${item.nama} tidak mencukupi!`);
          return prev;
        }
        return prev.map(p => p.id === item.id ? { ...p, qty: p.qty + 1 } : p);
      }
      return [...prev, { ...item, qty: 1 }];
    });
  };

  const kurangiDariKeranjang = (id) => {
    setKeranjang(prev => {
      const existing = prev.find(p => p.id === id);
      if (existing && existing.qty > 1) {
        return prev.map(p => p.id === id ? { ...p, qty: p.qty - 1 } : p);
      }
      return prev.filter(p => p.id !== id);
    });
  };

  const hapusDariKeranjang = (id) => {
    setKeranjang(prev => prev.filter(p => p.id !== id));
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

      for (const item of keranjang) {
        const newStok = (item.stok || 0) - item.qty;
        await api(`/rest/v1/menu?id=eq.${item.id}`, "PATCH", { stok: newStok }, token);
      }

      setKeranjang([]);
      setShowKasir(false);
      setSuccess("Transaksi berhasil!");
      await loadTransaksi(token, kafeId);
      await loadMenu(token, kafeId);
    } catch (err) {
      console.error("Checkout error:", err);
      setError("Gagal checkout.");
    } finally {
      setLoading(false);
    }
  };

  const getFilteredTransaksi = () => {
    let filtered = [...transaksi];
    if (filterTglMulai) {
      const start = new Date(filterTglMulai);
      start.setHours(0, 0, 0, 0);
      filtered = filtered.filter(t => new Date(t.created_at) >= start);
    }
    if (filterTglSelesai) {
      const end = new Date(filterTglSelesai);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter(t => new Date(t.created_at) <= end);
    }
    if (filterStatus === "lunas") {
      filtered = filtered.filter(t => t.status === "lunas");
    } else if (filterStatus === "belum_lunas") {
      filtered = filtered.filter(t => t.status === "belum_lunas");
    }
    return filtered;
  };

  const filtered = getFilteredTransaksi();
  const totalMasuk = filtered.filter(t => t.tipe === "masuk").reduce((a, b) => a + b.total, 0);
  const totalKeluar = filtered.filter(t => t.tipe === "keluar").reduce((a, b) => a + b.total, 0);
  const laba = totalMasuk - totalKeluar;
  const totalStok = menu.reduce((sum, item) => sum + (item.stok || 0), 0);

  const chartData = {};
  filtered.forEach(t => {
    const date = new Date(t.created_at).toLocaleDateString("id-ID");
    if (!chartData[date]) chartData[date] = { masuk: 0, keluar: 0 };
    if (t.tipe === "masuk") chartData[date].masuk += t.total;
    else chartData[date].keluar += t.total;
  });
  const chartLabels = Object.keys(chartData).slice(-7);
  const chartMasuk = chartLabels.map(d => chartData[d].masuk);
  const chartKeluar = chartLabels.map(d => chartData[d].keluar);
  const maxChart = Math.max(1, ...chartMasuk, ...chartKeluar);

  const exportExcel = () => {
    const header = "Tanggal,Item,Qty,Total,Tipe,Status\n";
    const rows = filtered.map(t =>
      `${new Date(t.created_at).toLocaleDateString("id-ID")},${t.item},${t.qty},${t.total},${t.tipe},${t.status || "lunas"}`
    ).join("\n");
    const csv = header + rows;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `laporan_keuangan_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
    setSuccess("Laporan berhasil di-download!");
  };

  const theme = darkMode ? {
    bg: "#0F0A06",
    card: "#1A1208",
    cardBorder: "#2A1F10",
    text: "#F5EFE6",
    textMuted: "#8B7355",
    input: "#0F0A06",
    inputBorder: "#2A1F10",
    gold: "#C8822A",
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
      maxWidth: 480,
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

  if (screen === "login") return (
    <div style={s.wrap}>
      <div style={{ padding: "60px 24px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 64, marginBottom: 8 }}>☕</div>
        <h1 style={{ fontSize: 36, fontWeight: 800, marginBottom: 4, letterSpacing: 2 }}>
          <span style={{ color: theme.gold }}>KOPI</span>
          <span style={{ color: theme.text }}>LABA</span>
        </h1>
        <div style={{ width: 60, height: 3, background: theme.gold, margin: "8px auto 16px", borderRadius: 2 }}></div>
        <p style={{ color: theme.textMuted, marginBottom: 32 }}>Manajemen Keuangan Kafe</p>
        {error && <div style={{ background: darkMode ? "#2A1A1A" : "#FFEBEE", border: `1px solid ${theme.danger}`, borderRadius: 12, padding: 12, marginBottom: 14, fontSize: 13, color: theme.danger }}>{error}</div>}
        {success && <div style={{ background: darkMode ? "#1A2A1A" : "#E8F5E9", border: `1px solid ${theme.success}`, borderRadius: 12, padding: 12, marginBottom: 14, fontSize: 13, color: theme.success }}>{success}</div>}
        <label style={s.label}>Email</label>
        <input style={s.input} type="email" placeholder="email@kamu.com" value={loginForm.email} onChange={e => setLoginForm({ ...loginForm, email: e.target.value })} />
        <label style={s.label}>Password</label>
        <input style={s.input} type="password" placeholder="Masukkan password" value={loginForm.password} onChange={e => setLoginForm({ ...loginForm, password: e.target.value })} />
        <button style={s.btn} onClick={handleLogin} disabled={loading}>{loading ? "Masuk..." : "Masuk"}</button>
        <p style={{ textAlign: "center", marginTop: 20, color: theme.textMuted, fontSize: 14 }}>
          Belum punya akun? <span style={{ color: theme.gold, cursor: "pointer", fontWeight: 600 }} onClick={() => { setScreen("register"); setError(""); }}>Daftar</span>
        </p>
        <div style={{ marginTop: 30, display: "flex", justifyContent: "center", gap: 12 }}>
          <button onClick={() => setDarkMode(true)} style={{ padding: "6px 20px", borderRadius: 20, border: darkMode ? `2px solid ${theme.gold}` : `1px solid ${theme.textMuted}`, background: "transparent", color: darkMode ? theme.gold : theme.textMuted, cursor: "pointer", fontSize: 13 }}>🌙 Dark</button>
          <button onClick={() => setDarkMode(false)} style={{ padding: "6px 20px", borderRadius: 20, border: !darkMode ? `2px solid ${theme.gold}` : `1px solid ${theme.textMuted}`, background: "transparent", color: !darkMode ? theme.gold : theme.textMuted, cursor: "pointer", fontSize: 13 }}>☀️ Light</button>
        </div>
      </div>
    </div>
  );

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

  const tabs = [
    { id: "dashboard", icon: "⊞", label: "Ringkasan" },
    { id: "transaksi", icon: "↕", label: "Transaksi" },
    { id: "menu", icon: "☕", label: "Menu" },
    { id: "karyawan", icon: "👤", label: "Karyawan" },
    { id: "laporan", icon: "📊", label: "Laporan" },
    { id: "struk", icon: "🧾", label: "Struk" },
  ];

  const isPemilik = profile?.role === "pemilik";

  return (
    <div style={s.wrap}>
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

      {success && <div style={{ margin: "0 20px", background: darkMode ? "#1A2A1A" : "#E8F5E9", border: `1px solid ${theme.success}`, borderRadius: 12, padding: "10px 14px", fontSize: 13, color: theme.success }}>{success}</div>}
      {error && <div style={{ margin: "0 20px", background: darkMode ? "#2A1A1A" : "#FFEBEE", border: `1px solid ${theme.danger}`, borderRadius: 12, padding: "10px 14px", fontSize: 13, color: theme.danger }} onClick={() => setError("")}>{error}</div>}
      {networkError && (
        <div style={{ margin: "0 20px 10px", background: darkMode ? "#2A1A1A" : "#FFEBEE", border: `1px solid ${theme.danger}`, borderRadius: 12, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, color: theme.danger }}>⚠️ {error || "Koneksi bermasalah"}</span>
          <button onClick={() => { setNetworkError(false); if (token && profile) loadData(token, profile); }} style={{ background: theme.gold, border: "none", borderRadius: 8, padding: "4px 12px", color: darkMode ? "#fff" : "#1A1208", fontWeight: 600, cursor: "pointer", fontSize: 12 }}>Coba Lagi</button>
        </div>
      )}

      <div style={{ padding: "14px 20px 100px" }}>
        {tab === "dashboard" && <>
          <div style={{ background: `linear-gradient(135deg,${theme.gold},${darkMode ? "#8B5A1A" : "#B8860B"})`, borderRadius: 20, padding: 24, marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.7)" }}>Laba Bersih</p>
              <button onClick={() => setShowLaba(!showLaba)} style={{ background: "transparent", border: "none", fontSize: 18, cursor: "pointer", color: "rgba(255,255,255,0.8)" }}>
                {showLaba ? "👁️" : "🙈"}
              </button>
            </div>
            <p style={{ margin: "0 0 16px", fontSize: 30, fontWeight: 800, color: "#fff" }}>
              {showLaba ? fmt(laba) : "••••••••"}
            </p>
            <div style={{ display: "flex", gap: 16 }}>
              <div><p style={{ margin: 0, fontSize: 10, color: "rgba(255,255,255,0.6)" }}>Pemasukan</p><p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#fff" }}>{fmt(totalMasuk)}</p></div>
              <div style={{ width: 1, background: "rgba(255,255,255,0.2)" }}></div>
              <div><p style={{ margin: 0, fontSize: 10, color: "rgba(255,255,255,0.6)" }}>Pengeluaran</p><p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#fff" }}>{fmt(totalKeluar)}</p></div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
            <button onClick={() => { setShowAdd(true); setAddType("masuk"); setEditTransaksiId(null); setAddForm({ item: "", qty: "1", total: "", kategori_id: "", menu_id: "" }); }} style={{ background: darkMode ? "#1A2A1A" : "#E8F5E9", border: `1px solid ${darkMode ? "#2A4A2A" : "#A5D6A7"}`, borderRadius: 14, padding: 16, cursor: "pointer", textAlign: "left" }}>
              <p style={{ margin: "0 0 4px", fontSize: 20 }}>💰</p>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: theme.success }}>Catat Pemasukan</p>
            </button>
            <button onClick={() => { setShowAdd(true); setAddType("keluar"); setEditTransaksiId(null); setAddForm({ item: "", qty: "1", total: "", kategori_id: "", menu_id: "" }); }} style={{ background: darkMode ? "#2A1A1A" : "#FFEBEE", border: `1px solid ${darkMode ? "#4A2A2A" : "#EF9A9A"}`, borderRadius: 14, padding: 16, cursor: "pointer", textAlign: "left" }}>
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
            {isPemilik && (
              <button onClick={() => setShowStok(true)} style={{ ...s.btnSm, marginTop: 10, width: "100%" }}>Kelola Stok</button>
            )}
          </div>
        </>}

        {tab === "transaksi" && <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Semua Transaksi</p>
            <button style={s.btnSm} onClick={() => { setShowAdd(true); setEditTransaksiId(null); setAddForm({ item: "", qty: "1", total: "", kategori_id: "", menu_id: "" }); }}>+ Tambah</button>
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            {["semua", "lunas", "belum_lunas"].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)} style={{ flex: 1, padding: "8px 12px", borderRadius: 10, border: "none", background: filterStatus === s ? theme.gold : theme.input, color: filterStatus === s ? (darkMode ? "#fff" : "#1A1208") : theme.textMuted, fontWeight: filterStatus === s ? 700 : 400, cursor: "pointer", fontSize: 12 }}>
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
                  {isPemilik && (
                    <>
                      <button onClick={() => handleEditTransaksi(t)} style={{ background: "transparent", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: 14 }}>✏️</button>
                      <button onClick={() => handleHapusTransaksi(t.id)} style={{ background: "transparent", border: "none", color: theme.danger, cursor: "pointer", fontSize: 14 }}>🗑️</button>
                    </>
                  )}
                  <button onClick={() => { setSelectedTransaksi(t); setTab("struk"); }} style={{ background: theme.gold, border: "none", borderRadius: 6, padding: "4px 8px", color: "#fff", fontSize: 10, cursor: "pointer" }}>🧾</button>
                </div>
              </div>
            ))}
          </div>
        </>}

        {tab === "menu" && <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Menu & Kategori</p>
            <div style={{ display: "flex", gap: 8 }}>
              {isPemilik && (
                <>
                  <button style={s.btnSm} onClick={() => { setEditKategoriId(null); setKategoriForm({ nama: "" }); setShowAddKategori(true); }}>🏷️</button>
                  <button style={s.btnSm} onClick={() => { setEditMenuId(null); setMenuForm({ nama: "", harga: "", hpp: "", stok: "", kategori_id: "", foto: "" }); setShowAddMenu(true); }}>+ Tambah</button>
                </>
              )}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
            {kategori.map(k => (
              <div key={k.id} style={{ background: theme.input, borderRadius: 20, padding: "4px 14px", display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 13, color: theme.text }}>{k.nama}</span>
                {isPemilik && (
                  <>
                    <button onClick={() => handleEditKategori(k)} style={{ background: "transparent", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: 12 }}>✏️</button>
                    <button onClick={() => handleHapusKategori(k.id)} style={{ background: "transparent", border: "none", color: theme.danger, cursor: "pointer", fontSize: 12 }}>🗑️</button>
                  </>
                )}
              </div>
            ))}
          </div>

          {menu.length === 0 && <div style={s.card}><p style={{ color: theme.textMuted, fontSize: 13 }}>Belum ada menu.</p></div>}
          {menu.map(m => {
            const margin = m.harga ? (((m.harga - m.hpp) / m.harga) * 100).toFixed(1) : 0;
            const stok = m.stok || 0;
            const kategoriNama = kategori.find(k => k.id === m.kategori_id)?.nama || "Umum";
            const icon = kategoriNama === "Minuman" ? "🥤" : kategoriNama === "Makanan" ? "🍔" : kategoriNama === "Snack" ? "🍿" : "☕";

            return (
              <div key={m.id} style={s.card}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{icon} {m.nama}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: theme.textMuted }}>📦 Stok: {stok} {stok < 5 && "⚠️"} · {kategoriNama}</p>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: theme.gold }}>{fmt(m.harga)}</p>
                    {isPemilik && (
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
                  {stok <= 0 ? "Stok Habis" : "🛒 +"}
                </button>
              </div>
            );
          })}
        </>}

        {tab === "karyawan" && <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Daftar Karyawan</p>
            {isPemilik && <button style={s.btnSm} onClick={() => { setEditKaryawanId(null); setKaryawanForm({ nama: "", email: "", password: "" }); setShowAddKaryawan(true); }}>+ Tambah</button>}
          </div>
          {karyawan.length === 0 && <div style={s.card}><p style={{ color: theme.textMuted, fontSize: 13 }}>Belum ada karyawan.</p></div>}
          {karyawan.map(k => (
            <div key={k.id} style={s.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{k.nama}</p>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: theme.textMuted }}>{k.email || "Barista"}</p>
                </div>
                {isPemilik && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => handleEditKaryawan(k)} style={{ background: "transparent", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: 14 }}>✏️</button>
                    <button onClick={() => handleHapusKaryawan(k.id)} style={{ background: "transparent", border: "none", color: theme.danger, cursor: "pointer", fontSize: 14 }}>🗑️</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </>}

        {tab === "laporan" && <>
          <div style={s.card}>
            <p style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700 }}>📊 Laporan Keuangan</p>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <label style={s.label}>Dari</label>
                <input style={s.input} type="date" value={filterTglMulai} onChange={e => setFilterTglMulai(e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={s.label}>Sampai</label>
                <input style={s.input} type="date" value={filterTglSelesai} onChange={e => setFilterTglSelesai(e.target.value)} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
              <div style={{ background: theme.input, borderRadius: 12, padding: 12 }}>
                <p style={{ margin: 0, fontSize: 10, color: theme.textMuted }}>Total Transaksi</p>
                <p style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{filtered.length}</p>
              </div>
              <div style={{ background: theme.input, borderRadius: 12, padding: 12 }}>
                <p style={{ margin: 0, fontSize: 10, color: theme.textMuted }}>Laba Bersih</p>
                <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: laba >= 0 ? theme.success : theme.danger }}>{fmt(laba)}</p>
              </div>
              <div style={{ background: theme.input, borderRadius: 12, padding: 12 }}>
                <p style={{ margin: 0, fontSize: 10, color: theme.textMuted }}>Pemasukan</p>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: theme.success }}>{fmt(totalMasuk)}</p>
              </div>
              <div style={{ background: theme.input, borderRadius: 12, padding: 12 }}>
                <p style={{ margin: 0, fontSize: 10, color: theme.textMuted }}>Pengeluaran</p>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: theme.danger }}>{fmt(totalKeluar)}</p>
              </div>
            </div>

            {chartLabels.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>📈 Grafik 7 Hari Terakhir</p>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 100 }}>
                  {chartLabels.map((label, idx) => {
                    const hMasuk = (chartMasuk[idx] / maxChart) * 80;
                    const hKeluar = (chartKeluar[idx] / maxChart) * 80;
                    return (
                      <div key={label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                        <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 80 }}>
                          <div style={{ width: 10, height: Math.max(4, hMasuk), background: theme.success, borderRadius: "4px 4px 0 0" }}></div>
                          <div style={{ width: 10, height: Math.max(4, hKeluar), background: theme.danger, borderRadius: "4px 4px 0 0" }}></div>
                        </div>
                        <span style={{ fontSize: 8, color: theme.textMuted }}>{label.slice(0, 5)}</span>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: "flex", gap: 16, justifyContent: "center", fontSize: 10, marginTop: 4 }}>
                  <span><span style={{ color: theme.success }}>■</span> Pemasukan</span>
                  <span><span style={{ color: theme.danger }}>■</span> Pengeluaran</span>
                </div>
              </div>
            )}

            {filtered.length > 0 && (
              <button onClick={exportExcel} style={{ ...s.btnSm, width: "100%", background: theme.gold }}>
                ⬇️ Download Excel (.csv)
              </button>
            )}

            <div style={{ marginTop: 14 }}>
              <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Detail Transaksi</p>
              {filtered.length === 0 && <p style={{ color: theme.textMuted, fontSize: 13 }}>Tidak ada transaksi.</p>}
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
          </div>
        </>}

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
                  <p style={{ margin: 0 }}>Terima kasih!</p>
                  <p style={{ margin: 0 }}>☕ KopiLaba</p>
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                  <button onClick={() => window.print()} style={{ ...s.btn, flex: 1 }}>🖨️ Cetak</button>
                  <button onClick={() => { setSelectedTransaksi(null); setTab("transaksi"); }} style={{ ...s.btn, background: theme.card, border: `1px solid ${theme.cardBorder}`, color: theme.text, flex: 1 }}>Kembali</button>
                </div>
              </>
            ) : (
              <div style={{ textAlign: "center", padding: 30 }}>
                <p style={{ color: theme.textMuted }}>Pilih transaksi untuk lihat struk</p>
                <button onClick={() => setTab("transaksi")} style={s.btnSm}>Ke Transaksi</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL TRANSAKSI */}
      {showAdd && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "flex-end", zIndex: 50 }} onClick={() => setShowAdd(false)}>
          <div style={{ background: theme.card, borderRadius: "20px 20px 0 0", padding: 24, width: "100%", maxWidth: 480, margin: "0 auto" }} onClick={e => e.stopPropagation()}>
            <p style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: theme.text }}>{editTransaksiId ? "Edit Transaksi" : "Tambah Transaksi"}</p>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {["masuk", "keluar"].map(t => (
                <button key={t} onClick={() => setAddType(t)} style={{ flex: 1, padding: 12, borderRadius: 12, border: "none", background: addType === t ? (t === "masuk" ? (darkMode ? "#1A2A1A" : "#E8F5E9") : (darkMode ? "#2A1A1A" : "#FFEBEE")) : theme.input, color: addType === t ? (t === "masuk" ? theme.success : theme.danger) : theme.textMuted, fontWeight: 700, cursor: "pointer" }}>
                  {t === "masuk" ? "💰 Pemasukan" : "🧾 Pengeluaran"}
                </button>
              ))}
            </div>

            <label style={s.label}>Kategori Menu</label>
            <select style={s.input} value={addForm.kategori_id} onChange={e => {
              setAddForm({ ...addForm, kategori_id: e.target.value, menu_id: "" });
            }}>
              <option value="">-- Pilih Kategori --</option>
              {kategori.map(k => <option key={k.id} value={k.id}>{k.nama}</option>)}
            </select>

            <label style={s.label}>Pilih Menu</label>
            <select style={s.input} value={addForm.menu_id} onChange={e => {
              const selected = menu.find(m => m.id === e.target.value);
              if (selected) {
                setAddForm({
                  ...addForm,
                  menu_id: selected.id,
                  item: selected.nama,
                  total: String(selected.harga)
                });
              } else {
                setAddForm({ ...addForm, menu_id: "", item: "", total: "" });
              }
            }}>
              <option value="">-- Pilih Menu --</option>
              {menu.filter(m => m.kategori_id === addForm.kategori_id || !addForm.kategori_id).map(m => (
                <option key={m.id} value={m.id}>{m.nama} - {fmt(m.harga)} (stok: {m.stok || 0})</option>
              ))}
            </select>

            <label style={s.label}>Nama Item</label>
            <input style={s.input} placeholder="cth: Cappuccino" value={addForm.item} onChange={e => setAddForm({ ...addForm, item: e.target.value })} />

            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={s.label}>Jumlah</label>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button onClick={() => setAddForm({ ...addForm, qty: String(Math.max(1, parseInt(addForm.qty) - 1 || 1)) }) } style={{ ...s.btnSm, width: 40, padding: 8 }}>−</button>
                  <input style={{ ...s.input, textAlign: "center", marginBottom: 0 }} type="number" value={addForm.qty} onChange={e => setAddForm({ ...addForm, qty: e.target.value })} />
                  <button onClick={() => setAddForm({ ...addForm, qty: String(parseInt(addForm.qty) + 1 || 2) }) } style={{ ...s.btnSm, width: 40, padding: 8 }}>+</button>
                </div>
              </div>
              <div style={{ flex: 2 }}>
                <label style={s.label}>Total (Rp)</label>
                <input style={s.input} type="number" placeholder="45000" value={addForm.total} onChange={e => setAddForm({ ...addForm, total: e.target.value })} />
              </div>
            </div>

            <button style={{ ...s.btn, background: addType === "masuk" ? (darkMode ? "#2D5A2D" : "#2E7D32") : (darkMode ? "#5A2D2D" : "#C62828"), color: "#fff" }} onClick={handleTambahTransaksi} disabled={loading}>
              {loading ? "Menyimpan..." : editTransaksiId ? "Update" : "Simpan"}
            </button>
          </div>
        </div>
      )}

      {/* MODAL MENU */}
      {showAddMenu && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "flex-end", zIndex: 50 }} onClick={() => setShowAddMenu(false)}>
          <div style={{ background: theme.card, borderRadius: "20px 20px 0 0", padding: 24, width: "100%", maxWidth: 480, margin: "0 auto" }} onClick={e => e.stopPropagation()}>
            <p style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: theme.text }}>{editMenuId ? "Edit Menu" : "Tambah Menu"}</p>
            <label style={s.label}>Nama Menu</label>
            <input style={s.input} placeholder="cth: Cappuccino" value={menuForm.nama} onChange={e => setMenuForm({ ...menuForm, nama: e.target.value })} />
            <label style={s.label}>Kategori</label>
            <select style={s.input} value={menuForm.kategori_id} onChange={e => setMenuForm({ ...menuForm, kategori_id: e.target.value })}>
              <option value="">-- Pilih Kategori --</option>
              {kategori.map(k => <option key={k.id} value={k.id}>{k.nama}</option>)}
            </select>
            <label style={s.label}>Harga Jual (Rp)</label>
            <input style={s.input} type="number" placeholder="45000" value={menuForm.harga} onChange={e => setMenuForm({ ...menuForm, harga: e.target.value })} />
            <label style={s.label}>HPP (Rp)</label>
            <input style={s.input} type="number" placeholder="15000" value={menuForm.hpp} onChange={e => setMenuForm({ ...menuForm, hpp: e.target.value })} />
            <label style={s.label}>Stok Awal</label>
            <input style={s.input} type="number" placeholder="50" value={menuForm.stok} onChange={e => setMenuForm({ ...menuForm, stok: e.target.value })} />
            <label style={s.label}>Foto (URL)</label>
            <input style={s.input} placeholder="https://... (opsional)" value={menuForm.foto} onChange={e => setMenuForm({ ...menuForm, foto: e.target.value })} />
            <button style={s.btn} onClick={handleTambahMenu} disabled={loading}>{loading ? "Menyimpan..." : editMenuId ? "Update" : "Simpan"}</button>
          </div>
        </div>
      )}

      {/* MODAL KATEGORI */}
      {showAddKategori && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "flex-end", zIndex: 50 }} onClick={() => setShowAddKategori(false)}>
          <div style={{ background: theme.card, borderRadius: "20px 20px 0 0", padding: 24, width: "100%", maxWidth: 480, margin: "0 auto" }} onClick={e => e.stopPropagation()}>
            <p style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: theme.text }}>{editKategoriId ? "Edit Kategori" : "Tambah Kategori"}</p>
            <label style={s.label}>Nama Kategori</label>
            <input style={s.input} placeholder="cth: Minuman" value={kategoriForm.nama} onChange={e => setKategoriForm({ ...kategoriForm, nama: e.target.value })} />
            <button style={s.btn} onClick={handleTambahKategori} disabled={loading}>{loading ? "Menyimpan..." : editKategoriId ? "Update" : "Simpan"}</button>
          </div>
        </div>
      )}

      {/* MODAL KARYAWAN */}
      {showAddKaryawan && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "flex-end", zIndex: 50 }} onClick={() => setShowAddKaryawan(false)}>
          <div style={{ background: theme.card, borderRadius: "20px 20px 0 0", padding: 24, width: "100%", maxWidth: 480, margin: "0 auto" }} onClick={e => e.stopPropagation()}>
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
            <button style={s.btn} onClick={handleTambahKaryawan} disabled={loading}>{loading ? "Menyimpan..." : editKaryawanId ? "Update" : "Tambah"}</button>
          </div>
        </div>
      )}

      {/* MODAL STOK */}
      {showStok && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "flex-end", zIndex: 50 }} onClick={() => setShowStok(false)}>
          <div style={{ background: theme.card, borderRadius: "20px 20px 0 0", padding: 24, width: "100%", maxWidth: 480, margin: "0 auto" }} onClick={e => e.stopPropagation()}>
            <p style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: theme.text }}>Kelola Stok</p>
            <label style={s.label}>Pilih Menu</label>
            <select style={s.input} value={stokForm.menu_id} onChange={e => setStokForm({ ...stokForm, menu_id: e.target.value })}>
              <option value="">-- Pilih Menu --</option>
              {menu.map(m => <option key={m.id} value={m.id}>{m.nama} (stok: {m.stok || 0})</option>)}
            </select>
            <label style={s.label}>Stok Baru</label>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={() => setStokForm({ ...stokForm, stok: String(Math.max(0, parseInt(stokForm.stok) - 1 || 0)) }) } style={{ ...s.btnSm, width: 40, padding: 8 }}>−</button>
              <input style={{ ...s.input, textAlign: "center", marginBottom: 0 }} type="number" placeholder="0" value={stokForm.stok} onChange={e => setStokForm({ ...stokForm, stok: e.target.value })} />
              <button onClick={() => setStokForm({ ...stokForm, stok: String(parseInt(stokForm.stok) + 1 || 1) }) } style={{ ...s.btnSm, width: 40, padding: 8 }}>+</button>
            </div>
            <button style={s.btn} onClick={handleUpdateStok} disabled={loading}>{loading ? "Menyimpan..." : "Update Stok"}</button>
          </div>
        </div>
      )}

      {/* MODAL KASIR */}
      {showKasir && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "flex-end", zIndex: 50 }} onClick={() => setShowKasir(false)}>
          <div style={{ background: theme.card, borderRadius: "20px 20px 0 0", padding: 24, width: "100%", maxWidth: 480, margin: "0 auto" }} onClick={e => e.stopPropagation()}>
            <p style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: theme.text }}>🛒 Keranjang Kasir</p>
            {keranjang.length === 0 && <p style={{ color: theme.textMuted, fontSize: 13 }}>Keranjang kosong.</p>}
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
                <button style={s.btn} onClick={handleCheckout} disabled={loading}>{loading ? "Memproses..." : "✅ Bayar"}</button>
              </>
            )}
            <button onClick={() => setShowKasir(false)} style={{ ...s.btn, background: theme.card, border: `1px solid ${theme.cardBorder}`, color: theme.text, marginTop: 8 }}>Tutup</button>
          </div>
        </div>
      )}

      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: theme.card, borderTop: `1px solid ${theme.cardBorder}`, display: "flex", padding: "8px 0 20px", transition: "all 0.3s ease" }}>
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
