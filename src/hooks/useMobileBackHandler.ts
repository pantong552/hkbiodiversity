'use client';

import { useEffect, useId, useRef } from 'react';

interface BackEntry {
  id: string;
  onBack: () => void;
  closingManually: boolean;
  backTimer: ReturnType<typeof setTimeout> | null;
}

const backStack: BackEntry[] = [];
let popstateListenerAttached = false;

function handlePopState() {
  const entry = backStack.pop();
  if (entry) {
    const shouldClose = !entry.closingManually;
    entry.closingManually = true;
    if (entry.backTimer) clearTimeout(entry.backTimer);
    entry.backTimer = null;
    if (shouldClose) entry.onBack();
  }

  if (backStack.length === 0 && popstateListenerAttached) {
    window.removeEventListener('popstate', handlePopState);
    popstateListenerAttached = false;
  }
}

function attachPopstateListener() {
  if (popstateListenerAttached) return;
  window.addEventListener('popstate', handlePopState);
  popstateListenerAttached = true;
}

export function useMobileBackHandler(
  active: boolean,
  onBack: () => void,
  maxWidth = 1100,
) {
  const id = useId();
  const onBackRef = useRef(onBack);

  useEffect(() => {
    onBackRef.current = onBack;
  }, [onBack]);

  useEffect(() => {
    if (!active || window.innerWidth > maxWidth) return;

    let entry = backStack.find((item) => item.id === id);
    if (entry) {
      if (entry.backTimer) clearTimeout(entry.backTimer);
      entry.backTimer = null;
      entry.closingManually = false;
      entry.onBack = () => onBackRef.current();
    } else {
      const currentState = window.history.state;
      const state = currentState && typeof currentState === 'object'
        ? { ...currentState, __mobileBackOverlayId: id }
        : { __mobileBackOverlayId: id };
      window.history.pushState(state, '');
      entry = {
        id,
        onBack: () => onBackRef.current(),
        closingManually: false,
        backTimer: null,
      };
      backStack.push(entry);
    }
    attachPopstateListener();

    return () => {
      if (!entry || entry.closingManually) return;
      entry.closingManually = true;
      entry.backTimer = setTimeout(() => {
        entry!.backTimer = null;
        if (backStack[backStack.length - 1] === entry) {
          window.history.back();
        } else {
          const index = backStack.indexOf(entry!);
          if (index !== -1) backStack.splice(index, 1);
        }
      }, 0);
    };
  }, [active, id, maxWidth]);
}
