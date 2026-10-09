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

const ERROR_MESSAGES: Record<string, string> = {
  "not-allowed": "Microphone access is blocked. Allow it in your browser settings and try again.",
  "service-not-allowed": "Voice search isn't allowed in this browser. Type the song name instead.",
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
  const handler = useRef(onTranscript);

  useEffect(() => {
    handler.current = onTranscript;
  }, [onTranscript]);

  // Checked after mount so the server and the first client render agree.
  useEffect(() => {
    const frame = requestAnimationFrame(() => setSupported(Boolean(getRecognition())));
    return () => {
      cancelAnimationFrame(frame);
      recognition.current?.abort();
    };
  }, []);

  const toggle = useCallback(() => {
    if (recognition.current) {
      recognition.current.stop();
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
      const text = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join("")
        .trim();
      if (text) handler.current(text);
    };
    session.onerror = (event) => {
      // "aborted" just means the visitor stopped it.
      if (event.error !== "aborted") {
        setError(ERROR_MESSAGES[event.error] ?? "Voice search didn't work. Type the song name instead.");
      }
    };
    session.onend = () => {
      recognition.current = null;
      setListening(false);
    };

    recognition.current = session;
    setError(null);
    setListening(true);
    try {
      session.start();
    } catch {
      recognition.current = null;
      setListening(false);
      setError("Voice search didn't start. Type the song name instead.");
    }
  }, []);

  return { supported, listening, error, toggle };
}
