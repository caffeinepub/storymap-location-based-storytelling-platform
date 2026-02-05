import { useState, useEffect } from 'react';
import { useGetRecentStories, useGetCallerUserProfile, useMarkIntroSeen } from '../hooks/useQueries';
import { useInternetIdentity } from '../hooks/useInternetIdentity';
import StoryFeed from '../components/StoryFeed';
import MapView from '../components/MapView';
import CreateStoryFAB from '../components/CreateStoryFAB';
import CreateStoryDialog from '../components/CreateStoryDialog';
import StoryDetailDialog from '../components/StoryDetailDialog';
import FilterBar from '../components/FilterBar';
import { Button } from '@/components/ui/button';
import { List, Map as MapIcon, MapPin } from 'lucide-react';
import type { Category, Story } from '../backend';
import { toast } from 'sonner';

export default function HomePage() {
  const [view, setView] = useState<'feed' | 'map'>('feed');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationPermissionDenied, setLocationPermissionDenied] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [hasCheckedFirstTime, setHasCheckedFirstTime] = useState(false);

  const { identity } = useInternetIdentity();
  const { data: stories = [], isLoading } = useGetRecentStories(100);
  const { data: userProfile, isLoading: profileLoading } = useGetCallerUserProfile();
  const markIntroSeenMutation = useMarkIntroSeen();

  // Request geolocation on mount
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
          setLocationPermissionDenied(false);
        },
        (error) => {
          console.error('Error getting location:', error);
          setLocationPermissionDenied(true);
          if (error.code === error.PERMISSION_DENIED) {
            toast.info('Location access denied. You can still browse stories, but distance information will not be available.');
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    } else {
      toast.error('Geolocation is not supported by your browser.');
    }
  }, []);

  // Auto-open create dialog for first-time users
  useEffect(() => {
    if (
      identity &&
      !profileLoading &&
      userProfile &&
      !hasCheckedFirstTime &&
      userProfile.storiesPosted === BigInt(0) &&
      !userProfile.seenIntro
    ) {
      setHasCheckedFirstTime(true);
      setCreateDialogOpen(true);
      // Mark intro as seen
      markIntroSeenMutation.mutate();
    }
  }, [identity, profileLoading, userProfile, hasCheckedFirstTime, markIntroSeenMutation]);

  const filteredStories = stories.filter((story) => {
    if (selectedCategory && story.category !== selectedCategory) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        story.title.toLowerCase().includes(query) ||
        story.content.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const handleRequestLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
          setLocationPermissionDenied(false);
          toast.success('Location access granted!');
        },
        (error) => {
          console.error('Error getting location:', error);
          setLocationPermissionDenied(true);
          if (error.code === error.PERMISSION_DENIED) {
            toast.error('Location access denied. Please enable location permissions in your browser settings.');
          } else {
            toast.error('Unable to retrieve your location. Please try again.');
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-8rem)]">
      <div className="container px-4 py-6 space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h2 className="text-2xl font-bold">
            {view === 'feed' ? 'Story Feed' : 'Story Map'}
          </h2>
          <div className="flex gap-2 items-center">
            {locationPermissionDenied && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRequestLocation}
                className="gap-2"
              >
                <MapPin className="h-4 w-4" />
                Enable Location
              </Button>
            )}
            <Button
              variant={view === 'feed' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setView('feed')}
            >
              <List className="h-4 w-4 mr-2" />
              Feed
            </Button>
            <Button
              variant={view === 'map' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setView('map')}
            >
              <MapIcon className="h-4 w-4 mr-2" />
              Map
            </Button>
          </div>
        </div>

        <FilterBar
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        {view === 'feed' ? (
          <StoryFeed
            stories={filteredStories}
            isLoading={isLoading}
            userLocation={userLocation}
            onStoryClick={setSelectedStory}
          />
        ) : (
          <MapView
            stories={filteredStories}
            userLocation={userLocation}
            onStoryClick={setSelectedStory}
          />
        )}
      </div>

      {identity && <CreateStoryFAB onClick={() => setCreateDialogOpen(true)} />}

      <CreateStoryDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        userLocation={userLocation}
      />

      <StoryDetailDialog
        story={selectedStory}
        open={!!selectedStory}
        onOpenChange={(open) => !open && setSelectedStory(null)}
        userLocation={userLocation}
      />
    </div>
  );
}
