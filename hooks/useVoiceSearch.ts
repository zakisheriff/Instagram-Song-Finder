"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** The parts of the browser's speech recognition API this hook relies on. */
interface RecognitionResultEvent {
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}

interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: RecognitionResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type RecognitionConstructor = new () => Recognition;

function getRecognition(): RecognitionConstructor | undefined {
  if (typeof window === "undefined") return undefined;
  const scope = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition;
}

/** Longest the microphone stays open waiting for speech. */
const MAX_LISTEN_MS = 10_000;
/** How long to wait for the browser to confirm a session has ended before forcing it. */
const END_GRACE_MS = 1_200;

const ERROR_MESSAGES: Record<string, string> = {
  "not-allowed": "Microphone access is blocked. Allow it in your browser settings and try again.",
  "service-not-allowed":
    "Voice search isn't available here. Turn on Dictation or Siri in your device settings, try Chrome or Safari, or type the song name.",
  "no-speech": "We didn't catch that. Tap the microphone and say the song name again.",
  "audio-capture": "No microphone was found. Type the song name instead.",
  network: "Voice search needs an internet connection. Check yours and try again.",
};

const GENERIC_ERROR = "Voice search didn't work. Tap the microphone to try again, or type the song name.";

/** Browsers often add a full stop or question mark to a spoken phrase; a song search doesn't want it. */
function tidy(transcript: string): string {
  return transcript
    .replace(/\s+/g, " ")
    .replace(/[.?!,;:]+$/u, "")
    .trim();
}

export interface VoiceSearchHandlers {
  /** Called as words are recognised, so they can be shown while the visitor is still speaking. */
  onHearing: (text: string) => void;
  /** Called once, with the finished phrase, when the visitor stops speaking. */
  onHeard: (text: string) => void;
}

export interface VoiceSearch {
  /** False in browsers without speech recognition; the button is then hidden. */
  supported: boolean;
  listening: boolean;
  error: string | null;
  toggle: () => void;
  /** Stops listening. Safe to call when not listening. */
  stop: () => void;
}

/**
 * Voice input for the search box, using the speech recognition built into the
 * browser. Nothing is recorded or stored by this site: the browser turns
 * speech into text and hands the text back.
 *
 * Reliability notes, because browsers (Safari in particular) are strict here:
 * - A single recogniser is created once and reused for every search. Creating
 *   a new one per tap can leave the browser's speech service holding the
 *   microphone, after which nothing works until the browser is restarted.
 * - A session is always ended gracefully with `stop()`, and a new one never
 *   starts until the browser has confirmed the last one ended.
 * - The session is released when the page is hidden or closed.
 */
export function useVoiceSearch({ onHearing, onHeard }: VoiceSearchHandlers): VoiceSearch {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recogniser = useRef<Recognition | null>(null);
  /** True from `start()` until the browser reports the session has ended. */
  const active = useRef(false);
  /** Set when the visitor taps the microphone while the last session is still closing. */
  const startWhenEnded = useRef(false);
  const heard = useRef("");
  const delivered = useRef(false);
  const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const graceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handlers = useRef({ onHearing, onHeard });
  const begin = useRef<() => void>(() => undefined);

  useEffect(() => {
    handlers.current = { onHearing, onHeard };
  }, [onHearing, onHeard]);

  const clearTimers = useCallback(() => {
    if (silenceTimer.current) clearTimeout(silenceTimer.current);
    if (graceTimer.current) clearTimeout(graceTimer.current);
    silenceTimer.current = null;
    graceTimer.current = null;
  }, []);

  /** Runs when a session is over, however it ended. Delivers the phrase exactly once. */
  const finish = useCallback(() => {
    clearTimers();
    active.current = false;
    setListening(false);

    const phrase = tidy(heard.current);
    if (phrase && !delivered.current) {
      delivered.current = true;
      handlers.current.onHeard(phrase);
    }

    if (startWhenEnded.current) {
      startWhenEnded.current = false;
      begin.current();
    }
  }, [clearTimers]);

  /** Asks the browser to end the session, and forces it if no confirmation arrives. */
  const requestEnd = useCallback(() => {
    const session = recogniser.current;
    if (!session || !active.current) return;
    setListening(false);
    if (silenceTimer.current) clearTimeout(silenceTimer.current);
    silenceTimer.current = null;
    try {
      session.stop();
    } catch {
      // Not running after all.
    }
    if (graceTimer.current) clearTimeout(graceTimer.current);
    graceTimer.current = setTimeout(() => {
      try {
        session.abort();
      } catch {
        // Already released.
      }
      finish();
    }, END_GRACE_MS);
  }, [finish]);

  const getRecogniser = useCallback((): Recognition | null => {
    if (recogniser.current) return recogniser.current;
    const Constructor = getRecognition();
    if (!Constructor) return null;

    const session = new Constructor();
    session.continuous = false;
    session.interimResults = true;
    session.maxAlternatives = 1;

    session.onresult = (event) => {
      const results = Array.from(event.results);
      const text = results.map((result) => result[0].transcript).join("");
      heard.current = text;
      const shown = tidy(text);
      if (shown) handlers.current.onHearing(shown);
      // One phrase is one search. Ending gracefully lets the browser close the
      // microphone cleanly; the phrase is delivered when it confirms.
      if (results.length > 0 && results.every((result) => result.isFinal)) requestEnd();
    };
    session.onerror = (event) => {
      // "aborted" and "no-speech" after something was heard are not failures.
      const benign = event.error === "aborted" || (event.error === "no-speech" && heard.current);
      if (!benign) setError(ERROR_MESSAGES[event.error] ?? GENERIC_ERROR);
      // Some browsers never signal the end after an error, so make sure it ends.
      requestEnd();
    };
    session.onend = finish;

    recogniser.current = session;
    return session;
  }, [finish, requestEnd]);

  useEffect(() => {
    begin.current = () => {
      const session = getRecogniser();
      if (!session) return;

      heard.current = "";
      delivered.current = false;
      session.lang = navigator.language || "en-US";
      setError(null);

      try {
        session.start();
      } catch {
        // The browser still considers the last session open: close it and try once more after it ends.
        active.current = true;
        startWhenEnded.current = true;
        requestEnd();
        return;
      }

      active.current = true;
      setListening(true);
      silenceTimer.current = setTimeout(() => {
        if (!heard.current) setError(ERROR_MESSAGES["no-speech"]);
        requestEnd();
      }, MAX_LISTEN_MS);
    };
  }, [getRecogniser, requestEnd]);

  // Checked after mount so the server and the first client render agree.
  useEffect(() => {
    const frame = requestAnimationFrame(() => setSupported(Boolean(getRecognition())));

    // Let go of the microphone whenever the page is hidden, closed or navigated away from.
    const release = () => {
      startWhenEnded.current = false;
      if (!active.current) return;
      try {
        recogniser.current?.abort();
      } catch {
        // Already released.
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") release();
    };
    window.addEventListener("pagehide", release);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pagehide", release);
      document.removeEventListener("visibilitychange", onVisibility);
      clearTimers();
      release();
    };
  }, [clearTimers]);

  const stop = useCallback(() => {
    startWhenEnded.current = false;
    requestEnd();
  }, [requestEnd]);

  const toggle = useCallback(() => {
    if (listening) {
      stop();
    } else if (active.current) {
      // The last session is still closing: start as soon as the browser confirms it has ended.
      startWhenEnded.current = true;
    } else {
      begin.current();
    }
  }, [listening, stop]);

  return { supported, listening, error, toggle, stop };
}
