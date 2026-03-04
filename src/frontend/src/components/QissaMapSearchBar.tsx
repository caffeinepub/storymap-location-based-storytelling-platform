import { Loader2, Search, X } from "lucide-react";
import type React from "react";
import { useRef, useState } from "react";

export interface SearchedLocation {
  latitude: number;
  longitude: number;
  displayName: string;
}

interface QissaMapSearchBarProps {
  onLocationFound: (location: SearchedLocation) => void;
  onClear?: () => void;
}

async function geocodeLocation(query: string): Promise<SearchedLocation> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
  const response = await fetch(url, {
    headers: {
      "Accept-Language": "en",
      "User-Agent": "QissaMapApp/1.0",
    },
  });

  if (!response.ok) {
    throw new Error("Geocoding request failed");
  }

  const results = await response.json();

  if (!results || results.length === 0) {
    throw new Error("Location not found");
  }

  const result = results[0];
  return {
    latitude: Number.parseFloat(result.lat),
    longitude: Number.parseFloat(result.lon),
    displayName: result.display_name,
  };
}

export default function QissaMapSearchBar({
  onLocationFound,
  onClear,
}: QissaMapSearchBarProps) {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    setIsLoading(true);
    setError(null);

    try {
      const location = await geocodeLocation(trimmed);
      onLocationFound(location);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Location not found";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setQuery("");
    setError(null);
    onClear?.();
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] w-full max-w-md px-3 pointer-events-auto">
      <form onSubmit={handleSearch} className="flex flex-col gap-1">
        <div className="flex items-center gap-2 bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 px-3 py-2">
          <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search city, area, or landmark…"
            className="flex-1 bg-transparent text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 outline-none min-w-0"
            disabled={isLoading}
          />
          {isLoading && (
            <Loader2 className="w-4 h-4 text-primary animate-spin flex-shrink-0" />
          )}
          {!isLoading && query && (
            <button
              type="button"
              onClick={handleClear}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 flex-shrink-0"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            type="submit"
            disabled={isLoading || !query.trim()}
            className="ml-1 px-3 py-1 bg-primary text-primary-foreground text-xs font-medium rounded-lg disabled:opacity-50 flex-shrink-0"
          >
            Go
          </button>
        </div>
        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 text-xs rounded-lg px-3 py-2">
            {error}
          </div>
        )}
      </form>
    </div>
  );
}
