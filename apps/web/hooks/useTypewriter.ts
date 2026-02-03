import { useState, useEffect } from 'react';

interface UseTypewriterOptions {
  /**
   * Typing speed in milliseconds per character
   * @default 30
   */
  speed?: number;

  /**
   * Whether to start typing immediately
   * @default true
   */
  startImmediately?: boolean;

  /**
   * Callback when typing is complete
   */
  onComplete?: () => void;
}

/**
 * Hook for creating typewriter effect
 *
 * @example
 * ```tsx
 * const { displayedText, isTyping, reset, skip } = useTypewriter(
 *   "Hello, World!",
 *   { speed: 50 }
 * );
 *
 * return (
 *   <div onClick={skip}>
 *     {displayedText}
 *     {isTyping && <Cursor />}
 *   </div>
 * );
 * ```
 */
export function useTypewriter(
  text: string,
  options: UseTypewriterOptions = {}
) {
  const {
    speed = 30,
    startImmediately = true,
    onComplete
  } = options;

  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Start typing when text changes
  useEffect(() => {
    if (!text || !startImmediately) return;

    // Reset state
    setDisplayedText('');
    setCurrentIndex(0);
    setIsTyping(true);

    let index = 0;
    const interval = setInterval(() => {
      if (index < text.length) {
        setDisplayedText(text.slice(0, index + 1));
        setCurrentIndex(index + 1);
        index++;
      } else {
        setIsTyping(false);
        clearInterval(interval);
        onComplete?.();
      }
    }, speed);

    return () => {
      clearInterval(interval);
    };
  }, [text, speed, startImmediately, onComplete]);

  // Skip to end
  const skip = () => {
    setDisplayedText(text);
    setCurrentIndex(text.length);
    setIsTyping(false);
    onComplete?.();
  };

  // Reset typing
  const reset = () => {
    setDisplayedText('');
    setCurrentIndex(0);
    setIsTyping(true);
  };

  return {
    /** The currently displayed text */
    displayedText,
    /** Whether typing is in progress */
    isTyping,
    /** Current character index */
    currentIndex,
    /** Skip to the end */
    skip,
    /** Reset and start over */
    reset,
  };
}
