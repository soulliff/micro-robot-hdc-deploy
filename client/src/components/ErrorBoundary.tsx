import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props { children: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          background: '#0d1117', color: '#f85149', padding: 40,
          textAlign: 'center', minHeight: '100vh',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          <h2 style={{ color: '#f85149', marginBottom: 12 }}>Something went wrong</h2>
          <pre style={{ color: '#8b949e', fontSize: 12, maxWidth: 600, overflow: 'auto', textAlign: 'left' }}>
            {this.state.error?.message}
          </pre>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              marginTop: 16, padding: '8px 20px', background: '#1f6feb', color: '#fff',
              border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14,
            }}
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
