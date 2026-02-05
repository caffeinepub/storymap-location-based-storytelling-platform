import { useState } from 'react';
import { useSaveCallerUserProfile } from '../hooks/useQueries';
import { useInternetIdentity } from '../hooks/useInternetIdentity';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export default function ProfileSetupModal() {
  const [username, setUsername] = useState('');
  const { identity } = useInternetIdentity();
  const saveMutation = useSaveCallerUserProfile();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!identity || !username.trim()) return;

    saveMutation.mutate({
      id: identity.getPrincipal(),
      username: username.trim(),
      storiesPosted: BigInt(0),
      likedStories: [],
      pinnedStories: [],
      seenIntro: false,
    });
  };

  return (
    <Dialog open={true}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Welcome to StoryMap!</DialogTitle>
          <DialogDescription>
            Please choose a username to get started with sharing and discovering stories.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={30}
              required
            />
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={!username.trim() || saveMutation.isPending}
          >
            {saveMutation.isPending ? 'Saving...' : 'Continue'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
