import type { LocalUpdate } from '../../backend';
import { computeRelevance, getLocalCategoryLabel, getLocalCategoryColor, formatRadius } from '../../lib/localUpdates';
import { formatDistanceValue } from '../../lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Clock, Radio } from 'lucide-react';

interface LocalUpdatesListProps {
  updates: LocalUpdate[];
  userLocation: { latitude: number; longitude: number } | null;
  onUpdateClick: (update: LocalUpdate) => void;
}

export default function LocalUpdatesList({
  updates,
  userLocation,
  onUpdateClick,
}: LocalUpdatesListProps) {
  if (updates.length === 0) {
    return (
      <div className="text-center py-12">
        <Radio className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">No local updates available</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {updates.map((update) => {
        const relevance = computeRelevance(update, userLocation);
        const timestamp = new Date(Number(update.timestamp) / 1000000);
        const timeAgo = getTimeAgo(timestamp);

        return (
          <Card
            key={update.id.toString()}
            className={`cursor-pointer transition-all hover:shadow-md ${
              relevance.isRelevant
                ? 'border-green-500 dark:border-green-700 bg-green-50/50 dark:bg-green-950/20'
                : ''
            }`}
            onClick={() => onUpdateClick(update)}
          >
            <CardContent className="pt-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                {update.image && (
                  <div className="flex-shrink-0 w-16 h-16 rounded-md overflow-hidden">
                    <img
                      src={update.image.getDirectURL()}
                      alt="Update"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-sm font-medium mb-1">{update.content}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      variant="secondary"
                      className={getLocalCategoryColor(update.category)}
                    >
                      {getLocalCategoryLabel(update.category)}
                    </Badge>
                    {relevance.isRelevant && (
                      <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                        <Radio className="h-3 w-3 mr-1" />
                        Relevant
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs text-muted-foreground mt-3">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>{timeAgo}</span>
                </div>
                <div className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  <span>{formatRadius(Number(update.radius))}</span>
                </div>
                {relevance.distanceKm !== null && (
                  <div className="flex items-center gap-1">
                    <span className="font-medium">
                      {formatDistanceValue(relevance.distanceKm)} away
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}
