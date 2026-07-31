/* ============================================================
   face.js
   - Draws the idle wireframe head (welcome screen, no camera)
   - Handles webcam + face-api.js detection (auth screen)
   ============================================================ */

const FaceModule = (() => {
  let idleCanvas, idleCtx;
  let overlayCanvas, overlayCtx, video;
  let modelsLoaded = false;
  let detectLoop = null;

  // ---- Idle wireframe head (no camera, just decorative) ----
  function initIdle() {
    idleCanvas = document.getElementById('face-canvas');
    idleCtx = idleCanvas.getContext('2d');
    animateIdleHead();
  }

  // Simple procedural "wireframe head" — a mesh of lines that gently
  // pulses. This is what shows on the Welcome screen before the camera
  // is even requested.
  function animateIdleHead() {
    let t = 0;
    function draw() {
      const w = idleCanvas.width, h = idleCanvas.height;
      idleCtx.clearRect(0, 0, w, h);
      idleCtx.strokeStyle = 'rgba(77,255,240,0.55)';
      idleCtx.lineWidth = 1;

      const cx = w / 2, cy = h / 2 - 10;
      const pulse = Math.sin(t / 40) * 4;

      // head oval
      idleCtx.beginPath();
      idleCtx.ellipse(cx, cy, 55 + pulse * 0.2, 70 + pulse * 0.2, 0, 0, Math.PI * 2);
      idleCtx.stroke();

      // horizontal mesh lines
      for (let i = -3; i <= 3; i++) {
        idleCtx.beginPath();
        idleCtx.ellipse(cx, cy + i * 16, 55 - Math.abs(i) * 6, 12, 0, 0, Math.PI * 2);
        idleCtx.stroke();
      }
      // vertical mesh lines
      for (let i = -2; i <= 2; i++) {
        idleCtx.beginPath();
        idleCtx.moveTo(cx + i * 18, cy - 65);
        idleCtx.lineTo(cx + i * 18, cy + 65);
        idleCtx.stroke();
      }
      // shoulders
      idleCtx.beginPath();
      idleCtx.moveTo(cx - 70, cy + 130);
      idleCtx.quadraticCurveTo(cx, cy + 80, cx + 70, cy + 130);
      idleCtx.stroke();

      t++;
      requestAnimationFrame(draw);
    }
    draw();
  }

  // ---- Real camera + face-api.js detection ----
  async function loadModels() {
    if (modelsLoaded) return;
    const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
    ]);
    modelsLoaded = true;
  }

  async function startCamera() {
    video = document.getElementById('webcam');
    overlayCanvas = document.getElementById('overlay-canvas');
    overlayCtx = overlayCanvas.getContext('2d');

    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 300, height: 320 } });
    video.srcObject = stream;
    await new Promise((res) => (video.onloadedmetadata = res));
    await loadModels();
  }

  function stopCamera() {
    if (video && video.srcObject) {
      video.srcObject.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    }
    if (detectLoop) cancelAnimationFrame(detectLoop);
  }

  // Draws the live landmark mesh over the video, and resolves with a
  // face descriptor (a 128-number "fingerprint") once a stable face is found.
  function detectAndDraw({ onDescriptor, onNoFace }) {
    let stableFrames = 0;
    const REQUIRED_STABLE_FRAMES = 20; // ~0.6s of consistent detection

    async function loop() {
      const result = await faceapi
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

      overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

      if (result) {
        stableFrames++;
        drawMesh(result.landmarks, overlayCanvas.width / video.videoWidth, overlayCanvas.height / video.videoHeight);
        if (stableFrames >= REQUIRED_STABLE_FRAMES) {
          onDescriptor(result.descriptor);
          return; // stop loop, caller decides what's next
        }
      } else {
        stableFrames = 0;
        onNoFace && onNoFace();
      }
      detectLoop = requestAnimationFrame(loop);
    }
    detectLoop = requestAnimationFrame(loop);
  }

  function drawMesh(landmarks, scaleX, scaleY) {
    const pts = landmarks.positions;
    overlayCtx.strokeStyle = 'rgba(77,255,240,0.8)';
    overlayCtx.fillStyle = 'rgba(77,255,240,0.9)';
    overlayCtx.lineWidth = 1;

    // connect points in sequence per facial feature group for a mesh look
    const groups = [
      [0, 17],   // jaw
      [17, 22],  // right eyebrow
      [22, 27],  // left eyebrow
      [27, 31],  // nose bridge
      [31, 36],  // nose bottom
      [36, 42],  // right eye
      [42, 48],  // left eye
      [48, 60],  // outer lips
    ];
    groups.forEach(([start, end]) => {
      overlayCtx.beginPath();
      for (let i = start; i < end; i++) {
        const x = pts[i].x * scaleX, y = pts[i].y * scaleY;
        if (i === start) overlayCtx.moveTo(x, y);
        else overlayCtx.lineTo(x, y);
      }
      overlayCtx.stroke();
    });
    // dots at each landmark
    pts.forEach((p) => {
      overlayCtx.beginPath();
      overlayCtx.arc(p.x * scaleX, p.y * scaleY, 1.4, 0, Math.PI * 2);
      overlayCtx.fill();
    });
  }

  return { initIdle, startCamera, stopCamera, detectAndDraw };
})();
