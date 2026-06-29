// src/App.tsx
import { useEffect, useState } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useStore } from './hooks/useStore';
import { useNotifications } from './hooks/useNotifications';
import BottomNav from './components/layout/BottomNav';
import { NotificationAlert } from './components/ui/NotificationAlert';
import InstallPrompt from './components/ui/InstallPrompt';
import Dashboard from './pages/Dashboard';
import Timetable from './pages/Timetable';
import Attendance from './pages/Attendance';
import Settings from './pages/Settings';
import More from './pages/More';
import Onboarding from './pages/Onboarding';
import AuthScreen from './pages/AuthScreen';
import SplashScreen from './pages/SplashScreen';
import Landing from './pages/Landing';
import Materials from './pages/Materials';
import Assignments from './pages/Assignments';
import Timer from './pages/Timer';
import GPA from './pages/GPA';
import AIAssistant from './pages/AIAssistant';
// Public route pages
import About   from './pages/public/About';
import Features from './pages/public/Features';
import FAQ     from './pages/public/FAQ';
import { Contact, Privacy, Terms, Support } from './pages/public/PublicPages';

export default function App() {
  const { authLoading, currentUser, hasProfile, initAuth, settings } = useStore();
  const [splashDone, setSplashDone] = useState(false);
  const navigate  = useNavigate();
  const location  = useLocation();

  useEffect(() => {
    const unsubscribe = initAuth();
    return unsubscribe;
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setSplashDone(true), 1500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (settings?.theme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }
  }, [settings?.theme]);

  // ── Gate 1: Splash ────────────────────────────────────────────────────────
  if (!splashDone || authLoading) {
    return <SplashScreen />;
  }

  // ── Public routes — always accessible, even when logged out ───────────────
  // These are rendered BEFORE the auth gate so Google can crawl them.
  // The nav "Get Started" button navigates to "/" which shows Landing.
  const PUBLIC_PATHS = ['/', '/about', '/features', '/faq', '/contact', '/privacy', '/terms', '/support'];
  const isPublicRoute = PUBLIC_PATHS.includes(location.pathname);

  // If no user and we're on a public sub-page (/about etc.) → render it
  // If no user and on / → show Landing (or AuthScreen if they clicked Get Started)
  if (!currentUser && isPublicRoute) {
    const handleGetStarted = () => navigate('/_auth');
    return (
      <div className="dark bg-dark-950 min-h-screen">
        <Routes>
          <Route path="/"        element={<Landing onGetStarted={handleGetStarted} />} />
          <Route path="/about"   element={<About />} />
          <Route path="/features" element={<Features />} />
          <Route path="/faq"     element={<FAQ />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms"   element={<Terms />} />
          <Route path="/support" element={<Support />} />
          {/* Fallback — unknown paths go to Landing */}
          <Route path="*"        element={<Landing onGetStarted={handleGetStarted} />} />
        </Routes>
        <InstallPrompt />
      </div>
    );
  }

  // ── Auth screen — reached via Get Started button or direct /_auth ─────────
  if (!currentUser) {
    return (
      <div className="dark bg-dark-950 min-h-screen">
        <AuthScreen />
        <InstallPrompt />
      </div>
    );
  }

  // ── Gate 3: Logged in but no profile → Onboarding ────────────────────────
  if (!hasProfile) {
    return (
      <div className="dark bg-dark-950 min-h-screen">
        <Onboarding />
        <InstallPrompt />
      </div>
    );
  }

  // ── Gate 4: Fully authenticated → Main app ────────────────────────────────
  return <MainApp />;
}

function MainApp() {
  const { activeTab, settings } = useStore();
  const { alert, dismissAlert } = useNotifications();
  const isInnerPage = ['gpa', 'timer', 'assignments', 'materials', 'ai'].includes(activeTab);

  return (
    <div className={settings?.theme === 'dark' ? 'dark' : ''}>
      <NotificationAlert visible={alert.visible} payload={alert.payload} onDismiss={dismissAlert} />
      <InstallPrompt />
      <div className="bg-dark-950 min-h-screen pb-20">
        {activeTab === 'dashboard'   && <Dashboard />}
        {activeTab === 'timetable'   && <Timetable />}
        {activeTab === 'attendance'  && <Attendance />}
        {activeTab === 'settings'    && <Settings />}
        {activeTab === 'more'        && <More />}
        {activeTab === 'gpa'         && <GPA />}
        {activeTab === 'timer'       && <Timer />}
        {activeTab === 'assignments' && <Assignments />}
        {activeTab === 'materials'   && <Materials />}
        {activeTab === 'ai'          && <AIAssistant />}
        {!isInnerPage && <BottomNav />}
      </div>
    </div>
  );
}