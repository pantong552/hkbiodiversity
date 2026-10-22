import { useEffect, useRef } from 'react';

export function useClickOutside<T extends HTMLElement = HTMLDivElement>(handler: () => void) {
  const domNode = useRef<T>(null);

  useEffect(() => {
    const maybeHandler = (event: MouseEvent) => {
      if (domNode.current && !domNode.current.contains(event.target as Node)) {
        handler();
      }
    };

    document.addEventListener('mousedown', maybeHandler);

    return () => {
      document.removeEventListener('mousedown', maybeHandler);
    };
  }, [handler]);

  return domNode;
}
