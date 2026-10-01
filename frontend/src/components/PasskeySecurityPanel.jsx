import React, { useCallback, useEffect, useState } from "react";
import Icon from "./Icon";
import {
  passkeysSupported, registerPasskey, listPasskeys, renamePasskey, revokePasskey,
  generateRecoveryCodes, recoveryCodesStatus, revokeAllSessions,
} from "../api/passkeys";

const ago = (iso) => {
  if (!iso) return "Jamais utilisée";
  try {
    const d = Math.floor((Date.now() - new Date(iso + (iso.endsWith("Z") ? "" : "Z")).getTime()) / 86400000);
    return d <= 0 ? "Dernière utilisation : aujourd'hui" : `Dernière utilisation : il y a ${d} jour${d > 1 ? "s" : ""}`;
  } catch {
    return "Date inconnue";
  }
};

export function RecoveryCodesView({ codes, onDone }) {
  const safeCodes = Array.isArray(codes) ? codes : [];
  const text = safeCodes.join("\n");
  const copy = () => {
    try {
      navigator.clipboard?.writeText(text);
    } catch (e) {
      console.warn("Clipboard copy failed:", e);
    }
  };
  const save = () => {
    try {
      const url = URL.createObjectURL(new Blob([`Codes de récupération GotoShop\n(un seul usage par code)\n\n${text}\n`], { type: "text/plain" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = "gotoshop-codes-recuperation.txt";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.warn("Download failed:", e);
    }
  };
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base sm:text-lg font-bold text-on-surface">Codes de récupération</h3>
        <p className="text-xs sm:text-sm text-on-surface-variant">Conservez ces codes dans un endroit sûr. Chaque code ne peut être utilisé qu'une seule fois. Ils ne seront plus affichés.</p>
      </div>
      <div className="grid grid-cols-2 gap-2 font-mono text-xs sm:text-sm">
        {safeCodes.map((c) => (
          <div key={c} className="rounded-xl bg-surface-container-high px-3 py-2 text-center tracking-wider text-on-surface border border-subtle">
            {c}
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={copy}
          className="flex-1 rounded-xl border border-subtle py-2.5 text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 text-on-surface hover:bg-surface-container-high active:scale-95 transition-all cursor-pointer"
        >
          <Icon name="content_copy" className="text-[16px]" />
          <span>Copier</span>
        </button>
        <button
          type="button"
          onClick={save}
          className="flex-1 rounded-xl border border-subtle py-2.5 text-xs sm:text-sm font-semibold text-on-surface hover:bg-surface-container-high active:scale-95 transition-all cursor-pointer"
        >
          Télécharger
        </button>
      </div>
      <button
        type="button"
        onClick={onDone}
        className="w-full rounded-xl bg-primary py-3 text-xs sm:text-sm font-bold text-white shadow-md active:scale-98 transition-all cursor-pointer"
      >
        J'ai enregistré mes codes
      </button>
    </div>
  );
}

export default function PasskeySecurityPanel({ showToast }) {
  const [items, setItems] = useState([]);
  const [remaining, setRemaining] = useState(null);
  const [busy, setBusy] = useState(false);
  const [codes, setCodes] = useState(null);
  const notify = (m) => (showToast ? showToast(m) : null);

  const refresh = useCallback(async () => {
    try {
      const [p, r] = await Promise.all([listPasskeys(), recoveryCodesStatus()]);
      setItems(Array.isArray(p) ? p : []);
      setRemaining(typeof r?.remaining === "number" ? r.remaining : null);
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const run = async (fn, okMsg) => {
    setBusy(true);
    try {
      const r = await fn();
      if (okMsg) notify(okMsg);
      await refresh();
      return r;
    } catch (e) {
      notify(e?.message || "Une erreur est survenue.");
    } finally {
      setBusy(false);
    }
  };

  if (codes && Array.isArray(codes)) return <RecoveryCodesView codes={codes} onDone={() => setCodes(null)} />;
  if (!passkeysSupported()) {
    return (
      <div className="flex items-center gap-2 text-xs text-on-surface-variant p-3 rounded-xl bg-surface-container-high/40">
        <Icon name="info" className="text-[16px] text-secondary shrink-0" />
        <span>Les clés d'accès (Passkeys) biométriques ne sont pas supportées sur ce navigateur.</span>
      </div>
    );
  }

  const passkeyList = Array.isArray(items) ? items : [];

  return (
    <section className="space-y-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-2xl text-primary"><Icon name="shield_lock" /></span>
        <div>
          <h3 className="text-sm sm:text-base font-bold text-on-surface">Sécurité &amp; Connexion Biométrique</h3>
          <p className="text-xs text-on-surface-variant">Connectez-vous sans mot de passe avec votre empreinte digitale, reconnaissance faciale ou code PIN.</p>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider">Mes appareils et Passkeys</h4>
        {passkeyList.length === 0 && <p className="text-xs text-on-surface-variant italic">Aucune clé d'accès configurée sur ce compte.</p>}
        <ul className="space-y-2">
          {passkeyList.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-xl border border-subtle bg-surface-container-high/40 p-3">
              <span className="text-lg text-primary shrink-0"><Icon name="smartphone" /></span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs sm:text-sm font-semibold text-on-surface">{p.friendly_name || "Appareil"}</div>
                <div className="text-[11px] text-on-surface-variant">{ago(p.last_used_at)}</div>
              </div>
              <button
                type="button"
                disabled={busy}
                aria-label="Renommer"
                className="p-1.5 text-on-surface-variant hover:text-on-surface cursor-pointer transition-colors"
                onClick={() => {
                  const n = window.prompt("Nom de l'appareil", p.friendly_name || "");
                  if (n) run(() => renamePasskey(p.id, n));
                }}
              >
                <Icon name="edit" className="text-[16px]" />
              </button>
              <button
                type="button"
                disabled={busy}
                aria-label="Révoquer"
                className="p-1.5 text-red-400 hover:text-red-500 cursor-pointer transition-colors"
                onClick={() =>
                  window.confirm("Révoquer cette Passkey ? Elle ne permettra plus de vous connecter.") &&
                  run(() => revokePasskey(p.id), "Passkey révoquée.")
                }
              >
                <Icon name="delete" className="text-[16px]" />
              </button>
            </li>
          ))}
        </ul>

        <button
          type="button"
          disabled={busy}
          onClick={() =>
            run(async () => {
              const r = await registerPasskey();
              if (r?.recovery_codes) setCodes(r.recovery_codes);
            }, "Passkey configurée avec succès !")
          }
          className="mt-2 w-full rounded-xl bg-primary hover:brightness-110 py-3 text-xs sm:text-sm font-bold text-white shadow-md active:scale-98 transition-all disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
        >
          <Icon name="fingerprint" className="text-[18px]" />
          <span>{passkeyList.length ? "Ajouter un autre appareil" : "Activer la connexion par empreinte / visage"}</span>
        </button>
      </div>

      <div className="rounded-xl bg-surface-container-high/60 border border-subtle p-3.5 space-y-2">
        <div className="flex items-center gap-2 text-xs font-bold text-on-surface">
          <Icon name="key" className="text-secondary text-[16px]" />
          <span>Codes de secours / récupération</span>
        </div>
        <p className="text-[11px] text-on-surface-variant">
          {remaining === null
            ? ""
            : remaining > 0
            ? `${remaining} code${remaining > 1 ? "s" : ""} de secours actif${remaining > 1 ? "s" : ""}.`
            : "Aucun code disponible."}{" "}
          En générer de nouveaux désactive les anciens.
        </p>
        <button
          type="button"
          disabled={busy || passkeyList.length === 0}
          onClick={() =>
            window.confirm("Les anciens codes ne fonctionneront plus. Continuer ?") &&
            run(async () => setCodes(await generateRecoveryCodes()))
          }
          className="w-full rounded-xl border border-subtle hover:bg-surface-container-high py-2 text-xs font-semibold text-on-surface disabled:opacity-40 cursor-pointer transition-colors"
        >
          Générer de nouveaux codes de secours
        </button>
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={() =>
          window.confirm("Déconnecter cet appareil et tous les autres appareils actifs ?") &&
          run(revokeAllSessions, "Toutes les sessions ont été fermées.")
        }
        className="flex w-full items-center justify-center gap-1.5 py-2 text-xs font-semibold text-on-surface-variant hover:text-red-400 transition-colors cursor-pointer"
      >
        <Icon name="logout" className="text-[14px]" />
        <span>Fermer toutes les sessions ouvertes</span>
      </button>
    </section>
  );
}
