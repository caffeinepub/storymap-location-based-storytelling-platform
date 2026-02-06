import { Button } from '@/components/ui/button';
import { Category } from '../backend';
import { getCategoryLabel } from '../lib/categories';

interface FilterBarProps {
  selectedCategory: Category | null;
  onCategoryChange: (category: Category | null) => void;
}

const categories: Category[] = [Category.love, Category.confession, Category.funny, Category.random, Category.other];

export default function FilterBar({
  selectedCategory,
  onCategoryChange,
}: FilterBarProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button
          variant={selectedCategory === null ? 'default' : 'outline'}
          size="sm"
          onClick={() => onCategoryChange(null)}
        >
          All
        </Button>
        {categories.map((category) => (
          <Button
            key={category}
            variant={selectedCategory === category ? 'default' : 'outline'}
            size="sm"
            onClick={() => onCategoryChange(category)}
          >
            {getCategoryLabel(category)}
          </Button>
        ))}
      </div>
    </div>
  );
}
