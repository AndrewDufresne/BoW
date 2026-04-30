import { useEffect, useMemo, useRef, useState } from "react";
import { clsx } from "clsx";

export interface ComboboxOption {
  value: string;
  label: string;
  hint?: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  /** Allow values not present in options (used for free-text fields with suggestions). */
  freeSolo?: boolean;
}

export function Combobox({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  invalid,
  className,
  freeSolo,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  const labelOf = (v: string) =>
    options.find((o) => o.value === v)?.label ?? (freeSolo ? v : "");
  const display = open ? query : labelOf(value);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const q = query.toLowerCase().trim();
  const filtered = useMemo(() => {
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.hint?.toLowerCase().includes(q) ?? false),
    );
  }, [options, q]);

  const exactMatch = filtered.some((o) => o.label.toLowerCase() === q);

  return (
    <div ref={wrapRef} className={clsx("relative", className)}>
      <input
        type="text"
        className={clsx("input pr-8 bg-white", invalid && "input-error")}
        value={display}
        placeholder={placeholder}
        disabled={disabled}
        onFocus={() => {
          setQuery(labelOf(value));
          setOpen(true);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (freeSolo) onChange(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
          } else if (e.key === "Enter") {
            e.preventDefault();
            if (filtered.length > 0) {
              onChange(filtered[0].value);
              setOpen(false);
            } else if (freeSolo) {
              onChange(query);
              setOpen(false);
            }
          } else if (e.key === "ArrowDown" && !open) {
            setOpen(true);
          }
        }}
      />
      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none text-xs">
        ▾
      </span>
      {open && (filtered.length > 0 || (freeSolo && q && !exactMatch)) && (
        <ul className="absolute z-50 mt-1 w-full max-h-64 overflow-auto rounded border border-ink-300 bg-white shadow-lg text-sm">
          {filtered.slice(0, 100).map((o) => (
            <li
              key={o.value}
              className={clsx(
                "px-3 py-1.5 cursor-pointer flex justify-between gap-3",
                o.value === value
                  ? "bg-[rgba(219,0,17,0.08)] text-ink-900 font-medium"
                  : "hover:bg-ink-100",
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(o.value);
                setOpen(false);
              }}
            >
              <span className="text-ink-900 truncate">{o.label}</span>
              {o.hint && (
                <span className="text-ink-500 text-xs whitespace-nowrap">
                  {o.hint}
                </span>
              )}
            </li>
          ))}
          {freeSolo && q && !exactMatch && (
            <li
              className="px-3 py-1.5 cursor-pointer hover:bg-ink-100 text-ink-700 italic border-t border-ink-200"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(query);
                setOpen(false);
              }}
            >
              Use &quot;{query}&quot;
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

/** Build a deduplicated, sorted list of strings extracted from a record list. */
export function distinct<T>(
  items: T[] | undefined | null,
  getter: (item: T) => string | null | undefined,
): string[] {
  const set = new Set<string>();
  for (const item of items ?? []) {
    const v = getter(item);
    if (v) set.add(v);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}