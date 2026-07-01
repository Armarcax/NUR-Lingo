"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAudioRecorder } from "@/lib/hooks/useAudioRecorder";

interface UserRecordingButtonProps {
  wordId: string;
  word?: string;
  onSave?: (key: string) => void;
  className?: string;
}

export default function UserRecordingButton({
  wordId,
  word,
  onSave,
  className = "",
}: UserRecordingButtonProps) {
  const {
    isRecording,
    isPaused,
    isPlaying,
    duration,
    audioLevel,
    error,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    playCurrentRecording,
    stopPlayback,
    saveRecording,
    getRecording,
    clearError,
  } = useAudioRecorder({
    onDurationChange: (d) => console.log(`Recording: ${d}s`),
  });

  const [hasLocalRecording, setHasLocalRecording] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Check if recording exists for this word
  useEffect(() => {
    const recording = getRecording(wordId);
    setHasLocalRecording(!!recording);
  }, [wordId, getRecording]);

  // Format duration as MM:SS
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Main button click handler
  const handleClick = useCallback(async () => {
    if (isRecording) {
      if (isPaused) {
        resumeRecording();
      } else {
        pauseRecording();
      }
    } else if (isPlaying) {
      stopPlayback();
    } else if (audioLevel > 0 || duration > 0) {
      // Has unsaved recording - play it
      await playCurrentRecording();
    } else {
      // Start new recording
      await startRecording();
    }
  }, [isRecording, isPaused, isPlaying, audioLevel, duration, pauseRecording, resumeRecording, stopPlayback, playCurrentRecording, startRecording]);

  // Stop and save
  const handleStopAndSave = useCallback(async () => {
    const blob = await stopRecording();
    if (blob && word) {
      try {
        await saveRecording(wordId, word);
        setHasLocalRecording(true);
        onSave?.(wordId);
      } catch (err) {
        console.error("Failed to save recording:", err);
      }
    }
  }, [stopRecording, saveRecording, wordId, word, onSave]);

  // Discard recording
  const handleDiscard = useCallback(async () => {
    await stopRecording();
    clearError();
  }, [stopRecording, clearError]);

  // Play saved recording
  const playSavedRecording = useCallback(() => {
    const recording = getRecording(wordId);
    if (!recording) return;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    try {
      const audio = new Audio(recording.data);
      audioRef.current = audio;
      audio.play().catch(console.error);
    } catch {
      console.error("Failed to play saved recording");
    }
  }, [wordId, getRecording]);

  // Get button state
  const getButtonState = () => {
    if (isRecording && !isPaused) return "recording";
    if (isRecording && isPaused) return "paused";
    if (isPlaying) return "playing";
    if (duration > 0) return "preview";
    if (hasLocalRecording) return "saved";
    return "idle";
  };

  const buttonState = getButtonState();

  return (
    <div className={`relative ${className}`}>
      {/* Main recording button */}
      <div className="flex items-center gap-2">
        {/* Animated audio level indicator */}
        <AnimatePresence>
          {isRecording && !isPaused && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              className="flex items-center gap-1"
            >
              <div
                className="w-1 bg-primary rounded-full transition-all duration-75"
                style={{ height: `${8 + audioLevel * 24}px` }}
              />
              <div
                className="w-1 bg-primary rounded-full transition-all duration-75"
                style={{ height: `${8 + audioLevel * 16}px` }}
              />
              <div
                className="w-1 bg-primary rounded-full transition-all duration-75"
                style={{ height: `${8 + audioLevel * 20}px` }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Duration display */}
        {(duration > 0 || isPaused) && (
          <span className="text-sm font-mono text-[var(--color-text-secondary)]">
            {formatDuration(duration)}
          </span>
        )}

        {/* Main button */}
        <motion.button
          onClick={handleClick}
          whileTap={{ scale: 0.95 }}
          className={`relative w-12 h-12 rounded-full flex items-center justify-center transition-all ${
            buttonState === "recording"
              ? "bg-error text-white shadow-lg animate-pulse"
              : buttonState === "paused"
                ? "bg-warning text-black shadow-lg"
                : buttonState === "playing"
                  ? "bg-success text-white shadow-lg"
                  : buttonState === "preview"
                    ? "bg-accent text-white"
                    : "bg-primary/20 text-primary hover:bg-primary/30"
          }`}
        >
          {buttonState === "recording" && (
            <div className="w-4 h-4 bg-white rounded-sm" />
          )}
          {buttonState === "paused" && (
            <div className="flex gap-1">
              <div className="w-1 h-4 bg-black rounded-sm" />
              <div className="w-1 h-4 bg-black rounded-sm" />
            </div>
          )}
          {buttonState === "playing" && (
            <span className="text-lg">⏸️</span>
          )}
          {buttonState === "preview" && (
            <span className="text-lg">▶️</span>
          )}
          {buttonState === "saved" && (
            <span className="text-lg">🎤</span>
          )}
          {buttonState === "idle" && (
            <span className="text-lg">🎤</span>
          )}
        </motion.button>

        {/* Control buttons when recording/paused */}
        <AnimatePresence>
          {(buttonState === "recording" || buttonState === "paused") && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="flex gap-2"
            >
              {/* Stop and save */}
              <button
                onClick={handleStopAndSave}
                className="w-10 h-10 rounded-full bg-success text-white flex items-center justify-center hover:bg-success/80 transition-colors"
                title="Save recording"
              >
                ✓
              </button>
              {/* Discard */}
              <button
                onClick={handleDiscard}
                className="w-10 h-10 rounded-full bg-error/20 text-error flex items-center justify-center hover:bg-error/30 transition-colors"
                title="Discard recording"
              >
                ✕
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Play saved recording button */}
        {buttonState === "saved" && (
          <button
            onClick={playSavedRecording}
            className="w-10 h-10 rounded-full bg-success/20 text-success flex items-center justify-center hover:bg-success/30 transition-colors"
            title="Play saved recording"
          >
            ▶️
          </button>
        )}
      </div>

      {/* Error message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full mt-2 left-0 right-0 text-center text-xs text-error"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
