import React, { useState, useEffect } from "react";
import Icon from "./Icon";
import { fetchMerchantWallet, requestWalletWithdrawal } from "../api/client";

export default function WalletPage({ store, showToast }) {
  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState(null);
  const [error, setError] = useState(null);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [payoutPhone, setPayoutPhone] = useState("");
  const [payoutOperator, setPayoutOperator] = useState("ORANGE");
  const [payoutNote, setPayoutNote] = useState("");
  const [submittingWithdraw, setSubmittingWithdraw] = useState(false);

  const loadWallet = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchMerchantWallet(store?.slug);
      setWallet(data);
      if (data?.payout_phone) setPayoutPhone(data.payout_phone);
      if (data?.payout_operator) setPayoutOperator(data.payout_operator);
    } catch (err) {
      setError(err?.message || "Impossible de charger le portefeuille");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWallet();
  }, [store?.slug]);

  const handleWithdrawSubmit = async (e) => {
    e.preventDefault();
    const amt = parseInt(withdrawAmount, 10);
    if (!amt || amt <= 0) {
      if (showToast) showToast("Veuillez saisir un montant valide.", "error");
      return;
    }
    if (amt > (wallet?.available_balance || 0)) {
      if (showToast) showToast("Montant supérieur au solde disponible.", "error");
      return;
    }
    if (!payoutPhone.trim() || payoutPhone.trim().length < 8) {
      if (showToast) showToast("Veuillez indiquer un numéro de téléphone valide.", "error");
      return;
    }

    try {
      setSubmittingWithdraw(true);
      const res = await requestWalletWithdrawal({
        amount: amt,
        payoutPhone,
        payoutOperator,
        note: payoutNote,
        storeSlug: store?.slug,
      });
      if (showToast) showToast("Demande de retrait enregistrée avec succès !", "success");
      setIsWithdrawModalOpen(false);
      setWithdrawAmount("");
      loadWallet();
    } catch (err) {
      if (showToast) showToast(err?.message || "Erreur lors du retrait", "error");
    } finally {
      setSubmittingWithdraw(false);
    }
  };

  const badgeConfig = {
    ESCROW_CREDIT: { label: "Séquestre Reçu", color: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300", sign: "+" },
    ESCROW_RELEASE: { label: "Fonds Libérés", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300", sign: "+" },
    REFUND: { label: "Remboursement", color: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300", sign: "-" },
    WITHDRAWAL_REQUEST: { label: "Retrait en cours", color: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300", sign: "-" },
    WITHDRAWAL_PAID: { label: "Retrait Effectué", color: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300", sign: "-" },
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Icon name="wallet" className="w-7 h-7 text-orange-600" />
            Portefeuille Vendeur
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Gestion sécurisée de vos revenus et des flux d'argent garantis en séquestre.
          </p>
        </div>

        <button
          onClick={() => setIsWithdrawModalOpen(true)}
          disabled={!wallet || wallet.available_balance <= 0}
          className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-orange-600/20 transition-all"
        >
          <Icon name="arrow-up-right" className="w-4 h-4" />
          Demander un retrait
        </button>
      </div>

      {loading && (
        <div className="py-20 text-center space-y-3">
          <div className="w-10 h-10 border-4 border-orange-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-500">Chargement de votre portefeuille...</p>
        </div>
      )}

      {!loading && error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-3">
          <Icon name="alert-triangle" className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!loading && wallet && (
        <>
          {/* Balances Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white shadow-lg shadow-emerald-600/15">
              <span className="text-xs font-semibold text-emerald-100 uppercase tracking-wider block mb-1">
                Solde Retirable
              </span>
              <div className="text-2xl font-black">
                {wallet.available_balance.toLocaleString("fr-FR")} {wallet.currency}
              </div>
              <p className="text-[11px] text-emerald-100 mt-2 flex items-center gap-1">
                <Icon name="check-circle" className="w-3.5 h-3.5" />
                Disponible immédiatement
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg shadow-orange-600/15">
              <span className="text-xs font-semibold text-amber-100 uppercase tracking-wider block mb-1">
                En Séquestre
              </span>
              <div className="text-2xl font-black">
                {wallet.pending_balance.toLocaleString("fr-FR")} {wallet.currency}
              </div>
              <p className="text-[11px] text-amber-100 mt-2 flex items-center gap-1">
                <Icon name="clock" className="w-3.5 h-3.5" />
                Libéré dès livraison confirmée
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                Total Gagné
              </span>
              <div className="text-2xl font-black text-slate-900 dark:text-white">
                {wallet.total_earned.toLocaleString("fr-FR")} {wallet.currency}
              </div>
              <p className="text-[11px] text-slate-400 mt-2">Ventes en ligne cumulées</p>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                Total Retiré
              </span>
              <div className="text-2xl font-black text-slate-900 dark:text-white">
                {wallet.total_withdrawn.toLocaleString("fr-FR")} {wallet.currency}
              </div>
              <p className="text-[11px] text-slate-400 mt-2">Retraits vers Mobile Money</p>
            </div>
          </div>

          {/* Guarantee Banner */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-start gap-3">
            <Icon name="shield-check" className="w-6 h-6 text-indigo-600 shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              <strong className="text-slate-900 dark:text-white">Sécurité financière absolue :</strong> Tout paiement par Mobile Money est conservé en compte séquestre étanche. Dès que vous marquez la commande comme <span className="font-semibold text-emerald-600">Livrée</span>, l’argent bascule immédiatement dans votre solde retirable sans aucun délai bancaire.
            </div>
          </div>

          {/* Transactions Ledger */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Journal des Mouvements
              </h3>
              <span className="text-xs text-slate-500">
                {wallet.transactions.length} transaction(s)
              </span>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {wallet.transactions.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  Aucun mouvement enregistré pour le moment.
                </div>
              ) : (
                wallet.transactions.map((tx) => {
                  const cfg = badgeConfig[tx.type] || { label: tx.type, color: "bg-slate-100 text-slate-800", sign: "" };
                  return (
                    <div key={tx.id} className="p-4 sm:p-5 flex items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${cfg.color}`}>
                            {cfg.label}
                          </span>
                          <span className="text-xs font-mono text-slate-400">
                            {tx.reference}
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 dark:text-slate-300">
                          {tx.note || "Mouvement de portefeuille"}
                        </p>
                        <span className="text-[11px] text-slate-400">
                          {new Date(tx.created_at).toLocaleString("fr-FR")}
                        </span>
                      </div>

                      <div className="text-right">
                        <div className={`text-sm font-black ${cfg.sign === "+" ? "text-emerald-600 dark:text-emerald-400" : "text-slate-900 dark:text-white"}`}>
                          {cfg.sign}{tx.amount.toLocaleString("fr-FR")} FCFA
                        </div>
                        <span className="text-[10px] text-slate-400">
                          Solde : {tx.balance_after.toLocaleString("fr-FR")} FCFA
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}

      {/* Withdrawal Modal */}
      {isWithdrawModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800">
            <div className="p-5 bg-gradient-to-r from-orange-600 to-amber-600 text-white flex items-center justify-between">
              <h3 className="font-bold text-base">Demande de Retrait de Fonds</h3>
              <button
                onClick={() => setIsWithdrawModalOpen(false)}
                className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                <Icon name="x" className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleWithdrawSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Montant à retirer (FCFA)
                </label>
                <input
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  max={wallet?.available_balance || 0}
                  min={100}
                  placeholder={`Max : ${(wallet?.available_balance || 0).toLocaleString("fr-FR")}`}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-orange-500"
                  required
                />
                <span className="text-[11px] text-slate-500">
                  Solde disponible : {(wallet?.available_balance || 0).toLocaleString("fr-FR")} FCFA
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Opérateur Mobile Money
                </label>
                <select
                  value={payoutOperator}
                  onChange={(e) => setPayoutOperator(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-orange-500"
                >
                  <option value="ORANGE">Orange Money</option>
                  <option value="MOOV">Moov Money</option>
                  <option value="WAVE">Wave</option>
                  <option value="LIGDICASH">LigdiCash</option>
                  <option value="BANK">Virement Bancaire</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Numéro bénéficiaire
                </label>
                <input
                  type="tel"
                  value={payoutPhone}
                  onChange={(e) => setPayoutPhone(e.target.value)}
                  placeholder="Ex: 70 12 34 56"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-orange-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Note ou référence interne (optionnel)
                </label>
                <input
                  type="text"
                  value={payoutNote}
                  onChange={(e) => setPayoutNote(e.target.value)}
                  placeholder="Ex: Retrait recettes semaine"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsWithdrawModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submittingWithdraw}
                  className="flex-1 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow"
                >
                  {submittingWithdraw ? "Validation..." : "Valider le retrait"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
