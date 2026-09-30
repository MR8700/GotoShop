import Icon from "./Icon";
import React from "react";
import { getMediaUrl } from "../api/client";

/** Affiché quand le client arrive depuis un lien de publicité : le produit partagé, prêt à commander. */
export default function SharedProductBanner({ product, storeName, onOrder, onClose }) {
  if (!product) return null;
  return (
    <div className="fixed left-3 right-3 bottom-20 z-40 max-w-md mx-auto p-3 rounded-2xl bg-surface-container-high border border-primary/30 shadow-2xl flex items-center gap-3">
      {product.primary_image_url && <img src={getMediaUrl(product.primary_image_url)} alt="" className="w-14 h-14 rounded-xl object-cover shrink-0" />}
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase text-primary">Produit recommandé{storeName ? ` · ${storeName}` : ""}</p>
        <p className="text-sm font-bold text-on-surface truncate">{product.name}</p>
        <p className="text-xs text-on-surface-variant">{Number(product.price || 0).toLocaleString("fr-FR")} {product.currency || "FCFA"}</p>
      </div>
      <button type="button" onClick={onOrder} className="h-10 px-4 rounded-xl bg-primary text-white text-xs font-bold cursor-pointer shrink-0">Commander</button>
      <button type="button" onClick={onClose} aria-label="Fermer" className="w-7 h-7 rounded-full text-on-surface-variant flex items-center justify-center cursor-pointer shrink-0">
        <Icon name="close" className="text-[16px]" />
      </button>
    </div>
  );
}
