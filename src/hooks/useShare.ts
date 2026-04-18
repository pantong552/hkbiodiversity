import { useState, useCallback } from 'react';

/**
 * Hook to handle sharing functionality with fallback to clipboard
 */
export function useShare() {
  const [isCopied, setIsCopied] = useState(false);

  const share = useCallback(async (data: { title?: string; text?: string; url: string }) => {
    // 1. Try Native Share API first
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: data.title,
          text: data.text,
          url: data.url,
        });
        return { success: true, method: 'native' };
      } catch (err) {
        // If user cancelled, don't fallback to clipboard
        if ((err as Error).name === 'AbortError') {
          return { success: false, method: 'cancelled' };
        }
        console.error('Native share failed:', err);
      }
    }

    // 2. Fallback to Clipboard API
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(data.url);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000); // Reset toast after 2s
        return { success: true, method: 'clipboard' };
      } catch (err) {
        console.error('Clipboard copy failed:', err);
      }
    }

    return { success: false, method: 'none' };
  }, []);

  return { share, isCopied };
}
