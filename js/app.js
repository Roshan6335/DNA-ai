/* ============================================================
   app.js — wires everything together and drives the screen flow:
   Welcome -> Face Auth -> Recognized/Registered -> Main Assistant

   MULTI-USER: after a face is scanned, the backend tells us which
   user this is (existing match, or a brand new profile). That id
   is kept in `currentUserId` for the rest of this page session and
   passed into every memory call, so each person's chat history and
   facts stay completely separate from everyone else's.
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

  let currentUserId = null;

  function showScreen(name) {
    Object.values(screens).forEach((s) => s.classList.remove('active'));
    screens[name].classList.add('active');
  }

  // ---------- Boot sequence ----------
  async function boot() {
    FaceModule.initIdle();
    OrbModule.initOrb();
    const memOk = await MemoryModule.init();
    if (!memOk) {
      console.warn('Memory backend not reachable — check SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in Vercel env vars.');
    }
    setTimeout(startFaceAuth, 1800);
  }

  async function startFaceAuth() {
    showScreen('auth');
    authStatus.textContent = 'Ready for Face Authentication';
    authSub.textContent = 'Starting camera...';

    try {
      await FaceModule.startCamera();
      authSub.textContent = 'Look at the camera';

      const startedAt = Date.now();
      FaceModule.detectAndDraw({
        onNoFace: () => {
          const elapsed = Date.now() - startedAt;
          if (elapsed > 8000) authSub.textContent = 'Make sure your whole face is visible';
          else if (elapsed > 4000) authSub.textContent = 'Try better lighting or move closer';
          else authSub.textContent = 'No face detected — center your face in frame';
        },
        onProgress: () => {
          authSub.textContent = 'Hold still...';
        },
        onDescriptor: async (descriptor) => handleDescriptor(descriptor),
      });
    } catch (e) {
      console.error(e);
      authStatus.textContent = 'Camera access denied';
      authSub.textContent = 'Allow camera permission and reload the page.';
    }
  }

  async function handleDescriptor(descriptor) {
    authSub.textContent = '';
    const descArray = Array.from(descriptor);

    if (MemoryModule.isReady()) {
      const result = await MemoryModule.identifyFace(descArray);
      if (result) {
        currentUserId = result.userId;
        authStatus.textContent = result.isNew ? 'New face registered' : 'Face recognized successfully';

        // fire-and-forget security snapshot — one still photo, not a recording
        const snap = FaceModule.captureSnapshot();
        if (snap) MemoryModule.logAttempt(snap, !result.isNew, currentUserId).catch(() => {});
      } else {
        authStatus.textContent = 'Could not verify — continuing anyway';
      }
    } else {
      authStatus.textContent = 'Face recognized successfully';
    }

    FaceModule.stopCamera();
    setTimeout(goToAssistant, 800);
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
    if (!MemoryModule.isReady()) {
      appendMessage('ai', "Heads up — I can't save memory right now (Supabase isn't configured on the server). I'll still chat, just won't remember next time.");
      return;
    }
    if (!currentUserId) return;
    const history = await MemoryModule.getRecentMessages(currentUserId, 10);
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
    if (!text.trim()) return;
    appendMessage('user', text);
    userInput.value = '';
    caption.textContent = 'Thinking...';

    const memReady = MemoryModule.isReady() && !!currentUserId;

    if (memReady) {
      MemoryModule.saveMessage(currentUserId, 'user', text);
      const fact = BrainModule.extractFact(text);
      if (fact) MemoryModule.saveFact(currentUserId, fact);
    }

    const facts = memReady ? await MemoryModule.getAllFacts(currentUserId) : [];
    const history = memReady ? await MemoryModule.getRecentMessages(currentUserId, 10) : [];

    const reply = await BrainModule.ask(text, { facts, history });
    appendMessage('ai', reply);
    if (memReady) MemoryModule.saveMessage(currentUserId, 'assistant', reply);

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
  micBtn.addEventListener('click', () => {
    if (micBtn.classList.contains('recording')) return;
    micBtn.classList.add('recording');
    caption.textContent = 'Listening...';
    OrbModule.setMode('listening');

    VoiceModule.listen({
      onResult: (text) => {
        userInput.value = text;
        sendToAssistant(text);
      },
      onEnd: () => {
        micBtn.classList.remove('recording');
        OrbModule.setMode('idle');
      },
      onError: (err) => {
        micBtn.classList.remove('recording');
        OrbModule.setMode('idle');
        caption.textContent = 'Ask me Anything';
        appendMessage('ai', err);
      },
    });
  });

  boot();
})();
