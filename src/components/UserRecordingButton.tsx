// src/components/UserRecordingButton.tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAudioRecorder } from "@/lib/hooks/useAudioRecorder";
import { addToUserDictionary, isInBaseDictionary } from "@/lib/dictionary";

interface UserRecordingButtonProps {
  wordId: string;
  word: string;
}

export default function UserRecordingButton({ wordId, word }: UserRecordingButtonProps) {
  const {
    isRecording,
    error,
    isSaving,
    startRecording,
    stopRecording,
    saveRecording,
    getRecording,
    deleteRecording,
  } = useAudioRecorder();

  const [hasRecording, setHasRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isUserWord, setIsUserWord] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Check for existing recording on mount
  useEffect(() => {
    const recording = getRecording(wordId);
    setHasRecording(!!recording);
    
    // Check if this is a user-added word
    setIsUserWord(!isInBaseDictionary(word));
    
    if (recording) {
      try {
        const base64 = recording.split(',')[1] || recording;
        const length = Math.floor(base64.length * 0.75);
        const duration = Math.round(length / 16000);
        setRecordingDuration(Math.min(duration, 60));
      } catch {
        setRecordingDuration(0);
      }
    }
  }, [wordId, word, getRecording]);

  // Recording timer
  useEffect(() => {
    if (isRecording) {
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime((t) => {
          const newTime = t + 1;
          if (newTime >= 60) {
            stopRecording();
            return 60;
          }
          return newTime;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (recordingTime > 0) {
        setRecordingDuration(recordingTime);
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording, recordingTime, stopRecording]);

  const handleRecord = useCallback(async () => {
    if (isRecording) {
      stopRecording();
      await new Promise((r) => setTimeout(r, 200));
      await saveRecording(wordId);
      setHasRecording(true);
      setRecordingDuration(recordingTime);
      
      // ✅ Եթե բառը հիմնական բառարանում չկա, ավելացնել օգտատերերի բառարանում
      if (!isInBaseDictionary(word)) {
        // Պարզեցված տարբերակ - կարող եք ավելացնել թարգմանությունները
        addToUserDictionary(word, word, word, "user");
        setIsUserWord(true);
      }
    } else {
      setRecordingTime(0);
      await startRecording();
    }
  }, [isRecording, stopRecording, saveRecording, wordId, recordingTime, startRecording, word]);

  const handlePlay = useCallback(() => {
    const base64 = getRecording(wordId);
    if (!base64) return;
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    
    try {
      const audio = new Audio(base64);
      audioRef.current = audio;
      setIsPlaying(true);
      
      audio.onended = () => {
        setIsPlaying(false);
        audioRef.current = null;
      };
      audio.onerror = () => {
        setIsPlaying(false);
        audioRef.current = null;
      };
      audio.play().catch(() => {
        setIsPlaying(false);
        audioRef.current = null;
      });
    } catch (err) {
      console.error('Playback error:', err);
      setIsPlaying(false);
    }
  }, [wordId, getRecording]);

  const handleDelete = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsPlaying(false);
    deleteRecording(wordId);
    setHasRecording(false);
    setRecordingDuration(0);
  }, [wordId, deleteRecording]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}s`;
  };

  return (
    <div className="flex items-center gap-1 pt-2 border-t border-white/10">
      <span className="text-xs text-white/30 mr-1">🎤</span>

      {/* Record / Stop button */}
      <button
        onClick={handleRecord}
        disabled={isSaving || (isRecording && recordingTime >= 60)}
        title={isRecording ? `Stop recording (${formatTime(recordingTime)})` : "Record your pronunciation"}
        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
          isRecording
            ? recordingTime >= 55
              ? "bg-red-600 text-white animate-pulse"
              : "bg-red-500/80 text-white animate-pulse"
            : hasRecording
            ? "bg-yellow-600/20 hover:bg-yellow-600/40 text-white/70 border border-yellow-600/30"
            : "bg-white/10 hover:bg-white/20 text-white/70"
        }`}
      >
        {isRecording ? (
          <>
            <span className="w-2 h-2 bg-white rounded-full animate-pulse inline-block" />
            {formatTime(recordingTime)}
          </>
        ) : isSaving ? (
          "⏳"
        ) : hasRecording ? (
          "🔄 Re-record"
        ) : (
          "🎤 Record"
        )}
      </button>

      {/* Play user recording */}
      {hasRecording && !isRecording && (
        <button
          onClick={handlePlay}
          disabled={isPlaying}
          title={isPlaying ? "Playing..." : `Play your recording (${formatTime(recordingDuration)})`}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
            isPlaying
              ? "bg-green-700 text-white animate-pulse"
              : "bg-green-600/20 hover:bg-green-600/40 text-white/70"
          }`}
        >
          {isPlaying ? "▶ ..." : "▶ Play"}
        </button>
      )}

      {/* Recording duration badge */}
      {hasRecording && !isRecording && recordingDuration > 0 && (
        <span className="text-[10px] text-white/30">
          {formatTime(recordingDuration)}
        </span>
      )}

      {/* Delete */}
      {hasRecording && !isRecording && (
        <button
          onClick={handleDelete}
          title="Delete your recording"
          className="px-2 py-1.5 rounded-lg text-xs text-red-400/60 hover:text-red-400 hover:bg-red-900/20 transition"
        >
          ✕
        </button>
      )}

      {/* User word indicator */}
      {isUserWord && hasRecording && (
        <span className="text-[10px] text-yellow-500" title="User-added word">
          ⭐
        </span>
      )}

      {/* Error indicator */}
      {error && (
        <span 
          className="text-xs text-red-400 ml-1 truncate max-w-[120px] cursor-help" 
          title={error}
        >
          ⚠️
        </span>
      )}

      {/* Max time warning */}
      {isRecording && recordingTime >= 55 && (
        <span className="text-[10px] text-yellow-400 animate-pulse">
          ⏰ max 60s
        </span>
      )}
    </div>
  );
}