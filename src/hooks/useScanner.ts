import { useEffect, useRef } from 'react';

export function useScanner(onScan: (scannedData: string) => void, timeoutMs: number = 50) {
  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTimeRef.current;

      // Reset buffer if time between keystrokes is too long (human typing vs scanner)
      if (timeDiff > timeoutMs) {
        bufferRef.current = '';
      }

      lastKeyTimeRef.current = currentTime;

      if (e.key === 'Enter') {
        // If the buffer has characters and was typed rapidly, it's a scan
        if (bufferRef.current.length >= 3) {
          onScan(bufferRef.current);

          // Prevent the Enter key from triggering unintended form submissions or clicks
          e.preventDefault();
        }
        // Clear buffer after enter
        bufferRef.current = '';
        return;
      }

      // Only capture printable single-character keys
      if (e.key.length === 1) {
        bufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Cleanup the event listener when component unmounts
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onScan, timeoutMs]);
}
