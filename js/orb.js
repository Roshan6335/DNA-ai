/* ============================================================
   orb.js
   - The glowing blue particle orb ("Ask me Anything" idle state)
   - The horizontal waveform that appears while listening/speaking
   ============================================================ */

const OrbModule = (() => {
  let orbCanvas, orbCtx, particles = [];
  let waveCanvas, waveCtx;
  let mode = 'idle'; // idle | listening | speaking
  let analyser, dataArray, audioCtx;

  function initOrb() {
    orbCanvas = document.getElementById('orb-canvas');
    orbCtx = orbCanvas.getContext('2d');
    waveCanvas = document.getElementById('wave-canvas');
    waveCtx = waveCanvas.getContext('2d');

    const N = 140;
    for (let i = 0; i < N; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 70;
      particles.push({
        angle,
        radius,
        speed: 0.002 + Math.random() * 0.004,
        size: Math.random() * 1.8 + 0.6,
      });
    }
    animate();
  }

  function animate() {
    const w = orbCanvas.width, h = orbCanvas.height;
    const cx = w / 2, cy = h / 2;
    orbCtx.clearRect(0, 0, w, h);

    // outer glow rings
    const pulse = mode === 'idle' ? Math.sin(Date.now() / 600) * 6 : 10;
    const grad = orbCtx.createRadialGradient(cx, cy, 40, cx, cy, 140 + pulse);
    grad.addColorStop(0, 'rgba(43,107,255,0.55)');
    grad.addColorStop(0.5, 'rgba(43,107,255,0.18)');
    grad.addColorStop(1, 'rgba(43,107,255,0)');
    orbCtx.fillStyle = grad;
    orbCtx.beginPath();
    orbCtx.arc(cx, cy, 140 + pulse, 0, Math.PI * 2);
    orbCtx.fill();

    // core disc
    const coreGrad = orbCtx.createRadialGradient(cx, cy, 0, cx, cy, 78);
    coreGrad.addColorStop(0, '#04060a');
    coreGrad.addColorStop(1, '#081428');
    orbCtx.fillStyle = coreGrad;
    orbCtx.beginPath();
    orbCtx.arc(cx, cy, 78, 0, Math.PI * 2);
    orbCtx.fill();

    // particles swirling inside
    particles.forEach((p) => {
      p.angle += p.speed * (mode === 'idle' ? 1 : 2.5);
      const x = cx + Math.cos(p.angle) * p.radius;
      const y = cy + Math.sin(p.angle) * p.radius * 0.9;
      orbCtx.beginPath();
      orbCtx.arc(x, y, p.size, 0, Math.PI * 2);
      orbCtx.fillStyle = 'rgba(180,220,255,0.85)';
      orbCtx.fill();
    });

    // ring outline
    orbCtx.strokeStyle = 'rgba(63,169,255,0.5)';
    orbCtx.lineWidth = 1.5;
    orbCtx.beginPath();
    orbCtx.arc(cx, cy, 78, 0, Math.PI * 2);
    orbCtx.stroke();

    drawWave();
    requestAnimationFrame(animate);
  }

  function drawWave() {
    const w = waveCanvas.width, h = waveCanvas.height;
    waveCtx.clearRect(0, 0, w, h);
    const midY = h / 2;

    waveCtx.beginPath();
    waveCtx.moveTo(0, midY);

    const bars = 48;
    for (let i = 0; i <= bars; i++) {
      const x = (i / bars) * w;
      let amp;
      if (mode === 'idle') {
        amp = 1.5;
      } else if (analyser && dataArray) {
        const idx = Math.floor((i / bars) * dataArray.length);
        amp = (dataArray[idx] / 255) * (h / 2 - 6);
      } else {
        // fallback fake animation for "speaking" TTS (no analyser on synthetic voice)
        amp = Math.abs(Math.sin(Date.now() / 120 + i)) * (h / 2 - 10) * 0.6;
      }
      const y = midY + Math.sin(i * 0.7 + Date.now() / 200) * amp * 0.3 - amp * 0.3;
      waveCtx.lineTo(x, midY - amp / 2);
    }
    waveCtx.strokeStyle = mode === 'idle' ? 'rgba(120,180,255,0.35)' : '#4dfff0';
    waveCtx.lineWidth = 2;
    waveCtx.shadowColor = mode === 'idle' ? 'transparent' : '#4dfff0';
    waveCtx.shadowBlur = mode === 'idle' ? 0 : 10;
    waveCtx.stroke();
  }

  function setMode(newMode, liveAnalyser) {
    mode = newMode;
    analyser = liveAnalyser || null;
    if (analyser) dataArray = new Uint8Array(analyser.frequencyBinCount);
  }

  return { initOrb, setMode };
})();
