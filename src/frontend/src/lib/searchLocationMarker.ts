/**
 * Factory function that returns a Leaflet divIcon for the searched location marker.
 * Styled distinctly from story markers and the current-location marker.
 * Uses a red teardrop pin shape with a white inner dot.
 */
export function getSearchLocationMarkerIcon(L: any, locationName?: string) {
  const label = locationName
    ? `<div style="
        position: absolute;
        bottom: 38px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0,0,0,0.75);
        color: white;
        font-size: 11px;
        font-weight: 600;
        padding: 3px 8px;
        border-radius: 4px;
        white-space: nowrap;
        max-width: 160px;
        overflow: hidden;
        text-overflow: ellipsis;
        pointer-events: none;
      ">${locationName}</div>`
    : "";

  return L.divIcon({
    className: "",
    html: `
      <div style="position: relative; width: 32px; height: 44px;">
        ${label}
        <div style="
          width: 32px;
          height: 32px;
          background: linear-gradient(135deg, #ef4444, #dc2626);
          border: 3px solid white;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          box-shadow: 0 3px 12px rgba(239, 68, 68, 0.5), 0 2px 6px rgba(0,0,0,0.3);
          position: absolute;
          top: 0;
          left: 0;
        ">
          <div style="
            width: 10px;
            height: 10px;
            background: white;
            border-radius: 50%;
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
          "></div>
        </div>
        <div style="
          width: 6px;
          height: 6px;
          background: rgba(239, 68, 68, 0.4);
          border-radius: 50%;
          position: absolute;
          bottom: 0;
          left: 50%;
          transform: translateX(-50%);
          filter: blur(2px);
        "></div>
      </div>
    `,
    iconSize: [32, 44],
    iconAnchor: [16, 44],
    popupAnchor: [0, -48],
  });
}
