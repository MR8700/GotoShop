import React, { useState } from "react";
import Icon from "./Icon";
import { passkeysSupported, loginWithPasskey, registerPasskey, consumeRecoveryCode } from "../api/passkeys";
import { RecoveryCodesView } from "./PasskeySecurityPanel";

/** Connexion principale sans mot de passe : bouton Passkey + parcours « Récupérer mon compte » (code de récupération). */
export default function PasskeyLoginBlock({ onSuccess, onClose, showToast, defaultPhone = "" }) {
  const [view, setView] = useState("main"); // main | recover | codes
  const [phone, setPhone] = useState(defaultPhone);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [codes, setCodes] = useState(null);
  const [pending, setPending] = useState(null);

  if (!passkeysSupported()) return null;

  const guard = async (fn) => {
    setError(""); setBusy(true);
    try { await fn(); } catch (e) { setError(e.message || "Une erreur est survenue."); } finally { setBusy(false); }
  };

  const login = () => guard(async () => {
    const customer = await loginWithPasskey();
    showToast?.(`Ravi de vous revoir ${customer?.name || ""} !`);
    onSuccess?.(customer); onClose?.();
  });

  const recover = () => guard(async () => {
    const { recovery_token } = await consumeRecoveryCode(phone.trim(), code.trim());
    const r = await registerPasskey({ recoveryToken: recovery_token });
    showToast?.("Compte récupéré. Nouvelle Passkey configurée.");
    if (r.recovery_codes) { setCodes(r.recovery_codes); setPending(r.customer); setView("codes"); }
    else { onSuccess?.(r.customer); onClose?.(); }
  });

  if (view === "codes" && codes) {
    return <RecoveryCodesView codes={codes} onDone={() => { onSuccess?.(pending); onClose?.(); }} />;
  }

  if (view === "recover") {
    return (
      <div className="space-y-3">
        <h3 className="text-base font-bold text-slate-900">Récupérer mon compte</h3>
        <p className="text-sm text-slate-600">Saisissez votre numéro et l'un de vos codes de récupération, puis créez une nouvelle Passkey sur cet appareil.</p>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="Numéro de téléphone" className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm" />
        <input value={code} onChange={(e) => setCode(e.target.value)} autoCapitalize="characters" placeholder="AB7K-92MX" className="w-full rounded-2xl border border-slate-300 px-4 py-3 font-mono text-sm tracking-wider" />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="button" disabled={busy || !phone.trim() || !code.trim()} onClick={recover} className="w-full rounded-2xl bg-slate-900 py-3.5 text-sm font-bold text-white disabled:opacity-50">Continuer</button>
        <button type="button" onClick={() => { setView("main"); setError(""); }} className="w-full py-2 text-sm font-semibold text-slate-600">Retour</button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button type="button" disabled={busy} onClick={login} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 py-3.5 text-sm font-bold text-white disabled:opacity-60">
        <Icon name="key" /> Utiliser ma Passkey
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="button" onClick={() => setView("recover")} className="w-full py-1 text-sm font-semibold text-slate-600">Récupérer mon compte</button>
    </div>
  );
}
