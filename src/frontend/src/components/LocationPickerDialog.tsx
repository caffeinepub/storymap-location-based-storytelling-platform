import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MapPin, Check, X, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import MapView from './MapView';

interface LocationPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialLocation?: { latitude: number; longitude: number } | null;
  onConfirm: (location: { latitude: number; longitude: number }) => void;
  onCancel: () => void;
}

export default function LocationPickerDialog({
  open,
  onOpenChange,
  initialLocation,
  onConfirm,
  onCancel,
}: LocationPickerDialogProps) {
  const [selectedLocation, setSelectedLocation] = useState<{ latitude: number; longitude: number } | null>(
    initialLocation || null
  );
  const [centerCoordinate, setCenterCoordinate] = useState<{ latitude: number; longitude: number } | null>(null);
  const [geolocationStatus, setGeolocationStatus] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle');
  const [geolocationMessage, setGeolocationMessage] = useState<string | null>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedLocation(initialLocation || null);
      setGeolocationStatus('idle');
      setGeolocationMessage(null);
      
      // Determine initial center deterministically
      if (initialLocation) {
        // If we have an initial location, center on it
        setCenterCoordinate(initialLocation);
      } else {
        // Otherwise, attempt to get user's current location
        requestGeolocation();
      }
    } else {
      // Clear center when dialog closes to ensure fresh state on next open
      setCenterCoordinate(null);
    }
  }, [open, initialLocation]);

  const requestGeolocation = () => {
    if (!navigator.geolocation) {
      setGeolocationStatus('denied');
      setGeolocationMessage('Geolocation is not supported by your browser. Please click on the map to select a location.');
      // Use default fallback center
      setCenterCoordinate({ latitude: 40.7128, longitude: -74.006 });
      return;
    }

    setGeolocationStatus('requesting');
    setGeolocationMessage('Requesting your location...');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setCenterCoordinate(coords);
        setGeolocationStatus('granted');
        setGeolocationMessage(null);
      },
      (error) => {
        console.error('Geolocation error:', error);
        setGeolocationStatus('denied');
        
        let message = 'Location access is not available. Please click on the map to select a location.';
        if (error.code === error.PERMISSION_DENIED) {
          message = 'Location access was denied. Please click on the map to select a location.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          message = 'Location information is unavailable. Please click on the map to select a location.';
        } else if (error.code === error.TIMEOUT) {
          message = 'Location request timed out. Please click on the map to select a location.';
        }
        
        setGeolocationMessage(message);
        // Use default fallback center
        setCenterCoordinate({ latitude: 40.7128, longitude: -74.006 });
      },
      {
        enableHighAccuracy: false,
        timeout: 5000,
        maximumAge: 0,
      }
    );
  };

  const handleMapClick = (latitude: number, longitude: number) => {
    setSelectedLocation({ latitude, longitude });
    // Clear any geolocation messages once user interacts with map
    if (geolocationMessage) {
      setGeolocationMessage(null);
    }
  };

  const handleConfirm = () => {
    if (selectedLocation) {
      onConfirm(selectedLocation);
      onOpenChange(false);
    }
  };

  const handleCancel = () => {
    onCancel();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col pointer-events-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Pick Location on Map
          </DialogTitle>
          <DialogDescription>
            Click anywhere on the map to set your story's location. You can also search for a place using the search box.
          </DialogDescription>
        </DialogHeader>

        {geolocationMessage && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{geolocationMessage}</AlertDescription>
          </Alert>
        )}

        <div className="flex-1 min-h-[400px] rounded-lg overflow-hidden border">
          {open && (
            <MapView
              stories={[]}
              userLocation={null}
              onStoryClick={() => {}}
              onMapBackgroundClick={handleMapClick}
              selectedLocation={selectedLocation}
              isVisible={open}
              centerCoordinate={centerCoordinate}
            />
          )}
        </div>

        {selectedLocation && (
          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg text-sm">
            <MapPin className="h-4 w-4 text-green-600" />
            <span className="font-medium">Selected:</span>
            <span className="text-muted-foreground">
              {selectedLocation.latitude.toFixed(6)}, {selectedLocation.longitude.toFixed(6)}
            </span>
          </div>
        )}

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={handleCancel}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedLocation}>
            <Check className="h-4 w-4 mr-2" />
            Confirm Location
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
