import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownWideNarrow,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clapperboard,
  Globe2,
  Heart,
  Info,
  LoaderCircle,
  MonitorPlay,
  Radio,
  Search,
  Signal,
  Tv,
  X,
  Play,
  Sparkles,
} from 'lucide-react';
import VideoPlayer from './components/VideoPlayer.jsx';
import { channelInitials, countryName } from './lib/playlist.js';

const PAGE_SIZE = 60;
const SOURCE_REPO = 'https://github.com/projectirbie-web/tv';

function readFavorites() {
  try {
    const parsed = JSON.parse(localStorage.getItem('yegtv-favorites') || '[]');
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function hueFor(value = '') {
  let hash = 0;
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) % 360;
  return (hash + 360) % 360;
}

function BrandMark() {
  return <div className="brand-mark"><Tv size={22} strokeWidth={2.2} /><span className="brand-live-dot" /></div>;
}

function Brand({ footer = false }) {
  return (
    <a className={footer ? 'brand footer-brand' : 'brand'} href="#top" aria-label="YEGTv beranda">
      <BrandMark />
      <span className="brand-type"><strong>YEG<span>Tv</span></strong><small>YOUR EVERYDAY GUIDE TV</small></span>
    </a>
  );
}

function ChannelLogo({ channel, large = false }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [channel.logo]);
  return (
    <div className={`channel-logo ${large ? 'channel-logo-large' : ''}`}>
      {channel.logo && !broken ? (
        <img src={channel.logo} alt={`${channel.name} logo`} loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
      ) : (
        <><span className="logo-glow" /><b>{channelInitials(channel.name)}</b></>
      )}
    </div>
  );
}

function FeaturedChannel({ channel, index, onSelect }) {
  return (
    <button
      className={`feature-card feature-card-${index + 1}`}
      style={{ '--hue': hueFor(channel.name) }}
      onClick={() => onSelect(channel)}
      aria-label={`Tonton ${channel.name}`}
    >
      <span className="feature-card-glow" />
      <span className="feature-card-copy">
        <span className="feature-label"><span className="live-dot" /> LIVE CHANNEL</span>
        <strong>{channel.name}</strong>
        <small><Globe2 size={13} /> {countryName(channel.countryCode)}{channel.category ? ` · ${channel.category}` : ''}</small>
        <span className="feature-watch">Tonton sekarang <Play size={12} fill="currentColor" /></span>
      </span>
      <span className="feature-art" aria-hidden="true">
        <span className="feature-orbit" />
        <ChannelLogo channel={channel} large />
      </span>
    </button>
  );
}

function ChannelCard({ channel, selected, favorite, onSelect, onFavorite }) {
  return (
    <article className={`channel-card ${selected ? 'is-selected' : ''}`} style={{ '--hue': hueFor(channel.name) }}>
      <button className="channel-card-main" onClick={() => onSelect(channel)} aria-label={`Tonton ${channel.name}`}>
        <span className="channel-poster-art">
          <span className="poster-orbit poster-orbit-one" />
          <span className="poster-orbit poster-orbit-two" />
          <span className="poster-onair"><span className="live-dot" /> LIVE</span>
          <ChannelLogo channel={channel} large />
          <span className="poster-play"><Play size={19} fill="currentColor" /></span>
        </span>
        <span className="channel-card-copy">
          <strong title={channel.name}>{channel.name}</strong>
          <small><span className="country-mini">{channel.countryCode || 'TV'}</span>{countryName(channel.countryCode)}</small>
          <span className="channel-card-category">{channel.category || 'Live TV'}</span>
        </span>
      </button>
      <button
        className={`card-favorite ${favorite ? 'favorited' : ''}`}
        onClick={() => onFavorite(channel)}
        aria-label={favorite ? `Hapus ${channel.name} dari favorit` : `Tambahkan ${channel.name} ke favorit`}
        title={favorite ? 'Hapus dari favorit' : 'Tambah ke favorit'}
      >
        <Heart size={16} fill={favorite ? 'currentColor' : 'none'} />
      </button>
    </article>
  );
}

export default function App() {
  const [channels, setChannels] = useState([]);
  const [metadata, setMetadata] = useState(null);
  const [loadState, setLoadState] = useState('loading');
  const [loadError, setLoadError] = useState('');
  const [activeChannel, setActiveChannel] = useState(null);
  const [search, setSearch] = useState('');
  const [country, setCountry] = useState('all');
  const [category, setCategory] = useState('all');
  const [activeTab, setActiveTab] = useState('all');
  const [favorites, setFavorites] = useState(readFavorites);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [playerStatus, setPlayerStatus] = useState('idle');
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`${import.meta.env.BASE_URL}channels.json`, { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error(`Tidak bisa membaca channels.json (HTTP ${response.status}).`);
        return response.json();
      })
      .then((data) => {
        if (cancelled) return;
        const rows = Array.isArray(data) ? data : data.channels;
        if (!Array.isArray(rows)) throw new Error('Format channels.json tidak valid.');
        const safeRows = rows.filter((item) => item && typeof item.name === 'string' && /^https?:\/\//i.test(item.url || ''));
        setChannels(safeRows);
        setMetadata(data);
        setLoadState('ready');
        if (safeRows.length) setActiveChannel(safeRows[0]);
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(error.message || 'Terjadi kesalahan ketika membaca data channel.');
        setLoadState('error');
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    try { localStorage.setItem('yegtv-favorites', JSON.stringify([...favorites])); } catch { /* storage may be unavailable */ }
  }, [favorites]);

  const countries = useMemo(() => {
    const codes = [...new Set(channels.map((channel) => channel.countryCode).filter(Boolean))];
    return codes.sort((a, b) => countryName(a).localeCompare(countryName(b), 'id'));
  }, [channels]);

  const categories = useMemo(() => {
    const names = [...new Set(channels.map((channel) => channel.category || 'Umum'))];
    return names.sort((a, b) => a.localeCompare(b, 'id'));
  }, [channels]);

  const filteredChannels = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('id');
    return channels.filter((channel) => {
      if (activeTab === 'favorites' && !favorites.has(channel.url)) return false;
      if (country !== 'all' && channel.countryCode !== country) return false;
      if (category !== 'all' && (channel.category || 'Umum') !== category) return false;
      if (!q) return true;
      return [channel.name, channel.countryCode, countryName(channel.countryCode), channel.category, channel.tvgId]
        .filter(Boolean).some((field) => String(field).toLocaleLowerCase('id').includes(q));
    });
  }, [channels, search, country, category, activeTab, favorites]);

  const visibleChannels = filteredChannels.slice(0, visibleCount);
  const handlePlayerStatus = useCallback((status) => setPlayerStatus(status), []);

  function chooseTab(tab) {
    setActiveTab(tab);
    setVisibleCount(PAGE_SIZE);
    document.getElementById('channels')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function selectChannel(channel, scrollToPlayer = false) {
    setActiveChannel(channel);
    if (scrollToPlayer) {
      window.setTimeout(() => document.getElementById('watch')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    }
  }

  function toggleFavorite(channel) {
    setFavorites((current) => {
      const next = new Set(current);
      if (next.has(channel.url)) next.delete(channel.url);
      else next.add(channel.url);
      return next;
    });
  }

  function resetFilters() {
    setSearch('');
    setCountry('all');
    setCategory('all');
    setActiveTab('all');
    setVisibleCount(PAGE_SIZE);
  }

  const featuredChannels = channels.slice(0, 3);

  return (
    <div className="app-shell" id="top">
      <header className="topbar">
        <Brand />
        <nav className="main-nav" aria-label="Navigasi utama">
          <button className={`nav-item ${activeTab === 'all' ? 'active' : ''}`} onClick={() => { resetFilters(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}><Clapperboard size={15} /> Jelajah</button>
          <button className="nav-item" onClick={() => document.getElementById('watch')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}><Radio size={15} /> Siaran</button>
          <button className={`nav-item ${activeTab === 'favorites' ? 'active' : ''}`} onClick={() => chooseTab('favorites')}><Heart size={15} /> Favorit <span className="nav-count">{favorites.size}</span></button>
        </nav>
        <label className="header-search">
          <Search size={17} />
          <input type="search" placeholder="Cari channel…" value={search} onChange={(event) => { setSearch(event.target.value); setVisibleCount(PAGE_SIZE); }} />
          {search && <button aria-label="Hapus pencarian" onClick={() => setSearch('')}><X size={14} /></button>}
        </label>
        <button className="icon-button help-button" onClick={() => setShowInfo(true)} aria-label="Informasi website" title="Informasi website"><CircleHelp size={18} /></button>
      </header>

      <main>
        <div className="page-content">
          <section className="hero-section" aria-label="Channel pilihan">
            <div className="hero-heading">
              <div>
                <span className="section-kicker"><Sparkles size={13} /> PILIHAN YEGTV</span>
                <h1>Temukan siaran<br /><span>yang kamu suka.</span></h1>
                <p>Ribuan channel dalam satu tempat. Pilih tayangan dan nikmati siaran langsung.</p>
              </div>
              <div className="hero-live-count"><span className="live-dot" /><span><strong>{loadState === 'ready' ? channels.length.toLocaleString('id-ID') : '—'}</strong><small>CHANNEL DI KATALOG</small></span></div>
            </div>

            {loadState === 'ready' && featuredChannels.length > 0 ? (
              <div className="feature-grid">
                {featuredChannels.map((channel, index) => <FeaturedChannel key={`${channel.url}-${channel.name}`} channel={channel} index={index} onSelect={(selected) => selectChannel(selected, true)} />)}
              </div>
            ) : loadState === 'loading' ? (
              <div className="feature-grid feature-skeletons">{[0, 1, 2].map((item) => <div className="feature-skeleton" key={item} />)}</div>
            ) : (
              <div className="feature-unavailable"><Radio size={22} /><span>Channel pilihan akan tampil setelah playlist berhasil dimuat.</span></div>
            )}
          </section>

          <section className="category-section" aria-label="Kategori channel">
            <div className="category-rail">
              <button className={`category-pill ${category === 'all' && activeTab !== 'favorites' ? 'active' : ''}`} onClick={() => { setCategory('all'); setActiveTab('all'); setVisibleCount(PAGE_SIZE); }}><Radio size={15} /> Semua</button>
              {categories.slice(0, 7).map((name) => (
                <button key={name} className={`category-pill ${category === name ? 'active' : ''}`} onClick={() => { setCategory(name); setActiveTab('all'); setVisibleCount(PAGE_SIZE); }}><Sparkles size={14} /> {name}</button>
              ))}
              <button className={`category-pill ${activeTab === 'favorites' ? 'active' : ''}`} onClick={() => chooseTab('favorites')}><Heart size={14} /> Favorit</button>
            </div>
          </section>

          <section className="watch-section" id="watch" aria-label="Pemutar TV langsung">
            <div className="section-heading player-heading">
              <div><span className="section-kicker">TONTON LANGSUNG</span><h2>Siaran pilihanmu</h2><p className="section-subtitle">Nikmati siaran dengan ambient glow yang mengikuti warna video.</p></div>
              <div className={`connection-status ${playerStatus === 'playing' ? 'connected' : playerStatus === 'error' ? 'disconnected' : ''}`}>
                <span className="status-dot" />{playerStatus === 'playing' ? 'Sedang diputar' : playerStatus === 'error' ? 'Stream bermasalah' : playerStatus === 'loading' ? 'Menghubungkan' : 'Siap menonton'}
              </div>
            </div>
            <div className="watch-layout">
              <div className="player-card">
                <VideoPlayer channel={activeChannel} onStatus={handlePlayerStatus} />
              </div>
              <aside className="now-playing">
                <div className="now-playing-head"><span className="section-kicker">SEKARANG DIPILIH</span><span className="on-air-chip"><span className="live-dot" /> LIVE</span></div>
                {activeChannel ? (
                  <>
                    <ChannelLogo channel={activeChannel} large />
                    <h3>{activeChannel.name}</h3>
                    <p className="now-country"><Globe2 size={14} /> {countryName(activeChannel.countryCode)}</p>
                    <div className="channel-meta-row"><span>Kategori</span><strong>{activeChannel.category || 'Umum'}</strong></div>
                    <div className="channel-meta-row"><span>Negara</span><strong>{activeChannel.countryCode || '—'}</strong></div>
                    <div className="player-actions">
                      <button className="primary-action" onClick={() => document.querySelector('.video-element')?.play().catch(() => {})}><MonitorPlay size={16} /> Putar channel</button>
                      <button className={`secondary-action ${favorites.has(activeChannel.url) ? 'favorited' : ''}`} onClick={() => toggleFavorite(activeChannel)} aria-label="Toggle favorit"><Heart size={16} fill={favorites.has(activeChannel.url) ? 'currentColor' : 'none'} /></button>
                    </div>
                  </>
                ) : (
                  <div className="no-channel"><Radio size={25} /><p>Pilih salah satu channel untuk melihat detailnya.</p></div>
                )}
                <div className="player-note"><Info size={14} /><p>Daftar channel mengikuti playlist publik. Ketersediaan siaran bergantung pada server masing-masing.</p></div>
              </aside>
            </div>
          </section>

          <section className="browse-section" id="channels">
            <div className="section-heading browse-heading">
              <div><span className="section-kicker">JELAJAHI</span><h2>{activeTab === 'favorites' ? 'Channel favorit' : 'Channel untuk ditonton'}</h2><p className="section-subtitle">Cari channel baru dari katalog YEGTv.</p></div>
              <div className="result-counter"><Signal size={15} /><span>{filteredChannels.length.toLocaleString('id-ID')} channel</span></div>
            </div>

            <div className="filter-panel">
              <label className="select-wrap"><Globe2 size={15} /><select value={country} onChange={(event) => { setCountry(event.target.value); setVisibleCount(PAGE_SIZE); }} aria-label="Filter negara"><option value="all">Semua negara</option>{countries.map((code) => <option value={code} key={code}>{countryName(code)}</option>)}</select><ChevronDown size={14} /></label>
              <label className="select-wrap"><ArrowDownWideNarrow size={15} /><select value={category} onChange={(event) => { setCategory(event.target.value); setVisibleCount(PAGE_SIZE); }} aria-label="Filter kategori"><option value="all">Semua kategori</option>{categories.map((name) => <option key={name} value={name}>{name}</option>)}</select><ChevronDown size={14} /></label>
              {(search || country !== 'all' || category !== 'all' || activeTab !== 'all') && <button className="clear-filter" onClick={resetFilters}>Reset filter <X size={13} /></button>}
            </div>

            {loadState === 'loading' && <div className="state-panel"><LoaderCircle className="spin" size={25} /><strong>Memuat data channel…</strong><span>Mengambil playlist yang dibangun dari folder streams di GitHub.</span></div>}
            {loadState === 'error' && <div className="state-panel state-error"><Info size={25} /><strong>Data channel belum tersedia</strong><span>{loadError}</span><small>Jalankan <code>npm run sync:channels</code> dari folder website, lalu muat ulang halaman.</small></div>}
            {loadState === 'ready' && filteredChannels.length === 0 && <div className="state-panel"><Search size={25} /><strong>Tidak ada channel yang cocok</strong><span>Coba kata kunci atau filter yang berbeda.</span><button className="clear-filter" onClick={resetFilters}>Hapus filter</button></div>}
            {loadState === 'ready' && filteredChannels.length > 0 && (
              <>
                <div className="channel-grid">
                  {visibleChannels.map((channel) => <ChannelCard key={`${channel.url}-${channel.name}-${channel.countryCode}`} channel={channel} selected={activeChannel?.url === channel.url} favorite={favorites.has(channel.url)} onSelect={(selected) => selectChannel(selected, true)} onFavorite={toggleFavorite} />)}
                </div>
                <div className="grid-footer">
                  <span>Menampilkan {visibleChannels.length.toLocaleString('id-ID')} dari {filteredChannels.length.toLocaleString('id-ID')} channel</span>
                  {visibleCount < filteredChannels.length && <button className="load-more" onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}>Muat lebih banyak <ChevronDown size={15} /></button>}
                </div>
              </>
            )}
          </section>
        </div>

        <footer className="footer">
          <Brand footer />
          <span>Streaming langsung, satu tempat.</span>
          <a href={SOURCE_REPO} target="_blank" rel="noreferrer">Sumber playlist <ChevronRight size={14} /></a>
          <small>YEGTv adalah katalog channel; ketersediaan siaran mengikuti server dan ketentuan penyedia masing-masing.</small>
        </footer>
      </main>

      {showInfo && (
        <div className="modal-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setShowInfo(false); }}>
          <section className="info-modal" role="dialog" aria-modal="true" aria-labelledby="info-title">
            <button className="modal-close" onClick={() => setShowInfo(false)} aria-label="Tutup"><X size={18} /></button>
            <div className="modal-icon"><Info size={23} /></div>
            <p className="section-kicker">TENTANG YEGTV</p><h2 id="info-title">Tentang sumber siaran</h2>
            <p>YEGTv mengubah entri playlist dari folder <code>streams/</code> pada repositori GitHub menjadi katalog channel dan pemutar live.</p>
            <ul><li>Daftar channel tidak menjamin semua sumber siaran sedang aktif.</li><li>Beberapa stream memerlukan kebijakan CORS atau header yang tidak dapat diatur dari browser.</li><li>Channel dapat dibatasi berdasarkan lokasi, waktu, atau kebijakan penyedia.</li><li>Gunakan hanya siaran yang kamu punya hak atau izin untuk akses dan tayangkan.</li></ul>
            <a className="repo-link" href={SOURCE_REPO} target="_blank" rel="noreferrer">Lihat repository sumber <Check size={15} /></a>
          </section>
        </div>
      )}
    </div>
  );
}
