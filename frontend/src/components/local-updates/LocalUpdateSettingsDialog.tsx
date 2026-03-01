import { LocalCategory } from '../../backend';
import { getLocalCategoryLabel } from '../../lib/localUpdates';
import { useLocalUpdateMuting } from '../../hooks/useLocalUpdateMuting';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Bell, BellOff } from 'lucide-react';

interface LocalUpdateSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const categories = [
  LocalCategory.traffic,
  LocalCategory.power,
  LocalCategory.police,
  LocalCategory.event,
  LocalCategory.nature,
  LocalCategory.general,
];

export default function LocalUpdateSettingsDialog({
  open,
  onOpenChange,
}: LocalUpdateSettingsDialogProps) {
  const { mutedCategories, toggleMute } = useLocalUpdateMuting();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Local Update Settings</DialogTitle>
          <DialogDescription>
            Manage which categories of local updates you want to receive notifications for.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {categories.map((category) => {
            const isMuted = mutedCategories[category];
            return (
              <div
                key={category}
                className="flex items-center justify-between space-x-2 p-3 rounded-lg border"
              >
                <div className="flex items-center gap-3">
                  {isMuted ? (
                    <BellOff className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <Bell className="h-5 w-5 text-primary" />
                  )}
                  <Label
                    htmlFor={`mute-${category}`}
                    className="text-sm font-medium cursor-pointer"
                  >
                    {getLocalCategoryLabel(category)}
                  </Label>
                </div>
                <Switch
                  id={`mute-${category}`}
                  checked={!isMuted}
                  onCheckedChange={() => toggleMute(category)}
                />
              </div>
            );
          })}
        </div>

        <div className="text-xs text-muted-foreground">
          <p>
            Muted categories will not trigger notifications, but you can still view them in the
            list.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
