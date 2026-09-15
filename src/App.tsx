import { Component, useEffect } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ThemeProvider } from './theme/ThemeContext';
import { attachInputModalityTracking } from './theme/inputModality';
import { BottomTabBar } from './components/BottomTabBar';
import { HomeScreen } from './screens/HomeScreen';
import { RulesScreen } from './screens/RulesScreen';
import { TimerScreen } from './screens/TimerScreen';
import { GemsScreen } from './screens/GemsScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { ScoreScreen } from './screens/ScoreScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { ScheduledBlockRunner } from './components/ScheduledBlockRunner';
import { BlockingInterruptedBanner } from './components/BlockingInterruptedBanner';
import { StorageNoticeBanner } from './components/StorageNoticeBanner';
import { EngineContractBanner } from './components/EngineContractBanner';
import './screens/HomeScreen.brand.css';
import { ScreenErrorBoundary } from './components/ScreenErrorBoundary';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class AppErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log to console only — no remote reporting; privacy-first.
    console.error('[Amethyst] Unhandled render error', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: '100dvh', background: '#0d0d0f', color: '#e2d9f3', padding: '2rem', gap: '1rem',
          fontFamily: 'system-ui, sans-serif', textAlign: 'center',
        }}>
          <span style={{ fontSize: '2.5rem' }}>◈</span>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Something went wrong</h1>
          <p style={{ fontSize: '0.875rem', color: '#a78bca', margin: 0, maxWidth: '22rem' }}>
            Amethyst hit an unexpected error. Your data is safe — tap below to reload.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '0.5rem', padding: '0.65rem 1.75rem', borderRadius: '999px',
              background: 'linear-gradient(135deg, #a757f9, #7c3aed)', border: 'none',
              color: '#fff', fontSize: '0.9rem', fontWeight: 500, cursor: 'pointer',
            }}
          >
            Reload app
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);

  return null;
}

function MotionRoutes() {
  const { pathname } = useLocation();

  return (
    <div className="route-stage" key={pathname}>
      <Routes>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/home" element={<ScreenErrorBoundary screenName="Home"><HomeScreen /></ScreenErrorBoundary>} />
        <Route path="/apps" element={<ScreenErrorBoundary screenName="Apps"><RulesScreen /></ScreenErrorBoundary>} />
        <Route path="/rules" element={<Navigate to="/apps" replace />} />
        <Route path="/timer" element={<ScreenErrorBoundary screenName="Timer"><TimerScreen /></ScreenErrorBoundary>} />
        <Route path="/score" element={<ScreenErrorBoundary screenName="Score"><ScoreScreen /></ScreenErrorBoundary>} />
        <Route path="/gems" element={<ScreenErrorBoundary screenName="Gems"><GemsScreen /></ScreenErrorBoundary>} />
        <Route path="/profile" element={<ScreenErrorBoundary screenName="Profile"><ProfileScreen /></ScreenErrorBoundary>} />
        <Route path="/settings" element={<ScreenErrorBoundary screenName="Settings"><SettingsScreen /></ScreenErrorBoundary>} />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </div>
  );
}

function Shell() {
  useEffect(() => attachInputModalityTracking(document.documentElement), []);

  return (
    <div>
      <ScrollToTop />
      <ScheduledBlockRunner />
      <StorageNoticeBanner />
      <EngineContractBanner />
      <BlockingInterruptedBanner />
      <MotionRoutes />
      <BottomTabBar />
    </div>
  );
}

function App() {
  return (
    <AppErrorBoundary>
      <ThemeProvider>
        <HashRouter>
          <Shell />
        </HashRouter>
      </ThemeProvider>
    </AppErrorBoundary>
  );
}

export default App;
