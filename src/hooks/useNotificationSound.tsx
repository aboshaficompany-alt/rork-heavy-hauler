import { useCallback, useRef, useEffect } from 'react';

// Create notification sound using Web Audio API
const createNotificationSound = (audioContext: AudioContext) => {
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
  oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1);
  oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.2);
  
  gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
  
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.5);
};

export function useNotificationSound() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const isEnabledRef = useRef(true);

  // Initialize audio context on first user interaction
  const initAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContextRef.current;
  }, []);

  // Play notification sound
  const playNotification = useCallback(() => {
    if (!isEnabledRef.current) return;

    try {
      const context = initAudioContext();
      if (context.state === 'suspended') {
        context.resume();
      }
      createNotificationSound(context);
    } catch (error) {
      console.error('Error playing notification sound:', error);
    }
  }, [initAudioContext]);

  // Play success sound (higher pitch, happy tone)
  const playSuccess = useCallback(() => {
    if (!isEnabledRef.current) return;

    try {
      const context = initAudioContext();
      if (context.state === 'suspended') {
        context.resume();
      }

      const oscillator = context.createOscillator();
      const gainNode = context.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(context.destination);
      
      oscillator.frequency.setValueAtTime(523.25, context.currentTime); // C5
      oscillator.frequency.setValueAtTime(659.25, context.currentTime + 0.1); // E5
      oscillator.frequency.setValueAtTime(783.99, context.currentTime + 0.2); // G5
      
      gainNode.gain.setValueAtTime(0.3, context.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.4);
      
      oscillator.start(context.currentTime);
      oscillator.stop(context.currentTime + 0.4);
    } catch (error) {
      console.error('Error playing success sound:', error);
    }
  }, [initAudioContext]);

  // Play alert sound (urgent tone)
  const playAlert = useCallback(() => {
    if (!isEnabledRef.current) return;

    try {
      const context = initAudioContext();
      if (context.state === 'suspended') {
        context.resume();
      }

      // Play two beeps
      for (let i = 0; i < 2; i++) {
        const oscillator = context.createOscillator();
        const gainNode = context.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(context.destination);
        
        oscillator.frequency.setValueAtTime(1200, context.currentTime + i * 0.3);
        
        gainNode.gain.setValueAtTime(0, context.currentTime + i * 0.3);
        gainNode.gain.linearRampToValueAtTime(0.4, context.currentTime + i * 0.3 + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + i * 0.3 + 0.2);
        
        oscillator.start(context.currentTime + i * 0.3);
        oscillator.stop(context.currentTime + i * 0.3 + 0.2);
      }
    } catch (error) {
      console.error('Error playing alert sound:', error);
    }
  }, [initAudioContext]);

  // Toggle sound on/off
  const toggleSound = useCallback((enabled: boolean) => {
    isEnabledRef.current = enabled;
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  return {
    playNotification,
    playSuccess,
    playAlert,
    toggleSound,
    initAudioContext
  };
}