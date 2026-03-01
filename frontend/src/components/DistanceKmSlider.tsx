import { Label } from '@/components/ui/label';

interface DistanceKmSliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  inactive?: boolean;
  helperText?: string;
}

export default function DistanceKmSlider({
  value,
  onChange,
  min = 1,
  max = 50,
  step = 1,
  inactive = false,
  helperText,
}: DistanceKmSliderProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label 
          htmlFor="distance-slider" 
          className={`text-sm font-medium ${inactive ? 'text-muted-foreground' : ''}`}
        >
          Distance (km)
        </Label>
        <span className={`text-sm font-semibold ${inactive ? 'text-muted-foreground' : 'text-primary'}`}>
          {value} km
        </span>
      </div>
      <input
        id="distance-slider"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
          inactive ? 'opacity-60' : ''
        }`}
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{min} km</span>
        <span>{max} km</span>
      </div>
      {helperText && (
        <p className={`text-xs mt-1 ${inactive ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
          {helperText}
        </p>
      )}
    </div>
  );
}
