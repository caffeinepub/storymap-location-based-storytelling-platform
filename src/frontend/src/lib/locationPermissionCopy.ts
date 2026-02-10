export const locationPermissionCopy = {
  idle: {
    title: 'Location Required',
    description: 'Pick a location on the map or use your current location.',
    action: 'Use My Current Location',
    secondaryAction: undefined,
  },
  requesting: {
    title: 'Requesting Location',
    description: 'Please allow location permissions in your browser.',
    action: null,
    secondaryAction: undefined,
  },
  granted: {
    title: 'Location Enabled',
    description: 'Your location has been successfully set.',
    action: null,
    secondaryAction: undefined,
  },
  denied: {
    title: 'Location Access Denied',
    description:
      'Location access is not available. You can still select a location by clicking on the map.',
    action: 'Retry Location Access',
    secondaryAction: 'Enter Manually',
  },
  prompt: {
    title: 'Location Access',
    description: 'Pick a location on the map or allow location access.',
    action: 'Use My Current Location',
    secondaryAction: 'Enter Manually',
  },
  unknown: {
    title: 'Location Access',
    description: 'Pick a location on the map or allow location access.',
    action: 'Use My Current Location',
    secondaryAction: 'Enter Manually',
  },
  unsupported: {
    title: 'Location Not Supported',
    description: 'Your browser does not support geolocation. Please use the map picker or enter coordinates manually.',
    action: 'Enter Manually',
    secondaryAction: undefined,
  },
  insecure: {
    title: 'Secure Connection Required',
    description: 'Location access requires HTTPS or localhost. Please use the map picker or enter coordinates manually.',
    action: 'Enter Manually',
    secondaryAction: undefined,
  },
} as const;

export function getLocationCopy(state: 'idle' | 'requesting' | 'granted' | 'denied' | 'prompt' | 'unknown' | 'unsupported' | 'insecure') {
  return locationPermissionCopy[state];
}
