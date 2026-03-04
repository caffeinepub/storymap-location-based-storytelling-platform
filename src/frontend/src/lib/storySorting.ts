import type { Story } from "../backend";
import { calculateDistance } from "./utils";

export type SortOption =
  | "newest"
  | "nearest"
  | "mostViewed"
  | "mostLiked"
  | "mostPinned";
// Alias so both names work
export type FrontendSortOption = SortOption;

/** Shared location shape used throughout the frontend */
export interface LatLng {
  latitude: number;
  longitude: number;
}

/**
 * Sort stories based on the selected option.
 * For 'nearest', compares base location against story.latitude / story.longitude.
 */
export function sortStories(
  stories: Story[],
  sortOption: SortOption,
  nearestCenter?: LatLng | null,
): Story[] {
  const sorted = [...stories];

  switch (sortOption) {
    case "newest":
      return sorted.sort((a, b) => {
        if (a.timestamp > b.timestamp) return -1;
        if (a.timestamp < b.timestamp) return 1;
        return 0;
      });

    case "mostViewed":
      return sorted.sort((a, b) => {
        if (a.viewCount > b.viewCount) return -1;
        if (a.viewCount < b.viewCount) return 1;
        return 0;
      });

    case "mostLiked":
      return sorted.sort((a, b) => {
        if (a.likeCount > b.likeCount) return -1;
        if (a.likeCount < b.likeCount) return 1;
        return 0;
      });

    case "mostPinned":
      return sorted.sort((a, b) => {
        if (a.pinCount > b.pinCount) return -1;
        if (a.pinCount < b.pinCount) return 1;
        if (a.timestamp > b.timestamp) return -1;
        if (a.timestamp < b.timestamp) return 1;
        return 0;
      });

    case "nearest":
      if (!nearestCenter) return sorted;
      return sorted.sort((a, b) => {
        // Use story.latitude / story.longitude — never uploader location
        const distanceA = calculateDistance(
          nearestCenter.latitude,
          nearestCenter.longitude,
          a.latitude,
          a.longitude,
        );
        const distanceB = calculateDistance(
          nearestCenter.latitude,
          nearestCenter.longitude,
          b.latitude,
          b.longitude,
        );
        return distanceA - distanceB;
      });

    default:
      return sorted;
  }
}

/**
 * Convert frontend sort option to backend SortOption type.
 */
export function toBackendSortOption(
  sortOption: SortOption,
  nearestCenter?: LatLng | null,
): import("../backend").SortOption {
  switch (sortOption) {
    case "newest":
      return { __kind__: "newest", newest: null };
    case "mostViewed":
      return { __kind__: "mostViewed", mostViewed: null };
    case "mostLiked":
      return { __kind__: "mostLiked", mostLiked: null };
    case "mostPinned":
      return { __kind__: "mostPinned", mostPinned: null };
    case "nearest":
      if (!nearestCenter) {
        return { __kind__: "newest", newest: null };
      }
      return {
        __kind__: "nearest",
        nearest: {
          latitude: nearestCenter.latitude,
          longitude: nearestCenter.longitude,
        },
      };
    default:
      return { __kind__: "newest", newest: null };
  }
}
