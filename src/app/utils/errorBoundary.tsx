import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    
    // Si el error es por hot reload del contexto, intentar resetear después de 100ms
    if (error.message.includes('must be used within') && error.message.includes('Provider')) {
      setTimeout(() => {
        this.setState({ hasError: false, error: undefined });
      }, 100);
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex items-center justify-center min-h-screen bg-[var(--ui-background-f2f3f5)] p-6">
          <div className="bg-[var(--ui-surface)] rounded-lg border border-[var(--ui-border-9d9b9a)] p-8 max-w-md w-full text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <h2 className="text-2xl text-[color:var(--ui-text-3b3a36)] mb-2 font-bold">
              Error de Aplicación
            </h2>
            <p className="text-[color:var(--ui-text-muted-5f6773)] mb-6">
              Ha ocurrido un error inesperado. Por favor, recarga la página.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-[var(--ui-primary-2475c7)] text-white px-6 py-3 rounded-lg hover:bg-[var(--ui-primary-hover-1f5da6)] transition-colors font-medium"
            >
              Recargar Página
            </button>
            {this.state.error && (
              <details className="mt-4 text-left">
                <summary className="cursor-pointer text-sm text-[color:var(--ui-text-muted-5f6773)] hover:text-[color:var(--ui-text-3b3a36)]">
                  Detalles técnicos
                </summary>
                <pre className="mt-2 p-3 bg-[var(--ui-background-f2f3f5)] rounded text-xs overflow-auto">
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}