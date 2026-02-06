export const locationPermissionCopy = {
  idle: {
    title: 'Location Required',
    description: 'Location is required to post and view nearby stories.',
    action: 'Allow Location Access',
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
      'To enable location access, please update your browser settings: Click the lock icon in the address bar, find Location permissions, and select "Allow". Then click "Retry Location Access" below.',
    action: 'Retry Location Access',
    secondaryAction: 'Enter Manually',
  },
  prompt: {
    title: 'Location Access',
    description: 'Click to allow location access for the best experience.',
    action: 'Allow Location Access',
    secondaryAction: 'Enter Manually',
  },
  unknown: {
    title: 'Location Access',
    description: 'Click to allow location access for the best experience.',
    action: 'Allow Location Access',
    secondaryAction: 'Enter Manually',
  },
  unsupported: {
    title: 'Location Not Supported',
    description: 'Your browser does not support geolocation. Please enter coordinates manually.',
    action: 'Enter Manually',
    secondaryAction: undefined,
  },
  insecure: {
    title: 'Secure Connection Required',
    description: 'Location access requires HTTPS or localhost. Please access this site via a secure connection.',
    action: 'Enter Manually',
    secondaryAction: undefined,
  },
} as const;

export function getLocationCopy(state: 'idle' | 'requesting' | 'granted' | 'denied' | 'prompt' | 'unknown' | 'unsupported' | 'insecure') {
  return locationPermissionCopy[state];
}
