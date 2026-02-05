import { Heart } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="border-t bg-background">
      <div className="container flex h-16 items-center justify-center px-4">
        <p className="text-sm text-muted-foreground flex items-center gap-1">
          © 2025. Built with <Heart className="h-3 w-3 text-red-500 fill-red-500" /> using{' '}
          <a
            href="https://caffeine.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-foreground hover:underline"
          >
            caffeine.ai
          </a>
        </p>
      </div>
    </footer>
  );
}
