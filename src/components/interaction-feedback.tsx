"use client";

import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";

type FeedbackSound = "tick" | "success";

export function InteractionFeedback() {
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    function handleFeedback(event: Event) {
      const detail = event instanceof CustomEvent ? event.detail : null;
      const sound = detail?.sound === "success" ? "success" : "tick";
      navigator.vibrate?.(detail?.haptic === "strong" ? 24 : 10);
      playFeedbackSound(audioContextRef, sound);
    }

    function handlePointerUp(event: PointerEvent) {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) {
        return;
      }

      const feedbackTarget = target.closest<HTMLElement>(
        "button:not([disabled]), [role='button'], a[data-haptic], [data-haptic]",
      );
      if (!feedbackTarget || feedbackTarget.dataset.haptic === "false") {
        return;
      }

      navigator.vibrate?.(feedbackTarget.dataset.haptic === "strong" ? 18 : 8);

      const sound = feedbackTarget.dataset.sound as FeedbackSound | undefined;
      if (sound) {
        playFeedbackSound(audioContextRef, sound);
      }
    }

    window.addEventListener("fkh:feedback", handleFeedback);
    window.addEventListener("pointerup", handlePointerUp, { passive: true });
    return () => {
      window.removeEventListener("fkh:feedback", handleFeedback);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, []);

  return null;
}

function playFeedbackSound(
  audioContextRef: MutableRefObject<AudioContext | null>,
  sound: FeedbackSound,
) {
  const AudioContextCtor = window.AudioContext ?? window.webkitAudioContext;
  if (!AudioContextCtor) {
    return;
  }

  const context = audioContextRef.current ?? new AudioContextCtor();
  audioContextRef.current = context;

  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = sound === "success" ? 740 : 520;
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(
    sound === "success" ? 0.035 : 0.018,
    context.currentTime + 0.01,
  );
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.11);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.12);
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
