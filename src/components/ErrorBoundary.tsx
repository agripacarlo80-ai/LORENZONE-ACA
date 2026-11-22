import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error.message || 'An unexpected error occurred.',
    };
  }

  render() {
    if (this.state.hasError) {
      let friendly = this.state.message;
      try {
        const parsed = JSON.parse(this.state.message) as { error?: string; operationType?: string; path?: string };
        if (parsed.error) {
          friendly = `${parsed.error} (${parsed.operationType || 'operation'} on ${parsed.path || 'database'})`;
        }
      } catch {
        // non-JSON message
      }

      return (
        <div className="min-h-screen bg-[#FAF8F2] flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white rounded-2xl border border-[#E5DEC9] p-8 shadow-sm text-center">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-[#EA7A26] flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-[#172A1E] mb-2">Something interrupted LORENZONE</h2>
            <p className="text-sm text-[#4D6354] mb-6 break-words">{friendly}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1E5B3A] text-white text-sm font-semibold hover:bg-[#17462C] transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Reload LORENZONE
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
