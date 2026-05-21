'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, FileText, Search, X } from 'lucide-react';
import type { GlobalSearchGroup, GlobalSearchResult } from '@/services/global-search.service';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const EMPTY_GROUPS: GlobalSearchGroup[] = [];

function flatten(groups: GlobalSearchGroup[]): GlobalSearchResult[] {
  return groups.flatMap((group) => group.results);
}

export default function GlobalSearchPalette({ open, onOpenChange }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState('');
  const [groups, setGroups] = useState<GlobalSearchGroup[]>(EMPTY_GROUPS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const results = useMemo(() => flatten(groups), [groups]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        onOpenChange(true);
      }
      if (event.key === 'Escape' && open) {
        event.preventDefault();
        onOpenChange(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onOpenChange, open]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const term = query.trim();
    setActiveIndex(0);
    if (term.length < 2) {
      setGroups(EMPTY_GROUPS);
      setError(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(term)}`, {
          signal: controller.signal,
        });
        const json = await response.json().catch(() => ({}));
        if (!response.ok) {
          console.error('[global-search] search failed', json);
          throw new Error(json?.detail || json?.error || 'Search could not load results');
        }
        setGroups((json.groups ?? []) as GlobalSearchGroup[]);
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        console.error('[global-search] search failed', err);
        setError('Search could not load results');
        setGroups(EMPTY_GROUPS);
      } finally {
        setLoading(false);
      }
    }, 180);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, query]);

  function openResult(result: GlobalSearchResult) {
    onOpenChange(false);
    setQuery('');
    setGroups(EMPTY_GROUPS);
    router.push(result.href);
  }

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((idx) => Math.min(results.length - 1, idx + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((idx) => Math.max(0, idx - 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const selected = results[activeIndex] ?? results[0];
      if (selected) openResult(selected);
    }
  }

  if (!open) return null;

  let absoluteIndex = 0;

  return (
    <div className="fixed inset-0 z-[90] bg-black/45 p-0 backdrop-blur-sm sm:p-4" role="dialog" aria-modal="true" aria-label="Global search">
      <button className="absolute inset-0 cursor-default" type="button" aria-label="Close search" onClick={() => onOpenChange(false)} />
      <div className="relative mx-auto flex h-dvh w-full max-w-3xl flex-col overflow-hidden bg-[var(--background)] shadow-2xl sm:h-[min(720px,calc(100dvh-2rem))] sm:rounded-xl sm:border sm:border-[var(--border-subtle)]">
        <div className="flex items-center gap-3 border-b border-[var(--border-subtle)] px-4 py-3">
          <Search className="h-5 w-5 shrink-0 text-[var(--text-muted)]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Search equipment, requests, work orders, parts..."
            className="h-10 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-[var(--text-muted)]"
          />
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
            aria-label="Close search"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3 sm:px-3">
          {query.trim().length < 2 ? (
            <div className="px-3 py-12 text-center">
              <p className="text-sm font-medium text-[var(--foreground)]">Type at least two characters</p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">Use asset codes, request numbers, work orders, parts, departments, or reports.</p>
            </div>
          ) : error ? (
            <div className="mx-2 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
              Search could not load results
            </div>
          ) : loading && results.length === 0 ? (
            <div className="px-3 py-12 text-center text-sm text-[var(--text-muted)]">Searching...</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-12 text-center">
              <p className="text-sm font-medium text-[var(--foreground)]">No matching records available to your role.</p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">Try an exact asset code, WO number, request number, or part code.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {groups.map((group) => (
                <section key={group.id} aria-label={group.label}>
                  <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{group.label}</p>
                  <div className="space-y-1">
                    {group.results.map((result) => {
                      const index = absoluteIndex++;
                      const selected = activeIndex === index;
                      return (
                        <button
                          key={`${result.group}-${result.id}`}
                          type="button"
                          onMouseEnter={() => setActiveIndex(index)}
                          onClick={() => openResult(result)}
                          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${
                            selected ? 'bg-[var(--surface-2)] text-[var(--foreground)]' : 'text-[var(--text-muted)] hover:bg-[var(--surface-1)]'
                          }`}
                        >
                          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[var(--border-subtle)] bg-[var(--surface-1)]">
                            <FileText className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-[var(--foreground)]">{result.title}</span>
                            <span className="block truncate text-xs text-[var(--text-muted)]">{result.subtitle}</span>
                          </span>
                          <ArrowRight className="h-4 w-4 shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>

        <div className="hidden items-center justify-between border-t border-[var(--border-subtle)] px-4 py-2 text-[11px] text-[var(--text-muted)] sm:flex">
          <span>Use arrow keys to move, Enter to open, Esc to close.</span>
          <span>Ctrl/Cmd K</span>
        </div>
      </div>
    </div>
  );
}
