import Icon from "./Icon";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { fetchDeliverySpots, saveDeliverySpot, deleteDeliverySpot } from "../api/client";

const EMPTY = { id: null, kind: "PICKUP", name: "", city: "", address: "", description: "", hours: "", fee: "", latitude: "", longitude: "", images: [], is_active: true };
const MAX_IMAGES = 6;

// Réduit l'image côté navigateur (max 1000 px, JPEG) avant l'envoi.
function fileToDataUri(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Lecture de l'image impossible."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Image invalide."));
      img.onload = () => {
        const scale = Math.min(1, 1000 / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// Lieux définis par le commerçant : points de retrait (le client vient chercher) et points de livraison
// (endroits où le commerçant se rend pour livrer). Photos et horaires facultatifs.
export default function DeliverySpotsSection({ store, currency = "FCFA", showToast }) {
  const [spots, setSpots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    if (!store?.id) return;
    setLoading(true);
    try {
      setSpots((await fetchDeliverySpots(store.id, { all: true })) || []);
    } finally {
      setLoading(false);
    }
  }, [store?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const reset = () => {
    setForm(EMPTY);
    setOpen(false);
  };

  const edit = (s) => {
    setForm({
      id: s.id, kind: s.kind, name: s.name || "", city: s.city || "", address: s.address || "",
      description: s.description || "", hours: s.hours || "",
      fee: s.kind === "DELIVERY" && s.delivery_fee != null ? String(s.delivery_fee) : "",
      latitude: s.latitude != null ? String(s.latitude) : "", longitude: s.longitude != null ? String(s.longitude) : "",
      images: s.images || [], is_active: s.is_active,
    });
    setOpen(true);
  };

  const addImages = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    const room = MAX_IMAGES - form.images.length;
    if (files.length > room) showToast?.(`${MAX_IMAGES} photos maximum par lieu.`);
    try {
      const uris = await Promise.all(files.slice(0, Math.max(0, room)).map(fileToDataUri));
      setForm((f) => ({ ...f, images: [...f.images, ...uris] }));
    } catch (err) {
      showToast?.(err.message);
    }
  };

  const useMyPosition = () => {
    if (!navigator.geolocation) return showToast?.("La géolocalisation n'est pas disponible sur cet appareil.");
    navigator.geolocation.getCurrentPosition(
      (pos) => setForm((f) => ({ ...f, latitude: pos.coords.latitude.toFixed(6), longitude: pos.coords.longitude.toFixed(6) })),
      () => showToast?.("Position refusée ou indisponible : saisissez les coordonnées à la main."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const submit = async (e) => {
    e.preventDefault();
    if (form.name.trim().length < 2) return showToast?.("Donnez un nom au lieu (ex: Boutique Marché central).");
    const fee = form.fee === "" ? null : Number(form.fee);
    if (fee !== null && (!Number.isInteger(fee) || fee < 0)) return showToast?.("Le tarif doit être un entier positif (ou vide).");
    const latTxt = String(form.latitude).trim().replace(",", ".");
    const lngTxt = String(form.longitude).trim().replace(",", ".");
    const lat = latTxt === "" ? null : Number(latTxt);
    const lng = lngTxt === "" ? null : Number(lngTxt);
    if ((lat === null) !== (lng === null)) return showToast?.("Renseignez la latitude ET la longitude (ou aucune des deux).");
    if (lat !== null && (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)) {
      return showToast?.("Coordonnées invalides (latitude -90 à 90, longitude -180 à 180).");
    }
    setSaving(true);
    try {
      const saved = await saveDeliverySpot(store.id, {
        id: form.id, kind: form.kind, name: form.name.trim(), city: form.city.trim() || null,
        address: form.address.trim() || null, description: form.description.trim() || null,
        hours: form.hours.trim() || null, images: form.images, latitude: lat, longitude: lng,
        delivery_fee: form.kind === "DELIVERY" ? fee : null, is_active: form.is_active,
      });
      const gapMsg = saved?.gps_check?.message;
      const done = form.id ? "Lieu mis à jour" : "Lieu ajouté";
      showToast?.(gapMsg ? `${done} — attention : ${gapMsg}` : `${done}.`);
      reset();
      await load();
    } catch (err) {
      showToast?.(err.message || "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (s) => {
    if (!window.confirm(`Supprimer le lieu « ${s.name} » ?`)) return;
    try {
      await deleteDeliverySpot(store.id, s.id);
      await load();
    } catch (err) {
      showToast?.(err.message || "Suppression impossible.");
    }
  };

  const toggleActive = async (s) => {
    try {
      await saveDeliverySpot(store.id, {
        id: s.id, kind: s.kind, name: s.name, city: s.city, address: s.address, description: s.description,
        hours: s.hours, images: s.images, latitude: s.latitude, longitude: s.longitude,
        delivery_fee: s.delivery_fee, is_active: !s.is_active,
      });
      await load();
    } catch (err) {
      showToast?.(err.message || "Modification impossible.");
    }
  };

  const input = "w-full h-10 px-3 rounded-xl bg-surface-container-high border border-white/5 text-on-surface text-xs";

  return (
    <section className="bg-surface-container rounded-xl p-space-md shadow-md space-y-3">
      <div className="flex items-center gap-2">
        <Icon name="storefront" className="text-primary text-[20px]" />
        <h3 className="font-headline-sm text-headline-sm text-on-surface">Lieux de retrait & de livraison</h3>
      </div>
      <p className="text-[11px] text-on-surface-variant">
        Ajoutez les endroits où vos clients peuvent retirer leur commande (gratuit) et ceux où vous allez livrer.
        À la commande, le client peut choisir l'un de ces lieux pour rejoindre votre tournée.
      </p>

      {loading ? (
        <div className="py-3 text-center text-xs text-on-surface-variant">Chargement...</div>
      ) : spots.length === 0 ? (
        <div className="p-3 text-center text-xs text-on-surface-variant bg-surface-container-high rounded-xl">Aucun lieu défini.</div>
      ) : (
        <div className="space-y-2">
          {spots.map((s) => (
            <div key={s.id} className={`flex gap-3 p-3 rounded-xl bg-surface-container-high ${s.is_active ? "" : "opacity-60"}`}>
              {s.images?.[0] ? (
                <img src={s.images[0]} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0" />
              ) : (
                <div className="w-14 h-14 rounded-lg bg-surface-container flex items-center justify-center shrink-0">
                  <Icon name="place" className="text-on-surface-variant" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-on-surface truncate">
                  {s.name}
                  <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-secondary/15 text-secondary">
                    {s.kind === "PICKUP" ? "Retrait" : "Livraison"}
                  </span>
                  {!s.is_active && <span className="ml-1 text-[10px] text-on-surface-variant">(masqué)</span>}
                </p>
                <p className="text-[11px] text-on-surface-variant truncate">{[s.city, s.address].filter(Boolean).join(" • ") || "Adresse non précisée"}</p>
                <p className="text-[11px] text-on-surface-variant truncate">
                  {s.hours ? `🕒 ${s.hours} • ` : ""}
                  {s.kind === "PICKUP" ? "Gratuit" : s.delivery_fee == null ? "Tarif de la zone" : `${s.delivery_fee.toLocaleString("fr-FR")} ${currency}`}
                  {s.images?.length > 1 ? ` • ${s.images.length} photos` : ""}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button type="button" title={s.is_active ? "Masquer" : "Afficher"} onClick={() => toggleActive(s)}
                  className="w-8 h-8 rounded-lg bg-surface-container text-on-surface-variant flex items-center justify-center">
                  <Icon name={s.is_active ? "visibility" : "visibility_off"} className="text-[16px]" />
                </button>
                <button type="button" title="Modifier" onClick={() => edit(s)}
                  className="w-8 h-8 rounded-lg bg-surface-container text-primary flex items-center justify-center">
                  <Icon name="edit" className="text-[16px]" />
                </button>
                <button type="button" title="Supprimer" onClick={() => remove(s)}
                  className="w-8 h-8 rounded-lg bg-surface-container hover:bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center transition-colors">
                  <Icon name="delete" className="text-[16px]" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!open ? (
        <button type="button" onClick={() => { setForm(EMPTY); setOpen(true); }}
          className="w-full h-10 rounded-xl bg-primary text-white text-xs font-bold hover:brightness-105">
          + Ajouter un lieu
        </button>
      ) : (
        <form onSubmit={submit} className="space-y-2 p-3 rounded-xl bg-surface-container-high">
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-surface-container rounded-xl text-xs">
            {[["PICKUP", "Point de retrait"], ["DELIVERY", "Point de livraison"]].map(([k, label]) => (
              <button key={k} type="button" onClick={() => setForm({ ...form, kind: k })}
                className={`py-2 rounded-lg font-semibold ${form.kind === k ? "bg-primary text-white" : "text-on-surface-variant"}`}>
                {label}
              </button>
            ))}
          </div>
          <input className={input} placeholder="Nom du lieu (ex: Boutique Marché central)" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <input className={input} placeholder="Ville / zone" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            <input className={input} placeholder="Horaires (ex: Lun-Sam 9h-18h)" value={form.hours}
              onChange={(e) => setForm({ ...form, hours: e.target.value })} />
          </div>
          <input className={input} placeholder="Adresse / repère (ex: en face de la pharmacie)" value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <textarea rows={2} className="w-full px-3 py-2 rounded-xl bg-surface-container border border-outline-variant/30 text-on-surface text-xs focus:outline-none focus:border-primary"
            placeholder="Consignes pour trouver le lieu (facultatif)" value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
            <input className={input} inputMode="decimal" placeholder="Latitude (ex: 12.3714)" value={form.latitude}
              onChange={(e) => setForm({ ...form, latitude: e.target.value })} />
            <input className={input} inputMode="decimal" placeholder="Longitude (ex: -1.5197)" value={form.longitude}
              onChange={(e) => setForm({ ...form, longitude: e.target.value })} />
            <button type="button" onClick={useMyPosition} title="Utiliser ma position actuelle"
              className="h-10 px-3 rounded-xl bg-surface-container-high text-primary text-xs font-bold">
              <Icon name="my_location" className="text-[18px]" />
            </button>
          </div>
          {form.kind === "DELIVERY" && (
            <input type="number" min="0" step="1" className={input} placeholder={`Tarif de livraison à ce lieu (${currency}) — vide = tarif de la zone`}
              value={form.fee} onChange={(e) => setForm({ ...form, fee: e.target.value })} />
          )}

          <div className="flex flex-wrap gap-2">
            {form.images.map((src, i) => (
              <div key={i} className="relative w-16 h-16">
                <img src={src} alt="" className="w-16 h-16 rounded-lg object-cover" />
                <button type="button" onClick={() => setForm({ ...form, images: form.images.filter((_, j) => j !== i) })}
                  className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[11px] leading-none">×</button>
              </div>
            ))}
            {form.images.length < MAX_IMAGES && (
              <button type="button" onClick={() => fileRef.current?.click()}
                className="w-16 h-16 rounded-lg border border-dashed border-outline-variant/50 text-on-surface-variant flex flex-col items-center justify-center text-[10px] hover:border-primary transition-colors">
                <Icon name="add_a_photo" className="text-[18px]" />Photo
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={addImages} />
          </div>

          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving}
              className="flex-1 h-10 rounded-xl bg-primary text-white text-xs font-bold disabled:opacity-60">
              {saving ? "Enregistrement..." : form.id ? "Mettre à jour" : "Ajouter"}
            </button>
            <button type="button" onClick={reset} className="h-10 px-3 rounded-xl text-xs text-on-surface-variant hover:underline">Annuler</button>
          </div>
        </form>
      )}
    </section>
  );
}
