import { Category } from '../backend';

const categoryEmoji: Record<string, string> = {
  love: '❤️',
  confession: '🤫',
  funny: '😂',
  random: '🎲',
  other: '📝',
};

/**
 * Factory function that returns a Leaflet divIcon for popular story markers.
 * Uses a star/highlighted pin with a category emoji badge.
 */
export function getPopularStoryMarkerIcon(L: any, category: Category, rank: number) {
  const emoji = categoryEmoji[category as string] ?? '📖';
  // Top 3 get a gold/silver/bronze tint
  const colors = ['#f59e0b', '#9ca3af', '#b45309'];
  const borderColor = rank < 3 ? colors[rank] : '#6366f1';

  return L.divIcon({
    className: '',
    html: `
      <div style="position: relative; width: 36px; height: 48px;">
        <div style="
          width: 36px;
          height: 36px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          border: 3px solid ${borderColor};
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          box-shadow: 0 3px 12px rgba(99, 102, 241, 0.5), 0 2px 6px rgba(0,0,0,0.3);
          position: absolute;
          top: 0;
          left: 0;
        ">
        </div>
        <div style="
          position: absolute;
          top: 4px;
          left: 4px;
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          line-height: 1;
          pointer-events: none;
        ">${emoji}</div>
        <div style="
          width: 6px;
          height: 6px;
          background: rgba(99, 102, 241, 0.4);
          border-radius: 50%;
          position: absolute;
          bottom: 0;
          left: 50%;
          transform: translateX(-50%);
          filter: blur(2px);
        "></div>
      </div>
    `,
    iconSize: [36, 48],
    iconAnchor: [18, 48],
    popupAnchor: [0, -52],
  });
}
