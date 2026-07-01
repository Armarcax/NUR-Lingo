// src/lib/hooks/useAudioRecorder.ts
// NUR Lingo — Enhanced Audio Recording Hook with pause/resume/playback

"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { addToUserDictionary, isInBaseDictionary } from "@/lib/dictionary";

export interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  isPlaying: boolean;
  duration: number;
  audioURL: string | null;
  error: string | null;
  isSaving: boolean;
  audioLevel: number;
}

export interface RecordingOptions {
  mimeType?: string;
  audioBitsPerSecond?: number;
  onDurationChange?: (duration: number) => void;
  onLevelChange?: (level: number) => void;
}

const DEFAULT_OPTIONS: RecordingOptions = {
  mimeType: "audio/webm;codecs=opus",
  audioBitsPerSecond: 128000,
};

export function useAudioRecorder(options: RecordingOptions = {}) {
  const config = { ...DEFAULT_OPTIONS, ...options };

  const [state, setState] = useState<RecordingState>({
    isRecording: false,
    isPaused: false,
    isPlaying: false,
    duration: 0,
    audioURL: null,
    error: null,
    isSaving: false,
    audioLevel: 0,
  });

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedDurationRef = useRef<number>(0);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  // Cleanup function
  const cleanup = useCallback(() => {
    // Stop timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Stop animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    // Stop media stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    // Revoke audio URL
    if (state.audioURL) {
      URL.revokeObjectURL(state.audioURL);
    }
  }, [state.audioURL]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
      if (mediaRecorderRef.current && state.isRecording) {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // Ignore
        }
      }
    };
  }, [cleanup, state.isRecording]);

  // Audio level analysis
  const startAudioAnalysis = useCallback((stream: MediaStream) => {
    try {
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;

      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);

      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);

      const updateLevel = () => {
        if (!analyserRef.current) return;

        analyserRef.current.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        const normalizedLevel = Math.min(1, average / 128);

        setState((prev) => ({ ...prev, audioLevel: normalizedLevel }));
        options.onLevelChange?.(normalizedLevel);

        if (state.isRecording && !state.isPaused) {
          animationFrameRef.current = requestAnimationFrame(updateLevel);
        }
      };

      updateLevel();
    } catch (err) {
      console.warn("Audio analysis not available:", err);
    }
  }, [options, state.isRecording, state.isPaused]);

  // Start recording
  const startRecording = useCallback(async () => {
    setState((prev) => ({ ...prev, error: null }));

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      });

      streamRef.current = stream;

      // Determine supported MIME type
      let mimeType = config.mimeType;
      if (!MediaRecorder.isTypeSupported(mimeType!)) {
        mimeType = MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4";
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: config.audioBitsPerSecond,
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      pausedDurationRef.current = 0;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        // Handled separately
      };

      mediaRecorder.onerror = (event) => {
        console.error("MediaRecorder error:", event);
        setState((prev) => ({
          ...prev,
          error: "Recording error occurred",
          isRecording: false,
          isPaused: false,
        }));
      };

      mediaRecorder.start(100); // Collect data every 100ms
      startTimeRef.current = Date.now();

      setState((prev) => ({
        ...prev,
        isRecording: true,
        isPaused: false,
        duration: 0,
        audioLevel: 0,
      }));

      // Start duration timer
      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current - pausedDurationRef.current;
        const duration = Math.floor(elapsed / 1000);
        setState((prev) => ({ ...prev, duration }));
        options.onDurationChange?.(duration);
      }, 100);

      // Start audio analysis
      startAudioAnalysis(stream);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not access microphone";
      setState((prev) => ({ ...prev, error: message }));
    }
  }, [config, options, startAudioAnalysis]);

  // Pause recording
  const pauseRecording = useCallback(() => {
    if (!mediaRecorderRef.current || !state.isRecording || state.isPaused) {
      return;
    }

    try {
      mediaRecorderRef.current.pause();
      pausedDurationRef.current += Date.now() - startTimeRef.current - pausedDurationRef.current;

      // Stop timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      // Stop animation
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      setState((prev) => ({
        ...prev,
        isPaused: true,
        audioLevel: 0,
      }));
    } catch (err) {
      console.error("Pause error:", err);
      setState((prev) => ({ ...prev, error: "Failed to pause recording" }));
    }
  }, [state.isRecording, state.isPaused]);

  // Resume recording
  const resumeRecording = useCallback(() => {
    if (!mediaRecorderRef.current || !state.isPaused) {
      return;
    }

    try {
      mediaRecorderRef.current.resume();

      setState((prev) => ({
        ...prev,
        isPaused: false,
      }));

      // Restart timer
      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current - pausedDurationRef.current;
        const duration = Math.floor(elapsed / 1000);
        setState((prev) => ({ ...prev, duration }));
        options.onDurationChange?.(duration);
      }, 100);

      // Restart audio analysis if stream exists
      if (streamRef.current) {
        startAudioAnalysis(streamRef.current);
      }
    } catch (err) {
      console.error("Resume error:", err);
      setState((prev) => ({ ...prev, error: "Failed to resume recording" }));
    }
  }, [state.isPaused, options, startAudioAnalysis]);

  // Stop recording
  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current || !state.isRecording) {
        resolve(null);
        return;
      }

      mediaRecorderRef.current.onstop = () => {
        // Stop timer
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        // Stop animation
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }

        // Stop stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }

        // Create blob
        const blob = new Blob(chunksRef.current, { type: mediaRecorderRef.current?.mimeType || "audio/webm" });
        const url = URL.createObjectURL(blob);

        // Cleanup old URL
        if (state.audioURL) {
          URL.revokeObjectURL(state.audioURL);
        }

        setState((prev) => ({
          ...prev,
          isRecording: false,
          isPaused: false,
          audioURL: url,
          audioLevel: 0,
        }));

        resolve(blob);
      };

      try {
        mediaRecorderRef.current.stop();
      } catch (err) {
        console.error("Stop error:", err);
        setState((prev) => ({
          ...prev,
          error: "Failed to stop recording",
          isRecording: false,
          isPaused: false,
        }));
        resolve(null);
      }
    });
  }, [state.isRecording, state.audioURL]);

  // Save recording to storage
  const saveRecording = useCallback(
    async (key: string, word?: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (chunksRef.current.length === 0) {
          const errMsg = "No recording data available";
          setState((prev) => ({ ...prev, error: errMsg }));
          reject(new Error(errMsg));
          return;
        }

        setState((prev) => ({ ...prev, isSaving: true, error: null }));

        try {
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          const reader = new FileReader();

          reader.onloadend = () => {
            try {
              const base64 = reader.result as string;
              const recordings = JSON.parse(
                localStorage.getItem("userAudioRecordings") || "{}"
              );
              recordings[key] = {
                data: base64,
                duration: state.duration,
                timestamp: Date.now(),
                word: word || null,
              };
              localStorage.setItem("userAudioRecordings", JSON.stringify(recordings));

              // Add to user dictionary if word not in base dictionary
              if (word && !isInBaseDictionary(word)) {
                addToUserDictionary(word, word, word, "user").then((result) => {
                  if (result) {
                    console.log(`✅ "${word}" added to user dictionary`);
                  }
                });
              }

              chunksRef.current = [];
              setState((prev) => ({ ...prev, isSaving: false }));
              resolve();
            } catch (err) {
              const msg = err instanceof Error ? err.message : "Save error";
              setState((prev) => ({ ...prev, error: msg, isSaving: false }));
              reject(err);
            }
          };

          reader.onerror = () => {
            const msg = "Failed to read recording";
            setState((prev) => ({ ...prev, error: msg, isSaving: false }));
            reject(new Error(msg));
          };

          reader.readAsDataURL(blob);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          setState((prev) => ({ ...prev, error: msg, isSaving: false }));
          reject(err);
        }
      });
    },
    [state.duration]
  );

  // Get recording from storage
  const getRecording = useCallback((key: string): { data: string; duration: number } | null => {
    try {
      const recordings = JSON.parse(localStorage.getItem("userAudioRecordings") || "{}");
      const entry = recordings[key];
      if (entry) {
        return {
          data: entry.data,
          duration: entry.duration || 0,
        };
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  // Play saved recording
  const playRecording = useCallback(
    (key: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        const recording = getRecording(key);
        if (!recording) {
          setState((prev) => ({ ...prev, error: "Recording not found" }));
          reject(new Error("Recording not found"));
          return;
        }

        // Stop any currently playing audio
        if (audioElementRef.current) {
          audioElementRef.current.pause();
          audioElementRef.current = null;
        }

        try {
          const audio = new Audio(recording.data);
          audioElementRef.current = audio;

          setState((prev) => ({ ...prev, isPlaying: true }));

          audio.onended = () => {
            setState((prev) => ({ ...prev, isPlaying: false }));
            audioElementRef.current = null;
            resolve();
          };

          audio.onerror = () => {
            setState((prev) => ({ ...prev, error: "Playback error", isPlaying: false }));
            audioElementRef.current = null;
            reject(new Error("Playback error"));
          };

          audio.play().catch((err) => {
            setState((prev) => ({ ...prev, error: "Failed to play", isPlaying: false }));
            reject(err);
          });
        } catch (err) {
          setState((prev) => ({ ...prev, error: "Audio creation error" }));
          reject(err);
        }
      });
    },
    [getRecording]
  );

  // Play current recording (from state)
  const playCurrentRecording = useCallback((): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!state.audioURL) {
        setState((prev) => ({ ...prev, error: "No recording to play" }));
        reject(new Error("No recording"));
        return;
      }

      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current = null;
      }

      try {
        const audio = new Audio(state.audioURL);
        audioElementRef.current = audio;

        setState((prev) => ({ ...prev, isPlaying: true }));

        audio.onended = () => {
          setState((prev) => ({ ...prev, isPlaying: false }));
          audioElementRef.current = null;
          resolve();
        };

        audio.onerror = () => {
          setState((prev) => ({ ...prev, error: "Playback error", isPlaying: false }));
          audioElementRef.current = null;
          reject(new Error("Playback error"));
        };

        audio.play().catch(reject);
      } catch (err) {
        reject(err);
      }
    });
  }, [state.audioURL]);

  // Stop playback
  const stopPlayback = useCallback(() => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.currentTime = 0;
      audioElementRef.current = null;
    }
    setState((prev) => ({ ...prev, isPlaying: false }));
  }, []);

  // Delete recording
  const deleteRecording = useCallback((key: string) => {
    try {
      const recordings = JSON.parse(localStorage.getItem("userAudioRecordings") || "{}");
      delete recordings[key];
      localStorage.setItem("userAudioRecordings", JSON.stringify(recordings));

      if (state.audioURL) {
        URL.revokeObjectURL(state.audioURL);
        setState((prev) => ({ ...prev, audioURL: null }));
      }
    } catch {
      setState((prev) => ({ ...prev, error: "Failed to delete recording" }));
    }
  }, [state.audioURL]);

  // Generate unique key
  const generateKey = useCallback((prefix = "recording") => {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  }, []);

  // Get all recordings
  const getAllRecordings = useCallback(() => {
    try {
      return JSON.parse(localStorage.getItem("userAudioRecordings") || "{}");
    } catch {
      return {};
    }
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    saveRecording,
    getRecording,
    playRecording,
    playCurrentRecording,
    stopPlayback,
    deleteRecording,
    generateKey,
    getAllRecordings,
    clearError,
    checkWordInBase: isInBaseDictionary,
  };
}
