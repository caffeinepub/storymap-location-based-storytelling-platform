import { useState, useEffect, useCallback } from 'react';
import { LocalCategory } from '../backend';

const MUTED_CATEGORIES_KEY = 'storymap-muted-local-categories';

export interface MutedCategories {
  [LocalCategory.traffic]: boolean;
  [LocalCategory.power]: boolean;
  [LocalCategory.police]: boolean;
  [LocalCategory.event]: boolean;
  [LocalCategory.nature]: boolean;
  [LocalCategory.general]: boolean;
}

const defaultMutedCategories: MutedCategories = {
  [LocalCategory.traffic]: false,
  [LocalCategory.power]: false,
  [LocalCategory.police]: false,
  [LocalCategory.event]: false,
  [LocalCategory.nature]: false,
  [LocalCategory.general]: false,
};

export function useLocalUpdateMuting() {
  const [mutedCategories, setMutedCategories] = useState<MutedCategories>(() => {
    try {
      const stored = localStorage.getItem(MUTED_CATEGORIES_KEY);
      if (stored) {
        return { ...defaultMutedCategories, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error('Failed to load muted categories:', error);
    }
    return defaultMutedCategories;
  });

  useEffect(() => {
    try {
      localStorage.setItem(MUTED_CATEGORIES_KEY, JSON.stringify(mutedCategories));
    } catch (error) {
      console.error('Failed to save muted categories:', error);
    }
  }, [mutedCategories]);

  const toggleMute = useCallback((category: LocalCategory) => {
    setMutedCategories((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  }, []);

  const isMuted = useCallback(
    (category: LocalCategory) => {
      return mutedCategories[category] || false;
    },
    [mutedCategories]
  );

  return {
    mutedCategories,
    toggleMute,
    isMuted,
  };
}
