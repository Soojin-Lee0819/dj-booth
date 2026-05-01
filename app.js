// ---- State ----
const state = {
  ctx: null,
  buffers: { a: null, b: null },
  sources: { a: null, b: null },
  gains: { a: null, b: null },
  playing: { a: false, b: false },
  startTime: { a: 0, b: 0 },
  offset: { a: 0, b: 0 },
  sfx: { laser: null, robot: null, boom: null },
  backspinning: { a: false, b: false },
};

// ---- DOM refs ----
const statusEl = document.getElementById('status');
const playA = document.getElementById('play-a');
const playB = document.getElementById('play-b');
const volA = document.getElementById('vol-a');
const volB = document.getElementById('vol-b');
const crossfader = document.getElementById('crossfader');
const vfxLayer = document.getElementById('vfx-layer');
const deckAEl = document.getElementById('deck-a');
const deckBEl = document.getElementById('deck-b');

// Gesture cards for visual feedback
const gestureCards = {
  palmLeft:  document.getElementById('gc-palm-left'),
  palmRight: document.getElementById('gc-palm-right'),
  fistLeft:  document.getElementById('gc-fist-left'),
  fistRight: document.getElementById('gc-fist-right'),
  pinchLeft: document.getElementById('gc-pinch-left'),
  crossfade: document.getElementById('gc-crossfade'),
  clap:      document.getElementById('gc-clap'),
};

// ---- Audio setup ----
async function initAudio() {
  const ctx = new AudioContext();
  state.ctx = ctx;

  state.gains.a = ctx.createGain();
  state.gains.b = ctx.createGain();
  state.gains.a.connect(ctx.destination);
  state.gains.b.connect(ctx.destination);

  try {
    const [bufA, bufB, sfxLaser, sfxRobot, sfxBoom] = await Promise.all([
      loadTrack(ctx, 'public/track-a.mp3'),
      loadTrack(ctx, 'public/track-b.mp3'),
      loadTrack(ctx, 'public/freesound_community-laser-zap-90575.mp3'),
      loadTrack(ctx, 'public/diff_style-robot-talk-344757 (1).mp3'),
      loadTrack(ctx, 'public/dragon-studio-cinematic-boom-454254.mp3'),
    ]);
    state.buffers.a = bufA;
    state.buffers.b = bufB;
    state.sfx.laser = sfxLaser;
    state.sfx.robot = sfxRobot;
    state.sfx.boom = sfxBoom;
    statusEl.textContent = 'Ready — show your hands';
    statusEl.className = 'ready';
  } catch (err) {
    statusEl.textContent = 'Error loading tracks: ' + err.message;
    statusEl.className = 'error';
    console.error(err);
  }
}

async function loadTrack(ctx, url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}`);
  const arrayBuf = await res.arrayBuffer();
  return ctx.decodeAudioData(arrayBuf);
}

// ---- Playback ----
function startDeck(deck) {
  if (!state.buffers[deck] || state.playing[deck]) return;
  if (state.ctx?.state === 'suspended') state.ctx.resume();
  const source = state.ctx.createBufferSource();
  source.buffer = state.buffers[deck];
  source.loop = true;
  source.connect(state.gains[deck]);
  source.start(0, state.offset[deck] % source.buffer.duration);
  state.sources[deck] = source;
  state.startTime[deck] = state.ctx.currentTime;
  state.playing[deck] = true;
  updateDeckUI(deck);
}

function pauseDeck(deck) {
  if (!state.playing[deck]) return;
  if (state.sources[deck]) { state.sources[deck].stop(); state.sources[deck] = null; }
  state.offset[deck] += state.ctx.currentTime - state.startTime[deck];
  state.playing[deck] = false;
  updateDeckUI(deck);
}

function toggleDeck(deck) {
  state.playing[deck] ? pauseDeck(deck) : startDeck(deck);
}

function updateDeckUI(deck) {
  const btn = deck === 'a' ? playA : playB;
  const el = deck === 'a' ? deckAEl : deckBEl;
  btn.textContent = state.playing[deck] ? 'Pause' : 'Play';
  btn.classList.toggle('playing', state.playing[deck]);
  el.classList.toggle('active', state.playing[deck]);
  document.body.classList.toggle('music-active', state.playing.a || state.playing.b);
}

// ---- SFX ----
function playSFX(name) {
  if (!state.sfx[name] || !state.ctx) return;
  if (state.ctx.state === 'suspended') state.ctx.resume();
  const s = state.ctx.createBufferSource();
  s.buffer = state.sfx[name];
  s.connect(state.ctx.destination);
  s.start(0);
}

function playAirHorn() {
  if (!state.ctx) return;
  if (state.ctx.state === 'suspended') state.ctx.resume();
  const ctx = state.ctx, now = ctx.currentTime, dur = 0.6;
  const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
  const g = ctx.createGain(), f = ctx.createBiquadFilter();
  o1.type = o2.type = 'sawtooth';
  o1.frequency.setValueAtTime(480, now); o2.frequency.setValueAtTime(490, now);
  o1.frequency.linearRampToValueAtTime(540, now + 0.08);
  o2.frequency.linearRampToValueAtTime(550, now + 0.08);
  f.type = 'lowpass'; f.frequency.setValueAtTime(3000, now); f.Q.setValueAtTime(2, now);
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(0.35, now + 0.02);
  g.gain.setValueAtTime(0.35, now + dur - 0.15);
  g.gain.linearRampToValueAtTime(0, now + dur);
  o1.connect(f); o2.connect(f); f.connect(g); g.connect(ctx.destination);
  o1.start(now); o2.start(now); o1.stop(now + dur); o2.stop(now + dur);
}

function triggerBackspin(deck) {
  if (!state.playing[deck] || !state.sources[deck] || state.backspinning[deck]) return;
  state.backspinning[deck] = true;
  const src = state.sources[deck], now = state.ctx.currentTime, d = 0.8;
  src.playbackRate.setValueAtTime(1, now);
  src.playbackRate.linearRampToValueAtTime(0, now + d * 0.5);
  src.playbackRate.linearRampToValueAtTime(1, now + d);
  setTimeout(() => { state.backspinning[deck] = false; }, d * 1000);
}

// ---- Crossfader & volume ----
function applyCrossfader(v) {
  const gA = Math.cos(v * Math.PI / 2), gB = Math.sin(v * Math.PI / 2);
  if (state.gains.a) state.gains.a.gain.value = gA * parseFloat(volA.value);
  if (state.gains.b) state.gains.b.gain.value = gB * parseFloat(volB.value);
}
function applyVolumes() { applyCrossfader(parseFloat(crossfader.value)); }

// ---- Click listeners ----
playA.addEventListener('click', () => { if (state.ctx?.state === 'suspended') state.ctx.resume(); toggleDeck('a'); });
playB.addEventListener('click', () => { if (state.ctx?.state === 'suspended') state.ctx.resume(); toggleDeck('b'); });
crossfader.addEventListener('input', () => applyCrossfader(parseFloat(crossfader.value)));
volA.addEventListener('input', applyVolumes);
volB.addEventListener('input', applyVolumes);

// ---- SFX button clicks ----
const sfxActions = {
  laser()    { playSFX('laser');  triggerVFX('laser'); },
  horn()     { playAirHorn();     triggerVFX('horn'); },
  robot()    { playSFX('robot');  triggerVFX('robot'); },
  boom()     { playSFX('boom');   triggerVFX('boom'); },
  backspin() {
    if (state.playing.a) { triggerBackspin('a'); triggerVFX('backspin'); }
    else if (state.playing.b) { triggerBackspin('b'); triggerVFX('backspin'); }
  },
};

document.querySelectorAll('.sfx-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (state.ctx?.state === 'suspended') state.ctx.resume();
    const key = btn.dataset.sfx;
    if (sfxActions[key]) sfxActions[key]();
    btn.classList.add('fired');
    setTimeout(() => btn.classList.remove('fired'), 300);
  });
});

// ============================================
// VFX
// ============================================
function triggerVFX(type) {
  vfxLayer.className = ''; vfxLayer.innerHTML = '';
  void vfxLayer.offsetWidth;
  if (type === 'laser') {
    vfxLayer.classList.add('vfx-laser');
    for (let i = 0; i < 4; i++) { const b = document.createElement('div'); b.className = 'laser-beam'; vfxLayer.appendChild(b); }
    setTimeout(() => { vfxLayer.className = ''; vfxLayer.innerHTML = ''; }, 250);
  }
  if (type === 'robot') {
    vfxLayer.classList.add('vfx-glitch');
    setTimeout(() => { vfxLayer.className = ''; vfxLayer.innerHTML = ''; }, 450);
  }
  if (type === 'boom') {
    vfxLayer.classList.add('vfx-boom');
    document.body.classList.add('screen-shake');
    setTimeout(() => { vfxLayer.className = ''; document.body.classList.remove('screen-shake'); }, 400);
  }
  if (type === 'horn') {
    vfxLayer.classList.add('vfx-horn');
    for (let i = 0; i < 8; i++) { const r = document.createElement('div'); r.className = 'horn-ray'; r.style.transform = `rotate(${i*45}deg)`; vfxLayer.appendChild(r); }
    setTimeout(() => { vfxLayer.className = ''; vfxLayer.innerHTML = ''; }, 400);
  }
  if (type === 'backspin') {
    vfxLayer.classList.add('vfx-backspin');
    setTimeout(() => { vfxLayer.className = ''; vfxLayer.innerHTML = ''; }, 800);
  }
}

// ============================================
// Gesture card feedback
// ============================================
function flashCard(card) {
  if (!card) return;
  card.classList.add('active');
  setTimeout(() => card.classList.remove('active'), 600);
}

// ============================================
// MediaPipe Hands — 5 gestures only
// ============================================
const videoEl = document.getElementById('webcam');
const canvasEl = document.getElementById('overlay');
const canvasCtx = canvasEl.getContext('2d');

const WRIST = 0, THUMB_IP = 3, THUMB_TIP = 4;
const INDEX_MCP = 5, INDEX_TIP = 8;
const MIDDLE_MCP = 9, MIDDLE_TIP = 12;
const RING_MCP = 13, RING_TIP = 16;
const PINKY_MCP = 17, PINKY_TIP = 20;

function ext(lm, tip, mcp) { return lm[tip].y < lm[mcp].y; }
function thumbExt(lm) { return lm[THUMB_TIP].y < lm[THUMB_IP].y; }

// #1 Open Palm
function isOpenPalm(lm) {
  return ext(lm, INDEX_TIP, INDEX_MCP) && ext(lm, MIDDLE_TIP, MIDDLE_MCP) &&
    ext(lm, RING_TIP, RING_MCP) && ext(lm, PINKY_TIP, PINKY_MCP);
}

// #2 Closed Fist
function isClosedFist(lm) {
  return !ext(lm, INDEX_TIP, INDEX_MCP) && !ext(lm, MIDDLE_TIP, MIDDLE_MCP) &&
    !ext(lm, RING_TIP, RING_MCP) && !ext(lm, PINKY_TIP, PINKY_MCP) && !thumbExt(lm);
}

// #3 Pinch
function isPinching(lm) {
  const dx = lm[THUMB_TIP].x - lm[INDEX_TIP].x, dy = lm[THUMB_TIP].y - lm[INDEX_TIP].y;
  return Math.sqrt(dx*dx+dy*dy) < 0.06 &&
    !ext(lm, MIDDLE_TIP, MIDDLE_MCP) && !ext(lm, RING_TIP, RING_MCP) && !ext(lm, PINKY_TIP, PINKY_MCP);
}

// #4 Flat Hand
function isFlatHand(lm) {
  if (!isOpenPalm(lm)) return false;
  const xs = [INDEX_TIP, MIDDLE_TIP, RING_TIP, PINKY_TIP].map(i => lm[i].x);
  return Math.max(...xs) - Math.min(...xs) < 0.12;
}

// ---- Gesture state ----
const gesture = {
  lastPlayTime: { Left: 0, Right: 0 },
  lastPauseTime: { Left: 0, Right: 0 },
  smoothedCrossfader: 0.5,
  smoothedVolume: { Left: 1.0, Right: 1.0 },
  wasOpenPalm: { Left: false, Right: false },
  wasFist: { Left: false, Right: false },
  lastBoomTime: 0,
  prevWrists: { Left: null, Right: null },
};

const COOLDOWN = 800;
const CF_SMOOTH = 0.15;
const VOL_SMOOTH = 0.12;
const BOOM_CD = 2000;
const CLAP_NEAR = 0.08;
const CLAP_FAR = 0.15;

function handleGestures(results) {
  if (!results.multiHandLandmarks || !results.multiHandedness) return;
  const now = Date.now();
  const hands = {};

  for (let i = 0; i < results.multiHandLandmarks.length; i++) {
    const lm = results.multiHandLandmarks[i];
    const label = results.multiHandedness[i].label === 'Left' ? 'Right' : 'Left';
    hands[label] = lm;
  }

  // ---- #5 Clap → Bass Boom ----
  if (hands.Left && hands.Right) {
    const lW = hands.Left[WRIST], rW = hands.Right[WRIST];
    const dist = Math.sqrt((lW.x-rW.x)**2 + (lW.y-rW.y)**2);

    if (gesture.prevWrists.Left && gesture.prevWrists.Right) {
      const pDist = Math.sqrt(
        (gesture.prevWrists.Left.x - gesture.prevWrists.Right.x)**2 +
        (gesture.prevWrists.Left.y - gesture.prevWrists.Right.y)**2
      );
      if (pDist > CLAP_FAR && dist < CLAP_NEAR && now - gesture.lastBoomTime > BOOM_CD) {
        playSFX('boom');
        triggerVFX('boom');
        flashCard(gestureCards.clap);
        gesture.lastBoomTime = now;
      }
    }
    gesture.prevWrists.Left = { x: lW.x, y: lW.y };
    gesture.prevWrists.Right = { x: rW.x, y: rW.y };
  } else {
    gesture.prevWrists.Left = null;
    gesture.prevWrists.Right = null;
  }

  // ---- Per-hand gestures ----
  for (const label of ['Left', 'Right']) {
    const lm = hands[label];
    if (!lm) { gesture.wasOpenPalm[label] = false; gesture.wasFist[label] = false; continue; }

    const deck = label === 'Left' ? 'a' : 'b';
    const palm = isOpenPalm(lm);
    const fist = isClosedFist(lm);
    const flat = isFlatHand(lm);
    const pinch = isPinching(lm);

    // ---- #1 Open Palm → Play ----
    if (palm && !flat) {
      if (!gesture.wasOpenPalm[label] && now - gesture.lastPlayTime[label] > COOLDOWN) {
        if (state.ctx?.state === 'suspended') state.ctx.resume();
        startDeck(deck);
        gesture.lastPlayTime[label] = now;
        flashCard(label === 'Left' ? gestureCards.palmLeft : gestureCards.palmRight);
      }
      gesture.wasOpenPalm[label] = true;
    } else {
      gesture.wasOpenPalm[label] = false;
    }

    // ---- #2 Closed Fist → Pause ----
    if (fist) {
      if (!gesture.wasFist[label] && now - gesture.lastPauseTime[label] > COOLDOWN) {
        pauseDeck(deck);
        gesture.lastPauseTime[label] = now;
        flashCard(label === 'Left' ? gestureCards.fistLeft : gestureCards.fistRight);
      }
      gesture.wasFist[label] = true;
    } else {
      gesture.wasFist[label] = false;
    }

    // ---- #4 Flat Hand → Crossfader ----
    if (flat) {
      const rawX = 1 - lm[WRIST].x;
      const clamped = Math.max(0, Math.min(1, rawX));
      gesture.smoothedCrossfader += CF_SMOOTH * (clamped - gesture.smoothedCrossfader);
      applyCrossfader(gesture.smoothedCrossfader);
      crossfader.value = gesture.smoothedCrossfader;
      flashCard(gestureCards.crossfade);
    }

    // ---- #3 Pinch → Volume ----
    if (pinch) {
      const pinchY = (lm[THUMB_TIP].y + lm[INDEX_TIP].y) / 2;
      const vol = Math.max(0, Math.min(1, 1 - pinchY));
      gesture.smoothedVolume[label] += VOL_SMOOTH * (vol - gesture.smoothedVolume[label]);
      const slider = deck === 'a' ? volA : volB;
      slider.value = gesture.smoothedVolume[label];
      applyVolumes();
      if (label === 'Left') flashCard(gestureCards.pinchLeft);
    }
  }
}

function onHandResults(results) {
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasEl.width, canvasEl.height);
  if (results.multiHandLandmarks && results.multiHandedness) {
    for (let i = 0; i < results.multiHandLandmarks.length; i++) {
      const lm = results.multiHandLandmarks[i];
      const label = results.multiHandedness[i].label === 'Left' ? 'Right' : 'Left';
      drawConnectors(canvasCtx, lm, HAND_CONNECTIONS, { color: label === 'Left' ? '#FF6600' : '#00BBFF', lineWidth: 3 });
      drawLandmarks(canvasCtx, lm, { color: label === 'Left' ? '#FF3300' : '#0088FF', lineWidth: 1, radius: 3 });
    }
  }
  canvasCtx.restore();
  handleGestures(results);
}

function initMediaPipe() {
  const hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
  });
  hands.setOptions({ maxNumHands: 2, modelComplexity: 1, minDetectionConfidence: 0.7, minTrackingConfidence: 0.5 });
  hands.onResults(onHandResults);

  const camera = new Camera(videoEl, {
    onFrame: async () => { await hands.send({ image: videoEl }); },
    width: 480,
    height: 360,
  });

  camera.start().then(() => {
    canvasEl.width = 480;
    canvasEl.height = 360;
    statusEl.textContent = 'Camera active — show your hands!';
    statusEl.className = 'ready';
  }).catch((err) => {
    console.error('Camera error:', err);
    statusEl.textContent = 'Camera access denied — use buttons';
    statusEl.className = 'error';
  });
}

// ---- Init ----
initAudio().then(() => {
  applyCrossfader(parseFloat(crossfader.value));
  initMediaPipe();
});
