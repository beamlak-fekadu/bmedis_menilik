'use client';

import { useEffect, useRef } from 'react';

// Drawer accessibility hook used by mobile sidebar, notification drawer,
// assistant panel, and any other slide-in panel.
//
// What it provides when `open === true`:
//  - Saves the previously focused element on open, restores it on close.
//  - Listens for Escape and calls onClose (skip with `disableEscape`).
//  - Constrains Tab / Shift+Tab to focusable elements inside the panel
//    (a minimal focus trap — no nested focus zones).
//  - Auto-focuses the first focusable element on open so screen readers
//    enter the panel cleanly.
//
// What it deliberately does NOT do:
//  - Doesn't lock background scroll (callers already handle this when
//    appropriate via `document.body.style.overflow`).
//  - Doesn't manage aria-modal / aria-label — set those on the panel yourself
//    so the semantics are visible in code.

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

type Options = {
  /** Skip the Escape→close handler (default: false). */
  disableEscape?: boolean;
  /** Skip auto-focus on open (default: false). Use when something inside the
   *  panel manages its own initial focus. */
  disableAutoFocus?: boolean;
};

export function useDrawerA11y<T extends HTMLElement = HTMLDivElement>(
  open: boolean,
  onClose: () => void,
  { disableEscape = false, disableAutoFocus = false }: Options = {},
) {
  const panelRef = useRef<T | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    if (typeof document === 'undefined') return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;

    // Auto-focus first focusable element so screen readers enter the panel.
    if (!disableAutoFocus && panelRef.current) {
      const first = panelRef.current.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      first?.focus();
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && !disableEscape) {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const nodes = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((node) => !node.hasAttribute('aria-hidden') && node.offsetParent !== null);
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      // Restore focus to the element that opened the drawer.
      previouslyFocused.current?.focus?.();
      previouslyFocused.current = null;
    };
  }, [open, onClose, disableEscape, disableAutoFocus]);

  return panelRef;
}
