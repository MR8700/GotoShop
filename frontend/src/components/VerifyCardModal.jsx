import React, { useEffect, useState } from "react";
import Icon from "./Icon";
import { fetchLoyaltyVerification } from "../api/client";

export default function VerifyCardModal({ cardNo, code, onClose, onNavigateToStore }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetchLoyaltyVerification(cardNo, code);
        if (isMounted) {
          setData(res);
        }
      } catch (err) {
        if (isMounted) {
          setError(err?.message || "Erreur de vérification");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    if (cardNo && code) {
      load();
    }
    return () => {
      isMounted = false;
    };
  }, [cardNo, code]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
    >
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800">
        {/* Header decoration */}
        <div className="relative p-6 pb-4 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white text-center">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            aria-label="Fermer"
          >
            <Icon name="x" className="w-5 h-5" />
          </button>
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shadow-inner">
            <Icon name="award" className="w-8 h-8 text-amber-400" />
          </div>
          <h2 className="text-xl font-bold tracking-tight">Authenticité Carte de Fidélité</h2>
          <p className="text-xs text-slate-300 mt-1">Protocole cryptographique GotoShop (HMAC-SHA256)</p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {loading && (
            <div className="py-12 text-center space-y-3">
              <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                Vérification auprès du registre souverain...
              </p>
            </div>
          )}

          {!loading && error && (
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-center">
              <Icon name="alert-triangle" className="w-8 h-8 text-rose-500 mx-auto mb-2" />
              <h3 className="text-sm font-semibold text-rose-800 dark:text-rose-200">Erreur de connexion</h3>
              <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">{error}</p>
            </div>
          )}

          {!loading && !error && data && data.valid && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow">
                  <Icon name="check" className="w-6 h-6 stroke-[3]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-emerald-800 dark:text-emerald-200">
                      Carte Authentique & Valide
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        data.status === "ACTIVE"
                          ? "bg-emerald-200 text-emerald-800 dark:bg-emerald-800 dark:text-emerald-200"
                          : "bg-amber-200 text-amber-800 dark:bg-amber-800 dark:text-amber-200"
                      }`}
                    >
                      {data.status === "ACTIVE" ? "Active" : "Suspendue"}
                    </span>
                  </div>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
                    Certifiée par la signature cryptographique du commerçant.
                  </p>
                </div>
              </div>

              {/* Card Details */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-700">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Titulaire</span>
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">
                    {data.holder || "Client GotoShop"}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-700">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Numéro de carte</span>
                  <span className="text-xs font-mono font-medium text-slate-700 dark:text-slate-300">
                    {data.card_number_masked}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-700">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Palier de privilège</span>
                  <span className="text-sm font-bold text-amber-600 dark:text-amber-400">
                    {data.tier || "Standard"}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-700">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Points fidélité réels</span>
                  <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                    {Number(data.points ?? 0).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} pt
                  </span>
                </div>
                {data.store && (
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-xs text-slate-500 dark:text-slate-400">Boutique émettrice</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                        {data.store.name}
                      </span>
                      {data.store.is_verified && (
                        <Icon name="check-circle" className="w-3.5 h-3.5 text-blue-500" />
                      )}
                    </div>
                  </div>
                )}
              </div>

              {data.store?.slug && onNavigateToStore && (
                <button
                  onClick={() => onNavigateToStore(data.store.slug)}
                  className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 transition-all"
                >
                  <Icon name="store" className="w-4 h-4" />
                  Visiter la boutique {data.store.name}
                </button>
              )}
            </div>
          )}

          {!loading && !error && data && !data.valid && (
            <div className="p-5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-rose-600 text-white flex items-center justify-center mx-auto shadow">
                <Icon name="x" className="w-7 h-7 stroke-[3]" />
              </div>
              <h3 className="text-base font-bold text-rose-900 dark:text-rose-200">
                Carte Invalide ou Falsifiée
              </h3>
              <p className="text-xs text-rose-700 dark:text-rose-400 leading-relaxed">
                Le numéro de carte ou le code de sécurité cryptographique ne correspond à aucun enregistrement valide dans le système GotoShop.
              </p>
              <div className="p-2.5 rounded-lg bg-rose-100/60 dark:bg-rose-900/40 text-[11px] font-mono text-rose-800 dark:text-rose-300">
                Card: {cardNo} • Code: {code}
              </div>
            </div>
          )}

          <button
            onClick={onClose}
            className="w-full py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
