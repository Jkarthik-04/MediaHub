import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { hasError: boolean };

export class ErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false };
  public static getDerivedStateFromError(): State {
    return { hasError: true };
  }
  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Unhandled client error', { error, errorInfo });
  }
  public render() {
    if (this.state.hasError)
      return (
        <main className="fallback-page">
          <section className="state-panel">
            <p className="eyebrow">Unexpected error</p>
            <h1>MediaHub could not render this page.</h1>
            <p>
              Try returning to the dashboard. If the problem continues, check the browser console.
            </p>
            <button
              className="button button-primary"
              onClick={() => window.location.assign('/')}
              type="button"
            >
              Return to dashboard
            </button>
          </section>
        </main>
      );
    return this.props.children;
  }
}
