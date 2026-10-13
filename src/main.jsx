import React from 'react';
import ReactDOM from 'react-dom/client';
import './kopilaba.css';
import KopiLaba from './KopiLaba.jsx';

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      message: String(error?.message || 'Kesalahan aplikasi tidak diketahui').slice(0, 240),
    };
  }

  componentDidCatch(error, info) {
    console.error('KopiLaba render error:', error, info?.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main style={{minHeight:'100dvh',display:'grid',placeItems:'center',padding:24,background:'#f8f4f0',fontFamily:'system-ui,sans-serif',color:'#21170f'}}>
          <section style={{width:'100%',maxWidth:460,background:'#fffdf9',border:'1px solid #e9dfd3',borderRadius:20,padding:24,boxShadow:'0 12px 36px rgba(66,42,20,.08)'}}>
            <div style={{fontSize:12,fontWeight:800,letterSpacing:'.12em',color:'#8a4b2a'}}>KOPILABA · PEMULIHAN</div>
            <h1 style={{fontSize:23,margin:'10px 0'}}>Aplikasi mengalami kendala</h1>
            <p style={{fontSize:14,lineHeight:1.6,color:'#75695f'}}>Halaman gagal ditampilkan, tetapi aplikasi tidak dibiarkan menjadi layar putih. Coba muat ulang. Jika masalah berulang, pulihkan sesi lokal tanpa menghapus data transaksi di server.</p>
            <div style={{fontSize:12,overflowWrap:'anywhere',padding:12,borderRadius:10,background:'#f5eee5',color:'#65452e'}}>Detail: {this.state.message}</div>
            <button onClick={() => window.location.reload()} style={{width:'100%',marginTop:16,padding:13,border:0,borderRadius:12,background:'#247a51',color:'#fff',fontWeight:800}}>Muat ulang aplikasi</button>
            <button onClick={() => { try { localStorage.removeItem('kopilaba_session'); } catch (_) {} window.location.reload(); }} style={{width:'100%',marginTop:8,padding:13,border:'1px solid #d8c2ac',borderRadius:12,background:'#fffaf4',color:'#452616',fontWeight:700}}>Pulihkan sesi login lokal</button>
            <p style={{fontSize:11,lineHeight:1.5,color:'#75695f',marginBottom:0}}>Tombol kedua hanya menghapus sesi login yang tersimpan di perangkat ini. Data kafe di server tidak dihapus.</p>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <AppErrorBoundary>
      <KopiLaba />
    </AppErrorBoundary>
  </React.StrictMode>
);
