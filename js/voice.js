/* ============================================================
   voice.js
   - Speech-to-text via Web Speech API (SpeechRecognition)
   - Text-to-speech via SpeechSynthesis API

   NOTE: earlier version also opened a second raw microphone stream
   (getUserMedia) just to draw a "real" waveform. On many Android
   devices/browsers, having SpeechRecognition AND a separate
   getUserMedia stream compete for the mic at the same time silently
   breaks recognition. That second stream has been removed — the
   waveform during listening is now a synced animation instead
   (see orb.js), and voice input is far more reliable as a result.
   ============================================================ */

const VoiceModule = (() => {
  let recognition = null;
  const supportsSTT = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;

  function initRecognition() {
    if (!supportsSTT) return null;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r = new SR();
    r.lang = 'en-IN'; // change to 'hi-IN' for Hindi recognition
    r.interimResults = false;
    r.maxAlternatives = 1;
    return r;
  }

  function listen({ onResult, onStart, onEnd, onError }) {
    if (!recognition) recognition = initRecognition();
    if (!recognition) {
      onError && onError('Speech recognition is not supported in this browser. Use Chrome on Android.');
      return;
    }

    recognition.onstart = () => onStart && onStart();
    recognition.onresult = (e) => {
      const text = e.results[0][0].transcript;
      onResult && onResult(text);
    };
    recognition.onerror = (e) => {
      const friendly =
        e.error === 'no-speech'
          ? "I didn't catch that — try again."
          : e.error === 'not-allowed'
          ? 'Microphone permission denied — allow it in browser settings.'
          : e.error;
      onError && onError(friendly);
    };
    recognition.onend = () => onEnd && onEnd();

    try {
      recognition.start();
    } catch (e) {
      // start() throws if it's already running — safe to ignore, onend will fire
      onError && onError('Already listening — try again in a second.');
    }
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

  return { listen, speak, supportsSTT };
})();
