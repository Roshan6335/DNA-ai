/* ============================================================
   voice.js
   - Speech-to-text via Web Speech API (SpeechRecognition)
   - Text-to-speech via SpeechSynthesis API
   - Live mic waveform via Web Audio API analyser
   ============================================================ */

const VoiceModule = (() => {
  let recognition = null;
  let audioCtx, analyser, micStream;
  const supportsSTT = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;

  function initRecognition() {
    if (!supportsSTT) return null;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SR();
    recognition.lang = 'en-IN'; // change to 'hi-IN' if you want Hindi recognition
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    return recognition;
  }

  async function startMicAnalyser() {
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(micStream);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      source.connect(analyser);
      return analyser;
    } catch (e) {
      console.warn('Mic analyser unavailable:', e);
      return null;
    }
  }

  function stopMicAnalyser() {
    if (micStream) micStream.getTracks().forEach((t) => t.stop());
    if (audioCtx) audioCtx.close();
    micStream = null;
    audioCtx = null;
    analyser = null;
  }

  function listen({ onResult, onStart, onEnd, onError }) {
    if (!recognition) recognition = initRecognition();
    if (!recognition) {
      onError && onError('Speech recognition not supported in this browser. Try Chrome.');
      return;
    }
    recognition.onstart = () => onStart && onStart();
    recognition.onresult = (e) => {
      const text = e.results[0][0].transcript;
      onResult && onResult(text);
    };
    recognition.onerror = (e) => onError && onError(e.error);
    recognition.onend = () => onEnd && onEnd();
    recognition.start();
  }

  function speak(text, { onStart, onEnd } = {}) {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1.0;
    utter.pitch = 1.0;
    utter.onstart = () => onStart && onStart();
    utter.onend = () => onEnd && onEnd();
    window.speechSynthesis.speak(utter);
  }

  return { initRecognition, startMicAnalyser, stopMicAnalyser, listen, speak, supportsSTT };
})();
