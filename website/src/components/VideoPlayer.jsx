'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Hls from 'hls.js';
import { AlertTriangle, Captions, ExternalLink, LoaderCircle, Play, Radio, RefreshCw, Sparkles, Volume2, Waves } from 'lucide-react';
import { countryName } from '../lib/playlist.js';

function hueFor(value = '') {
  let hash = 0;
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) % 360;
  return (hash + 360) % 360;
}

function colorFromHue(hue, saturation = 62, lightness = 53) {
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

function isIndonesianTrack(track) {
  const language = String(track?.lang || track?.language || '').toLowerCase();
  const label = String(track?.name || track?.label || '').toLowerCase();
  return ['id', 'ind', 'id-id', 'indonesia'].includes(language)
    || /bahasa indonesia|indonesian|(^|\W)indonesia(\W|$)/i.test(label);
}

function describeSubtitle(track, index) {
  const lang = String(track?.lang || track?.language || '').trim();
  const name = String(track?.name || track?.label || '').trim();
  const indonesia = isIndonesianTrack(track);
  return {
    value: String(index),
    label: indonesia ? `Bahasa Indonesia${name && !/indonesia/i.test(name) ? ` · ${name}` : ''}` : (name || lang || `Subtitle ${index + 1}`),
    lang,
    indonesia,
  };
}

export default function VideoPlayer({ channel, fallbacks = [], onStatus }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [ambientOn, setAmbientOn] = useState(true);
  const [ambientColors, setAmbientColors] = useState({ primary: 'hsl(198 58% 53%)', secondary: 'hsl(258 55% 60%)' });
  const [attemptIndex, setAttemptIndex] = useState(0);
  const [retryNonce, setRetryNonce] = useState(0);
  const [subtitleTracks, setSubtitleTracks] = useState([]);
  const [selectedSubtitle, setSelectedSubtitle] = useState('off');
  const [subtitleNote, setSubtitleNote] = useState('');

  const fallbackKey = fallbacks.map((item) => item?.url).filter(Boolean).join('|');
  const candidates = useMemo(() => {
    const unique = new Set();
    return [channel, ...fallbacks].filter((item) => {
      if (!item?.url || !/^https?:\/\//i.test(item.url) || unique.has(item.url)) return false;
      unique.add(item.url);
      return true;
    }).slice(0, 4);
    // The string key intentionally keeps this memo stable through unrelated parent renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel?.url, fallbackKey]);
  const activeSource = candidates[Math.min(attemptIndex, Math.max(0, candidates.length - 1))] || channel;

  useEffect(() => {
    const hue = hueFor(channel?.name || 'YEGTv');
    setAmbientColors({ primary: colorFromHue(hue), secondary: colorFromHue((hue + 66) % 360, 58, 58) });
  }, [channel?.url, channel?.name]);

  useEffect(() => {
    if (channel?.playerType === 'official-link') {
      setStatus('idle');
      setMessage('Sumber resmi belum memiliki player embed yang terverifikasi.');
      onStatus?.('idle');
      return undefined;
    }

    if (channel?.playerType === 'embed') {
      setStatus('loading');
      setMessage('Memuat player resmi…');
      onStatus?.('loading');
      return undefined;
    }

    const video = videoRef.current;
    if (!video) return undefined;

    let disposed = false;
    let switchedSource = false;
    let mediaRecoveryUsed = false;
    let liveRecoveryUsed = false;
    let stallTimer;
    const source = activeSource;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    video.pause();
    video.removeAttribute('src');
    video.load();
    setMessage('');
    setSubtitleTracks([]);
    setSelectedSubtitle('off');
    setSubtitleNote('');
    setStatus(channel && source ? 'loading' : 'idle');
    onStatus?.(channel && source ? 'loading' : 'idle');
    if (!channel || !source?.url) return undefined;

    const setPlayerStatus = (next, note = '') => {
      if (disposed) return;
      setStatus(next);
      if (note) setMessage(note);
      onStatus?.(next);
    };

    const switchToNextSource = (reason) => {
      if (disposed || switchedSource) return;
      switchedSource = true;
      if (stallTimer) clearTimeout(stallTimer);
      if (attemptIndex < candidates.length - 1) {
        setMessage(`${reason} Mencoba sumber cadangan ${attemptIndex + 2}/${candidates.length}…`);
        setStatus('loading');
        onStatus?.('loading');
        setAttemptIndex((current) => Math.min(current + 1, candidates.length - 1));
      } else {
        setPlayerStatus('error', `${reason} Tidak ada mirror lain yang tersedia di katalog.`);
      }
    };

    const handlePlaying = () => {
      if (stallTimer) clearTimeout(stallTimer);
      setPlayerStatus('playing');
      setMessage('');
    };
    const handleWaiting = () => {
      if (disposed || video.readyState >= 3) return;
      setPlayerStatus('loading');
      if (stallTimer) clearTimeout(stallTimer);

      stallTimer = setTimeout(() => {
        if (disposed || video.readyState >= 3) return;

        const hls = hlsRef.current;

        // Coba sinkronisasi ulang ke posisi live sebelum pindah sumber.
        if (hls && !liveRecoveryUsed) {
          liveRecoveryUsed = true;
          setPlayerStatus('loading', 'Siaran macet; mencoba sinkronisasi ulang live…');

          try {
            hls.startLoad(-1);

            if (Number.isFinite(hls.liveSyncPosition) && hls.liveSyncPosition >= 0) {
              video.currentTime = hls.liveSyncPosition;
            } else if (video.seekable.length > 0) {
              const last = video.seekable.length - 1;
              const start = video.seekable.start(last);
              const end = video.seekable.end(last);
              video.currentTime = Math.max(start, end - 3);
            }

            video.play().catch(() => {});
          } catch {
            // Jika pemulihan gagal, coba fallback setelah masa tunggu.
          }

          stallTimer = setTimeout(() => {
            if (!disposed && video.readyState < 3) {
              switchToNextSource('Siaran tetap macet setelah sinkronisasi ulang.');
            }
          }, 10000);

          return;
        }

        switchToNextSource('Siaran terlalu lama berhenti memuat.');
      }, 14000);
    };
    const handleCanPlay = () => {
      if (stallTimer) clearTimeout(stallTimer);
      setPlayerStatus('ready');
    };
    const handleError = () => {
      const detail = video.error?.message || 'Browser tidak dapat membaca sumber video ini.';
      switchToNextSource(detail);
    };

    const readNativeSubtitleTracks = () => {
      const list = video.textTracks;
      if (!list) return;
      const rows = Array.from({ length: list.length }, (_, index) => {
        const item = list[index];
        return { value: String(index), label: item.label || item.language || `Subtitle ${index + 1}`, lang: item.language || '', indonesia: isIndonesianTrack({ lang: item.language, name: item.label }) };
      }).filter((item) => list[Number(item.value)]?.kind === 'subtitles' || list[Number(item.value)]?.kind === 'captions');
      setSubtitleTracks(rows);
      const idTrack = rows.find((item) => item.indonesia);
      if (idTrack) {
        list[Number(idTrack.value)].mode = 'showing';
        setSelectedSubtitle(idTrack.value);
        setSubtitleNote('Subtitle Bahasa Indonesia aktif.');
      } else if (rows.length) {
        setSelectedSubtitle('off');
        setSubtitleNote('Subtitle tersedia, tetapi Bahasa Indonesia tidak ditemukan pada sumber ini.');
        for (const item of rows) list[Number(item.value)].mode = 'disabled';
      }
    };

    video.addEventListener('playing', handlePlaying);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('stalled', handleWaiting);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('error', handleError);
    video.addEventListener('loadedmetadata', readNativeSubtitleTracks);

    if (window.location.protocol === 'https:' && source.url.startsWith('http://')) {
      switchToNextSource('Browser memblokir sumber HTTP pada halaman HTTPS.');
    } else if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        liveSyncDurationCount: 3,
        maxLiveSyncPlaybackRate: 1.25,
        backBufferLength: 12,
        maxBufferLength: 16,
        maxMaxBufferLength: 30,
        startLevel: -1,
        capLevelToPlayerSize: true,
        startFragPrefetch: true,
        manifestLoadingTimeOut: 7000,
        levelLoadingTimeOut: 9000,
        fragLoadingTimeOut: 12000,
        manifestLoadingMaxRetry: 1,
        levelLoadingMaxRetry: 1,
        fragLoadingMaxRetry: 2,
        manifestLoadingRetryDelay: 400,
        levelLoadingRetryDelay: 400,
        fragLoadingRetryDelay: 500,
      });
      hlsRef.current = hls;
      hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, (_event, data) => {
        const tracks = data?.subtitleTracks || hls.subtitleTracks || [];
        const rows = tracks.map((item, index) => describeSubtitle(item, index));
        if (disposed) return;
        setSubtitleTracks(rows);
        const indonesian = rows.find((item) => item.indonesia);
        if (indonesian) {
          hls.subtitleDisplay = true;
          hls.subtitleTrack = Number(indonesian.value);
          setSelectedSubtitle(indonesian.value);
          setSubtitleNote('Subtitle Bahasa Indonesia aktif.');
        } else {
          hls.subtitleDisplay = false;
          hls.subtitleTrack = -1;
          setSelectedSubtitle('off');
          setSubtitleNote(rows.length ? 'Sumber menyediakan subtitle, tetapi track Bahasa Indonesia tidak ditemukan.' : 'Sumber ini tidak menyediakan track subtitle.');
        }
      });
      hls.on(Hls.Events.SUBTITLE_TRACK_SWITCH, (_event, data) => {
        if (data?.id !== undefined) setSelectedSubtitle(String(data.id));
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data?.fatal || disposed) return;
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR && !mediaRecoveryUsed) {
          mediaRecoveryUsed = true;
          hls.recoverMediaError();
          return;
        }
        const reason = data.details || data.type || 'kesalahan stream';
        switchToNextSource(`Stream gagal (${reason}).`);
      });
      hls.loadSource(source.url);
      hls.attachMedia(video);
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = source.url;
      video.load();
    } else {
      switchToNextSource('Browser ini tidak mendukung HLS.');
    }

    if (attemptIndex > 0) setMessage(`Menggunakan sumber cadangan ${attemptIndex + 1}/${candidates.length}…`);

    return () => {
      disposed = true;
      if (stallTimer) clearTimeout(stallTimer);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('stalled', handleWaiting);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('error', handleError);
      video.removeEventListener('loadedmetadata', readNativeSubtitleTracks);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
  }, [channel?.url, channel?.playerType, activeSource?.url, attemptIndex, candidates.length, onStatus, retryNonce]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !ambientOn || status !== 'playing') return undefined;

    const canvas = document.createElement('canvas');
    canvas.width = 24;
    canvas.height = 14;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return undefined;

    let frameId = 0;
    let ticks = 0;
    let stopped = false;
    const sample = () => {
      if (stopped) return;
      ticks += 1;
      if (ticks % 5 === 0 && video.readyState >= 2) {
        try {
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
          let red = 0; let green = 0; let blue = 0; let count = 0;
          for (let i = 0; i < data.length; i += 4) {
            if (data[i] + data[i + 1] + data[i + 2] < 35) continue;
            red += data[i]; green += data[i + 1]; blue += data[i + 2]; count += 1;
          }
          if (count > 0) {
            red = Math.round(red / count); green = Math.round(green / count); blue = Math.round(blue / count);
            const lift = (value) => Math.min(255, Math.round(value * 1.16 + 15));
            const primary = `rgb(${lift(red)} ${lift(green)} ${lift(blue)})`;
            const secondary = `rgb(${lift(blue)} ${lift(red)} ${lift(green)})`;
            setAmbientColors((current) => current.primary === primary && current.secondary === secondary ? current : { primary, secondary });
          }
        } catch {
          stopped = true;
          cancelAnimationFrame(frameId);
          return;
        }
      }
      frameId = requestAnimationFrame(sample);
    };
    frameId = requestAnimationFrame(sample);
    return () => { stopped = true; cancelAnimationFrame(frameId); };
  }, [ambientOn, status, channel?.url]);

  function changeSubtitle(value) {
    setSelectedSubtitle(value);
    const hls = hlsRef.current;
    if (hls) {
      hls.subtitleTrack = value === 'off' ? -1 : Number(value);
      hls.subtitleDisplay = value !== 'off';
    }
    const video = videoRef.current;
    if (video?.textTracks) {
      Array.from({ length: video.textTracks.length }, (_, index) => {
        const track = video.textTracks[index];
        track.mode = value !== 'off' && String(index) === value ? 'showing' : 'disabled';
      });
    }
    if (value === 'off') setSubtitleNote('Subtitle dimatikan.');
    else if (subtitleTracks.find((track) => track.value === value)?.indonesia) setSubtitleNote('Subtitle Bahasa Indonesia aktif.');
    else setSubtitleNote('Subtitle asli dari sumber siaran aktif; ini bukan terjemahan otomatis.');
  }

  const stageStyle = {
    '--ambient-primary': ambientColors.primary,
    '--ambient-secondary': ambientColors.secondary,
  };

  if (channel?.playerType === 'official-link' && channel.url) {
    return (
      <div
        className={`player-stage ${ambientOn ? 'ambient-enabled' : 'ambient-disabled'}`}
        style={stageStyle}
      >
        <div className="ambient-light ambient-light-one" aria-hidden="true" />
        <div className="ambient-light ambient-light-two" aria-hidden="true" />
        <div className="player-wrap official-embed-wrap">
          <div className="official-link-card">
            <div className="player-empty-icon"><Radio size={28} /></div>
            <p className="eyebrow">SUMBER SIARAN RESMI</p>
            <h2>{channel.name}</h2>
            <p className="official-link-note">
              Halaman sumber tersedia. Player yang diizinkan untuk ditanam
              di YEGTv belum terverifikasi, jadi pemutaran langsung di sini
              belum tersedia untuk channel ini.
            </p>
            <a
              className="external-link official-source-link"
              href={channel.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink size={14} /> Buka player resmi di tab baru
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (channel?.playerType === 'embed' && channel.url) {
    return (
      <div
        className={`player-stage ${ambientOn ? 'ambient-enabled' : 'ambient-disabled'}`}
        style={stageStyle}
      >
        <div className="player-wrap official-embed-wrap">
          <iframe
            className="official-embed-frame"
            src={channel.url}
            title={`Player resmi ${channel.name}`}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            loading="eager"
            onLoad={() => {
              setStatus('ready');
              setMessage('');
              onStatus?.('ready');
            }}
            onError={() => {
              setStatus('error');
              setMessage('Player resmi tidak dapat dimuat oleh browser.');
              onStatus?.('error');
            }}
          />
        </div>
      </div>
    );
  }

  if (!channel) {
    return (
      <div className="player-stage player-stage-empty" style={stageStyle}>
        <div className="ambient-light ambient-light-one" />
        <div className="ambient-light ambient-light-two" />
        <div className="player-empty">
          <div className="player-empty-icon"><Radio size={30} /></div>
          <p className="eyebrow">YEGTV LIVE</p>
          <h2>Pilih channel untuk mulai menonton</h2>
          <p>Jelajahi katalog, pilih siaran, dan ambient glow akan menemani tayanganmu.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`player-stage ${ambientOn ? 'ambient-enabled' : 'ambient-disabled'}`} style={stageStyle}>
      <div className="ambient-light ambient-light-one" aria-hidden="true" />
      <div className="ambient-light ambient-light-two" aria-hidden="true" />
      <div className="player-wrap">
        <video ref={videoRef} className="video-element" controls playsInline preload="metadata" aria-label={`Pemutar ${channel.name}`} />
        {status === 'loading' && (
          <div className="player-overlay"><LoaderCircle className="spin" size={26} /><span>{message || 'Menghubungkan ke siaran…'}</span></div>
        )}
        {status === 'idle' && (
          <div className="player-overlay"><Play size={26} /><span>Tekan tombol play untuk menonton</span></div>
        )}
        {status === 'error' && (
          <div className="player-overlay player-error">
            <AlertTriangle size={27} />
            <strong>Channel tidak dapat diputar</strong>
            <span>{message || 'Sumber siaran mungkin sedang offline atau membatasi akses browser.'}</span>
            {(activeSource?.requiresReferrer || activeSource?.requiresUserAgent) && <span className="error-hint">Playlist sumber meminta header tambahan. Browser tidak dapat meniru semua header aplikasi TV; coba sumber cadangan atau URL lain yang disediakan secara resmi.</span>}
            <span className="error-hint">Kendala CORS, HTTPS/HTTP, lokasi, header penyedia, atau URL yang kedaluwarsa tidak selalu bisa diperbaiki oleh pemutar web.</span>
            <div className="player-error-actions"><button type="button" className="external-link retry-stream" onClick={() => { setAttemptIndex(0); setRetryNonce((value) => value + 1); setMessage('Mencoba menyambungkan kembali…'); setStatus('loading'); }}><RefreshCw size={14} /> Coba lagi</button><a className="external-link" href={activeSource?.url || channel.url} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Buka sumber</a></div>
          </div>
        )}
        <div className="player-top-controls">
          <div className="player-live-tag"><span className="live-dot" /> LIVE {attemptIndex > 0 ? `· CADANGAN ${attemptIndex}` : ''}</div>
          <div className="player-control-cluster">
            <label className={`subtitle-select ${subtitleTracks.length ? 'has-subtitles' : ''}`} title={subtitleNote || 'Subtitle yang tersedia dari sumber siaran'}>
              <Captions size={14} />
              <select aria-label="Pilih subtitle" value={selectedSubtitle} onChange={(event) => changeSubtitle(event.target.value)}>
                <option value="off">CC Off</option>
                {subtitleTracks.map((track) => <option key={`${track.value}-${track.label}`} value={track.value}>{track.label}</option>)}
              </select>
            </label>
            <button className={`ambient-toggle ${ambientOn ? 'is-on' : ''}`} onClick={() => setAmbientOn((current) => !current)} aria-pressed={ambientOn} title={ambientOn ? 'Matikan ambient mode' : 'Aktifkan ambient mode'}>
              {ambientOn ? <Sparkles size={14} /> : <Waves size={14} />} Ambient {ambientOn ? 'On' : 'Off'}
            </button>
          </div>
        </div>
        <div className="player-watermark"><Volume2 size={13} /> YEGTV</div>
        <div className="player-label"><span>{countryName(channel.countryCode)}{activeSource?.url !== channel.url ? ' · Sumber cadangan' : ''}</span><b>{channel.name}</b></div>
      </div>
      {subtitleNote && status === 'playing' && <div className="subtitle-note" role="status">{subtitleNote}</div>}
    </div>
  );
}
