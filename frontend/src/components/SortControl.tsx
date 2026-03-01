import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { SortOption } from '../lib/storySorting';

interface SortControlProps {
  value: SortOption;
  onChange: (value: SortOption) => void;
  nearestDisabled?: boolean;
}

export default function SortControl({ value, onChange, nearestDisabled = false }: SortControlProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="sort-select" className="text-sm font-medium">
        Sort by
      </Label>
      <Select value={value} onValueChange={(val) => onChange(val as SortOption)}>
        <SelectTrigger id="sort-select" className="w-full">
          <SelectValue placeholder="Select sorting" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="newest">Newest</SelectItem>
          <SelectItem value="nearest" disabled={nearestDisabled}>
            Nearest {nearestDisabled && '(location required)'}
          </SelectItem>
          <SelectItem value="mostViewed">Most viewed</SelectItem>
          <SelectItem value="mostLiked">Most liked</SelectItem>
          <SelectItem value="mostPinned">Most pinned</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
