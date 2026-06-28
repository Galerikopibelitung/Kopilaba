import { useState, useEffect, useRef } from "react";

// ============================================================
// KONFIGURASI
// ============================================================
const SUPABASE_URL = "https://mxylkyoehzpbbsxgyhcx.supabase.co";
const SUPABASE_KEY = "sb_publishable_JSxrkF5z0bI9aJtl3eucag_OX7GN06D";

const SUPER_ADMIN = {
  id: "super_admin_1",
  email: "admin@kopilaba.com",
  password: "Desember12*",
  nama: "Super Admin",
  role: "super_admin",
  kafe_id: null
};

// ============================================================
// FUNGSI API
// ============================================================
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

// ============================================================
// KOMPONEN UTAMA
// ============================================================
export default function KopiLaba() {
  // ------------------------------------------------------------
  // STATE UMUM
  // ------------------------------------------------------------
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
  const [showLaba, setShowLaba] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [touchStartX, setTouchStartX] = useState(0);
  const [touchCurrentX, setTouchCurrentX] = useState(0);
  const sidebarRef = useRef(null);

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
      } catch (e) { console.warn("Session load error:", e); }
    }
  }, []);

  useEffect(() => {
    if (profile && token) {
      localStorage.setItem("kopilaba_session", JSON.stringify({
        user,
        profile,
        token,
        isSuperAdmin
      }));
    }
  }, [profile, token, user, isSuperAdmin]);

  useEffect(() => {
    document.body.style.margin = "0";
    document.body.style.padding = "0";
    document.body.style.overflowX = "hidden";
    document.body.style.background = darkMode ? "#0F0A06" : "#F8F4F0";
    return () => {
      document.body.style.margin = "";
      document.body.style.padding = "";
      document.body.style.overflowX = "";
      document.body.style.background = "";
    };
  }, [darkMode]);

  useEffect(() => {
    const handleTouchStart = (e) => {
      const touch = e.touches[0];
      setTouchStartX(touch.clientX);
      setTouchCurrentX(touch.clientX);
    };
    const handleTouchMove = (e) => {
      const touch = e.touches[0];
      setTouchCurrentX(touch.clientX);
    };
    const handleTouchEnd = () => {
      const delta = touchCurrentX - touchStartX;
      if (delta > 80) setSidebarOpen(true);
      if (delta < -80) setSidebarOpen(false);
    };
    document.addEventListener("touchstart", handleTouchStart);
    document.addEventListener("touchmove", handleTouchMove);
    document.addEventListener("touchend", handleTouchEnd);
    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [touchStartX, touchCurrentX]);

  // ------------------------------------------------------------
  // STATE LOGIN / REGISTER
  // ------------------------------------------------------------
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [regForm, setRegForm] = useState({ nama: "", email: "", password: "", namaKafe: "", alamatKafe: "", telepon: "" });

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
  const [addForm, setAddForm] = useState({ item: "", qty: "1", total: "", kategori_id: "", menu_id: "" });
  const [pesananItems, setPesananItems] = useState([]);
  const [editTransaksiId, setEditTransaksiId] = useState(null);
  const [pajakEnabled, setPajakEnabled] = useState(true);
  const [persentasePajak, setPersentasePajak] = useState(10);

  // ------------------------------------------------------------
  // STATE MODAL MENU
  // ------------------------------------------------------------
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [menuForm, setMenuForm] = useState({ nama: "", harga: "", hpp: "", stok: "", kategori_id: "", foto: "", qty: "" });
  const [editMenuId, setEditMenuId] = useState(null);

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
  // STATE GANTI PASSWORD
  // ------------------------------------------------------------
  const [showGantiPassword, setShowGantiPassword] = useState(false);
  const [gantiPasswordForm, setGantiPasswordForm] = useState({ oldPassword: "", newPassword: "", confirmPassword: "" });
  const [targetUserId, setTargetUserId] = useState(null);

  // ------------------------------------------------------------
  // STATE ABSENSI
  // ------------------------------------------------------------
  const [showAbsensi, setShowAbsensi] = useState(false);
  const [absensiForm, setAbsensiForm] = useState({ pegawai_id: "", tanggal: "", jam_masuk: "", jam_keluar: "" });
  const [filterNama, setFilterNama] = useState("");
  const [filterTglMulaiAbsen, setFilterTglMulaiAbsen] = useState("");
  const [filterTglSelesaiAbsen, setFilterTglSelesaiAbsen] = useState("");
  const [baristaAbsenLoading, setBaristaAbsenLoading] = useState(false);

  // ------------------------------------------------------------
  // STATE KASIR
  // ------------------------------------------------------------
  const [keranjang, setKeranjang] = useState([]);
  const [showKasir, setShowKasir] = useState(false);
  const [pembayaran, setPembayaran] = useState("tunai");
  const [bayarAmount, setBayarAmount] = useState("");

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

  // ------------------------------------------------------------
  // STATE SUPER ADMIN FILTER
  // ------------------------------------------------------------
  const [adminFilterPeriode, setAdminFilterPeriode] = useState("minggu");
  const [adminFilterOwner, setAdminFilterOwner] = useState("");

  // ------------------------------------------------------------
  // EFFECTS
  // ------------------------------------------------------------
  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(""), 3000);
      return () => clearTimeout(t);
    }
  }, [success]);

  useEffect(() => {
    if (addForm.menu_id && addForm.qty) {
      const selectedMenu = menu.find(m => m.id === addForm.menu_id);
      if (selectedMenu) {
        const qty = parseInt(addForm.qty) || 1;
        const harga = selectedMenu.harga || 0;
        setAddForm(prev => ({
          ...prev,
          total: String(qty * harga)
        }));
      }
    }
  }, [addForm.qty, addForm.menu_id, menu]);

  // ============================================================
  // LOAD DATA
  // ============================================================
  const loadData = async (tok, prof) => {
    try {
      if (prof?.role === "super_admin") {
        await loadAllData(tok);
        return;
      }
      const kafeData = await api(`/rest/v1/kafe?pemilik_id=eq.${prof.id}&limit=1`, "GET", null, tok);
      const k = Array.isArray(kafeData) ? kafeData[0] : null;
      if (!k && prof.kafe_id) {
        const k2 = await api(`/rest/v1/kafe?id=eq.${prof.kafe_id}&limit=1`, "GET", null, tok);
        setKafe(Array.isArray(k2) ? k2[0] : null);
        if (k2) setQrisUrl(k2.qris_url || "");
        await loadTransaksi(tok, prof.kafe_id);
        await loadMenu(tok, prof.kafe_id);
        await loadKategori(tok);
        await loadKaryawan(tok, prof.kafe_id);
        await loadAbsensi(tok, prof.kafe_id);
      } else if (k) {
        setKafe(k);
        setQrisUrl(k.qris_url || "");
        await loadTransaksi(tok, k.id);
        await loadMenu(tok, k.id);
        await loadKategori(tok);
        await loadKaryawan(tok, k.id);
        await loadAbsensi(tok, k.id);
      }
    } catch (err) {
      console.error("Load data error:", err);
      setNetworkError(true);
      setError("Gagal memuat data. Periksa koneksi.");
    }
  };

  const loadAllData = async (tok) => {
    try {
      const owners = await api("/rest/v1/profiles?role=eq.pemilik", "GET", null, tok);
      setAllOwners(Array.isArray(owners) ? owners : []);
      const allTrans = await api("/rest/v1/transaksi?order=created_at.desc&limit=1000", "GET", null, tok);
      setAllTransaksi(Array.isArray(allTrans) ? allTrans : []);
      setTransaksi(Array.isArray(allTrans) ? allTrans : []);
      const allMenu = await api("/rest/v1/menu", "GET", null, tok);
      setMenu(Array.isArray(allMenu) ? allMenu : []);
      const allKategori = await api("/rest/v1/kategori", "GET", null, tok);
      setKategori(Array.isArray(allKategori) ? allKategori : []);
      const allKaryawan = await api("/rest/v1/profiles?role=eq.barista", "GET", null, tok);
      setKaryawan(Array.isArray(allKaryawan) ? allKaryawan : []);
    } catch (err) {
      console.error("Load all data error:", err);
      setError("Gagal memuat data super admin.");
    }
  };

  const loadTransaksi = async (tok, kafeId) => {
    try {
      const data = await api(`/rest/v1/transaksi?kafe_id=eq.${kafeId}&order=created_at.desc&limit=500`, "GET", null, tok);
      setTransaksi(Array.isArray(data) ? data : []);
    } catch (err) { setTransaksi([]); }
  };

  const loadMenu = async (tok, kafeId) => {
    try {
      const data = await api(`/rest/v1/menu?kafe_id=eq.${kafeId}`, "GET", null, tok);
      setMenu(Array.isArray(data) ? data : []);
    } catch (err) { setMenu([]); }
  };

  const loadKategori = async (tok) => {
    try {
      const data = await api("/rest/v1/kategori?order=nama.asc", "GET", null, tok);
      setKategori(Array.isArray(data) ? data : []);
    } catch (err) { setKategori([]); }
  };

  const loadKaryawan = async (tok, kafeId) => {
    try {
      const data = await api(`/rest/v1/profiles?kafe_id=eq.${kafeId}&role=eq.barista`, "GET", null, tok);
      setKaryawan(Array.isArray(data) ? data : []);
    } catch (err) { setKaryawan([]); }
  };

  const loadAbsensi = async (tok, kafeId) => {
    try {
      const data = await api(`/rest/v1/absensi?kafe_id=eq.${kafeId}&order=tanggal.desc`, "GET", null, tok);
      setAbsensi(Array.isArray(data) ? data : []);
    } catch (err) { setAbsensi([]); }
  };

  // ============================================================
  // AUTH
  // ============================================================
  const handleLogin = async () => {
    setLoading(true);
    setError("");
    setNetworkError(false);
    if (loginForm.email === SUPER_ADMIN.email && loginForm.password === SUPER_ADMIN.password) {
      setUser(SUPER_ADMIN);
      setProfile(SUPER_ADMIN);
      setIsSuperAdmin(true);
      setToken("super_admin_token");
      setScreen("app");
      setLoading(false);
      await loadAllData("super_admin_token");
      return;
    }
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
          setIsSuperAdmin(false);
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
            pemilik_id: u.id,
            telepon: regForm.telepon || "",
            qris_url: ""
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
            kafe_id: kafeId,
            telepon: regForm.telepon || ""
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

  // ============================================================
  // GANTI PASSWORD
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
      if (isSuperAdmin && targetUserId) {
        const targetUser = allOwners.find(o => o.id === targetUserId);
        if (!targetUser) {
          setError("User tidak ditemukan.");
          setLoading(false);
          return;
        }
        setSuccess(`Password untuk ${targetUser.nama} berhasil diupdate!`);
        setGantiPasswordForm({ oldPassword: "", newPassword: "", confirmPassword: "" });
        setShowGantiPassword(false);
        setTargetUserId(null);
        setLoading(false);
        return;
      }
      const { data, error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw new Error(error.message);
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

      const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/qris/${kafeId}/${file.name}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${SUPABASE_KEY}`,
        },
        body: file,
      });

      if (!uploadRes.ok) {
        const errText = await uploadRes.text();
        throw new Error(`Upload gagal: ${errText}`);
      }

      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/qris/${kafeId}/${file.name}`;

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
        total: parseInt(addForm.total) || 0
      };
      setPesananItems(prev => [...prev, newItem]);
      setAddForm({ item: "", qty: "1", total: "", kategori_id: "", menu_id: "" });
      setSuccess("Item pengeluaran ditambahkan!");
      return;
    }
    if (!addForm.menu_id) {
      setError("Pilih menu terlebih dahulu!");
      return;
    }
    const selectedMenu = menu.find(m => m.id === addForm.menu_id);
    if (!selectedMenu) return;
    const qty = parseInt(addForm.qty) || 1;
    const total = qty * selectedMenu.harga;
    const newItem = {
      menu_id: selectedMenu.id,
      nama: selectedMenu.nama,
      qty: qty,
      harga: selectedMenu.harga,
      total: total
    };
    setPesananItems(prev => [...prev, newItem]);
    setAddForm({ item: "", qty: "1", total: "", kategori_id: "", menu_id: "" });
    setSuccess("Item ditambahkan ke pesanan!");
  };

  const hapusItemPesanan = (idx) => {
    setPesananItems(prev => prev.filter((_, i) => i !== idx));
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
      const itemNames = pesananItems.map(p => `${p.nama} x${p.qty}`).join(", ");
      const totalQty = pesananItems.reduce((sum, p) => sum + p.qty, 0);
      const subtotal = pesananItems.reduce((sum, p) => sum + p.total, 0);
      let pajak = 0;
      if (pajakEnabled && addType === "masuk") {
        pajak = Math.round(subtotal * (persentasePajak / 100));
      }
      const grandTotal = subtotal + pajak;

      const payload = {
        kafe_id: kafeId,
        item: itemNames,
        qty: totalQty,
        total: grandTotal,
        tipe: addType,
        status: "lunas",
        subtotal: subtotal,
        pajak: pajak,
        pajak_enabled: pajakEnabled && addType === "masuk"
      };
      if (editTransaksiId) {
        await api(`/rest/v1/transaksi?id=eq.${editTransaksiId}`, "PATCH", payload, token);
        setSuccess("Transaksi diupdate!");
        setEditTransaksiId(null);
      } else {
        await api("/rest/v1/transaksi", "POST", payload, token);
        setSuccess("Transaksi tersimpan!");
      }
      if (addType === "masuk") {
        for (const item of pesananItems) {
          if (item.menu_id) {
            const selectedMenu = menu.find(m => m.id === item.menu_id);
            if (selectedMenu) {
              const newStok = (selectedMenu.stok || 0) - item.qty;
              await api(`/rest/v1/menu?id=eq.${item.menu_id}`, "PATCH", { stok: newStok }, token);
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
    setPesananItems([]);
    setShowAdd(true);
  };

  const handleHapusTransaksi = async (id) => {
    if (profile?.role !== "pemilik" && profile?.role !== "super_admin") {
      setError("Hanya pemilik atau admin yang bisa menghapus transaksi.");
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

  // ============================================================
  // CRUD MENU (dengan qty)
  // ============================================================
  const handleTambahMenu = async () => {
    if (profile?.role !== "pemilik" && profile?.role !== "super_admin") {
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

      const payload = {
        kafe_id: kafeId,
        nama: menuForm.nama,
        harga: parseInt(menuForm.harga),
        hpp: parseInt(menuForm.hpp),
        stok: stokValue + qtyValue,
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
      setMenuForm({ nama: "", harga: "", hpp: "", stok: "", kategori_id: "", foto: "", qty: "" });
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
    if (profile?.role !== "pemilik" && profile?.role !== "super_admin") {
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
      qty: ""
    });
    setShowAddMenu(true);
  };

  const handleHapusMenu = async (id) => {
    if (profile?.role !== "pemilik" && profile?.role !== "super_admin") {
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
    if (profile?.role !== "pemilik" && profile?.role !== "super_admin") {
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
    if (profile?.role !== "pemilik" && profile?.role !== "super_admin") return;
    setEditKategoriId(k.id);
    setKategoriForm({ nama: k.nama });
    setShowAddKategori(true);
  };

  const handleHapusKategori = async (id) => {
    if (profile?.role !== "pemilik" && profile?.role !== "super_admin") return;
    if (!confirm("Yakin hapus kategori ini?")) return;
    try {
      await api(`/rest/v1/kategori?id=eq.${id}`, "DELETE", null, token);
      setSuccess("Kategori dihapus!");
      await loadKategori(token);
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
      if (!kafeId && profile?.role !== "super_admin") {
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
      await api("/rest/v1/absensi", "POST", {
        pegawai_id: absensiForm.pegawai_id,
        kafe_id: kafeId,
        tanggal: new Date().toISOString().slice(0,10),
        jam_masuk: now,
        jam_keluar: null
      }, token);
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
      const today = new Date().toISOString().slice(0,10);
      const existing = absensi.find(a => a.pegawai_id === profile.id && a.tanggal === today);
      if (existing && existing.jam_masuk) {
        setError("Anda sudah absen masuk hari ini.");
        setBaristaAbsenLoading(false);
        return;
      }
      const now = new Date().toISOString();
      await api("/rest/v1/absensi", "POST", {
        pegawai_id: profile.id,
        kafe_id: kafeId,
        tanggal: today,
        jam_masuk: now,
        jam_keluar: null
      }, token);
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
      const today = new Date().toISOString().slice(0,10);
      const existing = absensi.find(a => a.pegawai_id === profile.id && a.tanggal === today);
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

  const filteredAbsensi = absensi.filter(a => {
    let match = true;
    if (filterNama) {
      const pegawai = karyawan.find(k => k.id === a.pegawai_id);
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
    setSuccess(`${item.nama} ditambahkan ke keranjang!`);
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
      const subtotal = totalKeranjang;
      let pajak = 0;
      if (pajakEnabled) {
        pajak = Math.round(subtotal * (persentasePajak / 100));
      }
      const grandTotal = subtotal + pajak;

      await api("/rest/v1/transaksi", "POST", {
        kafe_id: kafeId,
        item: itemNames,
        qty: keranjang.reduce((sum, item) => sum + item.qty, 0),
        total: grandTotal,
        tipe: "masuk",
        status: pembayaran === "tunai" ? "lunas" : "belum_lunas",
        subtotal: subtotal,
        pajak: pajak,
        pajak_enabled: pajakEnabled
      }, token);

      for (const item of keranjang) {
        const newStok = (item.stok || 0) - item.qty;
        await api(`/rest/v1/menu?id=eq.${item.id}`, "PATCH", { stok: newStok }, token);
      }

      setKeranjang([]);
      setShowKasir(false);
      setBayarAmount("");
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

  // ============================================================
  // LAPORAN + GRAFIK + EXPORT
  // ============================================================
  const getFilteredTransaksi = () => {
    if (profile?.role === "barista") {
      const today = new Date().toISOString().slice(0,10);
      return transaksi.filter(t => new Date(t.created_at).toISOString().slice(0,10) === today);
    }
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

  const laporanStokData = menu.map(m => ({...m, terjual: 0, sisa: m.stok || 0}));
  filtered.forEach(t => {
    if (t.tipe === "masuk" && t.item) {
      const items = t.item.split(", ");
      items.forEach(itemStr => {
        const parts = itemStr.split(" x");
        const nama = parts[0]?.trim();
        const qty = parseInt(parts[1]) || 1;
        const found = laporanStokData.find(m => m.nama === nama);
        if (found) {
          found.terjual = (found.terjual || 0) + qty;
          found.sisa = (found.stok || 0) - found.terjual;
        }
      });
    }
  });

  const kategoriPenjualan = {};
  filtered.forEach(t => {
    if (t.tipe === "masuk" && t.item) {
      const items = t.item.split(", ");
      items.forEach(itemStr => {
        const parts = itemStr.split(" x");
        const nama = parts[0]?.trim();
        const qty = parseInt(parts[1]) || 1;
        const menuItem = menu.find(m => m.nama === nama);
        if (menuItem) {
          const kat = menuItem.kategori_id || "umum";
          const katNama = kategori.find(k => k.id === kat)?.nama || "Umum";
          if (!kategoriPenjualan[katNama]) kategoriPenjualan[katNama] = 0;
          kategoriPenjualan[katNama] += qty;
        }
      });
    }
  });
  const sortedKategori = Object.entries(kategoriPenjualan).sort((a, b) => b[1] - a[1]);
  const top5Kategori = sortedKategori.slice(0, 5);
  const bottom5Kategori = sortedKategori.slice(-5).reverse();

  const produkPerKategori = {};
  menu.forEach(m => {
    const katNama = kategori.find(k => k.id === m.kategori_id)?.nama || "Umum";
    if (!produkPerKategori[katNama]) produkPerKategori[katNama] = [];
    produkPerKategori[katNama].push(m);
  });
  const produkTerjual = {};
  filtered.forEach(t => {
    if (t.tipe === "masuk" && t.item) {
      const items = t.item.split(", ");
      items.forEach(itemStr => {
        const parts = itemStr.split(" x");
        const nama = parts[0]?.trim();
        const qty = parseInt(parts[1]) || 1;
        if (!produkTerjual[nama]) produkTerjual[nama] = 0;
        produkTerjual[nama] += qty;
      });
    }
  });

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

  // ============================================================
  // AI AGENT (INTERNAL)
  // ============================================================
  const handleAiQuery = async () => {
    if (!aiQuery.trim()) {
      setAiAnswer("Silakan tulis pertanyaan Anda.");
      return;
    }
    setAiLoading(true);
    const q = aiQuery.toLowerCase().trim();

    const totalTransaksi = transaksi.length;
    const totalPemasukan = transaksi.filter(t => t.tipe === "masuk").reduce((a, b) => a + b.total, 0);
    const totalPengeluaran = transaksi.filter(t => t.tipe === "keluar").reduce((a, b) => a + b.total, 0);
    const labaBersih = totalPemasukan - totalPengeluaran;
    const totalMenu = menu.length;
    const totalKategori = kategori.length;
    const totalKaryawan = karyawan.length;
    const totalStokAll = menu.reduce((sum, m) => sum + (m.stok || 0), 0);
    const today = new Date().toISOString().slice(0,10);
    const todayAbsen = absensi.filter(a => a.tanggal === today);
    const top5 = Object.entries(produkTerjual || {}).sort((a, b) => b[1] - a[1]).slice(0, 5);

    let answer = "";

    if (q.includes("total penjualan") || q.includes("omzet") || q.includes("total pemasukan")) {
      answer = `💰 Total pemasukan (omzet) seluruh periode: ${fmt(totalPemasukan)}`;
    }
    else if (q.includes("laba") || q.includes("keuntungan")) {
      answer = `📈 Laba bersih: ${fmt(labaBersih)} (Pemasukan ${fmt(totalPemasukan)}, Pengeluaran ${fmt(totalPengeluaran)})`;
    }
    else if (q.includes("stok") && (q.includes("menipis") || q.includes("habis") || q.includes("kurang"))) {
      const low = menu.filter(m => (m.stok || 0) < 5);
      if (low.length === 0) {
        answer = "✅ Semua stok produk aman (>=5).";
      } else {
        answer = `⚠️ Produk dengan stok menipis (kurang dari 5):\n${low.map(m => `- ${m.nama}: ${m.stok || 0} item`).join("\n")}`;
      }
    }
    else if (q.includes("total stok") || q.includes("jumlah stok")) {
      answer = `📦 Total stok seluruh produk: ${totalStokAll} item`;
    }
    else if (q.includes("karyawan") || q.includes("pegawai") || q.includes("staff")) {
      answer = `👤 Jumlah karyawan: ${totalKaryawan} orang.`;
    }
    else if (q.includes("absensi") || q.includes("kehadiran")) {
      if (todayAbsen.length === 0) {
        answer = "📋 Belum ada absensi hari ini.";
      } else {
        const hadir = todayAbsen.filter(a => a.jam_masuk).length;
        answer = `📋 Absensi hari ini: ${hadir} orang masuk.`;
      }
    }
    else if (q.includes("produk terlaris") || q.includes("terbanyak") || q.includes("best seller")) {
      if (top5.length === 0) {
        answer = "❌ Belum ada data penjualan produk.";
      } else {
        answer = `🏆 Top 5 produk terlaris:\n${top5.map(([nama, qty]) => `- ${nama}: ${qty} item`).join("\n")}`;
      }
    }
    else if (q.includes("kategori") && (q.includes("terlaris") || q.includes("terbanyak"))) {
      const sorted = Object.entries(kategoriPenjualan).sort((a, b) => b[1] - a[1]);
      const top = sorted.slice(0, 5);
      if (top.length === 0) {
        answer = "❌ Belum ada data kategori.";
      } else {
        answer = `🏷️ Top 5 kategori terlaris:\n${top.map(([kat, qty]) => `- ${kat}: ${qty} item`).join("\n")}`;
      }
    }
    else if (q.includes("total transaksi") || q.includes("jumlah transaksi")) {
      answer = `📝 Total transaksi: ${totalTransaksi} transaksi.`;
    }
    else if (q.includes("super admin") || q.includes("admin")) {
      answer = "👑 Super Admin: admin@kopilaba.com / Desember12*";
    }
    else if (q.includes("cuaca") || q.includes("ekonomi") || q.includes("politik") || q.includes("gempa") || q.includes("dunia") || q.includes("nasional")) {
      answer = "🌤️ Saya tidak memiliki akses ke data real-time. Saya hanya bisa menjawab pertanyaan seputar data di aplikasi KopiLaba.\n\n💡 Coba tanyakan: total penjualan, laba, stok menipis, produk terlaris, absensi hari ini, dll.";
    }
    else if (q.includes("apa itu") || q.includes("siapa itu") || q.includes("bagaimana cara") || q.includes("jelaskan")) {
      if (q.includes("kopi")) {
        answer = "☕ Kopi adalah minuman yang dibuat dari biji kopi yang disangrai dan diseduh.";
      } else if (q.includes("react")) {
        answer = "⚛️ React adalah library JavaScript untuk membangun antarmuka pengguna (UI).";
      } else if (q.includes("supabase")) {
        answer = "🗄️ Supabase adalah platform backend open-source dengan database PostgreSQL.";
      } else if (q.includes("ai") || q.includes("artificial intelligence")) {
        answer = "🤖 AI (Artificial Intelligence) adalah bidang ilmu komputer yang berfokus pada pembuatan sistem yang dapat berpikir dan belajar.";
      } else if (q.includes("kopilaba")) {
        answer = "☕ KopiLaba adalah aplikasi manajemen keuangan untuk kafe kopi.";
      } else {
        answer = `📖 Saya tidak memiliki pengetahuan tentang pertanyaan tersebut. Saya adalah AI untuk membantu Anda mengelola KopiLaba.`;
      }
    }
    else {
      answer = `📊 **Ringkasan Data KopiLaba:**\n- Total transaksi: ${totalTransaksi}\n- Total pemasukan: ${fmt(totalPemasukan)}\n- Total pengeluaran: ${fmt(totalPengeluaran)}\n- Laba bersih: ${fmt(labaBersih)}\n- Total menu: ${totalMenu}\n- Total kategori: ${totalKategori}\n- Total karyawan: ${totalKaryawan}\n- Total stok: ${totalStokAll} item\n${top5.length > 0 ? `- Produk terlaris: ${top5[0][0]} (${top5[0][1]} item)` : ''}\n\n💡 Coba tanyakan: "total penjualan", "laba", "stok menipis", "produk terlaris", "absensi hari ini", "apa itu kopi", dll.`;
    }

    setAiAnswer(answer);
    setAiLoading(false);
  };

  // ============================================================
  // SUPER ADMIN DASHBOARD
  // ============================================================
  const getAdminFilteredTransaksi = () => {
    let filtered = [...allTransaksi];
    const now = new Date();
    let start = new Date();
    if (adminFilterPeriode === "minggu") start.setDate(now.getDate() - 7);
    else if (adminFilterPeriode === "bulan") start.setMonth(now.getMonth() - 1);
    else if (adminFilterPeriode === "tahun") start.setFullYear(now.getFullYear() - 1);
    else start = new Date(0);

    filtered = filtered.filter(t => new Date(t.created_at) >= start);
    if (adminFilterOwner) {
      const ownerKafe = allOwners.find(o => o.id === adminFilterOwner);
      if (ownerKafe) {
        filtered = filtered.filter(t => t.kafe_id === ownerKafe.kafe_id);
      }
    }
    return filtered;
  };

  const adminFiltered = getAdminFilteredTransaksi();
  const adminTotalPemasukan = adminFiltered.filter(t => t.tipe === "masuk").reduce((a, b) => a + b.total, 0);
  const adminTotalPengeluaran = adminFiltered.filter(t => t.tipe === "keluar").reduce((a, b) => a + b.total, 0);
  const adminLaba = adminTotalPemasukan - adminTotalPengeluaran;

  // ============================================================
  // THEME & STYLES
  // ============================================================
  const theme = darkMode ? {
    bg: "#0F0A06",
    card: "rgba(26, 18, 8, 0.75)",
    cardBorder: "rgba(255,255,255,0.08)",
    text: "#F5EFE6",
    textMuted: "#8B7355",
    input: "rgba(15, 10, 6, 0.6)",
    inputBorder: "rgba(255,255,255,0.1)",
    gold: "#C8822A",
    success: "#6DBF5A",
    danger: "#EF8080",
    headerBg: "rgba(26, 15, 7, 0.85)",
    shadow: "0 8px 32px rgba(0,0,0,0.5)",
    blur: "blur(20px)",
  } : {
    bg: "#F8F4F0",
    card: "rgba(255, 255, 255, 0.7)",
    cardBorder: "rgba(0,0,0,0.06)",
    text: "#1A1208",
    textMuted: "#6B5A4A",
    input: "rgba(255,255,255,0.5)",
    inputBorder: "rgba(0,0,0,0.08)",
    gold: "#B8860B",
    success: "#2E7D32",
    danger: "#C62828",
    headerBg: "rgba(240, 234, 228, 0.85)",
    shadow: "0 8px 32px rgba(0,0,0,0.08)",
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
      color: darkMode ? "#fff" : "#1A1208",
      fontSize: 15,
      fontWeight: 700,
      cursor: "pointer",
      transition: "all 0.3s ease",
      boxShadow: "0 4px 12px rgba(200,130,42,0.3)",
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

  // ============================================================
  // RENDER LOGIN & REGISTER (sama seperti sebelumnya)
  // ============================================================
  if (screen === "login") return (
    <div style={{
      ...s.wrap,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100vh",
      padding: "20px",
      margin: 0,
      background: darkMode ? "#0F0A06" : "#F8F4F0",
      width: "100%",
    }}>
      <div style={{
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
      }}>
        <h1 style={{ fontSize: 44, fontWeight: 900, marginBottom: 4, letterSpacing: 4, fontFamily: "'Inter',system-ui,sans-serif", textAlign: "center" }}>
          <span style={{ color: theme.gold, textShadow: darkMode ? "0 0 40px rgba(200,130,42,0.3)" : "0 0 40px rgba(184,134,11,0.15)" }}>KOPI</span>
          <span style={{ color: theme.text }}>LABA</span>
        </h1>
        <div style={{ width: 80, height: 3, background: `linear-gradient(90deg, transparent, ${theme.gold}, transparent)`, margin: "8px auto 16px", borderRadius: 2 }}></div>
        <p style={{ color: theme.textMuted, marginBottom: 40, fontSize: 14, letterSpacing: 1, fontWeight: 300, textAlign: "center" }}>Manajemen Keuangan Kafe</p>
        {error && <div style={{ background: darkMode ? "rgba(42,26,26,0.8)" : "rgba(255,235,238,0.8)", border: `1px solid ${theme.danger}`, borderRadius: 12, padding: 12, marginBottom: 14, fontSize: 13, color: theme.danger }}>{error}</div>}
        {success && <div style={{ background: darkMode ? "rgba(26,42,26,0.8)" : "rgba(232,245,233,0.8)", border: `1px solid ${theme.success}`, borderRadius: 12, padding: 12, marginBottom: 14, fontSize: 13, color: theme.success }}>{success}</div>}
        <label style={s.label}>Email</label>
        <input style={s.input} type="email" placeholder="email@kamu.com" value={loginForm.email} onChange={e => setLoginForm({ ...loginForm, email: e.target.value })} />
        <label style={s.label}>Password</label>
        <input style={s.input} type="password" placeholder="Masukkan password" value={loginForm.password} onChange={e => setLoginForm({ ...loginForm, password: e.target.value })} />
        <button style={s.btn} onClick={handleLogin} disabled={loading}>{loading ? "Masuk..." : "Masuk"}</button>
        <p style={{ textAlign: "center", marginTop: 20, color: theme.textMuted, fontSize: 14 }}>Belum punya akun? <span style={{ color: theme.gold, cursor: "pointer", fontWeight: 600 }} onClick={() => { setScreen("register"); setError(""); }}>Daftar</span></p>
        <div style={{ marginTop: 30, display: "flex", justifyContent: "center", gap: 12 }}>
          <button onClick={() => setDarkMode(true)} style={{ padding: "6px 20px", borderRadius: 20, border: darkMode ? `2px solid ${theme.gold}` : `1px solid ${theme.textMuted}`, background: "transparent", color: darkMode ? theme.gold : theme.textMuted, cursor: "pointer", fontSize: 13 }}>🌙 Dark</button>
          <button onClick={() => setDarkMode(false)} style={{ padding: "6px 20px", borderRadius: 20, border: !darkMode ? `2px solid ${theme.gold}` : `1px solid ${theme.textMuted}`, background: "transparent", color: !darkMode ? theme.gold : theme.textMuted, cursor: "pointer", fontSize: 13 }}>☀️ Light</button>
        </div>
      </div>
    </div>
  );

  if (screen === "register") return (
    <div style={{ ...s.wrap, padding: "20px" }}>
      <div style={{ width: "100%", maxWidth: 400, margin: "0 auto", padding: "24px", background: theme.card, backdropFilter: theme.blur, WebkitBackdropFilter: theme.blur, borderRadius: 32, border: `1px solid ${theme.cardBorder}`, boxShadow: theme.shadow }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4, textAlign: "center" }}><span style={{ color: theme.gold }}>KOPI</span><span style={{ color: theme.text }}>LABA</span></h2>
        <p style={{ color: theme.textMuted, marginBottom: 24, textAlign: "center" }}>Buat akun baru</p>
        {error && <div style={{ background: darkMode ? "rgba(42,26,26,0.8)" : "rgba(255,235,238,0.8)", border: `1px solid ${theme.danger}`, borderRadius: 12, padding: 12, marginBottom: 14, fontSize: 13, color: theme.danger }}>{error}</div>}
        <label style={s.label}>Nama Lengkap</label>
        <input style={s.input} placeholder="Nama kamu" value={regForm.nama} onChange={e => setRegForm({ ...regForm, nama: e.target.value })} />
        <label style={s.label}>Email</label>
        <input style={s.input} type="email" placeholder="email@kamu.com" value={regForm.email} onChange={e => setRegForm({ ...regForm, email: e.target.value })} />
        <label style={s.label}>Password</label>
        <input style={s.input} type="password" placeholder="Min. 6 karakter" value={regForm.password} onChange={e => setRegForm({ ...regForm, password: e.target.value })} />
        <label style={s.label}>Telepon</label>
        <input style={s.input} type="tel" placeholder="08xxxxxxxxxx" value={regForm.telepon} onChange={e => setRegForm({ ...regForm, telepon: e.target.value })} />
        <div style={{ background: theme.input, borderRadius: 12, padding: "12px 16px", marginBottom: 10, border: `1px solid ${theme.cardBorder}` }}>
          <p style={{ margin: 0, fontSize: 14, color: theme.gold, fontWeight: 600 }}>🏠 Pemilik Kafe</p>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: theme.textMuted }}>Anda akan membuat dan mengelola kafe</p>
        </div>
        <label style={s.label}>Nama Kafe</label>
        <input style={s.input} placeholder="Nama kafe kamu" value={regForm.namaKafe} onChange={e => setRegForm({ ...regForm, namaKafe: e.target.value })} />
        <label style={s.label}>Alamat Kafe</label>
        <input style={s.input} placeholder="Alamat kafe" value={regForm.alamatKafe} onChange={e => setRegForm({ ...regForm, alamatKafe: e.target.value })} />
        <button style={s.btn} onClick={handleRegister} disabled={loading}>{loading ? "Mendaftar..." : "Daftar Sekarang"}</button>
        <p style={{ textAlign: "center", marginTop: 20, color: theme.textMuted, fontSize: 14 }}>Sudah punya akun? <span style={{ color: theme.gold, cursor: "pointer", fontWeight: 600 }} onClick={() => { setScreen("login"); setError(""); }}>Masuk</span></p>
      </div>
    </div>
  );

  // ============================================================
  // MAIN APP
  // ============================================================
  const tabs = isSuperAdmin ? [
    { id: "admin", icon: "👑", label: "Admin" },
    { id: "dashboard", icon: "⊞", label: "Ringkasan" },
    { id: "transaksi", icon: "↕", label: "Transaksi" },
    { id: "menu", icon: "☕", label: "Menu" },
    { id: "karyawan", icon: "👤", label: "Karyawan" },
    { id: "laporan", icon: "📊", label: "Laporan" },
    { id: "struk", icon: "🧾", label: "Struk" },
    { id: "qris", icon: "📱", label: "QRIS" },
  ] : [
    { id: "dashboard", icon: "⊞", label: "Ringkasan" },
    { id: "transaksi", icon: "↕", label: "Transaksi" },
    { id: "menu", icon: "☕", label: "Menu" },
    { id: "karyawan", icon: "👤", label: "Karyawan" },
    { id: "laporan", icon: "📊", label: "Laporan" },
    { id: "struk", icon: "🧾", label: "Struk" },
    { id: "qris", icon: "📱", label: "QRIS" },
  ];

  const isPemilik = profile?.role === "pemilik" || isSuperAdmin;
  const isBarista = profile?.role === "barista";

  // Data untuk dashboard
  const totalMasukAll = transaksi.filter(t => t.tipe === "masuk").reduce((a, b) => a + b.total, 0);
  const totalKeluarAll = transaksi.filter(t => t.tipe === "keluar").reduce((a, b) => a + b.total, 0);
  const labaAll = totalMasukAll - totalKeluarAll;

  // Filter menu berdasarkan kategori
  const filteredMenu = selectedKategori ? menu.filter(m => m.kategori_id === selectedKategori) : menu;

  return (
    <div style={s.wrap}>
      {/* HEADER */}
      <div style={{ padding: "16px 20px", background: theme.headerBg, backdropFilter: theme.blur, WebkitBackdropFilter: theme.blur, transition: "all 0.3s ease", width: "100%", boxSizing: "border-box", position: "sticky", top: 0, zIndex: 20, borderBottom: `1px solid ${theme.cardBorder}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => setSidebarOpen(true)} style={{ background: "transparent", border: "none", fontSize: 24, cursor: "pointer", color: theme.text, padding: 4 }}>
              ☰
            </button>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}><span style={{ color: theme.gold }}>KOPI</span><span style={{ color: theme.text }}>LABA</span></h1>
              <p style={{ margin: 0, fontSize: 12, color: theme.textMuted }}>
                {isSuperAdmin ? "👑 Super Admin" : `${kafe?.nama || "Kafe kamu"} · ${profile?.role}`}
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            {!isSuperAdmin && (
              <button onClick={() => setShowKasir(true)} style={{ background: theme.gold, border: "none", borderRadius: 10, padding: "6px 14px", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>🛒 Kasir</button>
            )}
            <button onClick={() => setDarkMode(!darkMode)} style={{ background: "transparent", border: "none", fontSize: 20, cursor: "pointer" }}>{darkMode ? "☀️" : "🌙"}</button>
            <button onClick={() => { setShowGantiPassword(true); setTargetUserId(null); }} style={{ background: "transparent", border: "none", fontSize: 18, cursor: "pointer", color: theme.textMuted }}>🔑</button>
            <button onClick={() => { localStorage.removeItem("kopilaba_session"); setUser(null); setToken(null); setProfile(null); setIsSuperAdmin(false); setScreen("login"); }} style={{ background: "transparent", border: "none", fontSize: 20, cursor: "pointer", color: theme.textMuted }}>✕</button>
          </div>
        </div>
      </div>

      {/* SIDEBAR */}
      <div ref={sidebarRef} style={{
        position: "fixed",
        top: 0,
        left: 0,
        height: "100%",
        width: "280px",
        background: theme.card,
        backdropFilter: theme.blur,
        WebkitBackdropFilter: theme.blur,
        borderRight: `1px solid ${theme.cardBorder}`,
        boxShadow: theme.shadow,
        transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)",
        transition: "transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)",
        zIndex: 100,
        padding: "20px 16px",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 30 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>☕ Menu</h2>
          <button onClick={() => setSidebarOpen(false)} style={{ background: "transparent", border: "none", fontSize: 24, cursor: "pointer", color: theme.text }}>✕</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); setSidebarOpen(false); }} style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "12px 16px",
              borderRadius: 12,
              border: "none",
              background: tab === t.id ? theme.gold : "transparent",
              color: tab === t.id ? (darkMode ? "#fff" : "#1A1208") : theme.textMuted,
              fontWeight: tab === t.id ? 700 : 400,
              fontSize: 15,
              cursor: "pointer",
              transition: "all 0.2s",
              width: "100%",
            }}>
              <span style={{ fontSize: 20 }}>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
        <div style={{ marginTop: "auto", borderTop: `1px solid ${theme.cardBorder}`, paddingTop: 16 }}>
          <button onClick={() => { localStorage.removeItem("kopilaba_session"); setUser(null); setToken(null); setProfile(null); setIsSuperAdmin(false); setScreen("login"); setSidebarOpen(false); }} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 12, border: "none", background: "transparent", color: theme.danger, fontSize: 15, cursor: "pointer", width: "100%" }}>
            🚪 Logout
          </button>
        </div>
      </div>

      {/* OVERLAY */}
      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.4)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          zIndex: 99,
          transition: "opacity 0.3s",
        }} />
      )}

      {/* TOAST */}
      {success && <div style={{ margin: "0 20px 10px", background: darkMode ? "rgba(26,42,26,0.8)" : "rgba(232,245,233,0.8)", backdropFilter: "blur(10px)", border: `1px solid ${theme.success}`, borderRadius: 12, padding: "10px 14px", fontSize: 13, color: theme.success }}>{success}</div>}
      {error && <div style={{ margin: "0 20px 10px", background: darkMode ? "rgba(42,26,26,0.8)" : "rgba(255,235,238,0.8)", backdropFilter: "blur(10px)", border: `1px solid ${theme.danger}`, borderRadius: 12, padding: "10px 14px", fontSize: 13, color: theme.danger }} onClick={() => setError("")}>{error}</div>}
      {networkError && (
        <div style={{ margin: "0 20px 10px", background: darkMode ? "rgba(42,26,26,0.8)" : "rgba(255,235,238,0.8)", backdropFilter: "blur(10px)", border: `1px solid ${theme.danger}`, borderRadius: 12, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, color: theme.danger }}>⚠️ {error || "Koneksi bermasalah"}</span>
          <button onClick={() => { setNetworkError(false); if (token && profile) loadData(token, profile); }} style={{ background: theme.gold, border: "none", borderRadius: 8, padding: "4px 12px", color: darkMode ? "#fff" : "#1A1208", fontWeight: 600, cursor: "pointer", fontSize: 12 }}>Coba Lagi</button>
        </div>
      )}

      {/* CONTENT */}
      <div style={{ padding: "14px 20px 100px", width: "100%", boxSizing: "border-box", flex: 1 }}>

        {/* SUPER ADMIN DASHBOARD */}
        {isSuperAdmin && tab === "admin" && (
          <div style={s.card}>
            <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 10, color: theme.gold }}>👑 Super Admin Dashboard</p>
            <p style={{ fontSize: 12, color: theme.textMuted, marginBottom: 14 }}>Lihat data semua owner dan toko</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
              <select style={s.input} value={adminFilterOwner} onChange={e => setAdminFilterOwner(e.target.value)}>
                <option value="">Semua Owner</option>
                {allOwners.map(o => (
                  <option key={o.id} value={o.id}>{o.nama} - {o.kafe_id || "Tidak ada toko"}</option>
                ))}
              </select>
              <select style={s.input} value={adminFilterPeriode} onChange={e => setAdminFilterPeriode(e.target.value)}>
                <option value="minggu">Minggu Ini</option>
                <option value="bulan">Bulan Ini</option>
                <option value="tahun">Tahun Ini</option>
                <option value="semua">Semua Waktu</option>
              </select>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
              <div style={{ background: theme.input, borderRadius: 12, padding: 12 }}><p style={{ margin: 0, fontSize: 10, color: theme.textMuted }}>Total Transaksi</p><p style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{adminFiltered.length}</p></div>
              <div style={{ background: theme.input, borderRadius: 12, padding: 12 }}><p style={{ margin: 0, fontSize: 10, color: theme.textMuted }}>Keuntungan</p><p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: adminLaba >= 0 ? theme.success : theme.danger }}>{fmt(adminLaba)}</p></div>
              <div style={{ background: theme.input, borderRadius: 12, padding: 12 }}><p style={{ margin: 0, fontSize: 10, color: theme.textMuted }}>Pemasukan</p><p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: theme.success }}>{fmt(adminTotalPemasukan)}</p></div>
              <div style={{ background: theme.input, borderRadius: 12, padding: 12 }}><p style={{ margin: 0, fontSize: 10, color: theme.textMuted }}>Pengeluaran</p><p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: theme.danger }}>{fmt(adminTotalPengeluaran)}</p></div>
            </div>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>📋 Daftar Owner & Toko</p>
            <div style={s.card}>
              {allOwners.length === 0 && <p style={{ color: theme.textMuted }}>Belum ada owner terdaftar.</p>}
              {allOwners.map(o => (
                <div key={o.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, paddingBottom: 4, borderBottom: `1px solid ${theme.cardBorder}`, marginBottom: 4 }}>
                  <span><strong>{o.nama}</strong> ({o.email})</span>
                  <span>{o.kafe_id ? "🏠 Ada toko" : "🚫 Tidak ada toko"}</span>
                  <button onClick={() => { setTargetUserId(o.id); setShowGantiPassword(true); }} style={{ background: "transparent", border: "none", color: theme.gold, cursor: "pointer", fontSize: 12 }}>🔑 Ganti Password</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* DASHBOARD */}
        {!isSuperAdmin && tab === "dashboard" && (
          <>
            <div style={{ background: `linear-gradient(135deg,${theme.gold},${darkMode ? "#8B5A1A" : "#B8860B"})`, borderRadius: 24, padding: 24, marginBottom: 14, boxShadow: theme.shadow }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.7)" }}>Laba Bersih</p>
                <button onClick={() => setShowLaba(!showLaba)} style={{ background: "transparent", border: "none", fontSize: 18, cursor: "pointer", color: "rgba(255,255,255,0.8)", transition: "all 0.3s" }}>
                  {showLaba ? "❖" : "✕"}
                </button>
              </div>
              <p style={{ margin: "0 0 16px", fontSize: 30, fontWeight: 800, color: "#fff", filter: showLaba ? "none" : "blur(8px)", transition: "filter 0.3s" }}>
                {showLaba ? fmt(labaAll) : "••••••••"}
              </p>
              <div style={{ display: "flex", gap: 16 }}>
                <div>
                  <p style={{ margin: 0, fontSize: 10, color: "rgba(255,255,255,0.6)" }}>Pemasukan</p>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#fff", filter: showLaba ? "none" : "blur(6px)", transition: "filter 0.3s" }}>
                    {showLaba ? fmt(totalMasukAll) : "••••••••"}
                  </p>
                </div>
                <div style={{ width: 1, background: "rgba(255,255,255,0.2)" }}></div>
                <div>
                  <p style={{ margin: 0, fontSize: 10, color: "rgba(255,255,255,0.6)" }}>Pengeluaran</p>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#fff", filter: showLaba ? "none" : "blur(6px)", transition: "filter 0.3s" }}>
                    {showLaba ? fmt(totalKeluarAll) : "••••••••"}
                  </p>
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
              <button onClick={() => { setShowAdd(true); setAddType("masuk"); setEditTransaksiId(null); setPesananItems([]); setAddForm({ item: "", qty: "1", total: "", kategori_id: "", menu_id: "" }); }} style={{ background: darkMode ? "rgba(26,42,26,0.5)" : "rgba(232,245,233,0.5)", backdropFilter: "blur(10px)", border: `1px solid ${darkMode ? "rgba(42,74,42,0.3)" : "rgba(165,214,167,0.3)"}`, borderRadius: 14, padding: 16, cursor: "pointer", textAlign: "left" }}>
                <p style={{ margin: "0 0 4px", fontSize: 20 }}>💰</p><p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: theme.success }}>Catat Pemasukan</p>
              </button>
              <button onClick={() => { setShowAdd(true); setAddType("keluar"); setEditTransaksiId(null); setPesananItems([]); setAddForm({ item: "", qty: "1", total: "", kategori_id: "", menu_id: "" }); }} style={{ background: darkMode ? "rgba(42,26,26,0.5)" : "rgba(255,235,238,0.5)", backdropFilter: "blur(10px)", border: `1px solid ${darkMode ? "rgba(74,42,42,0.3)" : "rgba(239,154,154,0.3)"}`, borderRadius: 14, padding: 16, cursor: "pointer", textAlign: "left" }}>
                <p style={{ margin: "0 0 4px", fontSize: 20 }}>🧾</p><p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: theme.danger }}>Catat Pengeluaran</p>
              </button>
            </div>

            <div style={s.card}>
              <p style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 600 }}>Transaksi Terbaru</p>
              {transaksi.length === 0 && <p style={{ color: theme.textMuted, fontSize: 13 }}>Belum ada transaksi.</p>}
              {transaksi.slice(0, 5).map(t => (
                <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 10, marginBottom: 10, borderBottom: `1px solid ${theme.cardBorder}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: t.tipe === "masuk" ? (darkMode ? "#1A2A1A" : "#E8F5E9") : (darkMode ? "#2A1A1A" : "#FFEBEE"), display: "flex", alignItems: "center", justifyContent: "center", color: t.tipe === "masuk" ? theme.success : theme.danger }}>{t.tipe === "masuk" ? "↑" : "↓"}</div>
                    <div><p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{t.item}</p><p style={{ margin: 0, fontSize: 11, color: theme.textMuted }}>Qty {t.qty} · {t.status === "belum_lunas" ? "🔴 Piutang" : "✅ Lunas"}</p></div>
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
              {isPemilik && <button onClick={() => setShowStok(true)} style={{ ...s.btnSm, marginTop: 10, width: "100%" }}>Kelola Stok</button>}
            </div>
          </>
        )}

        {/* TRANSAKSI */}
        {tab === "transaksi" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Semua Transaksi</p>
              {!isSuperAdmin && <button style={s.btnSm} onClick={() => { setShowAdd(true); setEditTransaksiId(null); setPesananItems([]); setAddForm({ item: "", qty: "1", total: "", kategori_id: "", menu_id: "" }); }}>+ Tambah</button>}
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
                    <div><p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{t.item}</p><p style={{ margin: 0, fontSize: 11, color: theme.textMuted }}>Qty {t.qty} · {new Date(t.created_at).toLocaleDateString("id-ID")} · {t.status === "belum_lunas" ? "🔴 Piutang" : "✅ Lunas"}</p></div>
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
          </>
        )}

        {/* MENU - DENGAN FILTER KATEGORI */}
        {tab === "menu" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Menu & Kategori</p>
              <div style={{ display: "flex", gap: 8 }}>
                {isPemilik && (
                  <>
                    <button style={s.btnSm} onClick={() => { setEditKategoriId(null); setKategoriForm({ nama: "" }); setShowAddKategori(true); }}>🏷️</button>
                    <button style={s.btnSm} onClick={() => { setEditMenuId(null); setMenuForm({ nama: "", harga: "", hpp: "", stok: "", kategori_id: "", foto: "", qty: "" }); setShowAddMenu(true); }}>+ Tambah</button>
                  </>
                )}
              </div>
            </div>

            {/* Filter Kategori */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
              <button
                onClick={() => setSelectedKategori("")}
                style={{
                  padding: "6px 16px",
                  borderRadius: 20,
                  border: "none",
                  background: selectedKategori === "" ? theme.gold : theme.input,
                  color: selectedKategori === "" ? (darkMode ? "#fff" : "#1A1208") : theme.textMuted,
                  fontWeight: selectedKategori === "" ? 700 : 400,
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                Semua
              </button>
              {kategori.map(k => (
                <button
                  key={k.id}
                  onClick={() => setSelectedKategori(selectedKategori === k.id ? "" : k.id)}
                  style={{
                    padding: "6px 16px",
                    borderRadius: 20,
                    border: "none",
                    background: selectedKategori === k.id ? theme.gold : theme.input,
                    color: selectedKategori === k.id ? (darkMode ? "#fff" : "#1A1208") : theme.textMuted,
                    fontWeight: selectedKategori === k.id ? 700 : 400,
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                >
                  {k.nama}
                </button>
              ))}
            </div>

            {filteredMenu.length === 0 && <div style={s.card}><p style={{ color: theme.textMuted, fontSize: 13 }}>Tidak ada menu di kategori ini.</p></div>}
            {filteredMenu.map(m => {
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
                  {!isSuperAdmin && (
                    <button onClick={() => tambahKeKeranjang(m)} style={{ ...s.btnSm, marginTop: 8, width: "100%", background: stok <= 0 ? theme.textMuted : theme.gold }} disabled={stok <= 0}>
                      {stok <= 0 ? "Stok Habis" : "🛒 +"}
                    </button>
                  )}
                </div>
              );
            })}
          </>
        )}

        {/* KARYAWAN & ABSENSI */}
        {tab === "karyawan" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Daftar Karyawan</p>
              {isPemilik && <button style={s.btnSm} onClick={() => { setEditKaryawanId(null); setKaryawanForm({ nama: "", email: "", password: "" }); setShowAddKaryawan(true); }}>+ Tambah</button>}
            </div>
            {karyawan.length === 0 && <div style={s.card}><p style={{ color: theme.textMuted, fontSize: 13 }}>Belum ada karyawan.</p></div>}
            {karyawan.map(k => (
              <div key={k.id} style={s.card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div><p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{k.nama}</p><p style={{ margin: "4px 0 0", fontSize: 12, color: theme.textMuted }}>{k.email || "Barista"}</p></div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {isPemilik && (
                      <>
                        <button onClick={() => handleEditKaryawan(k)} style={{ background: "transparent", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: 14 }}>✏️</button>
                        <button onClick={() => handleHapusKaryawan(k.id)} style={{ background: "transparent", border: "none", color: theme.danger, cursor: "pointer", fontSize: 14 }}>🗑️</button>
                      </>
                    )}
                    {isPemilik && <button onClick={() => { setAbsensiForm({ ...absensiForm, pegawai_id: k.id }); setShowAbsensi(true); }} style={{ background: theme.gold, border: "none", borderRadius: 6, padding: "4px 10px", color: "#fff", fontSize: 11, cursor: "pointer" }}>Absen</button>}
                    {isPemilik && <button onClick={() => { setTargetUserId(k.id); setShowGantiPassword(true); }} style={{ background: "transparent", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: 12 }}>🔑</button>}
                  </div>
                </div>
              </div>
            ))}

            {profile?.role === "barista" && (
              <div style={s.card}>
                <p style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700 }}>📋 Absen Saya</p>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={handleBaristaAbsenMasuk} disabled={baristaAbsenLoading || absensi.some(a => a.pegawai_id === profile.id && a.tanggal === new Date().toISOString().slice(0,10) && a.jam_masuk)} style={{ ...s.btnSm, flex: 1, background: (baristaAbsenLoading || absensi.some(a => a.pegawai_id === profile.id && a.tanggal === new Date().toISOString().slice(0,10) && a.jam_masuk)) ? theme.textMuted : theme.success }}>
                    {baristaAbsenLoading ? "..." : "✅ Absen Masuk"}
                  </button>
                  <button onClick={handleBaristaAbsenKeluar} disabled={baristaAbsenLoading || !absensi.some(a => a.pegawai_id === profile.id && a.tanggal === new Date().toISOString().slice(0,10) && a.jam_masuk) || absensi.some(a => a.pegawai_id === profile.id && a.tanggal === new Date().toISOString().slice(0,10) && a.jam_keluar)} style={{ ...s.btnSm, flex: 1, background: (baristaAbsenLoading || !absensi.some(a => a.pegawai_id === profile.id && a.tanggal === new Date().toISOString().slice(0,10) && a.jam_masuk) || absensi.some(a => a.pegawai_id === profile.id && a.tanggal === new Date().toISOString().slice(0,10) && a.jam_keluar)) ? theme.textMuted : theme.danger }}>
                    {baristaAbsenLoading ? "..." : "❌ Absen Keluar"}
                  </button>
                </div>
                {(() => {
                  const today = new Date().toISOString().slice(0,10);
                  const todayAbsen = absensi.find(a => a.pegawai_id === profile.id && a.tanggal === today);
                  if (todayAbsen) {
                    return <p style={{ marginTop: 10, fontSize: 13, color: theme.textMuted }}>Status: {todayAbsen.jam_masuk ? `✅ Masuk ${new Date(todayAbsen.jam_masuk).toLocaleTimeString("id-ID", {hour:'2-digit', minute:'2-digit'})}` : "Belum masuk"}{todayAbsen.jam_keluar && ` | Keluar ${new Date(todayAbsen.jam_keluar).toLocaleTimeString("id-ID", {hour:'2-digit', minute:'2-digit'})}`}</p>;
                  }
                  return <p style={{ marginTop: 10, fontSize: 13, color: theme.textMuted }}>Belum ada absensi hari ini.</p>;
                })()}
              </div>
            )}

            {isPemilik && (
              <div style={{ marginTop: 20 }}>
                <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>📋 Riwayat Absensi</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                  <input style={s.input} placeholder="Cari nama..." value={filterNama} onChange={e => setFilterNama(e.target.value)} />
                  <input style={s.input} type="date" value={filterTglMulaiAbsen} onChange={e => setFilterTglMulaiAbsen(e.target.value)} />
                  <input style={s.input} type="date" value={filterTglSelesaiAbsen} onChange={e => setFilterTglSelesaiAbsen(e.target.value)} />
                  <button style={s.btnSm} onClick={() => { setFilterNama(""); setFilterTglMulaiAbsen(""); setFilterTglSelesaiAbsen(""); }}>Reset</button>
                </div>
                <div style={s.card}>
                  {filteredAbsensi.length === 0 && <p style={{ color: theme.textMuted, fontSize: 13 }}>Tidak ada data absensi.</p>}
                  {filteredAbsensi.map(a => {
                    const pegawai = karyawan.find(k => k.id === a.pegawai_id);
                    return (
                      <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 8, marginBottom: 8, borderBottom: `1px solid ${theme.cardBorder}` }}>
                        <div><p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{pegawai?.nama || "Tidak diketahui"}</p><p style={{ margin: 0, fontSize: 11, color: theme.textMuted }}>{new Date(a.tanggal).toLocaleDateString("id-ID")}</p></div>
                        <div style={{ textAlign: "right" }}>
                          <p style={{ margin: 0, fontSize: 12, color: a.jam_masuk ? theme.success : theme.danger }}>{a.jam_masuk ? `Masuk: ${new Date(a.jam_masuk).toLocaleTimeString("id-ID", {hour:'2-digit', minute:'2-digit'})}` : "Belum masuk"}</p>
                          {a.jam_masuk && <p style={{ margin: 0, fontSize: 12, color: a.jam_keluar ? theme.textMuted : theme.gold }}>{a.jam_keluar ? `Keluar: ${new Date(a.jam_keluar).toLocaleTimeString("id-ID", {hour:'2-digit', minute:'2-digit'})}` : "Belum keluar"}</p>}
                          {isPemilik && a.jam_masuk && !a.jam_keluar && <button onClick={() => handleAbsenKeluar(a.id)} style={{ ...s.btnSm, fontSize: 10, padding: "4px 8px" }}>Absen Keluar</button>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* LAPORAN */}
        {tab === "laporan" && (
          <div style={s.card}>
            <p style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700 }}>📊 Laporan Keuangan</p>

            {/* AI Agent */}
            <div style={{ marginBottom: 16, padding: 12, background: theme.input, borderRadius: 12, border: `1px solid ${theme.gold}` }}>
              <p style={{ fontWeight: 600, marginBottom: 6, color: theme.gold }}>🤖 AI Agent - Tanya apa saja</p>
              <div style={{ display: "flex", gap: 8 }}>
                <input style={{ ...s.input, flex: 1, marginBottom: 0 }} placeholder="Tanya: total penjualan, laba, stok..." value={aiQuery} onChange={e => setAiQuery(e.target.value)} />
                <button style={s.btnSm} onClick={handleAiQuery} disabled={aiLoading}>{aiLoading ? "⏳" : "Tanya"}</button>
              </div>
              {aiAnswer && (
                <div style={{ marginTop: 8, padding: 8, background: theme.card, borderRadius: 8, whiteSpace: "pre-wrap", fontSize: 13, color: theme.text, maxHeight: 300, overflowY: "auto" }}>
                  {aiAnswer}
                </div>
              )}
            </div>

            {/* Filter tanggal */}
            {!isBarista && (
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                <div style={{ flex: 1 }}><label style={s.label}>Dari</label><input style={s.input} type="date" value={filterTglMulai} onChange={e => setFilterTglMulai(e.target.value)} /></div>
                <div style={{ flex: 1 }}><label style={s.label}>Sampai</label><input style={s.input} type="date" value={filterTglSelesai} onChange={e => setFilterTglSelesai(e.target.value)} /></div>
              </div>
            )}
            {isBarista && (
              <div style={{ marginBottom: 14, padding: 10, background: theme.input, borderRadius: 8, textAlign: "center", color: theme.textMuted, fontSize: 13 }}>
                📅 Laporan hanya menampilkan transaksi hari ini
              </div>
            )}

            {/* Ringkasan */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
              <div style={{ background: theme.input, borderRadius: 12, padding: 12 }}><p style={{ margin: 0, fontSize: 10, color: theme.textMuted }}>Total Transaksi</p><p style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{filtered.length}</p></div>
              <div style={{ background: theme.input, borderRadius: 12, padding: 12 }}><p style={{ margin: 0, fontSize: 10, color: theme.textMuted }}>Laba Bersih</p><p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: laba >= 0 ? theme.success : theme.danger }}>{fmt(laba)}</p></div>
              <div style={{ background: theme.input, borderRadius: 12, padding: 12 }}><p style={{ margin: 0, fontSize: 10, color: theme.textMuted }}>Pemasukan</p><p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: theme.success }}>{fmt(totalMasuk)}</p></div>
              <div style={{ background: theme.input, borderRadius: 12, padding: 12 }}><p style={{ margin: 0, fontSize: 10, color: theme.textMuted }}>Pengeluaran</p><p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: theme.danger }}>{fmt(totalKeluar)}</p></div>
            </div>

            {/* Grafik */}
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
                <div style={{ display: "flex", gap: 16, justifyContent: "center", fontSize: 10, marginTop: 4 }}><span><span style={{ color: theme.success }}>■</span> Pemasukan</span><span><span style={{ color: theme.danger }}>■</span> Pengeluaran</span></div>
              </div>
            )}

            {/* Laporan Stok Toggle */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <label style={s.label}>Tampilkan Laporan Stok</label>
              <button onClick={() => setLaporanStokOn(!laporanStokOn)} style={{ ...s.btnSm, padding: "4px 12px" }}>{laporanStokOn ? "ON" : "OFF"}</button>
            </div>
            {laporanStokOn && (
              <div style={{ marginBottom: 14 }}>
                <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>📦 Laporan Stok Per Produk</p>
                <div style={s.card}>
                  {laporanStokData.length === 0 && <p style={{ color: theme.textMuted }}>Belum ada produk.</p>}
                  {laporanStokData.map(m => (
                    <div key={m.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, paddingBottom: 4, borderBottom: `1px solid ${theme.cardBorder}` }}>
                      <span>{m.nama}</span>
                      <span>Stok: {m.stok || 0} | Terjual: {m.terjual || 0} | Sisa: {m.sisa || 0}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Kategori */}
            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>🏷️ Top 5 Kategori Terlaris</p>
              <div style={s.card}>
                {top5Kategori.length === 0 ? <p style={{ color: theme.textMuted }}>Belum ada data.</p> : top5Kategori.map(([kat, qty]) => (
                  <div key={kat} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, paddingBottom: 4, borderBottom: `1px solid ${theme.cardBorder}` }}><span>{kat}</span><span>{qty} item</span></div>
                ))}
              </div>
              <p style={{ fontSize: 13, fontWeight: 600, marginTop: 10, marginBottom: 6 }}>📉 5 Kategori Terendah</p>
              <div style={s.card}>
                {bottom5Kategori.length === 0 ? <p style={{ color: theme.textMuted }}>Belum ada data.</p> : bottom5Kategori.map(([kat, qty]) => (
                  <div key={kat} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, paddingBottom: 4, borderBottom: `1px solid ${theme.cardBorder}` }}><span>{kat}</span><span>{qty} item</span></div>
                ))}
              </div>
            </div>

            {/* Produk per Kategori */}
            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>📌 Produk Terlaris per Kategori</p>
              {Object.keys(produkPerKategori).length === 0 && <p style={{ color: theme.textMuted }}>Belum ada data produk per kategori.</p>}
              {Object.keys(produkPerKategori).map(kat => {
                const sorted = produkPerKategori[kat].sort((a, b) => (produkTerjual[b.nama] || 0) - (produkTerjual[a.nama] || 0));
                const top = sorted.slice(0, 3);
                const bottom = sorted.slice(-3).reverse();
                return (
                  <div key={kat} style={s.card}>
                    <p style={{ fontWeight: 600 }}>{kat}</p>
                    <p style={{ fontSize: 12, marginBottom: 4 }}>🔥 Top 3:</p>
                    {top.map(m => <div key={m.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, paddingBottom: 2 }}><span>{m.nama}</span><span>{(produkTerjual[m.nama] || 0)} item</span></div>)}
                    <p style={{ fontSize: 12, marginTop: 6, marginBottom: 4 }}>📉 Bottom 3:</p>
                    {bottom.map(m => <div key={m.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, paddingBottom: 2 }}><span>{m.nama}</span><span>{(produkTerjual[m.nama] || 0)} item</span></div>)}
                  </div>
                );
              })}
            </div>

            {/* Export Excel */}
            {filtered.length > 0 && <button onClick={exportExcel} style={{ ...s.btnSm, width: "100%", background: theme.gold, marginBottom: 14 }}>⬇️ Download Excel (.csv)</button>}

            {/* Detail Transaksi */}
            <div>
              <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Detail Transaksi</p>
              {filtered.length === 0 && <p style={{ color: theme.textMuted, fontSize: 13 }}>Tidak ada transaksi.</p>}
              {filtered.slice(0, 10).map(t => (
                <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 8, marginBottom: 8, borderBottom: `1px solid ${theme.cardBorder}` }}>
                  <div><p style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>{t.item}</p><p style={{ margin: 0, fontSize: 10, color: theme.textMuted }}>{new Date(t.created_at).toLocaleDateString("id-ID")} · {t.status === "belum_lunas" ? "🔴 Piutang" : "✅ Lunas"}</p></div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: t.tipe === "masuk" ? theme.success : theme.danger }}>{t.tipe === "masuk" ? "+" : "-"}{fmt(t.total)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STRUK */}
        {tab === "struk" && (
          <div style={s.card}>
            {selectedTransaksi ? (
              <div style={{ fontFamily: "'Courier New', monospace", fontSize: 13, maxWidth: "100%", wordWrap: "break-word" }}>
                <div style={{ textAlign: "center", marginBottom: 10 }}>
                  <h3 style={{ margin: 0, fontWeight: 800 }}>{kafe?.nama?.toUpperCase() || "KAFE ANDA"}</h3>
                  <p style={{ margin: 0, fontSize: 11 }}>{kafe?.alamat || ""}</p>
                  <p style={{ margin: 0, fontSize: 11 }}>Telp: {profile?.telepon || "-"}</p>
                  <div style={{ borderTop: "1px dashed #888", margin: "8px 0" }}></div>
                  <p style={{ margin: 0, fontSize: 11 }}>No: {selectedTransaksi.id?.slice(0, 12) || "N/A"}</p>
                  <p style={{ margin: 0, fontSize: 11 }}>Tanggal: {new Date(selectedTransaksi.created_at).toLocaleString("id-ID")}</p>
                  <p style={{ margin: 0, fontSize: 11 }}>Kasir: {profile?.nama || "Admin"}</p>
                  <div style={{ borderTop: "1px dashed #888", margin: "8px 0" }}></div>
                </div>
                <div>{selectedTransaksi.item?.split(", ").map((item, idx) => {
                  const [nama, qtyStr] = item.split(" x");
                  const qty = parseInt(qtyStr) || 1;
                  return <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "2px 0" }}><span>{nama} x{qty}</span><span>{fmt(selectedTransaksi.total)}</span></div>;
                })}</div>
                <div style={{ borderTop: "1px dashed #888", margin: "8px 0" }}></div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span>Subtotal</span><span>{fmt(selectedTransaksi.subtotal || selectedTransaksi.total)}</span></div>
                {selectedTransaksi.pajak_enabled && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span>Pajak ({persentasePajak}%)</span><span>{fmt(selectedTransaksi.pajak || 0)}</span></div>}
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 700, borderTop: "1px solid #888", paddingTop: 6, marginTop: 6 }}><span>Grand Total</span><span>{fmt(selectedTransaksi.total)}</span></div>
                {pembayaran === "tunai" && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginTop: 6 }}><span>Bayar</span><span>{fmt(selectedTransaksi.total)}</span></div>}
                {pembayaran === "piutang" && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginTop: 6 }}><span>Status</span><span style={{ color: theme.danger }}>Piutang</span></div>}
                <div style={{ textAlign: "center", marginTop: 14, fontSize: 11, borderTop: "1px dashed #888", paddingTop: 8 }}>
                  <p style={{ margin: 0 }}>Powered by KopiLaba</p>
                  <p style={{ margin: 0 }}>Manajemen Keuangan Kafe</p>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: 30 }}><p style={{ color: theme.textMuted }}>Pilih transaksi untuk lihat struk</p><button onClick={() => setTab("transaksi")} style={s.btnSm}>Ke Transaksi</button></div>
            )}
            <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
              <button onClick={() => window.print()} style={{ ...s.btn, flex: 1 }}>🖨️ Cetak</button>
              <button onClick={() => { setSelectedTransaksi(null); setTab("transaksi"); }} style={{ ...s.btn, background: theme.card, border: `1px solid ${theme.cardBorder}`, color: theme.text, flex: 1 }}>Kembali</button>
            </div>
          </div>
        )}

        {/* QRIS */}
        {tab === "qris" && (
          <div style={s.card}>
            <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 10, color: theme.gold }}>📱 QRIS Pembayaran</p>
            <p style={{ fontSize: 12, color: theme.textMuted, marginBottom: 14 }}>
              {isPemilik ? "Upload QRIS untuk pembayaran non-tunai. Pelanggan bisa scan QRIS ini." : "Scan QRIS di bawah untuk melakukan pembayaran."}
            </p>

            {qrisUrl ? (
              <div style={{ textAlign: "center", marginBottom: 14 }}>
                <img src={qrisUrl} alt="QRIS" style={{ maxWidth: "100%", maxHeight: 300, borderRadius: 12, border: `1px solid ${theme.cardBorder}` }} />
                <p style={{ fontSize: 11, color: theme.textMuted, marginTop: 8 }}>Scan QRIS untuk bayar</p>
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: 30, background: theme.input, borderRadius: 12, border: `1px dashed ${theme.cardBorder}` }}>
                <p style={{ fontSize: 14, color: theme.textMuted }}>Belum ada QRIS diupload</p>
                {isPemilik && <p style={{ fontSize: 12, color: theme.textMuted }}>Upload gambar QRIS di bawah</p>}
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
                        api(`/rest/v1/kafe?id=eq.${kafe?.id}`, "PATCH", { qris_url: "" }, token);
                        setSuccess("QRIS dihapus!");
                      }
                    }}
                    style={{ ...s.btnSm, width: "100%", background: theme.danger, marginTop: 8 }}
                  >
                    🗑️ Hapus QRIS
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ===== MODAL-MODAL ===== */}
      {/* Modal Transaksi */}
      {showAdd && !isSuperAdmin && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "flex-end", zIndex: 50 }} onClick={() => setShowAdd(false)}>
          <div style={{ background: theme.card, borderRadius: "20px 20px 0 0", padding: 24, width: "100%", maxWidth: 500, margin: "0 auto" }} onClick={e => e.stopPropagation()}>
            <p style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: theme.text }}>{editTransaksiId ? "Edit Transaksi" : "Tambah Transaksi"}</p>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {["masuk", "keluar"].map(t => (
                <button key={t} onClick={() => { setAddType(t); setPesananItems([]); setAddForm({ item: "", qty: "1", total: "", kategori_id: "", menu_id: "" }); }} style={{ flex: 1, padding: 12, borderRadius: 12, border: "none", background: addType === t ? (t === "masuk" ? (darkMode ? "#1A2A1A" : "#E8F5E9") : (darkMode ? "#2A1A1A" : "#FFEBEE")) : theme.input, color: addType === t ? (t === "masuk" ? theme.success : theme.danger) : theme.textMuted, fontWeight: 700, cursor: "pointer" }}>
                  {t === "masuk" ? "💰 Pemasukan" : "🧾 Pengeluaran"}
                </button>
              ))}
            </div>

            {addType === "masuk" ? (
              <>
                <label style={s.label}>Kategori Menu</label>
                <select style={s.input} value={addForm.kategori_id} onChange={e => { setAddForm({ ...addForm, kategori_id: e.target.value, menu_id: "" }); }}>
                  <option value="">-- Pilih Kategori --</option>
                  {kategori.map(k => <option key={k.id} value={k.id}>{k.nama}</option>)}
                </select>
                <label style={s.label}>Pilih Menu</label>
                <select style={s.input} value={addForm.menu_id} onChange={e => {
                  const selected = menu.find(m => m.id === e.target.value);
                  if (selected) { setAddForm({ ...addForm, menu_id: selected.id, item: selected.nama, total: String(selected.harga) }); } else { setAddForm({ ...addForm, menu_id: "", item: "", total: "" }); }
                }}>
                  <option value="">-- Pilih Menu --</option>
                  {menu.filter(m => m.kategori_id === addForm.kategori_id || !addForm.kategori_id).map(m => <option key={m.id} value={m.id}>{m.nama} - {fmt(m.harga)} (stok: {m.stok || 0})</option>)}
                </select>
              </>
            ) : (
              <>
                <label style={s.label}>Nama Barang</label>
                <input style={s.input} placeholder="cth: Gula, Kopi, Susu..." value={addForm.item} onChange={e => setAddForm({ ...addForm, item: e.target.value })} />
                <label style={s.label}>Total (Rp)</label>
                <input style={s.input} type="number" placeholder="100000" value={addForm.total} onChange={e => setAddForm({ ...addForm, total: e.target.value })} />
              </>
            )}

            <label style={s.label}>Jumlah</label>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <button onClick={() => setAddForm({ ...addForm, qty: String(Math.max(1, parseInt(addForm.qty) - 1 || 1)) }) } style={{ ...s.btnSm, width: 40, padding: 8 }}>−</button>
              <input style={{ ...s.input, textAlign: "center", marginBottom: 0 }} type="number" value={addForm.qty} onChange={e => setAddForm({ ...addForm, qty: e.target.value })} />
              <button onClick={() => setAddForm({ ...addForm, qty: String(parseInt(addForm.qty) + 1 || 2) }) } style={{ ...s.btnSm, width: 40, padding: 8 }}>+</button>
              <button onClick={tambahItemPesanan} style={{ ...s.btnSm, flex: 1 }}>Tambah Item</button>
            </div>

            {pesananItems.length > 0 && (
              <div style={s.card}>
                <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Item Pesanan:</p>
                {pesananItems.map((item, idx) => (
                  <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, paddingBottom: 4, marginBottom: 4, borderBottom: `1px solid ${theme.cardBorder}` }}>
                    <span>{item.nama} x{item.qty}</span>
                    <span>{fmt(item.total)}</span>
                    <button onClick={() => hapusItemPesanan(idx)} style={{ background: "transparent", border: "none", color: theme.danger, cursor: "pointer" }}>✕</button>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, marginTop: 6 }}>
                  <span>Subtotal</span>
                  <span>{fmt(pesananItems.reduce((sum, i) => sum + i.total, 0))}</span>
                </div>
              </div>
            )}

            {addType === "masuk" && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <label style={s.label}>Pajak {persentasePajak}%</label>
                <button onClick={() => setPajakEnabled(!pajakEnabled)} style={{ ...s.btnSm, flex: 0, padding: "4px 12px" }}>{pajakEnabled ? "ON" : "OFF"}</button>
              </div>
            )}

            <button style={{ ...s.btn, background: addType === "masuk" ? (darkMode ? "#2D5A2D" : "#2E7D32") : (darkMode ? "#5A2D2D" : "#C62828"), color: "#fff" }} onClick={handleTambahTransaksi} disabled={loading}>
              {loading ? "Menyimpan..." : editTransaksiId ? "Update" : "Simpan Transaksi"}
            </button>
          </div>
        </div>
      )}

      {/* Modal Menu - dengan input Jumlah */}
      {showAddMenu && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "flex-end", zIndex: 50 }} onClick={() => setShowAddMenu(false)}>
          <div style={{ background: theme.card, borderRadius: "20px 20px 0 0", padding: 24, width: "100%", maxWidth: 500, margin: "0 auto" }} onClick={e => e.stopPropagation()}>
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
            <label style={s.label}>Jumlah Tambahan</label>
            <input style={s.input} type="number" placeholder="0" value={menuForm.qty} onChange={e => setMenuForm({ ...menuForm, qty: e.target.value })} />
            <p style={{ fontSize: 11, color: theme.textMuted, marginTop: -6, marginBottom: 10 }}>Jumlah ini akan ditambahkan ke stok awal</p>
            <label style={s.label}>Foto (URL)</label>
            <input style={s.input} placeholder="https://... (opsional)" value={menuForm.foto} onChange={e => setMenuForm({ ...menuForm, foto: e.target.value })} />
            <button style={s.btn} onClick={handleTambahMenu} disabled={loading}>{loading ? "Menyimpan..." : editMenuId ? "Update" : "Simpan"}</button>
          </div>
        </div>
      )}

      {/* Modal Kategori */}
      {showAddKategori && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "flex-end", zIndex: 50 }} onClick={() => setShowAddKategori(false)}>
          <div style={{ background: theme.card, borderRadius: "20px 20px 0 0", padding: 24, width: "100%", maxWidth: 500, margin: "0 auto" }} onClick={e => e.stopPropagation()}>
            <p style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: theme.text }}>{editKategoriId ? "Edit Kategori" : "Tambah Kategori"}</p>
            <label style={s.label}>Nama Kategori</label>
            <input style={s.input} placeholder="cth: Minuman" value={kategoriForm.nama} onChange={e => setKategoriForm({ ...kategoriForm, nama: e.target.value })} />
            <button style={s.btn} onClick={handleTambahKategori} disabled={loading}>{loading ? "Menyimpan..." : editKategoriId ? "Update" : "Simpan"}</button>
          </div>
        </div>
      )}

      {/* Modal Karyawan */}
      {showAddKaryawan && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "flex-end", zIndex: 50 }} onClick={() => setShowAddKaryawan(false)}>
          <div style={{ background: theme.card, borderRadius: "20px 20px 0 0", padding: 24, width: "100%", maxWidth: 500, margin: "0 auto" }} onClick={e => e.stopPropagation()}>
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

      {/* Modal Stok */}
      {showStok && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "flex-end", zIndex: 50 }} onClick={() => setShowStok(false)}>
          <div style={{ background: theme.card, borderRadius: "20px 20px 0 0", padding: 24, width: "100%", maxWidth: 500, margin: "0 auto" }} onClick={e => e.stopPropagation()}>
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

      {/* Modal Ganti Password */}
      {showGantiPassword && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "flex-end", zIndex: 60 }} onClick={() => { setShowGantiPassword(false); setTargetUserId(null); }}>
          <div style={{ background: theme.card, borderRadius: "20px 20px 0 0", padding: 24, width: "100%", maxWidth: 500, margin: "0 auto" }} onClick={e => e.stopPropagation()}>
            <p style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: theme.text }}>{isSuperAdmin && targetUserId ? "Ganti Password User" : "Ganti Password"}</p>
            {isSuperAdmin && targetUserId && <p style={{ fontSize: 12, color: theme.textMuted, marginBottom: 10 }}>Mengganti password untuk: {allOwners.find(o => o.id === targetUserId)?.nama || "User"}</p>}
            <label style={s.label}>Password Lama</label>
            <input style={s.input} type="password" placeholder="Password lama" value={gantiPasswordForm.oldPassword} onChange={e => setGantiPasswordForm({ ...gantiPasswordForm, oldPassword: e.target.value })} />
            <label style={s.label}>Password Baru</label>
            <input style={s.input} type="password" placeholder="Min. 6 karakter" value={gantiPasswordForm.newPassword} onChange={e => setGantiPasswordForm({ ...gantiPasswordForm, newPassword: e.target.value })} />
            <label style={s.label}>Konfirmasi Password</label>
            <input style={s.input} type="password" placeholder="Ulangi password baru" value={gantiPasswordForm.confirmPassword} onChange={e => setGantiPasswordForm({ ...gantiPasswordForm, confirmPassword: e.target.value })} />
            <button style={s.btn} onClick={handleGantiPassword} disabled={loading}>{loading ? "Menyimpan..." : "Ganti Password"}</button>
            <button onClick={() => { setShowGantiPassword(false); setTargetUserId(null); setGantiPasswordForm({ oldPassword: "", newPassword: "", confirmPassword: "" }); }} style={{ ...s.btn, background: theme.card, border: `1px solid ${theme.cardBorder}`, color: theme.text, marginTop: 8 }}>Batal</button>
          </div>
        </div>
      )}

      {/* Modal Absensi */}
      {showAbsensi && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "flex-end", zIndex: 50 }} onClick={() => setShowAbsensi(false)}>
          <div style={{ background: theme.card, borderRadius: "20px 20px 0 0", padding: 24, width: "100%", maxWidth: 500, margin: "0 auto" }} onClick={e => e.stopPropagation()}>
            <p style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: theme.text }}>Absensi Pegawai</p>
            <label style={s.label}>Pegawai</label>
            <select style={s.input} value={absensiForm.pegawai_id} onChange={e => setAbsensiForm({ ...absensiForm, pegawai_id: e.target.value })}>
              <option value="">-- Pilih Pegawai --</option>
              {karyawan.map(k => <option key={k.id} value={k.id}>{k.nama}</option>)}
            </select>
            <button style={s.btn} onClick={handleAbsenMasuk} disabled={loading}>{loading ? "Menyimpan..." : "Absen Masuk"}</button>
          </div>
        </div>
      )}

      {/* Modal Kasir */}
      {showKasir && !isSuperAdmin && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "flex-end", zIndex: 50 }} onClick={() => setShowKasir(false)}>
          <div style={{ background: theme.card, borderRadius: "20px 20px 0 0", padding: 24, width: "100%", maxWidth: 500, margin: "0 auto" }} onClick={e => e.stopPropagation()}>
            <p style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: theme.text }}>🛒 Keranjang Kasir</p>
            {keranjang.length === 0 && <p style={{ color: theme.textMuted, fontSize: 13 }}>Keranjang kosong.</p>}
            {keranjang.map((item, idx) => (
              <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 8, marginBottom: 8, borderBottom: `1px solid ${theme.cardBorder}` }}>
                <div><p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{item.nama}</p><p style={{ margin: 0, fontSize: 11, color: theme.textMuted }}>{fmt(item.harga)} x {item.qty}</p></div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: theme.gold }}>{fmt(item.harga * item.qty)}</p>
                  <button onClick={() => kurangiDariKeranjang(item.id)} style={{ background: "transparent", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: 16 }}>➖</button>
                  <button onClick={() => hapusDariKeranjang(item.id)} style={{ background: "transparent", border: "none", color: theme.danger, cursor: "pointer", fontSize: 14 }}>🗑️</button>
                </div>
              </div>
            ))}
            {keranjang.length > 0 && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderTop: `2px solid ${theme.cardBorder}` }}><p style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Subtotal</p><p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: theme.gold }}>{fmt(totalKeranjang)}</p></div>
                {pajakEnabled && <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}><span>Pajak {persentasePajak}%</span><span>{fmt(Math.round(totalKeranjang * persentasePajak / 100))}</span></div>}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderTop: `1px solid ${theme.cardBorder}` }}><p style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Total</p><p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: theme.gold }}>{fmt(totalKeranjang + (pajakEnabled ? Math.round(totalKeranjang * persentasePajak / 100) : 0))}</p></div>
                <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                  {["tunai", "piutang"].map(p => <button key={p} onClick={() => setPembayaran(p)} style={{ flex: 1, padding: 12, borderRadius: 12, border: "none", background: pembayaran === p ? theme.gold : theme.input, color: pembayaran === p ? (darkMode ? "#fff" : "#1A1208") : theme.textMuted, fontWeight: pembayaran === p ? 700 : 400, cursor: "pointer" }}>{p === "tunai" ? "💰 Tunai" : "📝 Piutang"}</button>)}
                </div>
                {pembayaran === "tunai" && <div style={{ display: "flex", gap: 8, marginBottom: 10 }}><input style={{ ...s.input, flex: 1 }} type="number" placeholder="Jumlah bayar" value={bayarAmount} onChange={e => setBayarAmount(e.target.value)} /><span style={{ display: "flex", alignItems: "center", color: theme.textMuted }}>Kembali: {bayarAmount ? fmt(parseInt(bayarAmount) - (totalKeranjang + (pajakEnabled ? Math.round(totalKeranjang * persentasePajak / 100) : 0))) : fmt(0)}</span></div>}
                <button style={s.btn} onClick={handleCheckout} disabled={loading}>{loading ? "Memproses..." : "✅ Bayar"}</button>
              </>
            )}
            <button onClick={() => setShowKasir(false)} style={{ ...s.btn, background: theme.card, border: `1px solid ${theme.cardBorder}`, color: theme.text, marginTop: 8 }}>Tutup</button>
          </div>
        </div>
      )}

      {/* BOTTOM NAV */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, width: "100%", maxWidth: "100%", background: theme.headerBg, backdropFilter: theme.blur, WebkitBackdropFilter: theme.blur, borderTop: `1px solid ${theme.cardBorder}`, display: "flex", padding: "8px 0 20px", transition: "all 0.3s ease", zIndex: 10 }}>
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
