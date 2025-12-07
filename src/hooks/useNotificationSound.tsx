import { useCallback, useRef, useEffect } from 'react';

type SoundType = 'notification' | 'success' | 'alert' | 'bidAccepted' | 'bidRejected' | 'nearLocation' | 'tripComplete';

// Sound configurations
const soundConfigs: Record<SoundType, { frequencies: number[]; durations: number[]; volume: number }> = {
  notification: {
    frequencies: [800, 1000, 800],
    durations: [0.1, 0.1, 0.1],
    volume: 0.3
  },
  success: {
    frequencies: [523.25, 659.25, 783.99], // C5, E5, G5 - Major chord
    durations: [0.1, 0.1, 0.2],
    volume: 0.3
  },
  alert: {
    frequencies: [1200, 1200],
    durations: [0.15, 0.15],
    volume: 0.4
  },
  bidAccepted: {
    frequencies: [440, 554.37, 659.25, 880], // A4, C#5, E5, A5 - Rising happy
    durations: [0.1, 0.1, 0.1, 0.3],
    volume: 0.35
  },
  bidRejected: {
    frequencies: [440, 349.23, 293.66], // A4, F4, D4 - Falling sad
    durations: [0.15, 0.15, 0.3],
    volume: 0.25
  },
  nearLocation: {
    frequencies: [880, 1046.5, 880, 1046.5], // A5, C6 - Attention
    durations: [0.08, 0.08, 0.08, 0.15],
    volume: 0.4
  },
  tripComplete: {
    frequencies: [523.25, 659.25, 783.99, 1046.5, 1318.51], // C5, E5, G5, C6, E6 - Victory
    durations: [0.1, 0.1, 0.1, 0.15, 0.4],
    volume: 0.35
  }
};

// Create sound with specific configuration
const createSound = (audioContext: AudioContext, type: SoundType) => {
  const config = soundConfigs[type];
  let currentTime = audioContext.currentTime;

  config.frequencies.forEach((freq, index) => {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(freq, currentTime);
    
    gainNode.gain.setValueAtTime(0, currentTime);
    gainNode.gain.linearRampToValueAtTime(config.volume, currentTime + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.01, currentTime + config.durations[index]);
    
    oscillator.start(currentTime);
    oscillator.stop(currentTime + config.durations[index]);
    
    currentTime += config.durations[index] * 0.8; // Slight overlap for smoother sound
  });
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

  // Generic play sound function
  const playSound = useCallback((type: SoundType) => {
    if (!isEnabledRef.current) return;

    try {
      const context = initAudioContext();
      if (context.state === 'suspended') {
        context.resume();
      }
      createSound(context, type);
    } catch (error) {
      console.error(`Error playing ${type} sound:`, error);
    }
  }, [initAudioContext]);

  // Specific sound functions
  const playNotification = useCallback(() => playSound('notification'), [playSound]);
  const playSuccess = useCallback(() => playSound('success'), [playSound]);
  const playAlert = useCallback(() => playSound('alert'), [playSound]);
  const playBidAccepted = useCallback(() => playSound('bidAccepted'), [playSound]);
  const playBidRejected = useCallback(() => playSound('bidRejected'), [playSound]);
  const playNearLocation = useCallback(() => playSound('nearLocation'), [playSound]);
  const playTripComplete = useCallback(() => playSound('tripComplete'), [playSound]);

  // Toggle sound on/off
  const toggleSound = useCallback((enabled: boolean) => {
    isEnabledRef.current = enabled;
  }, []);

  // Get current enabled state
  const isEnabled = useCallback(() => isEnabledRef.current, []);

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
    playBidAccepted,
    playBidRejected,
    playNearLocation,
    playTripComplete,
    toggleSound,
    isEnabled,
    initAudioContext
  };
}