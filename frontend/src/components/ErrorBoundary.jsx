import React from "react";
import Icon from "./Icon";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidMount() {
    if (typeof window !== "undefined") {
      window.addEventListener("popstate", this.handlePopState);
    }
  }

  componentWillUnmount() {
    if (typeof window !== "undefined") {
      window.removeEventListener("popstate", this.handlePopState);
    }
  }

  handlePopState = () => {
    if (this.state.hasError) {
      this.setState({ hasError: false, error: null });
    }
  };

  handleReload = () => {
    try {
      this.setState({ hasError: false, error: null });
      window.location.reload();
    } catch (e) {
      window.location.href = "/";
    }
  };

  handleReset = () => {
    try {
      this.setState({ hasError: false, error: null });
      if (typeof window !== "undefined") {
        window.location.href = window.location.origin;
      } else {
        window.location.href = "/";
      }
    } catch (e) {
      window.location.href = "/";
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-6 text-center select-none animate-fadeIn">
          <div className="max-w-md w-full p-8 rounded-3xl bg-surface-container border-2 border-slate-300 dark:border-slate-700 shadow-card">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center text-3xl">
              <Icon name="warning" className="text-3xl text-amber-500" />
            </div>
            
            <h2 className="text-xl font-bold text-on-surface mb-2">
              Affichage interrompu
            </h2>
            
            <p className="text-sm text-text-muted mb-6 leading-relaxed">
              Une anomalie de compatibilité temporaire est survenue sur votre navigateur. Cliquez ci-dessous pour rétablir l'affichage sans perte de données.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={this.handleReload}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-primary text-white font-semibold text-sm hover:opacity-95 active:scale-95 transition-all shadow-md flex items-center justify-center gap-2"
              >
                <Icon name="refresh" className="text-base" />
                Actualiser la page
              </button>
              
              <button
                onClick={this.handleReset}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-surface-secondary border-2 border-slate-300 dark:border-slate-700 text-on-surface font-semibold text-sm hover:bg-surface active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Icon name="storefront" className="text-base" />
                Accueil des Boutiques
              </button>
            </div>
          </div>
          
          <p className="mt-8 text-xs text-text-muted">
            GotoShop • Optimisé pour tous les navigateurs et connexions mobiles
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
