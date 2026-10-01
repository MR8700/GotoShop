import React, { useCallback, useEffect, useState } from "react";
import Icon from "./Icon";
import {
  passkeysSupported, registerPasskey, listPasskeys, renamePasskey, revokePasskey,
  generateRecoveryCodes, recoveryCodesStatus, revokeAllSessions,
} from "../api/passkeys";

const ago = (iso) => {
  if (!iso) return "Jamais utilisée";
  const d = Math.floor((Date.now() - new Date(iso + (iso.endsWith("Z") ? "" : "Z")).getTime()) / 86400000);
  return d <= 0 ? "Dernière utilisation : aujourd'hui" : `Dernière utilisation : il y a ${d} jour${d > 1 ? "s" : ""}`;
};

export function RecoveryCodesView({ codes, onDone }) {
  const text = codes.join("\n");
  const copy = () => navigator.clipboard?.writeText(text);
  const save = () => {
    const url = URL.createObjectURL(new Blob([`Codes de récupération GotoShop\n(un seul usage par code)\n\n${text}\n`], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url; a.download = "gotoshop-codes-recuperation.txt"; a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-slate-900">Codes de récupération</h3>
        <p className="text-sm text-slate-600">Conservez ces codes dans un endroit sûr. Chaque code ne peut être utilisé qu'une seule fois. Ils ne seront plus affichés.</p>
      </div>
      <div className="grid grid-cols-2 gap-2 font-mono text-sm">
        {codes.map((c) => <div key={c} className="rounded-xl bg-slate-100 px-3 py-2 text-center tracking-wider">{c}</div>)}
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={copy} className="flex-1 rounded-2xl border border-slate-300 py-3 text-sm font-semibold flex items-center justify-center gap-2">
          <Icon name="content_copy" /> Copier
        </button>
        <button type="button" onClick={save} className="flex-1 rounded-2xl border border-slate-300 py-3 text-sm font-semibold">Télécharger</button>
      </div>
      <button type="button" onClick={onDone} className="w-full rounded-2xl bg-slate-900 py-3.5 text-sm font-bold text-white">J'ai enregistré mes codes</button>
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
  useEffect(() => { refresh(); }, [refresh]);

  const run = async (fn, okMsg) => {
    setBusy(true);
    try { const r = await fn(); if (okMsg) notify(okMsg); await refresh(); return r; }
    catch (e) { notify(e.message || "Une erreur est survenue."); }
    finally { setBusy(false); }
  };

  if (codes) return <RecoveryCodesView codes={codes} onDone={() => setCodes(null)} />;
  if (!passkeysSupported()) return <p className="text-sm text-slate-600">Les Passkeys ne sont pas disponibles sur ce navigateur.</p>;

  const passkeyList = Array.isArray(items) ? items : [];

  return (
    <section className="space-y-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-2xl text-slate-900"><Icon name="shield_lock" /></span>
        <div>
          <h3 className="text-lg font-bold text-slate-900">Sécurité</h3>
          <p className="text-sm text-slate-600">Connectez-vous sans mot de passe avec l'empreinte, le visage ou le verrouillage de votre appareil.</p>
        </div>
      </div>

      <div>
        <h4 className="mb-2 text-sm font-semibold text-slate-900">Mes appareils et Passkeys</h4>
        {passkeyList.length === 0 && <p className="text-sm text-slate-500">Aucune Passkey configurée.</p>}
        <ul className="space-y-2">
          {passkeyList.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3">
              <span className="text-xl text-slate-700"><Icon name="smartphone" /></span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-slate-900">{p.friendly_name || "Appareil"}</div>
                <div className="text-xs text-slate-500">{ago(p.last_used_at)}</div>
              </div>
              <button type="button" disabled={busy} aria-label="Renommer" className="p-2 text-slate-600"
                onClick={() => { const n = window.prompt("Nom de l'appareil", p.friendly_name || ""); if (n) run(() => renamePasskey(p.id, n)); }}>
                <Icon name="edit" />
              </button>
              <button type="button" disabled={busy} aria-label="Révoquer" className="p-2 text-red-600"
                onClick={() => window.confirm("Révoquer cette Passkey ? Elle ne permettra plus de vous connecter.") && run(() => revokePasskey(p.id), "Passkey révoquée.")}>
                <Icon name="delete" />
              </button>
            </li>
          ))}
        </ul>
        <button type="button" disabled={busy} onClick={() => run(async () => {
          const r = await registerPasskey();
          if (r.recovery_codes) setCodes(r.recovery_codes);
        }, "Passkey configurée.")} className="mt-3 w-full rounded-2xl bg-slate-900 py-3.5 text-sm font-bold text-white disabled:opacity-60">
          {passkeyList.length ? "Ajouter un appareil" : "Configurer ma Passkey"}
        </button>
      </div>

      <div className="rounded-2xl bg-slate-50 p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Icon name="key" /> Codes de récupération</div>
        <p className="text-xs text-slate-600">
          {remaining === null ? "" : remaining > 0 ? `${remaining} code${remaining > 1 ? "s" : ""} disponible${remaining > 1 ? "s" : ""}.` : "Aucun code disponible."}
          {" "}En générer de nouveaux invalide les anciens.
        </p>
        <button type="button" disabled={busy || passkeyList.length === 0} onClick={() => window.confirm("Les anciens codes ne fonctionneront plus. Continuer ?") && run(async () => setCodes(await generateRecoveryCodes()))}
          className="w-full rounded-2xl border border-slate-300 py-3 text-sm font-semibold disabled:opacity-50">Générer de nouveaux codes</button>
      </div>

      <button type="button" disabled={busy} onClick={() => window.confirm("Déconnecter cet appareil et tous les autres ?") && run(revokeAllSessions, "Sessions fermées.")}
        className="flex w-full items-center justify-center gap-2 py-2 text-sm font-semibold text-slate-600">
        <Icon name="logout" /> Fermer toutes mes sessions
      </button>
    </section>
  );
}
