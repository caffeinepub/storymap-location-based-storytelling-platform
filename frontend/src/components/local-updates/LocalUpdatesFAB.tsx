import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

interface LocalUpdatesFABProps {
  onClick: () => void;
}

export default function LocalUpdatesFAB({ onClick }: LocalUpdatesFABProps) {
  return (
    <Button
      onClick={onClick}
      size="lg"
      className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-shadow z-40 bg-gradient-to-br from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
    >
      <Plus className="h-6 w-6" />
      <span className="sr-only">Create Local Update</span>
    </Button>
  );
}
