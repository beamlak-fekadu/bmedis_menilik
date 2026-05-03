'use client';

import { useId, useState } from 'react';

type LineClamp = 1 | 2 | 3 | 4 | 5 | 6;

const LINE_CLAMP_CLASS: Record<LineClamp, string> = {
  1: 'line-clamp-1',
  2: 'line-clamp-2',
  3: 'line-clamp-3',
  4: 'line-clamp-4',
  5: 'line-clamp-5',
  6: 'line-clamp-6',
};

export interface ExpandableTextProps {
  text: string;
  lines?: LineClamp;
  className?: string;
  expandLabel?: string;
  collapseLabel?: string;
  buttonClassName?: string;
}

export default function ExpandableText({
  text,
  lines = 2,
  className = '',
  expandLabel = 'Show more',
  collapseLabel = 'Show less',
  buttonClassName = 'ml-1 text-violet-400 hover:text-violet-300',
}: ExpandableTextProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  if (!text?.trim()) return null;

  return (
    <span className={`block min-w-0 ${className}`}>
      <span
        id={id}
        className={open ? 'whitespace-pre-wrap break-words' : `${LINE_CLAMP_CLASS[lines]} break-words`}
      >
        {text}
      </span>
      <button
        type="button"
        className={`text-xs font-medium ${buttonClassName}`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? collapseLabel : expandLabel}
      </button>
    </span>
  );
}
