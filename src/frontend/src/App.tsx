import { useEffect, useState } from 'react';
import { useInternetIdentity } from './hooks/useInternetIdentity';
import { useGetCallerUserProfile } from './hooks/useQueries';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@/components/ui/sonner';
import Header from './components/Header';
import Footer from './components/Footer';
import ProfileSetupModal from './components/ProfileSetupModal';
import HomePage from './pages/HomePage';
import ProfilePage from './pages/ProfilePage';
import AdminModerationPage from './pages/AdminModerationPage';

type View = 'home' | 'profile' | 'admin';

const WALLPAPER_STORAGE_KEY = 'storymap-wallpaper';

export default function App() {
  const { identity, isInitializing } = useInternetIdentity();
  const { data: userProfile, isLoading: profileLoading, isFetched } = useGetCallerUserProfile();
  const [currentView, setCurrentView] = useState<View>('home');

  const isAuthenticated = !!identity;
  const showProfileSetup = isAuthenticated && !profileLoading && isFetched && userProfile === null;

  // Clean up any previously persisted wallpaper on mount
  useEffect(() => {
    try {
      localStorage.removeItem(WALLPAPER_STORAGE_KEY);
    } catch (error) {
      // Silently ignore storage errors
    }
  }, []);

  // Runtime guard to detect and recover from stuck non-interactive UI state
  useEffect(() => {
    const checkInteractivity = () => {
      const body = document.body;
      const root = document.getElementById('root');
      
      // Check if body or root has pointer-events: none
      if (body && window.getComputedStyle(body).pointerEvents === 'none') {
        console.warn('Detected pointer-events: none on body, restoring interactivity');
        body.style.pointerEvents = 'auto';
      }
      
      if (root && window.getComputedStyle(root).pointerEvents === 'none') {
        console.warn('Detected pointer-events: none on root, restoring interactivity');
        root.style.pointerEvents = 'auto';
      }

      // Check for inert attribute
      if (body?.hasAttribute('inert')) {
        console.warn('Detected inert attribute on body, removing');
        body.removeAttribute('inert');
      }
      
      if (root?.hasAttribute('inert')) {
        console.warn('Detected inert attribute on root, removing');
        root.removeAttribute('inert');
      }
    };

    // Check on mount and after authentication state changes
    checkInteractivity();
    
    // Set up a periodic check (every 2 seconds) to catch any stuck states
    const intervalId = setInterval(checkInteractivity, 2000);
    
    return () => clearInterval(intervalId);
  }, [isAuthenticated, isInitializing]);

  // Guard: redirect to home if trying to access profile/admin while unauthenticated
  useEffect(() => {
    if ((currentView === 'profile' || currentView === 'admin') && !isAuthenticated) {
      setCurrentView('home');
    }
  }, [currentView, isAuthenticated]);

  if (isInitializing) {
    return (
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <div className="flex h-screen items-center justify-center">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
            <p className="text-muted-foreground">Loading StoryMap...</p>
          </div>
        </div>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <div className="app-container">
        <div className="app-content">
          <Header 
            onNavigateProfile={() => setCurrentView('profile')} 
            onNavigateHome={() => setCurrentView('home')}
            onNavigateAdmin={() => setCurrentView('admin')}
          />
          <main className="flex-1">
            {currentView === 'home' && <HomePage />}
            {currentView === 'profile' && isAuthenticated && (
              <ProfilePage onBackHome={() => setCurrentView('home')} />
            )}
            {currentView === 'profile' && !isAuthenticated && (
              <div className="container px-4 py-16 text-center">
                <h2 className="text-2xl font-bold mb-4">Please log in to view your profile</h2>
                <p className="text-muted-foreground">You need to be authenticated to access this page.</p>
              </div>
            )}
            {currentView === 'admin' && <AdminModerationPage />}
          </main>
          <Footer />
          {showProfileSetup && <ProfileSetupModal />}
          <Toaster />
        </div>
      </div>
    </ThemeProvider>
  );
}
