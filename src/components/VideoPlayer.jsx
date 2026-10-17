import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { AlertTriangle, ExternalLink, LoaderCircle, Play, Radio, Sparkles, Volume2, Waves } from 'lucide-react';
import { countryName } from '../lib/playlist.js';

function hueFor(value = '') {
  let hash = 0;
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) % 360;
  return (hash + 360) % 360;
}

function colorFromHue(hue, saturation = 62, lightness = 53) {
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

export default function VideoPlayer({ channel, onStatus }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [ambientOn, setAmbientOn] = useState(true);
  const [ambientColors, setAmbientColors] = useState({ primary: 'hsl(198 58% 53%)', secondary: 'hsl(258 55% 60%)' });

  useEffect(() => {
    const hue = hueFor(channel?.name || 'YEGTv');
    setAmbientColors({ primary: colorFromHue(hue), secondary: colorFromHue((hue + 66) % 360, 58, 58) });
  }, [channel?.url, channel?.name]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    video.pause();
    video.removeAttribute('src');
    video.load();
    setMessage('');
    setStatus(channel ? 'loading' : 'idle');
    onStatus?.(channel ? 'loading' : 'idle');
    if (!channel?.url) return undefined;

    const handlePlaying = () => {
      setStatus('playing');
      setMessage('');
      onStatus?.('playing');
    };
    const handleWaiting = () => {
      setStatus('loading');
      onStatus?.('loading');
    };
    const handleCanPlay = () => {
      setStatus('ready');
      setMessage('');
      onStatus?.('ready');
    };
    const handleError = () => {
      const detail = video.error?.message || 'Browser tidak dapat membaca sumber video ini.';
      setStatus('error');
      setMessage(detail);
      onStatus?.('error');
    };

    video.addEventListener('playing', handlePlaying);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('error', handleError);

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 30,
        maxBufferLength: 30,
      });
      hlsRef.current = hls;
      hls.loadSource(channel.url);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          const reason = data.details || data.type || 'kesalahan stream';
          setStatus('error');
          setMessage(`Stream gagal diputar (${reason}).`);
          onStatus?.('error');
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = channel.url;
      video.load();
    } else {
      setStatus('error');
      setMessage('Browser ini tidak mendukung pemutaran HLS. Coba Safari atau browser terbaru.');
      onStatus?.('error');
    }

    return () => {
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('error', handleError);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
  }, [channel?.url, onStatus]);

  // Sample low-resolution frames when browser security permits it. Some native HLS
  // streams taint canvas; in that case we keep the channel-colour glow as fallback.
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
            // Skip mostly black pixels so letterboxing doesn't darken the ambient glow.
            const brightness = data[i] + data[i + 1] + data[i + 2];
            if (brightness < 35) continue;
            red += data[i]; green += data[i + 1]; blue += data[i + 2]; count += 1;
          }
          if (count > 0) {
            red = Math.round(red / count); green = Math.round(green / count); blue = Math.round(blue / count);
            const lift = (value) => Math.min(255, Math.round(value * 1.16 + 15));
            const primary = `rgb(${lift(red)} ${lift(green)} ${lift(blue)})`;
            const secondary = `rgb(${lift(blue)} ${lift(red)} ${lift(green)})`;
            setAmbientColors((current) => {
              if (current.primary === primary && current.secondary === secondary) return current;
              return { primary, secondary };
            });
          }
        } catch {
          // Canvas security restrictions vary by provider. The static hue fallback remains.
          stopped = true;
          cancelAnimationFrame(frameId);
          return;
        }
      }
      frameId = requestAnimationFrame(sample);
    };

    frameId = requestAnimationFrame(sample);
    return () => {
      stopped = true;
      cancelAnimationFrame(frameId);
    };
  }, [ambientOn, status, channel?.url]);

  const stageStyle = {
    '--ambient-primary': ambientColors.primary,
    '--ambient-secondary': ambientColors.secondary,
  };

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
        <video
          ref={videoRef}
          className="video-element"
          controls
          playsInline
          preload="none"
          aria-label={`Pemutar ${channel.name}`}
        />
        {status === 'loading' && (
          <div className="player-overlay"><LoaderCircle className="spin" size={26} /><span>Menghubungkan ke siaran…</span></div>
        )}
        {status === 'idle' && (
          <div className="player-overlay"><Play size={26} /><span>Tekan tombol play untuk menonton</span></div>
        )}
        {status === 'error' && (
          <div className="player-overlay player-error">
            <AlertTriangle size={27} />
            <strong>Channel tidak dapat diputar</strong>
            <span>{message || 'Sumber siaran mungkin sedang offline atau membatasi akses browser.'}</span>
            <span className="error-hint">CORS, HTTP di halaman HTTPS, pembatasan wilayah, atau URL yang sudah kedaluwarsa dapat menyebabkan kegagalan.</span>
            <a className="external-link" href={channel.url} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Buka sumber stream</a>
          </div>
        )}
        <div className="player-top-controls">
          <div className="player-live-tag"><span className="live-dot" /> LIVE</div>
          <button className={`ambient-toggle ${ambientOn ? 'is-on' : ''}`} onClick={() => setAmbientOn((current) => !current)} aria-pressed={ambientOn} title={ambientOn ? 'Matikan ambient mode' : 'Aktifkan ambient mode'}>
            {ambientOn ? <Sparkles size={14} /> : <Waves size={14} />} Ambient {ambientOn ? 'On' : 'Off'}
          </button>
        </div>
        <div className="player-watermark"><Volume2 size={13} /> YEGTV</div>
        <div className="player-label"><span>{countryName(channel.countryCode)}</span><b>{channel.name}</b></div>
      </div>
    </div>
  );
}
