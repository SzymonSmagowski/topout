'use client';

import { useQuery } from 'convex/react';
import { MapPin, Plus } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

import { api } from '@convex/_generated/api';
import type { Doc, Id } from '@convex/_generated/dataModel';

interface GymComboboxProps {
  /** When the user selects an existing gym, we know both id + name. */
  readonly value: { readonly gymId: Id<'gyms'> | null; readonly name: string };
  readonly onChange: (next: { readonly gymId: Id<'gyms'> | null; readonly name: string }) => void;
}

/**
 * Type-to-search gym selector with inline-create. Backed by `gyms.listByPrefix`.
 *
 * The form parent doesn't call `gyms.ensureByName` directly — instead, on
 * submit it inspects `value.gymId` (existing) vs `value.name` (new) and asks
 * the create-session mutation to materialize the new gym, OR (depending on
 * the architect's contract) calls `gyms.ensureByName` first then forwards the
 * id. Either way, this combobox stays purely controlled.
 */
export function GymCombobox({ value, onChange }: GymComboboxProps) {
  const inputId = useId();
  const [query, setQuery] = useState(value.name);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const results = useQuery(api.gyms.listByPrefix, { prefix: query });

  useEffect(() => {
    setQuery(value.name);
  }, [value.name]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, []);

  const matches: readonly Doc<'gyms'>[] = results ?? [];
  const exactMatch = matches.find(
    (g) => g.name.toLowerCase() === query.trim().toLowerCase(),
  );
  const canCreate = query.trim().length > 0 && !exactMatch;

  const pick = (gym: Doc<'gyms'>) => {
    onChange({ gymId: gym._id, name: gym.name });
    setQuery(gym.name);
    setOpen(false);
  };

  const pickNew = () => {
    onChange({ gymId: null, name: query.trim() });
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <label htmlFor={inputId} className="label">
        Gym
      </label>
      <input
        id={inputId}
        type="text"
        className="input"
        placeholder="Type to search or create…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange({ gymId: null, name: e.target.value });
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        autoComplete="off"
      />
      {open && (matches.length > 0 || canCreate) && (
        <div
          className="card absolute left-0 right-0 top-[calc(100%+4px)] z-20 max-h-64 overflow-auto p-1 text-sm"
          style={{ boxShadow: 'var(--shadow-pop)' }}
        >
          {matches.map((gym) => (
            <button
              key={gym._id}
              type="button"
              onClick={() => pick(gym)}
              className="btn btn-ghost h-9 w-full justify-start gap-2"
            >
              <MapPin className="h-3.5 w-3.5 text-[color:var(--color-muted)]" aria-hidden />
              <span className="text-[color:var(--color-text)]">{gym.name}</span>
              {gym.city && (
                <span className="ml-auto text-xs text-[color:var(--color-text-muted)]">{gym.city}</span>
              )}
            </button>
          ))}
          {canCreate && (
            <button
              type="button"
              onClick={pickNew}
              className="btn btn-ghost h-9 w-full justify-start gap-2 text-[color:var(--color-accent)]"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Create &ldquo;{query.trim()}&rdquo;
            </button>
          )}
        </div>
      )}
      <p className="mt-1 text-xs text-[color:var(--color-text-muted)]">
        Prefix-matched. Pick an existing gym, or type a new name to create.
      </p>
    </div>
  );
}
