import type { Story, Location } from '../backend';
import { calculateDistance } from './utils';

export type SortOption = 'newest' | 'nearest' | 'mostViewed' | 'mostLiked' | 'mostPinned';

/**
 * Sort stories based on the selected option
 */
export function sortStories(
  stories: Story[],
  sortOption: SortOption,
  nearestCenter?: Location | null
): Story[] {
  const sorted = [...stories];

  switch (sortOption) {
    case 'newest':
      return sorted.sort((a, b) => {
        // BigInt comparison for timestamps (newest first)
        if (a.timestamp > b.timestamp) return -1;
        if (a.timestamp < b.timestamp) return 1;
        return 0;
      });

    case 'mostViewed':
      return sorted.sort((a, b) => {
        // BigInt comparison for view counts (highest first)
        if (a.viewCount > b.viewCount) return -1;
        if (a.viewCount < b.viewCount) return 1;
        return 0;
      });

    case 'mostLiked':
      return sorted.sort((a, b) => {
        // BigInt comparison for like counts (highest first)
        if (a.likeCount > b.likeCount) return -1;
        if (a.likeCount < b.likeCount) return 1;
        return 0;
      });

    case 'mostPinned':
      return sorted.sort((a, b) => {
        // BigInt comparison for pin counts (highest first)
        if (a.pinCount > b.pinCount) return -1;
        if (a.pinCount < b.pinCount) return 1;
        // Tie-breaker: newest first
        if (a.timestamp > b.timestamp) return -1;
        if (a.timestamp < b.timestamp) return 1;
        return 0;
      });

    case 'nearest':
      if (!nearestCenter) {
        // If no center provided, return unsorted
        return sorted;
      }
      return sorted.sort((a, b) => {
        const distanceA = calculateDistance(
          nearestCenter.latitude,
          nearestCenter.longitude,
          a.location.latitude,
          a.location.longitude
        );
        const distanceB = calculateDistance(
          nearestCenter.latitude,
          nearestCenter.longitude,
          b.location.latitude,
          b.location.longitude
        );
        return distanceA - distanceB; // Ascending order (nearest first)
      });

    default:
      return sorted;
  }
}

/**
 * Convert frontend sort option to backend SortOption type
 */
export function toBackendSortOption(
  sortOption: SortOption,
  nearestCenter?: Location | null
): import('../backend').SortOption {
  switch (sortOption) {
    case 'newest':
      return { __kind__: 'newest', newest: null };
    case 'mostViewed':
      return { __kind__: 'mostViewed', mostViewed: null };
    case 'mostLiked':
      return { __kind__: 'mostLiked', mostLiked: null };
    case 'mostPinned':
      return { __kind__: 'mostPinned', mostPinned: null };
    case 'nearest':
      if (!nearestCenter) {
        // Fallback to newest if no center available
        return { __kind__: 'newest', newest: null };
      }
      return {
        __kind__: 'nearest',
        nearest: { location: nearestCenter },
      };
    default:
      return { __kind__: 'newest', newest: null };
  }
}
