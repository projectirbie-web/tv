'use client';

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowDownWideNarrow, ChevronDown, ChevronRight, CircleHelp,
  Globe2, Heart, Info, LoaderCircle, MonitorPlay, Radio, Search, Signal,
  Tv, X, Play, Sparkles, ArrowLeft, ExternalLink, Compass, Home, ShieldCheck,
} from 'lucide-react';
import VideoPlayer from './components/VideoPlayer.jsx';
import { channelInitials, countryName } from './lib/playlist.js';

const PAGE_SIZE = 60;
let catalogPromise;
function loadChannelCatalog() {
  if (!catalogPromise) {
    catalogPromise = fetch('/channels.json')
      .then((response) => {
        if (!response.ok) throw new Error(`Tidak bisa membaca katalog (HTTP ${response.status}).`);
        return response.json();
      })
      .then((data) => {
        const rows = Array.isArray(data) ? data : data.channels;
        if (!Array.isArray(rows)) throw new Error('Format katalog channel tidak valid.');
        return rows.filter((item) => item && typeof item.name === 'string' && /^https?:\/\//i.test(item.url || ''));
      })
      .catch((error) => { catalogPromise = undefined; throw error; });
  }
  return catalogPromise;
}
const SOURCE_REPO = 'https://github.com/projectirbie-web/tv';

function slugify(value = '') {
  return value.toLocaleLowerCase('id').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70) || 'channel';
}
function routeForChannel(channel, base = '/channel') {
  return `${base}/${slugify(channel.name)}?url=${encodeURIComponent(channel.url)}`;
}
function readFavorites() {
  try {
    const parsed = JSON.parse(localStorage.getItem('yegtv-favorites') || '[]');
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch { return new Set(); }
}
function hueFor(value = '') {
  let hash = 0;
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) % 360;
  return (hash + 360) % 360;
}
function BrandMark() {
  return <div className="brand-mark"><Tv size={22} strokeWidth={2.2} /><span className="brand-live-dot" /></div>;
}
function Brand({ onClick, footer = false }) {
  return <a className={footer ? 'brand footer-brand' : 'brand'} href="/" onClick={onClick} aria-label="YEGTv beranda">
    <BrandMark /><span className="brand-type"><strong>YEG<span>Tv</span></strong><small>YOUR EVERYDAY GUIDE TV</small></span>
  </a>;
}
function ChannelLogo({ channel, large = false }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [channel.logo]);
  return <div className={`channel-logo ${large ? 'channel-logo-large' : ''}`}>
    {channel.logo && !broken
      ? <img src={channel.logo} alt={`${channel.name} logo`} loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
      : <><span className="logo-glow" /><b>{channelInitials(channel.name)}</b></>}
  </div>;
}
function FeaturedChannel({ channel, index, onSelect }) {
  return <button className={`feature-card feature-card-${index + 1}`} style={{ '--hue': hueFor(channel.name) }} onClick={() => onSelect(channel)} aria-label={`Lihat ${channel.name}`}>
    <span className="feature-card-glow" /><span className="feature-card-copy">
      <span className="feature-label"><span className="live-dot" /> PILIHAN YEGTV</span>
      <strong>{channel.name}</strong><small><Globe2 size={13} /> {countryName(channel.countryCode)}{channel.category ? ` · ${channel.category}` : ''}</small>
      <span className="feature-watch">Lihat channel <ChevronRight size={13} /></span>
    </span><span className="feature-art" aria-hidden="true"><span className="feature-orbit" /><ChannelLogo channel={channel} large /></span>
  </button>;
}
function ChannelCard({ channel, favorite, onSelect, onFavorite }) {
  return <article className="channel-card" style={{ '--hue': hueFor(channel.name) }}>
    <button className="channel-card-main" onClick={() => onSelect(channel)} aria-label={`Buka ${channel.name}`}>
      <span className="channel-poster-art"><span className="poster-orbit poster-orbit-one" /><span className="poster-orbit poster-orbit-two" />
        <span className="poster-onair"><span className="live-dot" /> CHANNEL</span><ChannelLogo channel={channel} large /><span className="poster-play"><Play size={19} fill="currentColor" /></span>
      </span><span className="channel-card-copy"><strong title={channel.name}>{channel.name}</strong>
        <small><span className="country-mini">{channel.countryCode || 'TV'}</span>{countryName(channel.countryCode)}</small>
        <span className="channel-card-category">{channel.category || 'Live TV'}</span></span>
    </button><button className={`card-favorite ${favorite ? 'favorited' : ''}`} onClick={() => onFavorite(channel)} aria-label={favorite ? `Hapus ${channel.name} dari favorit` : `Tambahkan ${channel.name} ke favorit`} title={favorite ? 'Hapus dari favorit' : 'Tambah ke favorit'}><Heart size={16} fill={favorite ? 'currentColor' : 'none'} /></button>
  </article>;
}
function PageHeading({ kicker, title, description, action }) {
  return <div className="page-heading"><div><span className="section-kicker">{kicker}</span><h1>{title}</h1>{description && <p>{description}</p>}</div>{action}</div>;
}
function LoadMessage({ loadState, loadError, onRetry }) {
  if (loadState === 'loading') return <div className="state-panel"><LoaderCircle className="spin" size={25} /><strong>Memuat katalog channel…</strong><span>Mengambil data playlist dan menyiapkan katalog YEGTv.</span></div>;
  if (loadState === 'error') return <div className="state-panel state-error"><Info size={25} /><strong>Data channel belum tersedia</strong><span>{loadError}</span><small>Periksa apakah `channels.json` berhasil dibuat pada proses build.</small>{onRetry && <button className="secondary-action" onClick={onRetry}>Coba muat ulang katalog</button>}</div>;
  return null;
}
function ChannelGrid({ channels, favorites, onSelect, onFavorite, emptyTitle = 'Belum ada channel', emptyDescription = 'Pilih channel dari katalog untuk memulai.' }) {
  if (!channels.length) return <div className="state-panel"><Radio size={27} /><strong>{emptyTitle}</strong><span>{emptyDescription}</span></div>;
  return <div className="channel-grid">{channels.map((channel) => <ChannelCard key={`${channel.url}-${channel.name}-${channel.countryCode}`} channel={channel} favorite={favorites.has(channel.url)} onSelect={onSelect} onFavorite={onFavorite} />)}</div>;
}

export default function App() {
  const router = useRouter();
  const pathname = usePathname() || '/';
  const searchParams = useSearchParams();
  const currentPath = pathname.replace(/\/$/, '') || '/';
  const queryString = searchParams.toString();
  const route = { pathname: currentPath, search: queryString ? `?${queryString}` : '' };
  const [channels, setChannels] = useState([]);
  const [loadState, setLoadState] = useState('loading');
  const [loadError, setLoadError] = useState('');
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const [activeChannel, setActiveChannel] = useState(null);
  const [search, setSearch] = useState(() => searchParams.get('q') || '');
  const deferredSearch = useDeferredValue(search);
  const [favoritesLoaded, setFavoritesLoaded] = useState(false);
  const [country, setCountry] = useState('all');
  const [category, setCategory] = useState('all');
  const [favorites, setFavorites] = useState(() => new Set());
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [playerStatus, setPlayerStatus] = useState('idle');
  const fallbackChannels = useMemo(() => {
    if (!activeChannel) return [];
    const normalize = (value = '') => String(value).toLocaleLowerCase('id').normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '').replace(/\[[^\]]*\]/g, ' ').replace(/\([^)]*\)/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
    const currentName = normalize(activeChannel.name);
    return channels.filter((candidate) => {
      if (!candidate?.url || candidate.url === activeChannel.url || !candidate.url.startsWith('https://')) return false;
      if (candidate.countryCode !== activeChannel.countryCode) return false;
      if (activeChannel.tvgId && candidate.tvgId && candidate.tvgId === activeChannel.tvgId) return true;
      // Different providers sometimes label the same service with different tvg-id values.
      // Only use a name match within the same country, and prefer sources without custom headers.
      return normalize(candidate.name) === currentName;
    }).sort((a, b) => {
      const sourceScore = (item) => {
        const url = String(item.url || '').toLowerCase();
        let score = Number(Boolean(item.requiresReferrer || item.requiresUserAgent)) * 100;

        // Prioritaskan mirror Thailand yang manifest-nya telah teruji terbaca.
        if (String(activeChannel.countryCode || '').toUpperCase() === 'TH'
            && url.includes('live-us1.thaimomo.com')) {
          score -= 1000;
        }

        return score;
      };

      return sourceScore(a) - sourceScore(b);
    }).slice(0, 3);
  }, [channels, activeChannel?.url, activeChannel?.tvgId, activeChannel?.countryCode, activeChannel?.name]);

  const navigate = useCallback((to) => {
    const target = new URL(to, window.location.origin);
    if (target.origin !== window.location.origin) { window.location.assign(target.href); return; }
    const next = `${target.pathname}${target.search}${target.hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (next !== current) router.push(next);
    setVisibleCount(PAGE_SIZE);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [router]);

  useEffect(() => {
    setSearch(searchParams.get('q') || '');
  }, [currentPath, queryString]);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;
      ['/jelajah', '/siaran', '/favorit', '/tentang'].forEach((path) => router.prefetch(path));
    }, 600);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [router]);

  useEffect(() => {
    setFavorites(readFavorites());
    setFavoritesLoaded(true);
  }, []);

  const retryCatalog = useCallback(() => {
    setLoadState('loading');
    setLoadError('');
    setCatalogAttempt((attempt) => attempt + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadChannelCatalog()
      .then((safeRows) => {
        if (cancelled) return;
        setChannels(safeRows);
        setLoadState('ready');
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(error.message || 'Terjadi kesalahan ketika membaca data channel.');
        setLoadState('error');
      });
    return () => { cancelled = true; };
  }, [catalogAttempt]);

  useEffect(() => {
    if (!favoritesLoaded) return;
    try { localStorage.setItem('yegtv-favorites', JSON.stringify([...favorites])); } catch { /* storage may be unavailable */ }
  }, [favorites, favoritesLoaded]);

  useEffect(() => {
    if (loadState !== 'ready' || !channels.length) return;
    const params = new URLSearchParams(route.search);
    const targetUrl = params.get('url');
    const channelRoute = route.pathname.match(/^\/channel\/([^/]+)$/);
    if (targetUrl) {
      setActiveChannel(channels.find((item) => item.url === targetUrl) || null);
    } else if (channelRoute) {
      const slug = channelRoute[1];
      setActiveChannel(channels.find((item) => slugify(item.name) === slug) || null);
    }
  }, [channels, loadState, route.pathname, route.search]);

  const isChannelPage = /^\/channel\/[^/]+$/.test(currentPath);
  const isKnownRoute = ['/', '/jelajah', '/siaran', '/favorit', '/tentang'].includes(currentPath) || isChannelPage;
  const activeNav = currentPath === '/favorit' ? 'favorites' : currentPath === '/siaran' ? 'live' : currentPath === '/jelajah' ? 'explore' : 'home';
  const countries = useMemo(() => {
    const priority = ['id', 'my', 'th', 'kr', 'jp', 'sa', 'ae', 'qa', 'kw', 'bh', 'om', 'ye', 'jo', 'iq', 'lb', 'ps', 'il', 'us', 'gb', 'uk', 'ca', 'au', 'nz'];
    return [...new Set(channels.map((item) => item.countryCode).filter(Boolean))].sort((a, b) => {
      const ai = priority.indexOf(String(a).toLowerCase()); const bi = priority.indexOf(String(b).toLowerCase());
      if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      return countryName(a).localeCompare(countryName(b), 'id');
    });
  }, [channels]);
  const categories = useMemo(() => [...new Set(channels.map((item) => item.category || 'Umum'))].sort((a, b) => a.localeCompare(b, 'id')), [channels]);
  const filteredChannels = useMemo(() => {
    const q = deferredSearch.trim().toLocaleLowerCase('id');
    return channels.filter((channel) => {
      if (currentPath === '/favorit' && !favorites.has(channel.url)) return false;
      if (country !== 'all' && channel.countryCode !== country) return false;
      if (category !== 'all' && (channel.category || 'Umum') !== category) return false;
      if (!q) return true;
      return [channel.name, channel.countryCode, countryName(channel.countryCode), channel.category, channel.tvgId]
        .filter(Boolean).some((field) => String(field).toLocaleLowerCase('id').includes(q));
    });
  }, [channels, deferredSearch, country, category, currentPath, favorites]);
  const visibleChannels = filteredChannels.slice(0, visibleCount);
  const featuredChannels = channels.slice(0, 3);
  const handlePlayerStatus = useCallback((status) => setPlayerStatus(status), []);

  function openChannel(channel) { setActiveChannel(channel); navigate(routeForChannel(channel)); }
  function watchChannel(channel) { setActiveChannel(channel); navigate(`/siaran?url=${encodeURIComponent(channel.url)}`); }
  function toggleFavorite(channel) { setFavorites((current) => { const next = new Set(current); if (next.has(channel.url)) next.delete(channel.url); else next.add(channel.url); return next; }); }
  function resetFilters() { setSearch(''); setCountry('all'); setCategory('all'); setVisibleCount(PAGE_SIZE); navigate('/jelajah'); }
  function handleSearchSubmit(event) { event.preventDefault(); navigate(`/jelajah${search.trim() ? `?q=${encodeURIComponent(search.trim())}` : ''}`); }
  const handleInternalLink = (to) => (event) => {
    if (event && (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)) return;
    if (event) event.preventDefault();
    navigate(to);
  };

  useEffect(() => {
    const routeTitles = {
      '/': 'Beranda', '/jelajah': 'Jelajah Channel', '/siaran': 'Siaran Langsung',
      '/favorit': 'Channel Favorit', '/tentang': 'Tentang YEGTv',
    };
    const detail = isChannelPage ? activeChannel?.name : null;
    document.title = `${detail || routeTitles[currentPath] || 'Halaman tidak ditemukan'} | YEGTv`;
  }, [currentPath, isChannelPage, activeChannel]);

  return <div className="app-shell" id="top">
    <header className="topbar">
      <Brand onClick={handleInternalLink('/')} />
      <nav className="main-nav" aria-label="Navigasi utama">
        <a href="/" onClick={handleInternalLink('/')} className={`nav-item ${activeNav === 'home' ? 'active' : ''}`}><Home size={15} /> Beranda</a>
        <a href="/jelajah" onClick={handleInternalLink('/jelajah')} className={`nav-item ${activeNav === 'explore' ? 'active' : ''}`}><Compass size={15} /> Jelajah</a>
        <a href="/siaran" onClick={handleInternalLink('/siaran')} className={`nav-item ${activeNav === 'live' ? 'active' : ''}`}><Radio size={15} /> Siaran</a>
        <a href="/favorit" onClick={handleInternalLink('/favorit')} className={`nav-item ${activeNav === 'favorites' ? 'active' : ''}`}><Heart size={15} /> Favorit <span className="nav-count">{favorites.size}</span></a>
      </nav>
      <form className="header-search" onSubmit={handleSearchSubmit}><Search size={17} /><input type="search" placeholder="Cari channel…" value={search} onChange={(event) => { setSearch(event.target.value); setVisibleCount(PAGE_SIZE); }} aria-label="Cari channel" />{search && <button type="button" aria-label="Hapus pencarian" onClick={() => setSearch('')}><X size={14} /></button>}</form>
      <a className="icon-button help-button" href="/tentang" onClick={handleInternalLink('/tentang')} aria-label="Tentang YEGTv" title="Tentang YEGTv"><CircleHelp size={18} /></a>
    </header>

    <main>
      {!isKnownRoute ? <div className="page-content"><div className="state-panel not-found"><Radio size={31} /><strong>Halaman tidak ditemukan</strong><span>Alamat ini belum tersedia di YEGTv.</span><button className="primary-action" onClick={() => navigate('/')}>Kembali ke beranda</button></div></div> : null}

      {currentPath === '/' && <div className="page-content home-page">
        <section className="hero-section"><div className="hero-heading"><div><span className="section-kicker"><Sparkles size={13} /> TELEVISI DALAM SATU TEMPAT</span><h1>Temukan siaran<br /><span>yang kamu suka.</span></h1><p>Jelajahi ribuan channel, temukan tontonan pilihan, lalu nikmati siaran langsung dalam pengalaman glass yang nyaman.</p><div className="hero-ctas"><button className="primary-action" onClick={() => navigate('/jelajah')}><Compass size={16} /> Jelajahi channel</button><button className="secondary-action hero-secondary" onClick={() => navigate('/siaran')}><MonitorPlay size={16} /> Buka siaran</button></div></div>
          <div className="hero-live-count"><span className="live-dot" /><span><strong>{loadState === 'ready' ? channels.length.toLocaleString('id-ID') : '—'}</strong><small>CHANNEL DI KATALOG</small></span></div></div>
          <LoadMessage loadState={loadState} loadError={loadError} onRetry={retryCatalog} />
          {loadState === 'loading' && <div className="feature-grid feature-skeletons">{[0,1,2].map((n) => <div className="feature-skeleton" key={n} />)}</div>}
          {loadState === 'ready' && <div className="feature-grid">{featuredChannels.map((channel, index) => <FeaturedChannel key={`${channel.url}-${channel.name}`} channel={channel} index={index} onSelect={openChannel} />)}</div>}
        </section>
        <section className="category-section"><div className="category-rail"><button className="category-pill active" onClick={() => navigate('/jelajah')}><Radio size={15} /> Semua channel</button>{categories.slice(0,6).map((name) => <button className="category-pill" key={name} onClick={() => { setCategory(name); navigate('/jelajah'); }}><Sparkles size={14} /> {name}</button>)}<button className="category-pill" onClick={() => navigate('/favorit')}><Heart size={14} /> Favoritku</button></div></section>
        <section className="browse-section home-browse"><div className="section-heading browse-heading"><div><span className="section-kicker">MULAI MENJELAJAH</span><h2>Channel untuk kamu temukan</h2><p className="section-subtitle">Pilih salah satu channel untuk membuka halaman detail dan pemutar siarannya.</p></div><button className="text-action" onClick={() => navigate('/jelajah')}>Lihat semua <ChevronRight size={15} /></button></div>
          {loadState === 'ready' && <ChannelGrid channels={channels.slice(0,10)} favorites={favorites} onSelect={openChannel} onFavorite={toggleFavorite} />}
        </section>
      </div>}

      {currentPath === '/jelajah' && <div className="page-content browse-page">
        <PageHeading kicker="KATALOG YEGTV" title="Jelajahi channel" description="Temukan siaran berdasarkan nama, negara, atau kategori." action={<div className="result-counter"><Signal size={15} /> {filteredChannels.length.toLocaleString('id-ID')} channel</div>} />
        <LoadMessage loadState={loadState} loadError={loadError} onRetry={retryCatalog} />
        <div className="filter-panel"><label className="select-wrap"><Globe2 size={15} /><select value={country} onChange={(event) => { setCountry(event.target.value); setVisibleCount(PAGE_SIZE); }} aria-label="Filter negara"><option value="all">Semua negara</option>{countries.map((code) => <option value={code} key={code}>{countryName(code)}</option>)}</select><ChevronDown size={14} /></label>
          <label className="select-wrap"><ArrowDownWideNarrow size={15} /><select value={category} onChange={(event) => { setCategory(event.target.value); setVisibleCount(PAGE_SIZE); }} aria-label="Filter kategori"><option value="all">Semua kategori</option>{categories.map((name) => <option key={name} value={name}>{name}</option>)}</select><ChevronDown size={14} /></label>
          {(search || country !== 'all' || category !== 'all') && <button className="clear-filter" onClick={resetFilters}>Reset filter <X size={13} /></button>}
        </div>
        {loadState === 'ready' && <><ChannelGrid channels={visibleChannels} favorites={favorites} onSelect={openChannel} onFavorite={toggleFavorite} emptyTitle="Tidak ada channel yang cocok" emptyDescription="Coba kata kunci atau filter yang berbeda." /><div className="grid-footer"><span>Menampilkan {visibleChannels.length.toLocaleString('id-ID')} dari {filteredChannels.length.toLocaleString('id-ID')} channel</span>{visibleCount < filteredChannels.length && <button className="load-more" onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}>Muat lebih banyak <ChevronDown size={15} /></button>}</div></>}
      </div>}

      {currentPath === '/favorit' && <div className="page-content favorites-page">
        <PageHeading kicker="KOLEKSI PRIBADI" title="Channel favorit" description="Semua channel yang kamu simpan, terkumpul di satu tempat." action={<div className="hero-live-count"><Heart size={15} /><span><strong>{favorites.size}</strong><small>DISIMPAN</small></span></div>} />
        <LoadMessage loadState={loadState} loadError={loadError} onRetry={retryCatalog} />
        {loadState === 'ready' && <ChannelGrid channels={filteredChannels} favorites={favorites} onSelect={openChannel} onFavorite={toggleFavorite} emptyTitle={search ? 'Favorit tidak ditemukan' : 'Belum ada channel favorit'} emptyDescription={search ? 'Coba kata pencarian lain.' : 'Tekan ikon hati pada channel yang kamu suka, lalu channel itu akan muncul di sini.'} />}
        {loadState === 'ready' && favorites.size === 0 && <button className="primary-action favorites-cta" onClick={() => navigate('/jelajah')}><Compass size={16} /> Jelajahi channel</button>}
      </div>}

      {currentPath === '/siaran' && <div className="page-content live-page">
        <PageHeading kicker="YEGTV LIVE" title="Siaran langsung" description="Pilih channel dan tonton di halaman ini. Ketersediaan stream bergantung pada penyedia masing-masing." action={<span className={`connection-status ${playerStatus === 'playing' ? 'connected' : playerStatus === 'error' ? 'disconnected' : ''}`}><span className="status-dot" />{playerStatus === 'playing' ? 'Sedang diputar' : playerStatus === 'error' ? 'Stream bermasalah' : playerStatus === 'loading' ? 'Menghubungkan' : 'Siap menonton'}</span>} />
        <LoadMessage loadState={loadState} loadError={loadError} onRetry={retryCatalog} />
        {loadState === 'ready' && <div className="live-page-layout"><section className="live-main"><div className="glass-panel live-player-panel"><VideoPlayer key={activeChannel?.url || 'empty-player'} channel={activeChannel} fallbacks={fallbackChannels} onStatus={handlePlayerStatus} /></div>
          {activeChannel ? <div className="live-channel-info glass-panel"><div className="live-detail-brand"><ChannelLogo channel={activeChannel} large /><div><span className="section-kicker">SEKARANG DIPUTAR</span><h2>{activeChannel.name}</h2><p>{countryName(activeChannel.countryCode)} · {activeChannel.category || 'Umum'}</p></div></div><div className="detail-actions"><button className="primary-action" onClick={() => document.querySelector('.video-element')?.play().catch(() => {})}><Play size={15} fill="currentColor" /> Putar channel</button><button className={`secondary-action ${favorites.has(activeChannel.url) ? 'favorited' : ''}`} onClick={() => toggleFavorite(activeChannel)}><Heart size={15} fill={favorites.has(activeChannel.url) ? 'currentColor' : 'none'} /> {favorites.has(activeChannel.url) ? 'Tersimpan' : 'Favorit'}</button><button className="secondary-action" onClick={() => openChannel(activeChannel)}><Info size={15} /> Detail</button></div></div> : null}
        </section><aside className="live-sidebar glass-panel"><div className="sidebar-title"><div><span className="section-kicker">KATALOG</span><h2>Pilih channel</h2></div><span>{channels.length.toLocaleString('id-ID')}</span></div><div className="live-channel-list">{channels.slice(0,30).map((channel) => <button className={`live-channel-item ${activeChannel?.url === channel.url ? 'active' : ''}`} key={`${channel.url}-${channel.name}`} onClick={() => watchChannel(channel)}><ChannelLogo channel={channel} /><span><strong>{channel.name}</strong><small>{countryName(channel.countryCode)} · {channel.category || 'Umum'}</small></span><Play size={13} /></button>)}</div><button className="load-more live-more" onClick={() => navigate('/jelajah')}>Jelajahi semua channel <ChevronRight size={14} /></button></aside></div>}
      </div>}

      {isChannelPage && <div className="page-content channel-page">
        {!activeChannel && loadState === 'ready' ? <div className="state-panel"><Radio size={29} /><strong>Channel tidak ditemukan</strong><span>Channel ini mungkin sudah tidak ada di katalog.</span><button className="primary-action" onClick={() => navigate('/jelajah')}>Kembali ke katalog</button></div> : null}
        {loadState === 'loading' && <LoadMessage loadState={loadState} loadError={loadError} onRetry={retryCatalog} />}
        {activeChannel && <><button className="back-link" onClick={() => navigate('/jelajah')}><ArrowLeft size={15} /> Kembali ke jelajah</button><div className="channel-detail-layout"><section className="channel-detail-hero glass-panel" style={{ '--hue': hueFor(activeChannel.name) }}><div className="detail-backdrop" /><ChannelLogo channel={activeChannel} large /><div className="channel-detail-text"><span className="section-kicker"><span className="live-dot" /> HALAMAN CHANNEL</span><h1>{activeChannel.name}</h1><p>{countryName(activeChannel.countryCode)} · {activeChannel.category || 'Umum'}</p><div className="detail-actions"><button className="primary-action" onClick={() => watchChannel(activeChannel)}><Play size={15} fill="currentColor" /> Tonton siaran</button><button className={`secondary-action ${favorites.has(activeChannel.url) ? 'favorited' : ''}`} onClick={() => toggleFavorite(activeChannel)}><Heart size={15} fill={favorites.has(activeChannel.url) ? 'currentColor' : 'none'} /> {favorites.has(activeChannel.url) ? 'Tersimpan' : 'Simpan favorit'}</button></div></div></section><section className="glass-panel channel-meta-panel"><div className="section-kicker">INFORMASI CHANNEL</div><div className="channel-meta-row"><span>Nama</span><strong>{activeChannel.name}</strong></div><div className="channel-meta-row"><span>Negara</span><strong>{countryName(activeChannel.countryCode)}</strong></div><div className="channel-meta-row"><span>Kode negara</span><strong>{activeChannel.countryCode || '—'}</strong></div><div className="channel-meta-row"><span>Kategori</span><strong>{activeChannel.category || 'Umum'}</strong></div><div className="channel-meta-row"><span>ID playlist</span><strong>{activeChannel.tvgId || 'Tidak tersedia'}</strong></div><p className="detail-disclaimer"><Info size={14} /> YEGTv adalah katalog. Ketersediaan siaran dan hak tayang mengikuti penyedia sumber.</p></section></div><section className="browse-section detail-related"><div className="section-heading"><div><span className="section-kicker">TEMUKAN LAGI</span><h2>Channel lainnya</h2></div><button className="text-action" onClick={() => navigate('/jelajah')}>Lihat semua <ChevronRight size={15} /></button></div><ChannelGrid channels={channels.filter((item) => item.url !== activeChannel.url).slice(0,5)} favorites={favorites} onSelect={openChannel} onFavorite={toggleFavorite} /></section></>}
      </div>}

      {currentPath === '/tentang' && <div className="page-content about-page">
        <PageHeading kicker="TENTANG YEGTV" title="Panduan TV sehari-hari, dalam satu tempat." description="Temukan channel, simpan pilihanmu, dan buka halaman siaran dengan navigasi yang lebih jelas." />
        <div className="about-grid"><section className="glass-panel about-main-card"><div className="about-logo-large"><BrandMark /></div><span className="section-kicker">YOUR EVERYDAY GUIDE TV</span><h2>Streaming terasa lebih teratur.</h2><p>YEGTv menyatukan katalog channel dari playlist publik menjadi halaman jelajah, favorit, detail channel, dan pemutar siaran. Setiap bagian memiliki URL tersendiri sehingga pengguna bisa berpindah halaman atau membagikan link channel tertentu.</p><div className="about-stat-row"><div><strong>{loadState === 'ready' ? channels.length.toLocaleString('id-ID') : '—'}</strong><span>Channel katalog</span></div><div><strong>{countries.length || '—'}</strong><span>Negara / wilayah</span></div><div><strong>{categories.length || '—'}</strong><span>Kategori</span></div></div></section>
          <section className="about-links"><button className="glass-panel about-link-card" onClick={() => navigate('/jelajah')}><Compass size={21} /><span><strong>Jelajah channel</strong><small>Temukan siaran dari berbagai negara dan kategori.</small></span><ChevronRight size={16} /></button><button className="glass-panel about-link-card" onClick={() => navigate('/favorit')}><Heart size={21} /><span><strong>Favorit pribadi</strong><small>Simpan channel favorit pada browser kamu.</small></span><ChevronRight size={16} /></button><button className="glass-panel about-link-card" onClick={() => navigate('/siaran')}><MonitorPlay size={21} /><span><strong>Pemutar siaran</strong><small>Tonton channel tanpa kehilangan konteks navigasi.</small></span><ChevronRight size={16} /></button><a className="glass-panel about-link-card" href={SOURCE_REPO} target="_blank" rel="noreferrer"><ExternalLink size={21} /><span><strong>Repository sumber</strong><small>Lihat playlist publik yang menjadi sumber katalog.</small></span><ChevronRight size={16} /></a></section></div>
        <section className="glass-panel about-notice"><ShieldCheck size={20} /><div><h3>Catatan penggunaan</h3><p>Daftar channel tidak menjamin semua siaran aktif atau dapat diputar di semua wilayah. Beberapa penyedia membatasi akses melalui CORS, lokasi, atau ketentuan tertentu. Gunakan hanya sumber siaran yang boleh kamu akses dan tayangkan.</p></div></section>
      </div>}

      <footer className="footer"><Brand footer onClick={handleInternalLink('/')} /><span>Streaming langsung, satu tempat.</span><div className="footer-nav"><a href="/jelajah" onClick={handleInternalLink('/jelajah')}>Jelajah</a><a href="/siaran" onClick={handleInternalLink('/siaran')}>Siaran</a><a href="/favorit" onClick={handleInternalLink('/favorit')}>Favorit</a><a href="/tentang" onClick={handleInternalLink('/tentang')}>Tentang</a></div><small>YEGTv adalah katalog channel; ketersediaan siaran mengikuti server dan ketentuan penyedia masing-masing.</small></footer>
    </main>
  </div>;
}
