// src/lib/hooks/useAudioRecorder.ts
"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { addToUserDictionary, isInBaseDictionary } from "@/lib/dictionary";

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // Ազատել Blob URL-ը
  const revokeAudioURL = useCallback(() => {
    if (audioURL) {
      URL.revokeObjectURL(audioURL);
      setAudioURL(null);
    }
  }, [audioURL]);

  // Մաքրում component-ի unmount-ի ժամանակ
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && isRecording) {
        try {
          mediaRecorderRef.current.stop();
        } catch (_) {
          // ignore
        }
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      revokeAudioURL();
    };
  }, [isRecording, revokeAudioURL]);

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Միկրոֆոնի հասանելիություն չի ստացվել";
      setError(message);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        setError("Ձայնագրությունը դադարեցնելիս սխալ տեղի ունեցավ");
      } finally {
        setIsRecording(false);
      }
    }
  }, [isRecording]);

  // ✅ Պահպանել ձայնագրությունը localStorage-ում և ավելացնել բառը բառարանում
  const saveRecording = useCallback(
    async (key: string, word?: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (chunksRef.current.length === 0) {
          const errMsg = "Ձայնագրության տվյալներ չկան";
          setError(errMsg);
          reject(new Error(errMsg));
          return;
        }

        setIsSaving(true);
        setError(null);

        try {
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          const reader = new FileReader();

          reader.onloadend = () => {
            try {
              const base64 = reader.result as string;
              const recordings = JSON.parse(
                localStorage.getItem("userAudioRecordings") || "{}"
              );
              recordings[key] = base64;
              localStorage.setItem(
                "userAudioRecordings",
                JSON.stringify(recordings)
              );

              // ✅ Եթե word-ը փոխանցված է և բառը հիմնական բառարանում չկա,
              // ավելացնել օգտատերերի բառարանում
              if (word && !isInBaseDictionary(word)) {
                // Ստուգել, արդյոք արդեն ավելացված է
                const existing = addToUserDictionary(word, word, word, "user");
                if (existing) {
                  console.log(`✅ "${word}" ավելացվել է օգտատերերի բառարանում`);
                }
              }

              chunksRef.current = [];
              revokeAudioURL();
              setIsSaving(false);
              resolve();
            } catch (err) {
              const msg =
                err instanceof Error ? err.message : "Պահպանման սխալ";
              setError(msg);
              setIsSaving(false);
              reject(err);
            }
          };

          reader.onerror = () => {
            const msg = "Ֆայլի ընթերցման սխալ";
            setError(msg);
            setIsSaving(false);
            reject(new Error(msg));
          };

          reader.readAsDataURL(blob);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Անհայտ սխալ";
          setError(msg);
          setIsSaving(false);
          reject(err);
        }
      });
    },
    [revokeAudioURL]
  );

  // ✅ saveRecording-ի պարզեցված տարբերակ (առանց word-ի)
  const saveRecordingSimple = useCallback(
    (key: string): Promise<void> => {
      return saveRecording(key, undefined);
    },
    [saveRecording]
  );

  // Ստանալ ձայնագրությունը base64 տողով
  const getRecording = useCallback((key: string): string | null => {
    try {
      const recordings = JSON.parse(
        localStorage.getItem("userAudioRecordings") || "{}"
      );
      return recordings[key] || null;
    } catch {
      return null;
    }
  }, []);

  // Նվագարկել ձայնագրությունը
  const playRecording = useCallback(
    (key: string) => {
      const base64 = getRecording(key);
      if (!base64) {
        setError("Ձայնագրությունը չի գտնվել");
        return;
      }
      try {
        const audio = new Audio(base64);
        audio.play().catch(() => {
          setError("Նվագարկման սխալ");
        });
      } catch {
        setError("Աուդիո ստեղծման սխալ");
      }
    },
    [getRecording]
  );

  // Ջնջել ձայնագրությունը
  const deleteRecording = useCallback(
    (key: string) => {
      try {
        const recordings = JSON.parse(
          localStorage.getItem("userAudioRecordings") || "{}"
        );
        delete recordings[key];
        localStorage.setItem(
          "userAudioRecordings",
          JSON.stringify(recordings)
        );
        revokeAudioURL();
      } catch {
        setError("Ջնջման սխալ");
      }
    },
    [revokeAudioURL]
  );

  // Ստեղծել եզակի բանալի
  const generateKey = useCallback((prefix = "recording") => {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  }, []);

  // ✅ Ստուգել, արդյոք բառը հիմնական բառարանում է
  const checkWordInBase = useCallback((word: string): boolean => {
    return isInBaseDictionary(word);
  }, []);

  // ✅ Ստանալ բոլոր ձայնագրությունները
  const getAllRecordings = useCallback(() => {
    try {
      return JSON.parse(
        localStorage.getItem("userAudioRecordings") || "{}"
      );
    } catch {
      return {};
    }
  }, []);

  return {
    isRecording,
    audioURL,
    error,
    isSaving,
    startRecording,
    stopRecording,
    saveRecording,
    saveRecordingSimple,
    getRecording,
    playRecording,
    deleteRecording,
    generateKey,
    revokeAudioURL,
    checkWordInBase,
    getAllRecordings,
  };
}