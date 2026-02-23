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
        <div className="flex items-center justify-center min-h-screen bg-[#F2F3F5] p-6">
          <div className="bg-white rounded-lg border border-[#9D9B9A] p-8 max-w-md w-full text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <h2 className="text-2xl text-[#3B3A36] mb-2 font-bold">
              Error de Aplicación
            </h2>
            <p className="text-[#5F6773] mb-6">
              Ha ocurrido un error inesperado. Por favor, recarga la página.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-[#2475C7] text-white px-6 py-3 rounded-lg hover:bg-[#1f5da6] transition-colors font-medium"
            >
              Recargar Página
            </button>
            {this.state.error && (
              <details className="mt-4 text-left">
                <summary className="cursor-pointer text-sm text-[#5F6773] hover:text-[#3B3A36]">
                  Detalles técnicos
                </summary>
                <pre className="mt-2 p-3 bg-[#F2F3F5] rounded text-xs overflow-auto">
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