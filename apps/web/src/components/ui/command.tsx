import { useState, useEffect, useRef, useMemo, type ReactNode, KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Search, ChevronRight, Keyboard, Key } from "lucide-react";

export interface CommandItem {
  key: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  shortcut?: string;
  action: () => void;
  section?: string;
  disabled?: boolean;
}

export interface CommandGroup {
  label: string;
  items: CommandItem[];
}

export interface CommandPaletteProps {
  items: CommandItem[] | CommandGroup[];
  onClose: () => void;
  placeholder?: string;
}

export function CommandPalette({ items, onClose, placeholder = "Search commands..." }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Flatten items
  const flatItems = useMemo(() => {
    const result: (CommandItem & { section?: string; isGroupHeader?: boolean })[] = [];
    for (const item of items) {
      if ("items" in item) {
        if (item.items.length > 0) {
          result.push({ key: `__group_${item.label}`, label: item.label, action: () => {}, isGroupHeader: true });
          result.push(...item.items.map((i) => ({ ...i, section: item.label })));
        }
      } else {
        result.push(item);
      }
    }
    return result;
  }, [items]);

  // Filter items
  const filteredItems = useMemo(() => {
    if (!query) return flatItems;
    const lowerQuery = query.toLowerCase();
    return flatItems.filter(
      (item) =>
        item.isGroupHeader ||
        item.label.toLowerCase().includes(lowerQuery) ||
        item.description?.toLowerCase().includes(lowerQuery) ||
        item.shortcut?.toLowerCase().includes(lowerQuery),
    );
  }, [query, flatItems]);

  // Get selectable items (non-group, non-disabled)
  const selectableItems = useMemo(
    () => filteredItems.filter((item) => !item.isGroupHeader && !item.disabled),
    [filteredItems],
  );

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (!selectableItems.length) return;

      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, selectableItems.length - 1));
          break;
        case "ArrowUp":
          event.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "Enter":
          event.preventDefault();
          selectableItems[selectedIndex]?.action();
          onClose();
          break;
        case "Escape":
          onClose();
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectableItems, selectedIndex, onClose]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
    setSelectedIndex(0);
  }, []);

  // Scroll selected item into view
  useEffect(() => {
    const selectedElement = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    selectedElement?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const paletteContent = (
    <div
      className="fixed inset-0 z-[var(--z-index-90)] flex items-start justify-center pt-16 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" aria-hidden="true" />
      <div
        className="relative w-full max-w-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
      >
        <div className="bg-[var(--color-surface-primary)] border border-[var(--color-border-primary)] rounded-xl shadow-2xl overflow-hidden animate-zoom-in">
          <div className="p-4 border-b border-[var(--color-border-primary)]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-[var(--color-text-tertiary)]" aria-hidden="true" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                placeholder={placeholder}
                className="w-full pl-10 pr-4 py-2.5 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-primary)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-500)]"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
              <kbd className="px-1.5 py-0.5 bg-[var(--color-bg-tertiary)] rounded text-[var(--color-text-secondary)] font-mono">
                <Keyboard className="h-3 w-3" />
              </kbd>
              <span>Navigate</span>
              <kbd className="px-1.5 py-0.5 bg-[var(--color-bg-tertiary)] rounded text-[var(--color-text-secondary)] font-mono">
                <Key className="h-3 w-3" />
              </kbd>
              <span>Select</span>
              <kbd className="px-1.5 py-0.5 bg-[var(--color-bg-tertiary)] rounded text-[var(--color-text-secondary)] font-mono">Esc</kbd>
              <span>Close</span>
            </div>
          </div>
          <div
            ref={listRef}
            className="max-h-[400px] overflow-y-auto p-2"
            role="listbox"
            aria-label="Commands"
          >
            {filteredItems.length === 0 ? (
              <div className="px-4 py-8 text-center text-[var(--color-text-tertiary)]">
                No commands found
              </div>
            ) : (
              filteredItems.map((item, index) => {
                if (item.isGroupHeader) {
                  return (
                    <div
                      key={item.key}
                      className="px-3 py-2 text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider"
                      role="separator"
                    >
                      {item.label}
                    </div>
                  );
                }

                const isSelected = selectableItems[selectedIndex]?.key === item.key;

                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      item.action();
                      onClose();
                    }}
                    disabled={item.disabled}
                    className={`
                      w-full px-3 py-2.5 rounded-lg
                      flex items-center gap-3
                      text-left
                      transition-colors duration-fast
                      focus-visible:outline-none focus-visible:bg-[var(--color-surface-hover)]
                      ${isSelected ? "bg-[var(--color-surface-hover)]" : "hover:bg-[var(--color-surface-hover)]"}
                      ${item.disabled ? "opacity-50 cursor-not-allowed" : ""}
                    `}
                    role="option"
                    aria-selected={isSelected}
                    data-index={selectableItems.findIndex((i) => i.key === item.key)}
                  >
                    {item.icon && <span className="h-5 w-5 flex-shrink-0 text-[var(--color-text-tertiary)]" aria-hidden="true">{item.icon}</span>}
                    <div className="flex-1 min-w-0">
                      <span className={`
                        block font-medium truncate
                        ${item.disabled ? "text-[var(--color-text-tertiary)]" : "text-[var(--color-text-primary)]"}
                      `}>
                        {item.label}
                      </span>
                      {item.description && (
                        <span className="block text-xs text-[var(--color-text-tertiary)] truncate mt-0.5">
                          {item.description}
                        </span>
                      )}
                    </div>
                    {item.shortcut && (
                      <kbd className="px-2 py-0.5 text-xs font-mono text-[var(--color-text-tertiary)] bg-[var(--color-bg-tertiary)] rounded">
                        {item.shortcut}
                      </kbd>
                    )}
                    {isSelected && (
                      <ChevronRight className="h-4 w-4 text-[var(--color-text-brand)] flex-shrink-0" aria-hidden="true" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(paletteContent, document.body);
}