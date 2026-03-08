import { Loader2, MapPin, Search, X } from "lucide-react";
import { useState } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";

interface MapSearchResult {
  latitude: number;
  longitude: number;
  label: string;
}

interface MapSearchBarProps {
  onResult: (result: MapSearchResult) => void;
  onClear: () => void;
  activeLabel: string | null;
}

export default function MapSearchBar({
  onResult,
  onClear,
  activeLabel,
}: MapSearchBarProps) {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    setIsLoading(true);
    setError(null);

    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(trimmed)}&format=json&limit=1`;
      const response = await fetch(url, {
        headers: {
          "User-Agent": "StoryMap/1.0",
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Search request failed");
      }

      const results = await response.json();

      if (!results || results.length === 0) {
        setError("Location not found");
        return;
      }

      const result = results[0];
      onResult({
        latitude: Number.parseFloat(result.lat),
        longitude: Number.parseFloat(result.lon),
        label: result.display_name,
      });
      setQuery("");
    } catch (err) {
      console.error("Geocoding error:", err);
      setError("Location not found");
    } finally {
      setIsLoading(false);
    }
  }

  function handleClear() {
    setQuery("");
    setError(null);
    onClear();
  }

  const truncatedLabel = activeLabel
    ? activeLabel.length > 40
      ? `${activeLabel.slice(0, 40)}…`
      : activeLabel
    : null;

  return (
    <div className="mb-3">
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            data-ocid="map.search_input"
            type="text"
            placeholder="Search a location…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (error) setError(null);
            }}
            className="pl-9 pr-3 text-sm"
            disabled={isLoading}
          />
        </div>

        <Button
          data-ocid="map.search_button"
          type="submit"
          size="sm"
          disabled={isLoading || !query.trim()}
          className="shrink-0"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          <span className="ml-1.5 hidden sm:inline">Search</span>
        </Button>

        {activeLabel && (
          <Button
            data-ocid="map.clear_button"
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClear}
            className="shrink-0"
            title="Clear search"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </form>

      {error && (
        <p className="mt-1.5 text-xs text-destructive flex items-center gap-1">
          <X className="h-3 w-3 shrink-0" />
          {error}
        </p>
      )}

      {truncatedLabel && (
        <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 text-xs font-medium text-amber-800 dark:text-amber-200">
          <MapPin className="h-3 w-3 shrink-0 text-amber-500" />
          <span>Viewing stories near: {truncatedLabel}</span>
        </div>
      )}
    </div>
  );
}
