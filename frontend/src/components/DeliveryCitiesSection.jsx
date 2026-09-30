import Icon from "./Icon";
import React, { useState, useEffect, useCallback } from "react";
import { fetchDeliveryCities, saveDeliveryCity, deleteDeliveryCity } from "../api/client";

// Saisie des villes de livraison et de leur tarif. Le serveur impose ce tarif aux commandes de la ville ;
// sans tarif configuré, le montant proposé par le client est plafonné.
export default function DeliveryCitiesSection({ store, currency = "FCFA", showToast }) {
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(false);
  const EMPTY = { id: null, name: "", fee: "", lat: "", lng: "", radius: "" };
  const [form, setForm] = useState(EMPTY);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!store?.id) return;
    setLoading(true);
    try {
      setCities((await fetchDeliveryCities(store.id)) || []);
    } finally {
      setLoading(false);
    }
  }, [store?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const reset = () => setForm(EMPTY);

  const useMyPosition = () => {
    if (!navigator.geolocation) return showToast?.("Géolocalisation indisponible sur cet appareil.");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setForm((f) => ({ ...f, lat: p.coords.latitude.toFixed(5), lng: p.coords.longitude.toFixed(5), radius: f.radius || "10" }));
        setLocating(false);
      },
      () => {
        setLocating(false);
        showToast?.("Position refusée ou indisponible : saisissez les coordonnées à la main.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const submit = async (e) => {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) return showToast?.("Indiquez le nom de la ville ou de la zone.");
    const fee = Number(form.fee);
    if (form.fee === "" || !Number.isInteger(fee) || fee < 0) {
      return showToast?.("Le tarif de livraison est obligatoire (nombre entier, 0 = gratuit).");
    }
    const lat = form.lat === "" ? null : Number(form.lat);
    const lng = form.lng === "" ? null : Number(form.lng);
    const radius = form.radius === "" ? null : Number(form.radius);
    if ((lat === null) !== (lng === null)) return showToast?.("Renseignez la latitude ET la longitude.");
    if (lat !== null && (!(lat >= -90 && lat <= 90) || !(lng >= -180 && lng <= 180))) {
      return showToast?.("Coordonnées GPS invalides.");
    }
    if (radius !== null && !(radius > 0)) return showToast?.("Le rayon doit être supérieur à 0 km.");
    setSaving(true);
    try {
      await saveDeliveryCity(store.id, { id: form.id, name, delivery_fee: fee, latitude: lat, longitude: lng, radius_km: radius });
      showToast?.(form.id ? "Tarif mis à jour." : "Ville ajoutée.");
      reset();
      await load();
    } catch (err) {
      showToast?.(err.message || "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c) => {
    if (!window.confirm(`Supprimer « ${c.name} » des zones de livraison ?`)) return;
    try {
      await deleteDeliveryCity(store.id, c.id);
      await load();
    } catch (err) {
      showToast?.(err.message || "Suppression impossible.");
    }
  };

  return (
    <section className="bg-surface-container rounded-xl p-space-md shadow-md space-y-3">
      <div className="flex items-center gap-2">
        <Icon name="local_shipping" className="text-primary text-[20px]" />
        <h3 className="font-headline-sm text-headline-sm text-on-surface">Zones & Tarifs de Livraison</h3>
      </div>
      <p className="text-[11px] text-on-surface-variant">
        Chaque zone a un tarif obligatoire et un point GPS avec son rayon de couverture. La position du client est
        comparée à la zone choisie : en cas d'écart, le client est alerté et la commande vous est signalée.
      </p>

      {loading ? (
        <div className="py-3 text-center text-xs text-on-surface-variant">Chargement...</div>
      ) : cities.length === 0 ? (
        <div className="p-3 text-center text-xs text-on-surface-variant bg-surface-container-high rounded-xl">
          Aucune zone configurée.
        </div>
      ) : (
        <div className="space-y-2">
          {cities.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-2 p-3 rounded-xl bg-surface-container-high">
              <div className="min-w-0">
                <p className="text-sm font-bold text-on-surface truncate">
                  {c.name}
                  {c.is_default && (
                    <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-secondary/15 text-secondary">Par défaut</span>
                  )}
                </p>
                <p className="text-[11px] text-on-surface-variant">
                  {c.delivery_fee == null ? "⚠️ Tarif non configuré" : `${c.delivery_fee.toLocaleString("fr-FR")} ${currency}`}
                  {c.has_gps ? ` • 📍 GPS (${c.radius_km ?? 15} km)` : " • ⚠️ Sans GPS : position du client non vérifiable"}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  title="Modifier"
                  onClick={() => setForm({ id: c.id, name: c.name, fee: c.delivery_fee == null ? "" : String(c.delivery_fee), lat: c.latitude == null ? "" : String(c.latitude), lng: c.longitude == null ? "" : String(c.longitude), radius: c.radius_km == null ? "" : String(c.radius_km) })}
                  className="w-8 h-8 rounded-lg bg-surface-container hover:bg-surface-container-highest text-primary flex items-center justify-center"
                >
                  <Icon name="edit" className="text-[16px]" />
                </button>
                <button
                  type="button"
                  title="Supprimer"
                  onClick={() => remove(c)}
                  className="w-8 h-8 rounded-lg bg-surface-container hover:bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center transition-colors"
                >
                  <Icon name="delete" className="text-[16px]" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={submit} className="flex flex-col sm:flex-row sm:flex-wrap gap-2 pt-1">
        <input
          type="text"
          placeholder="Ville / zone (ex: Ouaga 2000)"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="flex-1 h-10 px-3 rounded-xl bg-surface-container-high border border-outline-variant/30 text-on-surface text-xs focus:outline-none focus:border-primary"
        />
        <input
          type="number"
          min="0"
          step="1"
          required
          placeholder={`Tarif obligatoire (${currency})`}
          value={form.fee}
          onChange={(e) => setForm({ ...form, fee: e.target.value })}
          className="sm:w-36 h-10 px-3 rounded-xl bg-surface-container-high border border-outline-variant/30 text-on-surface text-xs focus:outline-none focus:border-primary"
        />
        <div className="w-full grid grid-cols-3 gap-2">
          <input type="number" step="any" placeholder="Latitude" value={form.lat}
            onChange={(e) => setForm({ ...form, lat: e.target.value })}
            className="h-10 px-3 rounded-xl bg-surface-container-high border border-outline-variant/30 text-on-surface text-xs focus:outline-none focus:border-primary" />
          <input type="number" step="any" placeholder="Longitude" value={form.lng}
            onChange={(e) => setForm({ ...form, lng: e.target.value })}
            className="h-10 px-3 rounded-xl bg-surface-container-high border border-outline-variant/30 text-on-surface text-xs focus:outline-none focus:border-primary" />
          <input type="number" step="any" min="0" placeholder="Rayon (km)" value={form.radius}
            onChange={(e) => setForm({ ...form, radius: e.target.value })}
            className="h-10 px-3 rounded-xl bg-surface-container-high border border-outline-variant/30 text-on-surface text-xs focus:outline-none focus:border-primary" />
        </div>
        <button type="button" onClick={useMyPosition} disabled={locating}
          className="h-10 px-3 rounded-xl bg-surface-container-high text-xs text-primary font-semibold disabled:opacity-60">
          {locating ? "Localisation..." : "📍 Utiliser ma position"}
        </button>
        <p className="w-full text-[10px] text-on-surface-variant">
          GPS vide : les villes connues (Ouagadougou, Bobo-Dioulasso, Abidjan...) sont géolocalisées automatiquement.
        </p>
        <button
          type="submit"
          disabled={saving}
          className="h-10 px-4 rounded-xl bg-primary text-white text-xs font-bold hover:brightness-105 disabled:opacity-60"
        >
          {form.id ? "Mettre à jour" : "Ajouter"}
        </button>
        {form.id && (
          <button type="button" onClick={reset} className="h-10 px-3 rounded-xl text-xs text-on-surface-variant hover:underline">
            Annuler
          </button>
        )}
      </form>
    </section>
  );
}
