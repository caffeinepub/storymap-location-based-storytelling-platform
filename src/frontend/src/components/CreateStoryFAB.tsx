import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

interface CreateStoryFABProps {
  onClick: () => void | Promise<void>;
}

export default function CreateStoryFAB({ onClick }: CreateStoryFABProps) {
  return (
    <Button
      onClick={onClick}
      size="lg"
      className="fixed bottom-8 right-8 h-16 w-16 rounded-full shadow-lg bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 hover:shadow-xl transition-all hover:scale-110"
    >
      <Plus className="h-8 w-8" />
      <span className="sr-only">Create story</span>
    </Button>
  );
}
