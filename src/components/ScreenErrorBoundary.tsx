import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  screenName: string;
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ScreenErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[Amethyst] ${this.props.screenName} render error`, error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: '60dvh', padding: '2rem', gap: '0.75rem',
          fontFamily: 'system-ui, sans-serif', textAlign: 'center',
        }}>
          <div style={{
            padding: '1.25rem 1.75rem', borderRadius: '20px',
            border: '1px solid rgba(168,85,247,0.2)',
            background: 'linear-gradient(145deg, rgba(20,18,28,0.95), rgba(10,10,14,0.95))',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem',
          }}>
            <span style={{ fontSize: '1.5rem' }}>◈</span>
            <strong style={{ fontSize: '0.9rem', fontWeight: 600, color: '#e2d9f3' }}>
              {this.props.screenName} hit an error
            </strong>
            <p style={{ fontSize: '0.8rem', color: '#a78bca', margin: 0, maxWidth: '18rem', lineHeight: 1.4 }}>
              Something went wrong on this screen. Your data is safe.
            </p>
            <button
              onClick={() => this.setState({ hasError: false })}
              style={{
                marginTop: '0.25rem', padding: '0.5rem 1.25rem', borderRadius: '999px',
                background: 'rgba(168,85,247,0.2)', border: '1px solid rgba(168,85,247,0.3)',
                color: '#d4b5ff', fontSize: '0.82rem', fontWeight: 500, cursor: 'pointer',
              }}
            >
              Tap to retry
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
