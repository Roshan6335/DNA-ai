/* ============================================================
   orb.js
   - The glowing blue particle orb ("Ask me Anything" idle state),
     built with Three.js for a real 3D look instead of flat 2D circles.
   - The horizontal waveform under it (canvas 2D, synced to mode —
     idle / listening / speaking — no separate mic stream needed).
   ============================================================ */

const OrbModule = (() => {
  let renderer, scene, camera, points, mount;
  let waveCanvas, waveCtx;
  let mode = 'idle'; // idle | listening | speaking

  function initOrb() {
    mount = document.getElementById('orb-three-mount');
    waveCanvas = document.getElementById('wave-canvas');
    waveCtx = waveCanvas.getContext('2d');

    const w = mount.clientWidth, h = mount.clientHeight;
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    camera.position.z = 4.2;

    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    mount.appendChild(renderer.domElement);

    // particle sphere — points scattered through a solid ball, not just the surface,
    // to match the "energy sphere" look from the reference video
    const count = 900;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 1.15 * Math.cbrt(Math.random());
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0x9fd8ff,
      size: 0.022,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    points = new THREE.Points(geo, mat);
    scene.add(points);

    // soft outer glow shell
    const glowGeo = new THREE.SphereGeometry(1.35, 32, 32);
    const glowMat = new THREE.MeshBasicMaterial({ color: 0x2b6bff, transparent: true, opacity: 0.14 });
    scene.add(new THREE.Mesh(glowGeo, glowMat));

    const glowGeo2 = new THREE.SphereGeometry(1.7, 32, 32);
    const glowMat2 = new THREE.MeshBasicMaterial({ color: 0x2b6bff, transparent: true, opacity: 0.06 });
    scene.add(new THREE.Mesh(glowGeo2, glowMat2));

    window.addEventListener('resize', onResize);
    animate();
  }

  function onResize() {
    if (!mount) return;
    const w = mount.clientWidth, h = mount.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  function animate() {
    const speed = mode === 'idle' ? 0.0018 : 0.0045;
    points.rotation.y += speed;
    points.rotation.x += speed * 0.35;

    const targetScale = mode === 'idle' ? 1 : 1.1;
    points.scale.x += (targetScale - points.scale.x) * 0.08;
    points.scale.y = points.scale.z = points.scale.x;

    renderer.render(scene, camera);
    drawWave();
    requestAnimationFrame(animate);
  }

  function drawWave() {
    const w = waveCanvas.width, h = waveCanvas.height;
    waveCtx.clearRect(0, 0, w, h);
    const midY = h / 2;
    const bars = 48;

    waveCtx.beginPath();
    for (let i = 0; i <= bars; i++) {
      const x = (i / bars) * w;
      let amp;
      if (mode === 'idle') {
        amp = 2 + Math.sin(Date.now() / 500 + i) * 1.5;
      } else {
        // synced pseudo-waveform — no raw mic stream needed, avoids the
        // dual-mic-access bug that broke speech recognition before
        amp = Math.abs(Math.sin(Date.now() / 130 + i * 0.5)) * (h / 2 - 8);
      }
      const y = midY - amp / 2;
      if (i === 0) waveCtx.moveTo(x, y);
      else waveCtx.lineTo(x, y);
    }
    waveCtx.strokeStyle = mode === 'idle' ? 'rgba(120,180,255,0.35)' : '#4dfff0';
    waveCtx.lineWidth = 2;
    waveCtx.shadowColor = mode === 'idle' ? 'transparent' : '#4dfff0';
    waveCtx.shadowBlur = mode === 'idle' ? 0 : 10;
    waveCtx.stroke();
  }

  function setMode(newMode) {
    mode = newMode;
  }

  return { initOrb, setMode };
})();
