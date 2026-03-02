import React, { useRef } from 'react';
import { Search, X, Loader2 } from 'lucide-react';

interface QissaMapSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSearch: (query: string) => void;
  isSearching: boolean;
  error: string | null;
  onClear: () => void;
}

export default function QissaMapSearchBar({
  value,
  onChange,
  onSearch,
  isSearching,
  error,
  onClear,
}: QissaMapSearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = value.trim();
    if (query) {
      onSearch(query);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      onClear();
      inputRef.current?.blur();
    }
  };

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] w-full max-w-md px-4">
      <form onSubmit={handleSubmit}>
        <div className="relative flex items-center">
          {/* Search icon */}
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            {isSearching ? (
              <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
            ) : (
              <Search className="h-4 w-4 text-muted-foreground" />
            )}
          </div>

          {/* Input */}
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search for a location..."
            className="
              w-full
              pl-10 pr-20
              py-2.5
              rounded-full
              border border-border
              bg-background/95
              backdrop-blur-sm
              shadow-lg
              text-sm
              text-foreground
              placeholder:text-muted-foreground
              focus:outline-none
              focus:ring-2
              focus:ring-primary/50
              focus:border-primary
              transition-all
            "
          />

          {/* Right side buttons */}
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {value && (
              <button
                type="button"
                onClick={onClear}
                className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="submit"
              disabled={isSearching || !value.trim()}
              className="
                px-3 py-1
                rounded-full
                bg-primary
                text-primary-foreground
                text-xs
                font-medium
                hover:bg-primary/90
                disabled:opacity-50
                disabled:cursor-not-allowed
                transition-colors
                flex items-center gap-1
              "
            >
              <Search className="h-3 w-3" />
              Go
            </button>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mt-2 mx-2 px-3 py-1.5 bg-destructive/10 border border-destructive/20 rounded-lg text-xs text-destructive text-center">
            {error}
          </div>
        )}
      </form>
    </div>
  );
}
