'use client';

import { useEffect } from 'react';

export default function PwaRegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
        // Service worker registration is optional for normal site usage.
      });
    }
  }, []);

  return null;
}