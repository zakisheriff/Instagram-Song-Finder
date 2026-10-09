"use client";

import { useEffect, useRef, useState } from "react";

interface DemoVideoProps {
  className?: string;
}

/** Size of public/demo.mp4; reserving it prevents layout shift. */
const WIDTH = 588;
const HEIGHT = 1280;

/** Starts playback, ignoring a refusal (autoplay blocked, or a browser with no video support). */
function start(element: HTMLVideoElement): void {
  try {
    void element.play()?.catch(() => undefined);
  } catch {
    // Nothing to do: the poster frame stays on screen.
  }
}

/**
 * A screen recording of the whole flow, shown inside a phone frame: search for
 * a song, copy its code, paste it into Instagram's music search and add the song.
 *
 * It uses the browser's own player, so visitors can pause, scrub back and
 * forth, turn the sound on and go full screen with controls they already know.
 * Browsers only let a video start by itself while it is silent, so it begins
 * muted, with a "Tap for sound" button over it until the sound is turned on. Nothing is downloaded until it scrolls into view; until then the
 * poster frame is shown. It pauses when it leaves the screen and resumes on
 * return, unless the visitor paused it themselves. Visitors who have asked
 * their device to reduce motion get no autoplay at all.
 */
export function DemoVideo({ className }: DemoVideoProps) {
  const video = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);

  // Keeps the "Tap for sound" button in step with the player's own mute control.
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    const sync = () => setMuted(element.muted || element.volume === 0);
    element.addEventListener("volumechange", sync);
    return () => element.removeEventListener("volumechange", sync);
  }, []);

  function turnSoundOn() {
    const element = video.current;
    if (!element) return;
    element.muted = false;
    if (element.volume === 0) element.volume = 1;
    setMuted(false);
    // A tap is also permission to play, in case autoplay was refused.
    start(element);
  }

  useEffect(() => {
    const element = video.current;
    if (!element) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    // Phones only allow a video to start by itself when it is muted and inline.
    element.muted = true;

    if (!("IntersectionObserver" in window)) {
      start(element);
      return;
    }

    /** True once it has played at least once, so a pause can be told apart from "not started". */
    let started = false;
    /** True when the visitor pressed pause; scrolling back must not override that. */
    let pausedByVisitor = false;
    /** True while this code is pausing it for being off screen. */
    let pausingForScroll = false;

    const onPlay = () => {
      started = true;
      pausedByVisitor = false;
    };
    const onPause = () => {
      if (!pausingForScroll && !element.ended) pausedByVisitor = true;
      pausingForScroll = false;
    };
    element.addEventListener("play", onPlay);
    element.addEventListener("pause", onPause);

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          if (!started || !pausedByVisitor) start(element);
        } else if (!element.paused) {
          pausingForScroll = true;
          element.pause();
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(element);

    return () => {
      observer.disconnect();
      element.removeEventListener("play", onPlay);
      element.removeEventListener("pause", onPause);
    };
  }, []);

  return (
    <div className={className ? `demo ${className}` : "demo"}>
      <span className="demo__bezel" aria-hidden="true" />
      <div className="demo__screen">
        <video
          ref={video}
          className="demo__video"
          width={WIDTH}
          height={HEIGHT}
          poster="/demo-poster.webp"
          preload="none"
          controls
          muted
          loop
          playsInline
          aria-label="Demo: searching for a song, copying its code and adding the song to an Instagram story"
        >
          <source src="/demo.mp4" type="video/mp4" />
        </video>
        {muted && (
          <button type="button" className="demo__sound" onClick={turnSoundOn}>
            Tap for sound
          </button>
        )}
      </div>
      <span className="demo__rim" aria-hidden="true" />
    </div>
  );
}
