/* ============================================================
   face.js
   - Idle wireframe "head" on the Welcome screen (Three.js, purely
     decorative, no camera).
   - Real webcam + face-api.js detection on the Auth screen.

   PERFORMANCE FIX vs the previous version: before, the app computed
   a full 128-point face descriptor (the heaviest possible operation)
   on EVERY single video frame — that's what made verification feel
   endless on a phone. Now, each frame only runs a lightweight
   detector + tiny landmark net (fast, just for the live mesh visual),
   and the expensive descriptor is computed exactly ONCE, right after
   the face has held steady for a handful of frames.
   ============================================================ */

const FaceModule = (() => {
  let idleRenderer, idleScene, idleCamera, idleMesh, idleMount;
  let overlayCanvas, overlayCtx, video;
  let modelsLoaded = false;
  let detectLoop = null;
  let stream = null;

  // ---- Idle wireframe head (Three.js, no camera) ----
  function initIdle() {
    idleMount = document.getElementById('face-three-mount');
    const w = idleMount.clientWidth, h = idleMount.clientHeight;

    idleScene = new THREE.Scene();
    idleCamera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    idleCamera.position.z = 4;

    idleRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    idleRenderer.setSize(w, h);
    idleRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    idleMount.appendChild(idleRenderer.domElement);

    const geo = new THREE.IcosahedronGeometry(1.25, 2);
    const mat = new THREE.MeshBasicMaterial({ color: 0x4dfff0, wireframe: true, transparent: true, opacity: 0.8 });
    idleMesh = new THREE.Mesh(geo, mat);
    idleScene.add(idleMesh);

    const glowGeo = new THREE.SphereGeometry(0.95, 24, 24);
    const glowMat = new THREE.MeshBasicMaterial({ color: 0x0d3b38, transparent: true, opacity: 0.35 });
    idleScene.add(new THREE.Mesh(glowGeo, glowMat));

    window.addEventListener('resize', () => {
      const w2 = idleMount.clientWidth, h2 = idleMount.clientHeight;
      idleCamera.aspect = w2 / h2;
      idleCamera.updateProjectionMatrix();
      idleRenderer.setSize(w2, h2);
    });

    animateIdle();
  }

  function animateIdle() {
    idleMesh.rotation.y += 0.005;
    idleMesh.rotation.x += 0.0015;
    idleRenderer.render(idleScene, idleCamera);
    requestAnimationFrame(animateIdle);
  }

  // ---- Real camera + face-api.js detection ----
  async function loadModels() {
    if (modelsLoaded) return;
    const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
    // Using the TINY landmark net (not the full 68-point net) — noticeably
    // faster on phones, and still accurate enough for this use case.
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);
    modelsLoaded = true;
  }

  async function startCamera() {
    video = document.getElementById('webcam');
    overlayCanvas = document.getElementById('overlay-canvas');
    overlayCtx = overlayCanvas.getContext('2d');

    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 640 } },
    });
    video.srcObject = stream;
    await new Promise((resolve) => (video.onloadedmetadata = resolve));
    await video.play();

    // size the overlay canvas to match how the video is actually displayed
    overlayCanvas.width = video.clientWidth;
    overlayCanvas.height = video.clientHeight;

    await loadModels();
  }

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
    if (video) video.srcObject = null;
    if (detectLoop) cancelAnimationFrame(detectLoop);
  }

  // Runs a fast per-frame detector to draw the live mesh and track how many
  // consecutive frames had a face. Once stable, does ONE heavier call to
  // get the actual descriptor (the "fingerprint" used for matching).
  function detectAndDraw({ onDescriptor, onNoFace, onProgress }) {
    const displaySize = { width: video.clientWidth, height: video.clientHeight };
    faceapi.matchDimensions(overlayCanvas, displaySize);

    const fastOptions = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 });
    let stableFrames = 0;
    const REQUIRED_STABLE_FRAMES = 6; // roughly half a second of a steady face
    let resolved = false;

    async function loop() {
      if (resolved) return;

      const result = await faceapi.detectSingleFace(video, fastOptions).withFaceLandmarks(true); // true = tiny net
      overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

      if (result) {
        const resized = faceapi.resizeResults(result, displaySize);
        drawMesh(resized.landmarks);
        stableFrames++;
        onProgress && onProgress(stableFrames, REQUIRED_STABLE_FRAMES);

        if (stableFrames >= REQUIRED_STABLE_FRAMES) {
          resolved = true;
          // ONE expensive call for the actual descriptor — not every frame
          const full = await faceapi
            .detectSingleFace(video, fastOptions)
            .withFaceLandmarks(true)
            .withFaceDescriptor();

          if (full) {
            onDescriptor(full.descriptor);
            return;
          }
          // rare race condition (face moved right as we grabbed it) — retry
          resolved = false;
          stableFrames = 0;
        }
      } else {
        stableFrames = 0;
        onNoFace && onNoFace();
      }
      detectLoop = requestAnimationFrame(loop);
    }
    detectLoop = requestAnimationFrame(loop);
  }

  function drawMesh(landmarks) {
    const pts = landmarks.positions;
    overlayCtx.strokeStyle = 'rgba(77,255,240,0.85)';
    overlayCtx.fillStyle = 'rgba(77,255,240,0.9)';
    overlayCtx.lineWidth = 1.2;

    const groups = [
      [0, 17], // jaw
      [17, 22], // right eyebrow
      [22, 27], // left eyebrow
      [27, 31], // nose bridge
      [31, 36], // nose bottom
      [36, 42], // right eye
      [42, 48], // left eye
      [48, 60], // outer lips
    ];
    groups.forEach(([start, end]) => {
      overlayCtx.beginPath();
      for (let i = start; i < end; i++) {
        const p = pts[i];
        if (i === start) overlayCtx.moveTo(p.x, p.y);
        else overlayCtx.lineTo(p.x, p.y);
      }
      overlayCtx.stroke();
    });
    pts.forEach((p) => {
      overlayCtx.beginPath();
      overlayCtx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
      overlayCtx.fill();
    });
  }

  // Grabs a single still frame from the live video — used for the optional
  // security-attempt snapshot. Not a recording, just one JPEG per attempt.
  function captureSnapshot() {
    if (!video || !video.videoWidth) return null;
    const c = document.createElement('canvas');
    c.width = video.videoWidth;
    c.height = video.videoHeight;
    c.getContext('2d').drawImage(video, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.6);
  }

  return { initIdle, startCamera, stopCamera, detectAndDraw, captureSnapshot };
})();
