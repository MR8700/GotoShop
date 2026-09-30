import Icon from "./Icon";
import React, { useState, useEffect, useCallback } from "react";
import { fetchDiscountRules, saveDiscountRule, deleteDiscountRule, fetchMerchantClients, fetchProducts, fetchCategories } from "../api/client";

const AUDIENCES = [
  { id: "ALL", label: "Tous", hint: "Clients et visiteurs" },
  { id: "CLIENTS", label: "Clients inscrits", hint: "Ceux qui ont un compte" },
  { id: "VISITORS", label: "Visiteurs", hint: "Sans compte" },
  { id: "SELECTED", label: "Clients choisis", hint: "Un ou plusieurs clients" },
];
const SCOPES = [
  { id: "STORE", label: "Toute la commande", hint: "Tous les produits" },
  { id: "PRODUCT", label: "Produits choisis", hint: "Un ou plusieurs produits" },
  { id: "CATEGORY", label: "Catégories choisies", hint: "Toute une catégorie" },
];
const EMPTY = { id: null, name: "", percent: 10, audience: "ALL", customer_ids: [], scope: "STORE", product_ids: [], category_ids: [], min_order_amount: 0, starts_at: "", ends_at: "", is_active: true };
const toInput = (iso) => (iso ? iso.slice(0, 10) : "");

export default function DiscountRulesSection({ store, currency = "FCFA", showToast }) {
  const [rules, setRules] = useState([]);
  const [form, setForm] = useState(null); // null = fermé
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [prodSearch, setProdSearch] = useState("");

  const load = useCallback(async () => {
    if (!store?.id) return;
    try {
      setRules((await fetchDiscountRules(store.id)) || []);
    } catch (e) {
      showToast?.(e.message || "Erreur de chargement des remises");
    }
  }, [store?.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (form?.audience !== "SELECTED") return;
    let alive = true;
    fetchMerchantClients(search, store?.slug).then((d) => { if (alive) setClients(d || []); }).catch(() => {});
    return () => { alive = false; };
  }, [form?.audience, search, store?.slug]);

  useEffect(() => {
    if (!form || form.scope === "STORE") return;
    let alive = true;
    if (form.scope === "PRODUCT") {
      fetchProducts(null, store?.slug).then((d) => { if (alive) setProducts(Array.isArray(d) ? d : []); }).catch(() => {});
    } else {
      fetchCategories(store?.slug).then((d) => { if (alive) setCategories(Array.isArray(d) ? d : []); }).catch(() => {});
    }
    return () => { alive = false; };
  }, [form?.scope, store?.slug]);

  const toggleIn = (key, id) =>
    setForm((f) => ({ ...f, [key]: (f[key] || []).includes(id) ? f[key].filter((x) => x !== id) : [...(f[key] || []), id] }));

  const openEdit = (r) => setForm(r ? { ...r, starts_at: toInput(r.starts_at), ends_at: toInput(r.ends_at) } : { ...EMPTY });
  const toggleClient = (id) =>
    setForm((f) => ({ ...f, customer_ids: f.customer_ids.includes(id) ? f.customer_ids.filter((x) => x !== id) : [...f.customer_ids, id] }));

  const submit = async (e) => {
    e?.preventDefault();
    setSaving(true);
    try {
      await saveDiscountRule(store.id, form);
      showToast?.(form.id ? "Remise mise à jour" : "Remise créée");
      setForm(null);
      await load();
    } catch (err) {
      showToast?.(err.message || "Erreur d'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (r) => {
    try {
      await saveDiscountRule(store.id, { ...r, is_active: !r.is_active });
      await load();
    } catch (err) {
      showToast?.(err.message || "Erreur");
    }
  };

  const remove = async (r) => {
    if (!window.confirm(`Supprimer la remise « ${r.name} » ?`)) return;
    try {
      await deleteDiscountRule(store.id, r.id);
      await load();
    } catch (err) {
      showToast?.(err.message || "Erreur de suppression");
    }
  };

  const summary = (r) => {
    const parts = [r.audience === "SELECTED" ? `${r.customer_ids.length} client(s) choisi(s)` : r.audience_label];
    if (r.scope === "PRODUCT") parts.unshift(`${(r.product_ids || []).length} produit(s)`);
    else if (r.scope === "CATEGORY") parts.unshift(`${(r.category_ids || []).length} catégorie(s)`);
    if (r.min_order_amount > 0) parts.push(`dès ${Number(r.min_order_amount).toLocaleString("fr-FR")} ${currency}`);
    if (r.starts_at || r.ends_at) parts.push(`${r.starts_at ? new Date(r.starts_at).toLocaleDateString("fr-FR") : "…"} → ${r.ends_at ? new Date(r.ends_at).toLocaleDateString("fr-FR") : "…"}`);
    return parts.join(" · ");
  };

  return (
    <section className="bg-surface-container rounded-xl p-space-md shadow-md space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-headline-sm text-sm font-bold text-on-surface flex items-center gap-2">
          <Icon name="sell" className="text-[20px] text-primary" />
          Remises boutique
        </h3>
        <button type="button" onClick={() => openEdit(null)} className="px-3 h-9 rounded-lg bg-primary text-white text-xs font-bold cursor-pointer">
          + Nouvelle remise
        </button>
      </div>
      <p className="text-[11px] text-on-surface-variant">
        Appliquées automatiquement à la commande, sur toute la commande, sur des produits ou sur des catégories, et seulement pour le public choisi. Une seule remise s'applique : la plus avantageuse pour le client. Elle ne se cumule pas avec un coupon (le meilleur des deux gagne) mais se combine avec les points fidélité.
        La remise personnelle d'un client (fiche client) compte aussi.
      </p>

      {rules.length === 0 && !form && (
        <div className="p-4 text-center text-xs text-on-surface-variant rounded-xl border border-dashed border-white/10">Aucune remise pour l'instant.</div>
      )}

      <div className="space-y-2">
        {rules.map((r) => (
          <div key={r.id} className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${r.is_active ? "bg-surface-container-high/60 border-white/5" : "opacity-60 border-white/5"}`}>
            <div className="min-w-0">
              <p className="font-bold text-sm text-on-surface truncate">
                {r.name} <span className="text-primary font-mono">-{r.percent}%</span>
              </p>
              <p className="text-[11px] text-on-surface-variant">{summary(r)}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button type="button" onClick={() => toggleActive(r)} className="px-2 h-8 rounded-lg border border-white/10 text-[11px] font-bold text-on-surface-variant cursor-pointer">
                {r.is_active ? "Pause" : "Activer"}
              </button>
              <button type="button" onClick={() => openEdit(r)} className="w-8 h-8 rounded-lg border border-white/10 text-on-surface-variant cursor-pointer" title="Modifier">
                <Icon name="edit" className="text-[16px]" />
              </button>
              <button type="button" onClick={() => remove(r)} className="w-8 h-8 rounded-lg border border-white/10 text-rose-400 cursor-pointer" title="Supprimer">
                <Icon name="delete" className="text-[16px]" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {form && (
        <form onSubmit={submit} className="p-3.5 rounded-xl bg-surface-container-high/60 border border-primary/20 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="text-[11px] font-bold text-on-surface-variant uppercase block mb-1">Nom</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex. Promo de la rentrée"
                className="w-full h-10 px-3 rounded-lg bg-surface-container border border-outline-variant/30 text-sm text-on-surface" />
            </div>
            <div>
              <label className="text-[11px] font-bold text-on-surface-variant uppercase block mb-1">Remise %</label>
              <input required type="number" min="1" max="100" value={form.percent} onChange={(e) => setForm({ ...form, percent: e.target.value })}
                className="w-full h-10 px-3 rounded-lg bg-surface-container border border-outline-variant/30 text-sm text-on-surface" />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-on-surface-variant uppercase block mb-1">Sur quoi ?</label>
            <div className="grid grid-cols-3 gap-2">
              {SCOPES.map((sc) => (
                <button key={sc.id} type="button" onClick={() => setForm({ ...form, scope: sc.id })}
                  className={`p-2.5 rounded-xl border text-left cursor-pointer ${form.scope === sc.id ? "bg-primary/10 border-primary" : "border-white/10"}`}>
                  <p className="text-xs font-bold text-on-surface">{sc.label}</p>
                  <p className="text-[10px] text-on-surface-variant">{sc.hint}</p>
                </button>
              ))}
            </div>
          </div>

          {form.scope === "PRODUCT" && (
            <div className="space-y-2">
              <input value={prodSearch} onChange={(e) => setProdSearch(e.target.value)} placeholder="Rechercher un produit"
                className="w-full h-10 px-3 rounded-lg bg-surface-container border border-outline-variant/30 text-sm text-on-surface" />
              <p className="text-[11px] text-on-surface-variant">{(form.product_ids || []).length} produit(s) choisi(s)</p>
              <div className="max-h-44 overflow-y-auto space-y-1">
                {products.filter((p) => !prodSearch || (p.name || "").toLowerCase().includes(prodSearch.toLowerCase())).map((p) => (
                  <label key={p.id} className="flex items-center gap-2 p-2 rounded-lg bg-surface-container text-xs text-on-surface cursor-pointer">
                    <input type="checkbox" checked={(form.product_ids || []).includes(p.id)} onChange={() => toggleIn("product_ids", p.id)} />
                    <span className="font-semibold truncate">{p.name}</span>
                    <span className="text-on-surface-variant font-mono ml-auto">{Number(p.price || 0).toLocaleString("fr-FR")} {currency}</span>
                  </label>
                ))}
                {products.length === 0 && <p className="text-[11px] text-on-surface-variant p-2">Aucun produit trouvé.</p>}
              </div>
            </div>
          )}

          {form.scope === "CATEGORY" && (
            <div className="space-y-2">
              <p className="text-[11px] text-on-surface-variant">{(form.category_ids || []).length} catégorie(s) choisie(s)</p>
              <div className="max-h-44 overflow-y-auto space-y-1">
                {categories.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 p-2 rounded-lg bg-surface-container text-xs text-on-surface cursor-pointer">
                    <input type="checkbox" checked={(form.category_ids || []).includes(c.id)} onChange={() => toggleIn("category_ids", c.id)} />
                    <span className="font-semibold truncate">{c.name}</span>
                    {c.product_count != null && <span className="text-on-surface-variant ml-auto">{c.product_count} produit(s)</span>}
                  </label>
                ))}
                {categories.length === 0 && <p className="text-[11px] text-on-surface-variant p-2">Aucune catégorie trouvée.</p>}
              </div>
            </div>
          )}

          <div>
            <label className="text-[11px] font-bold text-on-surface-variant uppercase block mb-1">Pour qui ?</label>
            <div className="grid grid-cols-2 gap-2">
              {AUDIENCES.map((a) => (
                <button key={a.id} type="button" onClick={() => setForm({ ...form, audience: a.id })}
                  className={`p-2.5 rounded-xl border text-left cursor-pointer transition-colors ${form.audience === a.id ? "bg-primary/10 border-primary" : "border-outline-variant/30 hover:border-outline-variant/60"}`}>
                  <p className="text-xs font-bold text-on-surface">{a.label}</p>
                  <p className="text-[10px] text-on-surface-variant">{a.hint}</p>
                </button>
              ))}
            </div>
          </div>

          {form.audience === "SELECTED" && (
            <div className="space-y-2">
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un client (nom, téléphone)"
                className="w-full h-10 px-3 rounded-lg bg-surface-container border border-outline-variant/30 text-sm text-on-surface focus:outline-none focus:border-primary" />
              <p className="text-[11px] text-on-surface-variant">{form.customer_ids.length} client(s) choisi(s)</p>
              <div className="max-h-44 overflow-y-auto space-y-1">
                {clients.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 p-2 rounded-lg bg-surface-container text-xs text-on-surface cursor-pointer">
                    <input type="checkbox" checked={form.customer_ids.includes(c.id)} onChange={() => toggleClient(c.id)} />
                    <span className="font-semibold truncate">{c.name}</span>
                    <span className="text-on-surface-variant font-mono ml-auto">{c.phone}</span>
                  </label>
                ))}
                {clients.length === 0 && <p className="text-[11px] text-on-surface-variant p-2">Aucun client trouvé.</p>}
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[11px] font-bold text-on-surface-variant uppercase block mb-1">Commande min.</label>
              <input type="number" min="0" step="500" value={form.min_order_amount} onChange={(e) => setForm({ ...form, min_order_amount: e.target.value })}
                className="w-full h-10 px-2 rounded-lg bg-surface-container border border-outline-variant/30 text-sm text-on-surface focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="text-[11px] font-bold text-on-surface-variant uppercase block mb-1">Début</label>
              <input type="date" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
                className="w-full h-10 px-2 rounded-lg bg-surface-container border border-outline-variant/30 text-xs text-on-surface focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="text-[11px] font-bold text-on-surface-variant uppercase block mb-1">Fin</label>
              <input type="date" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
                className="w-full h-10 px-2 rounded-lg bg-surface-container border border-outline-variant/30 text-xs text-on-surface focus:outline-none focus:border-primary" />
            </div>
          </div>

          <div className="flex gap-2">
            <button type="button" onClick={() => setForm(null)} className="flex-1 h-10 rounded-lg border border-outline-variant/30 text-xs font-bold text-on-surface-variant hover:bg-surface-container-high transition-colors cursor-pointer">Annuler</button>
            <button type="submit" disabled={saving} className="flex-[2] h-10 rounded-lg bg-primary text-white text-xs font-bold disabled:opacity-50 cursor-pointer">
              {saving ? "Enregistrement..." : form.id ? "Mettre à jour" : "Créer la remise"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
