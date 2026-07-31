/* ============================================================
   app.js — wires everything together and drives the screen flow:
   Welcome -> Face Auth -> Recognized -> Main Assistant
   ============================================================ */

(function () {
  const screens = {
    welcome: document.getElementById('screen-welcome'),
    auth: document.getElementById('screen-auth'),
    assistant: document.getElementById('screen-assistant'),
  };
  const authStatus = document.getElementById('auth-status');
  const authSub = document.getElementById('auth-substatus');
  const chatLog = document.getElementById('chat-log');
  const userInput = document.getElementById('user-input');
  const micBtn = document.getElementById('mic-btn');
  const caption = document.getElementById('assistant-caption');

  const imageBtn = document.getElementById('image-btn');
  const imageFileInput = document.getElementById('image-file-input');
  const imagePreview = document.getElementById('image-preview');
  const imagePreviewImg = document.getElementById('image-preview-img');
  const imageRemoveBtn = document.getElementById('image-remove-btn');

  let pendingImageBase64 = null;

  function showScreen(name) {
    Object.values(screens).forEach((s) => s.classList.remove('active'));
    screens[name].classList.add('active');
  }

  // ---------- Boot sequence ----------
  async function boot() {
    FaceModule.initIdle();
    OrbModule.initOrb();
    await MemoryModule.init(); // fetches Supabase config from /api/config (Vercel env vars)

    // Welcome screen shows for a couple seconds, then move to face auth
    setTimeout(startFaceAuth, 2200);
  }

  async function startFaceAuth() {
    showScreen('auth');
    authStatus.textContent = 'Ready for Face Authentication';
    authSub.textContent = 'Starting camera...';

    try {
      await FaceModule.startCamera();
      authSub.textContent = 'Look at the camera';

      FaceModule.detectAndDraw({
        onNoFace: () => {
          authSub.textContent = 'No face detected — center your face in frame';
        },
        onDescriptor: async (descriptor) => handleDescriptor(descriptor),
      });
    } catch (e) {
      console.error(e);
      authStatus.textContent = 'Camera access denied';
      authSub.textContent = 'Allow camera permission and reload the page. Skipping to assistant...';
      setTimeout(goToAssistant, 2000);
    }
  }

  async function handleDescriptor(descriptor) {
    authStatus.textContent = 'Face recognized successfully';
    authSub.textContent = '';

    // If Supabase is connected, try to compare against saved descriptor.
    // First-time use: no saved descriptor yet, so we register this one.
    if (MemoryModule.isReady()) {
      const saved = await MemoryModule.getFaceDescriptor();
      if (!saved) {
        await MemoryModule.saveFaceDescriptor(descriptor);
        authSub.textContent = 'Face registered for next time';
      } else {
        const distance = faceapi.euclideanDistance(saved, Array.from(descriptor));
        // distance < 0.5 is generally considered a solid match for face-api.js
        if (distance > 0.5) {
          authStatus.textContent = "Face doesn't match saved profile";
          authSub.textContent = 'Continuing anyway (demo mode)';
        }
      }
    }

    FaceModule.stopCamera();
    setTimeout(goToAssistant, 1200);
  }

  async function goToAssistant() {
    showScreen('assistant');
    await loadHistoryIntoUI();
    greet();
  }

  async function greet() {
    caption.textContent = 'Ask me Anything';
    VoiceModule.speak('Hello, I am your assistant.');
  }

  // ---------- Chat handling ----------
  async function loadHistoryIntoUI() {
    if (!MemoryModule.isReady()) return;
    const history = await MemoryModule.getRecentMessages(10);
    history.forEach((m) => appendMessage(m.role === 'user' ? 'user' : 'ai', m.content));
  }

  function appendMessage(role, text) {
    const div = document.createElement('div');
    div.className = `msg ${role}`;
    div.textContent = text;
    chatLog.appendChild(div);
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  async function sendToAssistant(text) {
    const image = pendingImageBase64;
    if (!text.trim() && !image) return;

    appendMessage('user', text || '(image attached)');
    userInput.value = '';
    clearImage();
    caption.textContent = 'Thinking...';

    if (MemoryModule.isReady()) {
      MemoryModule.saveMessage('user', text || '(image attached)');
      const fact = BrainModule.extractFact(text);
      if (fact) MemoryModule.saveFact(fact);
    }

    const facts = MemoryModule.isReady() ? await MemoryModule.getAllFacts() : [];
    const history = MemoryModule.isReady() ? await MemoryModule.getRecentMessages(10) : [];

    const reply = await BrainModule.ask(text, { facts, history, image });
    appendMessage('ai', reply);
    if (MemoryModule.isReady()) MemoryModule.saveMessage('assistant', reply);

    caption.textContent = 'Ask me Anything';
    OrbModule.setMode('speaking');
    VoiceModule.speak(reply, {
      onEnd: () => OrbModule.setMode('idle'),
    });
  }

  userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendToAssistant(userInput.value);
  });

  // ---------- Mic button ----------
  micBtn.addEventListener('click', async () => {
    micBtn.classList.add('recording');
    caption.textContent = 'Listening...';
    const analyser = await VoiceModule.startMicAnalyser();
    if (analyser) OrbModule.setMode('listening', analyser);

    VoiceModule.listen({
      onResult: (text) => {
        userInput.value = text;
        sendToAssistant(text);
      },
      onEnd: () => {
        micBtn.classList.remove('recording');
        VoiceModule.stopMicAnalyser();
        OrbModule.setMode('idle');
      },
      onError: (err) => {
        micBtn.classList.remove('recording');
        VoiceModule.stopMicAnalyser();
        OrbModule.setMode('idle');
        caption.textContent = 'Ask me Anything';
        appendMessage('ai', `Mic error: ${err}`);
      },
    });
  });

  // ---------- Image upload ----------
  imageBtn.addEventListener('click', () => imageFileInput.click());

  imageFileInput.addEventListener('change', () => {
    const file = imageFileInput.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      appendMessage('ai', 'That file is not an image — please attach a jpg/png/webp.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      appendMessage('ai', "That image is a bit large — try one under 8MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      pendingImageBase64 = reader.result; // data:image/...;base64,...
      imagePreviewImg.src = pendingImageBase64;
      imagePreview.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  });

  imageRemoveBtn.addEventListener('click', clearImage);

  function clearImage() {
    pendingImageBase64 = null;
    imageFileInput.value = '';
    imagePreviewImg.src = '';
    imagePreview.classList.add('hidden');
  }

  boot();
})();
