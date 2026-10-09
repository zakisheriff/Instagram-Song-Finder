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

const ERROR_MESSAGES: Record<string, string> = {
  "not-allowed": "Microphone access is blocked. Allow it in your browser settings and try again.",
  "service-not-allowed":
    "Voice search isn't available here. Turn on Dictation or Siri in your device settings, try Chrome or Safari, or type the song name.",
  "no-speech": "We didn't catch that. Tap the microphone and say the song name again.",
  "audio-capture": "No microphone was found. Type the song name instead.",
  network: "Voice search needs an internet connection. Check yours and try again.",
};

export interface VoiceSearch {
  /** False in browsers without speech recognition; the button is then hidden. */
  supported: boolean;
  listening: boolean;
  error: string | null;
  toggle: () => void;
  /** Stops listening immediately. Safe to call when not listening. */
  stop: () => void;
}

/**
 * Voice input for the search box, using the speech recognition built into the
 * browser. Nothing is recorded or stored by this site: the browser turns
 * speech into text and hands the text back.
 */
export function useVoiceSearch(onTranscript: (text: string) => void): VoiceSearch {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognition = useRef<Recognition | null>(null);
  const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handler = useRef(onTranscript);

  useEffect(() => {
    handler.current = onTranscript;
  }, [onTranscript]);

  // Checked after mount so the server and the first client render agree.
  useEffect(() => {
    const frame = requestAnimationFrame(() => setSupported(Boolean(getRecognition())));
    return () => {
      cancelAnimationFrame(frame);
      if (silenceTimer.current) clearTimeout(silenceTimer.current);
      recognition.current?.abort();
    };
  }, []);

  /** Ends the current session straight away, without waiting for the browser to confirm. */
  const stop = useCallback(() => {
    if (silenceTimer.current) clearTimeout(silenceTimer.current);
    silenceTimer.current = null;
    const session = recognition.current;
    recognition.current = null;
    setListening(false);
    if (session) {
      // Detach first so a late event from this session can't restart the UI state.
      session.onresult = null;
      session.onerror = null;
      session.onend = null;
      try {
        session.abort();
      } catch {
        // Already stopped.
      }
    }
  }, []);

  const toggle = useCallback(() => {
    if (recognition.current) {
      stop();
      return;
    }
    const Recognition = getRecognition();
    if (!Recognition) return;

    const session = new Recognition();
    session.lang = navigator.language || "en-US";
    session.continuous = false;
    session.interimResults = true;
    session.maxAlternatives = 1;

    session.onresult = (event) => {
      const results = Array.from(event.results);
      const text = results
        .map((result) => result[0].transcript)
        .join("")
        .trim();
      if (text) handler.current(text);
      // One phrase is one search: finish as soon as the browser is sure of it.
      if (results.some((result) => result.isFinal)) stop();
    };
    session.onerror = (event) => {
      // Some browsers report an error and never signal the end, so end it here.
      stop();
      // "aborted" just means the visitor stopped it.
      if (event.error !== "aborted") {
        setError(ERROR_MESSAGES[event.error] ?? "Voice search didn't work. Type the song name instead.");
      }
    };
    session.onend = stop;

    recognition.current = session;
    setError(null);
    setListening(true);
    // Never leave the microphone open indefinitely if nothing is heard.
    silenceTimer.current = setTimeout(() => {
      stop();
      setError(ERROR_MESSAGES["no-speech"]);
    }, MAX_LISTEN_MS);
    try {
      session.start();
    } catch {
      stop();
      setError("Voice search didn't start. Type the song name instead.");
    }
  }, [stop]);

  return { supported, listening, error, toggle, stop };
}
