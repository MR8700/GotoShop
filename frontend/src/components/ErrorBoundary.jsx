import React from "react";
import Icon from "./Icon";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
      copied: false,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[GotoShop ErrorBoundary Caught]:", error, errorInfo);
    this.setState({ errorInfo });
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
      this.setState({ hasError: false, error: null, errorInfo: null });
    }
  };

  handleReload = () => {
    try {
      this.setState({ hasError: false, error: null, errorInfo: null });
      if (typeof window !== "undefined") {
        window.location.reload();
      }
    } catch (e) {
      this.handleCleanReset();
    }
  };

  handleCleanReset = () => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        // Clear all cached items that might cause deserialization or corrupt state errors
        const keysToRemove = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const k = window.localStorage.key(i);
          if (k && (k.startsWith("gotoshop_cache_") || k.includes("view") || k.includes("slug"))) {
            keysToRemove.push(k);
          }
        }
        keysToRemove.forEach((k) => window.localStorage.removeItem(k));
        window.sessionStorage?.clear();
      }
    } catch (e) {
      console.warn("Storage cleanup notice:", e);
    }

    this.setState({ hasError: false, error: null, errorInfo: null });
    if (typeof window !== "undefined") {
      try {
        window.location.replace(window.location.origin);
      } catch (e) {
        window.location.href = "/";
      }
    }
  };

  handleReset = () => {
    try {
      this.setState({ hasError: false, error: null, errorInfo: null });
      if (typeof window !== "undefined") {
        window.location.replace(window.location.origin);
      } else {
        window.location.href = "/";
      }
    } catch (e) {
      this.handleCleanReset();
    }
  };

  handleCopyError = () => {
    const errorText = `[GotoShop Runtime Report]\nError: ${this.state.error?.toString()}\nStack: ${this.state.error?.stack || "N/A"}\nComponent Stack: ${this.state.errorInfo?.componentStack || "N/A"}`;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(errorText);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2500);
    }
  };

  render() {
    if (this.state.hasError) {
      const errorMessage = this.state.error?.message || this.state.error?.toString() || "Erreur de rendu inattendue";

      return (
        <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-4 sm:p-6 text-center select-none animate-fadeIn">
          <div className="max-w-lg w-full p-6 sm:p-8 rounded-3xl bg-surface-container border-2 border-slate-300 dark:border-slate-700 shadow-card text-left">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center text-3xl">
              <Icon name="warning" className="text-3xl text-amber-500" />
            </div>

            <h2 className="text-xl font-bold text-on-surface mb-2 text-center">
              Affichage interrompu
            </h2>

            <p className="text-xs sm:text-sm text-text-muted mb-6 leading-relaxed text-center">
              Une anomalie temporaire est survenue lors du chargement de cet écran. Vous pouvez débloquer l'application instantanément sans perte de vos commandes.
            </p>

            {/* Error Message Snippet */}
            <div className="mb-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 dark:text-rose-400 text-xs font-mono break-words leading-snug">
              <strong>Détail :</strong> {errorMessage}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={this.handleCleanReset}
                className="w-full py-3 px-4 rounded-xl bg-primary hover:brightness-105 active:scale-98 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
              >
                <Icon name="restart_alt" className="text-lg" />
                <span>Débloquer & Rétablir l'Accès (Recommandé)</span>
              </button>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={this.handleReload}
                  className="py-2.5 px-3 rounded-xl bg-surface-secondary hover:bg-surface-elevated border-2 border-slate-300 dark:border-slate-700 text-on-surface font-semibold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Icon name="refresh" className="text-base" />
                  <span>Actualiser la page</span>
                </button>

                <button
                  type="button"
                  onClick={this.handleReset}
                  className="py-2.5 px-3 rounded-xl bg-surface-secondary hover:bg-surface-elevated border-2 border-slate-300 dark:border-slate-700 text-on-surface font-semibold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Icon name="storefront" className="text-base" />
                  <span>Accueil des Boutiques</span>
                </button>
              </div>
            </div>

            {/* Expandable Technical Details */}
            <div className="mt-5 pt-4 border-t border-subtle">
              <button
                type="button"
                onClick={() => this.setState((prev) => ({ showDetails: !prev.showDetails }))}
                className="text-[11px] text-on-surface-variant hover:text-on-surface font-medium flex items-center justify-between w-full cursor-pointer"
              >
                <span className="flex items-center gap-1">
                  <Icon name="bug_report" className="text-sm" />
                  <span>Détails techniques pour développeurs</span>
                </span>
                <Icon name={this.state.showDetails ? "expand_less" : "expand_more"} className="text-base" />
              </button>

              {this.state.showDetails && (
                <div className="mt-3 p-3 rounded-xl bg-surface-secondary border border-subtle text-[10px] font-mono text-on-surface-variant space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-on-surface">Pile d'erreur :</span>
                    <button
                      type="button"
                      onClick={this.handleCopyError}
                      className="px-2 py-0.5 rounded bg-surface hover:bg-surface-elevated border border-subtle text-on-surface text-[10px] flex items-center gap-1 cursor-pointer"
                    >
                      <Icon name={this.state.copied ? "check" : "content_copy"} className="text-xs" />
                      <span>{this.state.copied ? "Copié !" : "Copier"}</span>
                    </button>
                  </div>
                  <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap select-all leading-tight">
                    {this.state.error?.stack || this.state.error?.message || "Aucune pile disponible."}
                  </pre>
                  {this.state.errorInfo?.componentStack && (
                    <pre className="max-h-32 overflow-y-auto whitespace-pre-wrap select-all leading-tight opacity-75 border-t border-subtle pt-2">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  )}
                </div>
              )}
            </div>
          </div>

          <p className="mt-6 text-xs text-text-muted">
            GotoShop • Optimisé pour tous les navigateurs et connexions mobiles
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
