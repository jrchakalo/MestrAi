import React from 'react';
import { Button } from './Button';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('UI render error boundary caught:', error);
  }

  handleReset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl border border-red-800/60 bg-red-950/30 p-4 text-red-100">
          <p className="font-semibold">{this.props.fallbackTitle || 'Erro inesperado no chat'}</p>
          <p className="mt-1 text-sm text-red-200/80">
            {this.props.fallbackMessage || 'A interface encontrou uma falha de renderização. Tente recarregar ou continuar após reiniciar este bloco.'}
          </p>
          <div className="mt-3">
            <Button size="sm" variant="outline" onClick={this.handleReset}>
              Tentar recuperar
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
