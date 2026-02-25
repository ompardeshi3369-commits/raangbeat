import { useState, useEffect, useRef } from "react";
import { usePlayer } from "@/contexts/PlayerContext";

interface AudioAnalyzerResult {
  frequencyData: number[];
  isConnected: boolean;
}

export function useAudioAnalyzer(barCount: number = 40, isActive: boolean = true): AudioAnalyzerResult {
  const { isPlaying, analyser: sharedAnalyser } = usePlayer();
  const [frequencyData, setFrequencyData] = useState<number[]>(
    Array(barCount).fill(0)
  );
  const animationRef = useRef<number>();

  useEffect(() => {
    // Return idle state when not playing or NOT ACTIVE for this component
    if (!sharedAnalyser || !isPlaying || !isActive) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      return;
    }

    const bufferLength = sharedAnalyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const animate = () => {
      sharedAnalyser.getByteFrequencyData(dataArray);

      // Map frequency data to bar count
      const step = Math.floor(bufferLength / barCount);
      const newData: number[] = [];

      for (let i = 0; i < barCount; i++) {
        // Average frequencies for each bar
        let sum = 0;
        for (let j = 0; j < step; j++) {
          sum += dataArray[i * step + j] || 0;
        }
        // Normalize to 0-100 range
        newData.push(Math.min(100, (sum / step / 255) * 100 * 1.5));
      }

      setFrequencyData(newData);
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [sharedAnalyser, isPlaying, barCount, isActive]);

  return { frequencyData, isConnected: !!sharedAnalyser };
}
