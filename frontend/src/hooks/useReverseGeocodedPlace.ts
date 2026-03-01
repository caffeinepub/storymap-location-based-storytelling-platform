import { useState, useEffect } from 'react';
import { reverseGeocode } from '../lib/reverseGeocode';

interface UseReverseGeocodedPlaceResult {
  placeName: string | null;
  isLoading: boolean;
  error: Error | null;
}

export function useReverseGeocodedPlace(
  lat: number,
  lon: number
): UseReverseGeocodedPlaceResult {
  const [placeName, setPlaceName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const abortController = new AbortController();
    let mounted = true;

    async function fetchPlace() {
      setIsLoading(true);
      setError(null);

      try {
        const name = await reverseGeocode(lat, lon, abortController.signal);
        if (mounted) {
          setPlaceName(name);
          setIsLoading(false);
        }
      } catch (err: any) {
        if (err.name !== 'AbortError' && mounted) {
          setError(err);
          setIsLoading(false);
        }
      }
    }

    fetchPlace();

    return () => {
      mounted = false;
      abortController.abort();
    };
  }, [lat, lon]);

  return { placeName, isLoading, error };
}
