import { useEffect, useRef } from 'react';
import type { LocalUpdate, LocalCategory } from '../backend';
import { computeRelevance } from '../lib/localUpdates';
import { formatDistanceValue } from '../lib/utils';
import { toast } from 'sonner';

interface UseLocalUpdateNotificationsParams {
  updates: LocalUpdate[];
  userLocation: { latitude: number; longitude: number } | null;
  mutedCategories: Record<LocalCategory, boolean>;
  enabled: boolean;
}

export function useLocalUpdateNotifications({
  updates,
  userLocation,
  mutedCategories,
  enabled,
}: UseLocalUpdateNotificationsParams) {
  const notifiedIdsRef = useRef<Set<string>>(new Set());
  const previousRelevanceRef = useRef<Map<string, boolean>>(new Map());

  useEffect(() => {
    if (!enabled || !userLocation || updates.length === 0) {
      return;
    }

    // Request notification permission if not already granted
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch((err) => {
        console.warn('Failed to request notification permission:', err);
      });
    }

    updates.forEach((update) => {
      const updateId = update.id.toString();
      const isMuted = mutedCategories[update.category] || false;

      // Skip if muted
      if (isMuted) {
        return;
      }

      const relevance = computeRelevance(update, userLocation);
      const wasRelevant = previousRelevanceRef.current.get(updateId) || false;
      const isNowRelevant = relevance.isRelevant;

      // Update relevance tracking
      previousRelevanceRef.current.set(updateId, isNowRelevant);

      // Check if we should notify
      const shouldNotify =
        isNowRelevant &&
        !notifiedIdsRef.current.has(updateId) &&
        (!wasRelevant || previousRelevanceRef.current.size === 0); // First check or transition

      if (shouldNotify) {
        notifiedIdsRef.current.add(updateId);

        const distanceText =
          relevance.distanceKm !== null
            ? ` (${formatDistanceValue(relevance.distanceKm)} away)`
            : '';

        const notificationBody = `${update.content}${distanceText}`;

        // Try system notification first
        if ('Notification' in window && Notification.permission === 'granted') {
          try {
            new Notification('Local Update Nearby', {
              body: notificationBody,
              icon: '/assets/generated/story-marker.dim_48x48.png',
              tag: updateId,
            });
          } catch (err) {
            console.warn('Failed to show system notification, using toast:', err);
            toast.info(notificationBody, {
              description: 'Local Update Nearby',
              duration: 5000,
            });
          }
        } else {
          // Fallback to in-app toast
          toast.info(notificationBody, {
            description: 'Local Update Nearby',
            duration: 5000,
          });
        }
      }
    });
  }, [updates, userLocation, mutedCategories, enabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      notifiedIdsRef.current.clear();
      previousRelevanceRef.current.clear();
    };
  }, []);
}
