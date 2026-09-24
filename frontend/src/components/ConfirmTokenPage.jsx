import Icon from "./Icon";
import React, { useState, useEffect } from "react";
import { confirmByToken } from "../api/client";

export default function ConfirmTokenPage({ token, onBackToStore, showToast }) {
  const [isDone, setIsDone] = useState(false);
  const [isSold, setIsSold] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleDecision = async (sold) => {
    setLoading(true);
    try {
      const res = await confirmByToken(token, { is_sold: sold });
      setIsSold(sold);
      setIsDone(true);
      setMessage(res.message);
      showToast(sold ? "Vente confirmée avec succès !" : "Abandon enregistré.");
    } catch (err) {
      showToast(err.message || "Erreur de validation");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-margin py-8 max-w-md mx-auto text-center">
      <div className="w-full bg-surface-container-high rounded-2xl p-6 shadow-2xl border border-white/5 flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-primary-container/20 text-primary-container flex items-center justify-center">
          <Icon name="verified" className="text-[32px]" />
        </div>

        <span className="px-3 py-1 rounded-full bg-secondary-container/20 text-secondary font-label-sm text-xs font-bold uppercase">
          Lien de Relance 24h Sécurisé
        </span>

        <h2 className="font-headline-sm text-headline-sm text-on-surface">
          Arbitrage Vente Commerciale
        </h2>

        {!isDone ? (
          <>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Cette intention de commande a été initiée il y a 24 heures via vos canaux sociaux. Confirmez si le client a conclu l'achat pour mettre à jour vos statistiques et votre trésorerie.
            </p>

            <div className="w-full bg-surface-container p-3 rounded-xl flex items-center justify-between text-left">
              <div>
                <span className="font-label-sm text-xs text-on-surface-variant block">Jeton sécurisé</span>
                <span className="font-mono text-xs text-primary truncate max-w-[200px] block">
                  {token}
                </span>
              </div>
              <Icon name="lock" className="text-secondary" />
            </div>

            <div className="flex flex-col gap-2 w-full pt-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => handleDecision(true)}
                className="w-full h-14 rounded-xl bg-secondary-container text-on-secondary font-label-lg text-label-lg font-bold flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-transform"
              >
                <Icon name="check_circle" className="text-[20px]" />
                <span>OUI, VENTE RÉALISÉE</span>
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={() => handleDecision(false)}
                className="w-full h-12 rounded-xl bg-surface-container-highest text-on-surface-variant font-label-md text-label-md flex items-center justify-center gap-2 active:scale-95 transition-transform"
              >
                <Icon name="cancel" className="text-[18px]" />
                <span>NON, PAS DE VENTE</span>
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 py-4">
            <Icon name={isSold ? "task_alt" : "unpublished"} className={`text-[48px] ${isSold ? "text-secondary" : "text-on-surface-variant"}`} />
            <h3 className="font-headline-sm text-on-surface">{message}</h3>
            <p className="font-body-sm text-on-surface-variant">
              {isSold
                ? "Le chiffre d'affaires et les statistiques de la boutique ont été actualisés en base de données."
                : "L'abandon a été pris en compte dans le calcul des taux de clôture."}
            </p>
            <button
              onClick={onBackToStore}
              className="mt-2 h-11 px-6 rounded-xl bg-surface-container-highest text-on-surface font-label-md text-label-md hover:bg-surface-bright"
            >
              Retour à la boutique
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
