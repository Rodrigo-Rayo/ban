/* La Maqueta · fase 0 (laboratorio). Todo ocurre en el navegador: nada se sube a ningún servidor.
 * Graba partes de un bucle corto sobre lo ya grabado, las mezcla y genera un vídeo vertical.
 * Sincronía: la entrada del micro se captura en PCM con su marca de tiempo del AudioContext y
 * se recorta respecto al inicio del bucle + el retraso medido en la calibración (ida y vuelta).
 */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const CALIB_KEY = 'maqueta_calib_v1';
  const BLOCK = 2048;

  let ctx = null;
  let micStream = null;
  let capture = null;          // { chunks: [{t, data}], on: bool }
  let tracks = [];             // { id, inst, who, raw, play, muted, offsetMs, base }
  let playing = [];            // live BufferSources of the transport
  let busy = false;
  let lastBlob = null;
  let calib = readCalib();
  const diag = { playbackTime: 'sin probar', lastRec: '—', mic: '—' };

  // ── song ────────────────────────────────────────────────────────────────
  const bpm = () => Math.min(180, Math.max(60, Number($('bpm').value) || 90));
  const bars = () => Number($('bars').value) || 4;
  const beatDur = () => 60 / bpm();
  const barDur = () => 4 * beatDur();
  const loopDur = () => bars() * barDur();

  function showLength() {
    $('len-status').textContent = `Bucle de ${loopDur().toFixed(1)} s · ${bars()} compases de 4/4`;
  }

  function readCalib() {
    try { const v = JSON.parse(localStorage.getItem(CALIB_KEY)); return typeof v?.s === 'number' ? v : null; } catch { return null; }
  }
  function saveCalib(v) { try { localStorage.setItem(CALIB_KEY, JSON.stringify(v)); } catch { /* private mode */ } }

  // ── audio setup ─────────────────────────────────────────────────────────
  async function ensureCtx() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC({ latencyHint: 'interactive' });
    }
    if (ctx.state !== 'running') await ctx.resume();
    return ctx;
  }

  async function ensureMic() {
    if (micStream && micStream.getAudioTracks()[0]?.readyState === 'live') return micStream;
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
    });
    const s = micStream.getAudioTracks()[0].getSettings();
    diag.mic = `${micStream.getAudioTracks()[0].label || 'micro'} · eco ${s.echoCancellation} · ruido ${s.noiseSuppression} · ganancia ${s.autoGainControl}` +
      (s.latency !== undefined ? ` · lat ${(s.latency * 1000).toFixed(0)} ms` : '');
    const src = ctx.createMediaStreamSource(micStream);
    const proc = ctx.createScriptProcessor(BLOCK, 1, 1);
    const sink = ctx.createGain();
    sink.gain.value = 0;
    proc.onaudioprocess = e => {
      if (!capture?.on) return;
      const hasPT = typeof e.playbackTime === 'number' && e.playbackTime > 0;
      diag.playbackTime = hasPT ? 'sí' : 'no (menos preciso)';
      capture.chunks.push({ t: hasPT ? e.playbackTime : ctx.currentTime, data: new Float32Array(e.inputBuffer.getChannelData(0)) });
    };
    src.connect(proc);
    proc.connect(sink);
    sink.connect(ctx.destination);
    // keep references alive
    micStream._nodes = { src, proc, sink };
    return micStream;
  }

  function startCapture() { capture = { chunks: [], on: true }; }
  function stopCapture() { if (capture) capture.on = false; return capture; }

  /** Samples captured between `from` and `from + dur` (context time), zero where nothing arrived. */
  function slice(cap, from, dur) {
    const sr = ctx.sampleRate;
    const out = new Float32Array(Math.round(dur * sr));
    let covered = 0;
    for (const c of cap.chunks) {
      const i0 = Math.round((c.t - from) * sr);
      for (let k = 0; k < c.data.length; k++) {
        const i = i0 + k;
        if (i >= 0 && i < out.length) { out[i] = c.data[k]; covered++; }
      }
    }
    return { data: out, coverage: covered / out.length };
  }

  // ── sounds ──────────────────────────────────────────────────────────────
  function click(at, accent, gain = 0.35) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.value = accent ? 1600 : 1000;
    g.gain.setValueAtTime(gain, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.035);
    o.connect(g).connect(ctx.destination);
    o.start(at);
    o.stop(at + 0.05);
  }

  function noiseBuffer(c, secs) {
    const b = c.createBuffer(1, Math.ceil(secs * c.sampleRate), c.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  /** A simple rock beat for the loop, rendered offline (the "base" track). */
  async function renderDrums() {
    const sr = ctx.sampleRate;
    const oc = new OfflineAudioContext(1, Math.round(loopDur() * sr), sr);
    const noise = noiseBuffer(oc, 0.3);
    const eighth = beatDur() / 2;
    const kick = t => {
      const o = oc.createOscillator(); const g = oc.createGain();
      o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
      g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      o.connect(g).connect(oc.destination); o.start(t); o.stop(t + 0.4);
    };
    const snare = t => {
      const n = oc.createBufferSource(); n.buffer = noise;
      const f = oc.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.8;
      const g = oc.createGain(); g.gain.setValueAtTime(0.6, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      n.connect(f).connect(g).connect(oc.destination); n.start(t); n.stop(t + 0.2);
      const o = oc.createOscillator(); const g2 = oc.createGain(); o.type = 'triangle'; o.frequency.value = 190;
      g2.gain.setValueAtTime(0.3, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      o.connect(g2).connect(oc.destination); o.start(t); o.stop(t + 0.1);
    };
    const hat = (t, v) => {
      const n = oc.createBufferSource(); n.buffer = noise;
      const f = oc.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
      const g = oc.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
      n.connect(f).connect(g).connect(oc.destination); n.start(t); n.stop(t + 0.06);
    };
    for (let b = 0; b < bars(); b++) {
      for (let e = 0; e < 8; e++) {
        const t = b * barDur() + e * eighth;
        hat(t, e % 2 ? 0.12 : 0.22);
        if (e === 0 || e === 4 || (e === 5 && b % 2 === 1)) kick(t);
        if (e === 2 || e === 6) snare(t);
      }
    }
    return oc.startRendering();
  }

  // ── tracks ──────────────────────────────────────────────────────────────
  /** Circular shift (the content is a loop), positive = later. */
  function shifted(raw, ms) {
    const n = raw.length;
    const s = Math.round((ms / 1000) * raw.sampleRate) % n;
    if (!s) return raw;
    const out = ctx.createBuffer(1, n, raw.sampleRate);
    const a = raw.getChannelData(0), b = out.getChannelData(0);
    for (let i = 0; i < n; i++) b[(i + s + n) % n] = a[i];
    return out;
  }

  function addTrack(t) {
    tracks.push({ id: Math.random().toString(36).slice(2), muted: false, offsetMs: 0, ...t, play: t.raw });
    lockSong();
    renderTracks();
  }

  function lockSong() {
    const locked = tracks.some(t => !t.base);
    for (const id of ['bpm', 'bars', 'tap']) $(id).disabled = locked;
    if (locked) $('len-status').textContent = `Bucle de ${loopDur().toFixed(1)} s · tempo bloqueado (ya hay partes grabadas; recarga para empezar otra)`;
  }

  function drawWave(canvas, buf) {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth * dpr, h = canvas.clientHeight * dpr;
    canvas.width = w; canvas.height = h;
    const g = canvas.getContext('2d');
    const d = buf.getChannelData(0);
    const step = Math.max(1, Math.floor(d.length / w));
    g.fillStyle = '#c23a1f';
    for (let x = 0; x < w; x++) {
      let m = 0;
      for (let i = x * step; i < (x + 1) * step && i < d.length; i++) m = Math.max(m, Math.abs(d[i]));
      const bh = Math.max(1, m * h);
      g.fillRect(x, (h - bh) / 2, 1, bh);
    }
  }

  function renderTracks() {
    const ul = $('tracks');
    ul.innerHTML = '';
    for (const t of tracks) {
      const li = document.createElement('li');
      li.className = 'track';
      li.innerHTML = `
        <div class="head">
          <span class="inst"></span>
          <button type="button" data-a="solo" aria-label="Escuchar solo esta parte">▶</button>
          <button type="button" data-a="mute"></button>
          <button type="button" data-a="del" aria-label="Quitar">✕</button>
        </div>
        <span class="who"></span>
        <canvas class="wave"></canvas>
        ${t.base ? '' : `<label class="offset">Ajuste <input type="range" min="-150" max="150" step="5" value="${t.offsetMs}"><span>${t.offsetMs} ms</span></label>`}`;
      li.querySelector('.inst').textContent = t.inst;
      li.querySelector('.who').textContent = t.base ? 'Base de BandYou (puedes silenciarla)' : (t.who || 'Sin nombre');
      const mute = li.querySelector('[data-a="mute"]');
      mute.textContent = t.muted ? 'OFF' : 'ON';
      mute.classList.toggle('muted', t.muted);
      mute.setAttribute('aria-label', t.muted ? 'Activar' : 'Silenciar');
      mute.addEventListener('click', () => { t.muted = !t.muted; restartIfPlaying(); renderTracks(); });
      li.querySelector('[data-a="del"]').addEventListener('click', () => { tracks = tracks.filter(x => x !== t); stopAll(); renderTracks(); lockSong(); });
      li.querySelector('[data-a="solo"]').addEventListener('click', () => playAll([t]));
      const range = li.querySelector('input[type=range]');
      if (range) {
        range.addEventListener('input', () => { li.querySelector('.offset span').textContent = `${range.value} ms`; });
        range.addEventListener('change', () => { t.offsetMs = Number(range.value); t.play = shifted(t.raw, t.offsetMs); restartIfPlaying(); });
      }
      ul.appendChild(li);
      requestAnimationFrame(() => drawWave(li.querySelector('.wave'), t.play));
    }
  }

  // ── transport ───────────────────────────────────────────────────────────
  function stopAll() {
    for (const s of playing) { try { s.stop(); } catch { /* already stopped */ } }
    playing = [];
    $('play').textContent = '▶ Escuchar todo';
  }

  async function ensureBase() {
    if (!tracks.length) addTrack({ inst: 'Batería (base)', who: '', raw: await renderDrums(), base: true });
  }

  /** Tempo or length changed before anything was recorded: the base follows. */
  async function rebuildBase() {
    showLength();
    if (!ctx || tracks.some(t => !t.base)) return;
    stopAll();
    tracks = [];
    await ensureBase();
  }

  async function playAll(only) {
    await ensureCtx();
    if (!only) await ensureBase();
    const wasPlaying = playing.length > 0;
    stopAll();
    if (wasPlaying && !only) return;
    const list = (only || tracks).filter(t => only || !t.muted);
    if (!list.length) return;
    const at = ctx.currentTime + 0.08;
    for (const t of list) {
      const s = ctx.createBufferSource();
      s.buffer = t.play; s.loop = true;
      s.connect(ctx.destination); s.start(at);
      playing.push(s);
    }
    $('play').textContent = '■ Parar';
  }

  function restartIfPlaying() { if (playing.length) { stopAll(); playAll(); } }

  // ── calibration ─────────────────────────────────────────────────────────
  async function calibrate() {
    if (busy) return;
    busy = true;
    stopAll();
    const st = $('calib-status');
    try {
      await ensureCtx(); await ensureMic();
      st.textContent = 'Escuchando… no toques nada';
      const t0 = ctx.currentTime + 0.4;
      const clicks = Array.from({ length: 6 }, (_, i) => t0 + 0.5 + i * 0.6);
      startCapture();
      clicks.forEach(t => click(t, true, 0.9));
      await wait((clicks.at(-1) + 0.7 - ctx.currentTime) * 1000);
      const cap = stopCapture();
      const sr = ctx.sampleRate;
      const quiet = slice(cap, t0, 0.4).data;
      const noise = Math.sqrt(quiet.reduce((s, x) => s + x * x, 0) / Math.max(1, quiet.length));
      const thr = Math.max(0.03, noise * 8);
      const found = [];
      for (const t of clicks) {
        const w = slice(cap, t - 0.02, 0.5).data;
        const i = w.findIndex(x => Math.abs(x) > thr);
        if (i >= 0) found.push(i / sr - 0.02);
      }
      found.sort((a, b) => a - b);
      const med = found[Math.floor(found.length / 2)];
      const spread = found.length ? found.at(-1) - found[0] : 1;
      if (found.length < 4 || spread > 0.03) {
        st.textContent = `No se oyeron bien los clics (${found.length}/6). Sube el volumen, quita los cascos y el modo silencio, y repite.`;
      } else {
        calib = { s: med, n: found.length, spreadMs: Math.round(spread * 1000), at: new Date().toISOString() };
        saveCalib(calib);
        st.textContent = `Listo: retraso del móvil ${Math.round(med * 1000)} ms (${found.length}/6 clics, variación ${calib.spreadMs} ms)`;
      }
    } catch (e) {
      st.textContent = micError(e);
    } finally {
      busy = false;
      updateDiag();
    }
  }

  // ── recording ───────────────────────────────────────────────────────────
  async function record() {
    if (busy) return;
    busy = true;
    stopAll();
    const st = $('rec-status');
    const btn = $('rec');
    try {
      await ensureCtx(); await ensureMic();
      await ensureBase();
      const t0 = ctx.currentTime + 0.35;
      const loopStart = t0 + barDur();
      const end = loopStart + loopDur();
      // count-in + metronome
      for (let b = 0; b < 4; b++) click(t0 + b * beatDur(), b === 0);
      if ($('click-on').checked) {
        for (let b = 0; b < bars() * 4; b++) click(loopStart + b * beatDur(), b % 4 === 0, 0.18);
      }
      // what is already there, once
      for (const t of tracks.filter(x => !x.muted)) {
        const s = ctx.createBufferSource(); s.buffer = t.play; s.connect(ctx.destination); s.start(loopStart);
        playing.push(s);
      }
      startCapture();
      btn.classList.add('on'); btn.disabled = true;
      const tick = setInterval(() => {
        const now = ctx.currentTime;
        if (now < loopStart) st.textContent = `Preparado… ${Math.ceil((loopStart - now) / beatDur())}`;
        else if (now < end) st.textContent = `● Grabando · ${(end - now).toFixed(1)} s`;
      }, 80);
      await wait((end + 0.35 - ctx.currentTime) * 1000);
      clearInterval(tick);
      const cap = stopCapture();
      playing = [];
      const offset = calib ? calib.s : 0;
      const { data, coverage } = slice(cap, loopStart + offset, loopDur());
      let peak = 0;
      for (const x of data) peak = Math.max(peak, Math.abs(x));
      const gain = peak > 0 && peak < 0.5 ? Math.min(4, 0.7 / peak) : 1;
      const buf = ctx.createBuffer(1, data.length, ctx.sampleRate);
      const out = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) out[i] = data[i] * gain;
      diag.lastRec = `cobertura ${(coverage * 100).toFixed(1)}% · pico ${peak.toFixed(2)} · ganancia x${gain.toFixed(1)} · bloques ${cap.chunks.length}` + (calib ? '' : ' · SIN CALIBRAR');
      addTrack({ inst: $('rec-inst').value, who: $('rec-name').value.trim(), raw: buf, base: false });
      st.textContent = coverage < 0.97
        ? 'Grabado, pero se perdió audio por el camino (mira el diagnóstico). Escúchalo y repite si hace falta.'
        : (calib ? '¡Grabado! Dale a «Escuchar todo». Si va adelantado o atrasado, mueve su «Ajuste».' : '¡Grabado! Sin calibrar puede ir desfasado: usa su «Ajuste» o calibra en el paso 1.');
    } catch (e) {
      st.textContent = micError(e);
    } finally {
      btn.classList.remove('on'); btn.disabled = false;
      busy = false;
      updateDiag();
    }
  }

  function micError(e) {
    if (e && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) return 'Sin permiso para el micro: actívalo en los ajustes del navegador para esta web.';
    if (e && e.name === 'NotFoundError') return 'No se encontró micrófono.';
    return 'Algo falló: ' + (e && e.message ? e.message : e);
  }

  // ── video export ────────────────────────────────────────────────────────
  const MIMES = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  const pickMime = () => (window.MediaRecorder ? MIMES.find(m => MediaRecorder.isTypeSupported(m)) : null) || '';

  function envelope(buf, fps) {
    const d = buf.getChannelData(0);
    const per = Math.floor(buf.sampleRate / fps);
    const env = [];
    let max = 0.0001;
    for (let i = 0; i < d.length; i += per) {
      let s = 0;
      for (let k = i; k < i + per && k < d.length; k++) s += d[k] * d[k];
      const v = Math.sqrt(s / per);
      env.push(v); max = Math.max(max, v);
    }
    return env.map(v => v / max);
  }

  function wrap(g, text, maxW) {
    const words = text.split(/\s+/).filter(Boolean);
    const lines = []; let line = '';
    for (const w of words) {
      const next = line ? line + ' ' + w : w;
      if (line && g.measureText(next).width > maxW) { lines.push(line); line = w; } else line = next;
    }
    if (line) lines.push(line);
    return lines;
  }

  function drawPoster(g, t, active, envs, total) {
    const W = 1080, H = 1920, P = 90;
    g.fillStyle = '#f2ebdd'; g.fillRect(0, 0, W, H);
    g.save(); g.strokeStyle = 'rgba(20,18,16,0.035)'; g.lineWidth = 4;
    for (let x = -H; x < W; x += 50) { g.beginPath(); g.moveTo(x, H); g.lineTo(x + H * 0.62, 0); g.stroke(); }
    g.restore();
    g.fillStyle = '#c23a1f'; g.fillRect(0, 0, W, 22);
    let y = 300;
    g.textBaseline = 'alphabetic';
    g.font = '70px Anton'; g.fillStyle = '#141210'; g.fillText('BAND', P, y);
    const bw = g.measureText('BAND').width; g.fillStyle = '#c23a1f'; g.fillText('YOU', P + bw, y);
    y += 80;
    g.font = '700 32px JB, monospace'; g.fillStyle = '#c23a1f';
    g.fillText(`LA MAQUETA · ${bpm()} BPM`, P, y);
    y += 30;
    g.font = '150px Anton'; g.fillStyle = '#141210';
    const title = ($('title').value.trim() || 'Sin título').toUpperCase();
    let size = 150;
    let lines = wrap(g, title, W - 2 * P);
    while (lines.length > 2 && size > 80) { size -= 10; g.font = `${size}px Anton`; lines = wrap(g, title, W - 2 * P); }
    for (const l of lines.slice(0, 2)) { y += size * 1.02; g.fillText(l, P, y); }
    const chords = $('chords').value.trim();
    if (chords) { y += 64; g.font = '700 40px IS, sans-serif'; g.fillStyle = '#3d3830'; g.fillText(chords, P, y); }
    y += 60;
    const rowH = Math.min(170, (1480 - y) / Math.max(1, active.length));
    active.forEach((tr, i) => {
      const top = y + i * rowH;
      g.fillStyle = 'rgba(20,18,16,0.18)'; g.fillRect(P, top, W - 2 * P, 3);
      const lvl = envs[i][Math.floor((t % loopDur()) * 30)] || 0;
      g.fillStyle = '#c23a1f'; g.fillRect(P, top + rowH - 22, (W - 2 * P) * lvl, 10);
      g.font = `${Math.round(rowH * 0.42)}px Anton`; g.fillStyle = '#141210';
      g.fillText(tr.inst.toUpperCase(), P, top + rowH * 0.55);
      g.font = `700 ${Math.round(rowH * 0.26)}px IS, sans-serif`; g.fillStyle = '#3d3830';
      const who = tr.base ? 'BandYou' : (tr.who || 'Anónimo');
      g.fillText(who, W - P - g.measureText(who).width, top + rowH * 0.55);
    });
    g.fillStyle = '#141210'; g.fillRect(P, 1500, W - 2 * P, 6);
    g.fillStyle = '#c23a1f'; g.fillRect(P, 1500, (W - 2 * P) * Math.min(1, t / total), 6);
    g.font = '700 30px JB, monospace'; g.fillStyle = '#141210'; g.fillText('HECHO EN BANDYOU.ES', P, 1550);
  }

  async function exportVideo() {
    if (busy) return;
    const active = tracks.filter(t => !t.muted);
    if (!active.length) { $('export-status').textContent = 'Primero graba algo.'; return; }
    const mime = pickMime();
    if (!mime) { $('export-status').textContent = 'Este navegador no puede grabar vídeo (MediaRecorder).'; return; }
    busy = true;
    stopAll();
    $('export-actions').hidden = true;
    try {
      await ensureCtx();
      await document.fonts.ready;
      const total = loopDur() * 2;
      const sr = ctx.sampleRate;
      const oc = new OfflineAudioContext(1, Math.round((total + 0.3) * sr), sr);
      for (const t of active) for (const at of [0, loopDur()]) {
        const s = oc.createBufferSource(); s.buffer = t.play; s.connect(oc.destination); s.start(at);
      }
      const mix = await oc.startRendering();
      const md = mix.getChannelData(0);
      let peak = 0; for (const x of md) peak = Math.max(peak, Math.abs(x));
      if (peak > 0.98) for (let i = 0; i < md.length; i++) md[i] *= 0.98 / peak;
      const envs = active.map(t => envelope(t.play, 30));

      const canvas = $('poster');
      const g = canvas.getContext('2d');
      drawPoster(g, 0, active, envs, total);
      const vStream = canvas.captureStream(30);
      const dest = ctx.createMediaStreamDestination();
      const src = ctx.createBufferSource();
      src.buffer = mix; src.connect(dest); src.connect(ctx.destination);
      const stream = new MediaStream([...vStream.getVideoTracks(), ...dest.stream.getAudioTracks()]);
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 5_000_000, audioBitsPerSecond: 128_000 });
      const parts = [];
      rec.ondataavailable = e => { if (e.data.size) parts.push(e.data); };
      const done = new Promise(r => { rec.onstop = r; });
      rec.start(250);
      const startAt = ctx.currentTime + 0.1;
      src.start(startAt);
      $('export-status').textContent = 'Grabando el vídeo… no cambies de app';
      await new Promise(resolve => {
        const frame = () => {
          const t = Math.max(0, ctx.currentTime - startAt);
          drawPoster(g, t, active, envs, total);
          if (t < total + 0.2) requestAnimationFrame(frame); else resolve();
        };
        requestAnimationFrame(frame);
      });
      rec.stop();
      await done;
      lastBlob = new Blob(parts, { type: mime.split(';')[0] });
      diag.lastExport = `${mime} · ${(lastBlob.size / 1024 / 1024).toFixed(2)} MB · ${total.toFixed(1)} s`;
      $('export-status').textContent = `Vídeo listo (${lastBlob.type.includes('mp4') ? 'MP4' : 'WebM'}, ${(lastBlob.size / 1024 / 1024).toFixed(1)} MB)`;
      $('export-actions').hidden = false;
    } catch (e) {
      $('export-status').textContent = 'No se pudo crear el vídeo: ' + (e && e.message ? e.message : e);
    } finally {
      busy = false;
      updateDiag();
    }
  }

  function fileName() {
    return 'maqueta-bandyou.' + (lastBlob && lastBlob.type.includes('mp4') ? 'mp4' : 'webm');
  }

  async function share() {
    if (!lastBlob) return;
    const file = new File([lastBlob], fileName(), { type: lastBlob.type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], text: 'Nuestra maqueta en BandYou · bandyou.es' }); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    download();
  }

  function download() {
    if (!lastBlob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(lastBlob);
    a.download = fileName();
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  }

  // ── tap tempo ───────────────────────────────────────────────────────────
  let taps = [];
  function tap() {
    const now = performance.now();
    taps = taps.filter(t => now - t < 2500);
    taps.push(now);
    if (taps.length >= 3) {
      const gaps = taps.slice(1).map((t, i) => t - taps[i]);
      const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      $('bpm').value = Math.round(Math.min(180, Math.max(60, 60000 / avg)));
      rebuildBase();
    }
    $('tap').textContent = taps.length < 3 ? `Toca otra vez (${taps.length})` : `${$('bpm').value} BPM · sigue tocando`;
  }

  // ── diagnostics ─────────────────────────────────────────────────────────
  function updateDiag() {
    const lines = [
      `Navegador: ${navigator.userAgent}`,
      `Audio: ${ctx ? `${ctx.sampleRate} Hz · base ${((ctx.baseLatency || 0) * 1000).toFixed(0)} ms · salida ${((ctx.outputLatency || 0) * 1000).toFixed(0)} ms · ${ctx.state}` : 'sin iniciar'}`,
      `Micro: ${diag.mic}`,
      `Calibración: ${calib ? `${Math.round(calib.s * 1000)} ms (${calib.n}/6, ±${calib.spreadMs} ms)` : 'no hecha'}`,
      `Marca de tiempo del audio: ${diag.playbackTime}`,
      `Última grabación: ${diag.lastRec}`,
      `Vídeo: ${pickMime() || 'no soportado'}${diag.lastExport ? ` · último: ${diag.lastExport}` : ''}`,
      `Compartir archivos: ${navigator.canShare ? 'sí' : 'no'}`,
    ];
    $('diag').textContent = lines.join('\n');
  }

  const wait = ms => new Promise(r => setTimeout(r, Math.max(0, ms)));

  // ── wire up ─────────────────────────────────────────────────────────────
  $('calib-btn').addEventListener('click', calibrate);
  $('rec').addEventListener('click', record);
  $('play').addEventListener('click', () => playAll());
  $('export').addEventListener('click', exportVideo);
  $('share').addEventListener('click', share);
  $('download').addEventListener('click', download);
  $('tap').addEventListener('click', tap);
  $('bpm').addEventListener('change', rebuildBase);
  $('bars').addEventListener('change', rebuildBase);
  if (calib) $('calib-status').textContent = `Ya calibrado en este móvil: ${Math.round(calib.s * 1000)} ms. Puedes repetirlo.`;
  showLength();
  updateDiag();
})();
