import { Component, ReactNode } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="grid min-h-dvh place-items-center bg-canvas p-6">
        <div className="flex w-full max-w-md flex-col items-center text-center">
          <span className="mb-5 grid size-[72px] place-items-center rounded-[22px] bg-ios-orange/14 text-ios-orange-text">
            <TriangleAlert className="size-9" strokeWidth={1.6} aria-hidden />
          </span>
          <h1 className="text-title1 font-bold">Something went wrong</h1>
          <p className="mt-2 text-body text-label-2">The page hit an unexpected problem. Reloading usually fixes it.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="press mt-6 inline-flex h-[50px] items-center gap-2 rounded-[14px] bg-tint px-6 text-headline font-semibold text-white">
            <RotateCcw className="size-5" aria-hidden />
            Reload page
          </button>
          {this.state.error?.message && (
            <details className="mt-8 w-full rounded-group bg-surface p-4 text-left">
              <summary className="cursor-pointer text-subhead font-medium text-label-2">Technical details</summary>
              <pre className="mt-3 overflow-auto whitespace-break-spaces text-footnote text-label-2">{this.state.error.stack || this.state.error.message}</pre>
            </details>
          )}
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
