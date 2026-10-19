import { useCallback, useEffect, useRef, useState } from 'react';

// Voice input for the search bar via the Web Speech API (Chrome's
// webkitSpeechRecognition). Interim words stream into `onText`; the final
// phrase arrives with `final: true`. Errors become a short user-facing line.

interface RecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface RecognitionEvent {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
}
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

const recognitionCtor = (): RecognitionCtor | undefined => {
  const w = globalThis as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
};

export const SPEECH_ERRORS: Record<string, string> = {
  'not-allowed': 'Microphone access is blocked — allow it in the site settings',
  'service-not-allowed': 'Microphone access is blocked — allow it in the site settings',
  'no-speech': "Didn't catch that — try again",
  'audio-capture': 'No microphone found',
  network: 'Voice input needs an internet connection',
};

// Extension pages don't show Chrome's mic prompt for speech recognition on
// their own, so ask through getUserMedia first (a no-op once granted).
async function ensureMicrophone(): Promise<boolean> {
  try {
    const status = await navigator.permissions?.query({ name: 'microphone' as PermissionName });
    if (status?.state === 'granted') return true;
    if (status?.state === 'denied') return false;
  } catch {
    // permissions API without 'microphone' — fall through
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    return true;
  } catch {
    return false;
  }
}

export function useSpeechInput(onText: (text: string, final: boolean) => void) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<Recognition | null>(null);
  const onTextRef = useRef(onText);
  useEffect(() => {
    onTextRef.current = onText;
  });
  const supported = recognitionCtor() !== undefined;

  useEffect(() => () => recRef.current?.abort(), []);

  // Errors fade on their own.
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(t);
  }, [error]);

  const startingRef = useRef(false);

  // Turning the mic off is immediate: abort (rec.stop() would keep listening
  // until the engine finishes the phrase) and drop the listening state now.
  const stop = useCallback(() => {
    startingRef.current = false;
    const rec = recRef.current;
    recRef.current = null;
    setListening(false);
    rec?.abort();
  }, []);

  const start = useCallback(async () => {
    const Ctor = recognitionCtor();
    if (!Ctor) return setError('Voice input is not supported in this browser');
    if (recRef.current || startingRef.current) return;
    setError(null);
    startingRef.current = true;
    setListening(true); // the button shows "on" while the mic permission is checked
    const allowed = await ensureMicrophone();
    if (!startingRef.current) return; // turned off while we waited
    startingRef.current = false;
    if (!allowed) {
      setListening(false);
      return setError(SPEECH_ERRORS['not-allowed']);
    }

    const rec = new Ctor();
    rec.lang = navigator.language || 'en-US';
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      let text = '';
      let final = false;
      for (let i = 0; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
        if (i >= e.resultIndex && e.results[i].isFinal) final = true;
      }
      onTextRef.current(text.trim(), final);
    };
    rec.onerror = (e) => {
      if (e.error !== 'aborted') setError(SPEECH_ERRORS[e.error] ?? 'Voice input stopped unexpectedly');
    };
    rec.onend = () => {
      // An older, aborted session ending must not switch off a newer one.
      if (recRef.current && recRef.current !== rec) return;
      recRef.current = null;
      setListening(false);
    };
    recRef.current = rec;
    setListening(true);
    try {
      rec.start();
    } catch {
      recRef.current = null;
      setListening(false);
      setError('Voice input stopped unexpectedly');
    }
  }, []);

  return { supported, listening, error, start, stop };
}
