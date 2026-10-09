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

/** English regions that speech services reliably offer. */
const COMMON_ENGLISH = new Set(["en-US", "en-GB", "en-AU", "en-CA", "en-IN", "en-IE", "en-NZ", "en-ZA", "en-SG"]);
/** Regions whose English is closest to the Indian English model. */
const SOUTH_ASIA = new Set(["LK", "PK", "BD", "NP", "MV", "BT"]);

/**
 * Languages to try, best first. Safari hands speech to the operating system,
 * which refuses outright ("service-not-allowed") when it has no recogniser for
 * the exact locale, and many real browser locales such as en-LK have none. So
 * an unusual English locale is mapped to a common one, and there is always a
 * plain en-US fallback.
 */
export function speechLanguages(browserLanguage: string | undefined): string[] {
  const [base = "en", region = ""] = (browserLanguage || "en-US").split("-");
  const language = base.toLowerCase();
  const tag = region ? `${language}-${region.toUpperCase()}` : language;
  const candidates: string[] = [];

  if (language === "en") {
    if (COMMON_ENGLISH.has(tag)) candidates.push(tag);
    else if (SOUTH_ASIA.has(region.toUpperCase())) candidates.push("en-IN");
  } else {
    candidates.push(tag);
  }
  candidates.push("en-US");
  return [...new Set(candidates)];
}

/** Errors that mean "not in this language", worth retrying in another one. */
const LANGUAGE_ERRORS = new Set(["service-not-allowed", "language-not-supported"]);

/** Longest the microphone stays open waiting for speech. */
const MAX_LISTEN_MS = 10_000;
/** How long a finished session is given to close by itself before it is asked to stop. */
const NATURAL_END_MS = 4_000;
/** How long to wait after asking before giving up on a session that never reports its end. */
const STOP_GRACE_MS = 3_000;

const ERROR_MESSAGES: Record<string, string> = {
  "not-allowed": "Microphone access is blocked. Allow it in your browser settings and try again.",
  "service-not-allowed":
    "Voice search isn't available here. Turn on Dictation or Siri in your device settings, try Chrome or Safari, or type the song name.",
  "no-speech": "We didn't catch that. Tap the microphone and say the song name again.",
  "audio-capture": "No microphone was found. Type the song name instead.",
  network: "Voice search needs an internet connection. Check yours and try again.",
};

const GENERIC_ERROR = "Voice search didn't work. Tap the microphone to try again, or type the song name.";
const STUCK_ERROR =
  "Voice search has stopped hearing you. Reload the page to use it again, or type the song name.";

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

/** Everything about one tap-to-speak attempt. */
interface Session {
  recognition: Recognition;
  /** Which tap of the microphone this session belongs to. */
  tap: number;
  heard: string;
  delivered: boolean;
  /** True once the browser has reported the session over. */
  ended: boolean;
  /** Set when the session failed in a way that should surface as a message. */
  failure: string | null;
  /** True when the next language should be tried as soon as this session has closed. */
  retryNextLanguage: boolean;
}

/**
 * Voice input for the search box, using the speech recognition built into the
 * browser. Nothing is recorded or stored by this site: the browser turns
 * speech into text and hands the text back.
 *
 * iOS and macOS Safari are unforgiving about how sessions are closed. If a
 * session is cut short with `abort()`, or told to `stop()` while it is still
 * finishing a phrase, later sessions on the same page open the microphone but
 * hear nothing until the page is reloaded. So this hook follows three rules:
 *
 * 1. Every tap gets a brand new recogniser.
 * 2. A session that has produced its phrase is left to close by itself. It is
 *    never aborted; it is only asked to stop if the visitor stops it or it
 *    lingers, and `abort()` is reserved for the page being closed.
 * 3. A new session never starts until the previous one has reported its end.
 *    A tap during that moment is remembered and honoured as soon as it has.
 */
export function useVoiceSearch({ onHearing, onHeard }: VoiceSearchHandlers): VoiceSearch {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** The session that has not yet reported its end, if any. */
  const open = useRef<Session | null>(null);
  /** True while the visitor expects the microphone to be on. */
  const wanted = useRef(false);
  /** Counts taps that turn the microphone on, to tell a new request from the one a session served. */
  const taps = useRef(0);
  const languages = useRef<string[]>(["en-US"]);
  const attempt = useRef(0);
  const provenLanguage = useRef<string | null>(null);
  /** Consecutive sessions that closed without hearing anything. */
  const emptySessions = useRef(0);
  const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handlers = useRef({ onHearing, onHeard });
  const startSession = useRef<() => void>(() => undefined);

  useEffect(() => {
    handlers.current = { onHearing, onHeard };
  }, [onHearing, onHeard]);

  const clearTimers = useCallback(() => {
    if (silenceTimer.current) clearTimeout(silenceTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    silenceTimer.current = null;
    closeTimer.current = null;
  }, []);

  /** Hands the finished phrase to the search, once per session. */
  const deliver = useCallback((session: Session) => {
    const phrase = tidy(session.heard);
    if (!phrase || session.delivered) return;
    session.delivered = true;
    emptySessions.current = 0;
    handlers.current.onHeard(phrase);
  }, []);

  /** Runs when the browser reports a session over, or it is given up on. */
  const closed = useCallback(
    (session: Session) => {
      if (session.ended) return;
      session.ended = true;
      if (open.current === session) open.current = null;
      clearTimers();
      deliver(session);

      if (session.retryNextLanguage && wanted.current) {
        startSession.current();
        return;
      }
      if (wanted.current && taps.current > session.tap) {
        // The visitor tapped again while this one was closing: now it is safe to start.
        startSession.current();
        return;
      }

      wanted.current = false;
      setListening(false);
      if (session.failure) {
        setError(session.failure);
      } else if (!session.heard) {
        emptySessions.current += 1;
        // Twice in a row with the microphone open and nothing heard means the
        // browser's speech service has stopped delivering audio to this page.
        setError(emptySessions.current >= 2 ? STUCK_ERROR : ERROR_MESSAGES["no-speech"]);
      }
    },
    [clearTimers, deliver],
  );

  /**
   * Waits for a session to close. It is left alone first; if it lingers it is
   * asked to stop, and if it still never reports back it is simply let go of.
   * It is never aborted, because that is what breaks Safari.
   */
  const awaitClose = useCallback(
    (session: Session, askNow: boolean) => {
      if (session.ended) return;
      if (silenceTimer.current) clearTimeout(silenceTimer.current);
      silenceTimer.current = null;
      if (closeTimer.current) clearTimeout(closeTimer.current);

      const ask = () => {
        try {
          session.recognition.stop();
        } catch {
          // Already stopped.
        }
        closeTimer.current = setTimeout(() => closed(session), STOP_GRACE_MS);
      };

      if (askNow) ask();
      else closeTimer.current = setTimeout(ask, NATURAL_END_MS);
    },
    [closed],
  );

  useEffect(() => {
    startSession.current = () => {
      const Constructor = getRecognition();
      if (!Constructor) return;

      const recognition = new Constructor();
      recognition.lang = languages.current[attempt.current] ?? "en-US";
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      const session: Session = {
        recognition,
        tap: taps.current,
        heard: "",
        delivered: false,
        ended: false,
        failure: null,
        retryNextLanguage: false,
      };

      recognition.onresult = (event) => {
        const results = Array.from(event.results);
        session.heard = results.map((result) => result[0].transcript).join("");
        provenLanguage.current = recognition.lang;
        const shown = tidy(session.heard);
        if (shown && !session.delivered) handlers.current.onHearing(shown);

        if (results.length > 0 && results.every((result) => result.isFinal)) {
          // The phrase is complete: search now, and let the browser close the
          // session in its own time rather than interrupting it.
          wanted.current = false;
          setListening(false);
          deliver(session);
          awaitClose(session, false);
        }
      };

      recognition.onerror = (event) => {
        const refusedLanguage =
          LANGUAGE_ERRORS.has(event.error) && !session.heard && attempt.current + 1 < languages.current.length;
        if (refusedLanguage) {
          attempt.current += 1;
          session.retryNextLanguage = true;
        } else if (event.error !== "aborted" && !(event.error === "no-speech" && session.heard)) {
          session.failure = ERROR_MESSAGES[event.error] ?? GENERIC_ERROR;
          wanted.current = false;
        }
        // Most browsers follow an error with the end signal; make sure of it without forcing.
        awaitClose(session, false);
      };

      recognition.onend = () => closed(session);

      try {
        recognition.start();
      } catch {
        wanted.current = false;
        setListening(false);
        setError(GENERIC_ERROR);
        return;
      }

      open.current = session;
      setListening(true);
      silenceTimer.current = setTimeout(() => awaitClose(session, true), MAX_LISTEN_MS);
    };
  }, [awaitClose, closed, deliver]);

  // Checked after mount so the server and the first client render agree.
  useEffect(() => {
    const frame = requestAnimationFrame(() => setSupported(Boolean(getRecognition())));

    // Leaving the page for another app or tab: ask politely, so the microphone is released.
    const onVisibility = () => {
      if (document.visibilityState !== "hidden") return;
      wanted.current = false;
      const session = open.current;
      if (session && !session.ended) {
        try {
          session.recognition.stop();
        } catch {
          // Already stopped.
        }
      }
    };
    // The page itself is going away, which is the one time a hard stop is right.
    const onPageHide = () => {
      wanted.current = false;
      try {
        open.current?.recognition.abort();
      } catch {
        // Already released.
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      clearTimers();
      onPageHide();
    };
  }, [clearTimers]);

  const stop = useCallback(() => {
    wanted.current = false;
    setListening(false);
    const session = open.current;
    if (session && !session.ended) awaitClose(session, true);
  }, [awaitClose]);

  const toggle = useCallback(() => {
    if (wanted.current) {
      stop();
      return;
    }

    wanted.current = true;
    taps.current += 1;
    setError(null);
    setListening(true);

    const options = speechLanguages(navigator.language);
    languages.current = provenLanguage.current
      ? [provenLanguage.current, ...options.filter((option) => option !== provenLanguage.current)]
      : options;
    attempt.current = 0;

    // If the last session is still closing, `closed` starts the new one the moment it has.
    if (!open.current) startSession.current();
  }, [stop]);

  return { supported, listening, error, toggle, stop };
}
