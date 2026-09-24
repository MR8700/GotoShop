/**
 * Centralized Business Context and Contextual Terminology Engine for GotoShop.
 * 
 * Enforces contextual coherence across all UI components, modals, cards,
 * notifications, icons, placeholders, and action buttons.
 * 
 * Strict rule: NEVER display restaurant-specific UI ("Commander votre plat",
 * food icons, "portion", seasoning choices) on fashion, tech, craft or service stores.
 */

export const DOMAINS = {
  FOOD: "FOOD",
  FASHION: "FASHION",
  ELECTRONICS: "ELECTRONICS",
  SERVICE: "SERVICE",
  GENERAL_COMMERCE: "GENERAL_COMMERCE",
};

export const TERMINOLOGY_PROFILES = {
  FOOD: {
    domain: DOMAINS.FOOD,
    domain_label: "Restauration & Saveurs",
    item_singular: "Plat",
    item_plural: "Plats",
    catalog_title: "Menu & Spécialités",
    catalog_selection: "Plats de la sélection",
    action_order: "Commander ce plat",
    action_order_direct: "Commander en direct",
    search_placeholder: "Rechercher un plat ou une spécialité...",
    empty_catalog: "Aucun plat disponible pour le moment.",
    customization_title: "Assaisonnements & Préférences",
    customization_default_prompt: "Précisez vos préférences (cuisson, piment, garniture...)",
    icon_default: "restaurant",
    icon_catalog: "restaurant_menu",
    preparation_status: "Préparation en cours en cuisine",
    order_items_label: "Plats commandés",
    price_suffix: "/ plat",
    customization_type: "FOOD_SEASONING",
  },
  FASHION: {
    domain: DOMAINS.FASHION,
    domain_label: "Mode & Créations",
    item_singular: "Article",
    item_plural: "Articles",
    catalog_title: "Collection & Nouveautés",
    catalog_selection: "Articles de la sélection",
    action_order: "Commander cet article",
    action_order_direct: "Commander en direct",
    search_placeholder: "Rechercher un vêtement, tissu, coupe...",
    empty_catalog: "Aucun article disponible pour le moment.",
    customization_title: "Personnalisation & Mesures",
    customization_default_prompt: "Précisez vos mensurations, retouches ou finitions souhaitées",
    icon_default: "checkroom",
    icon_catalog: "shopping_bag",
    preparation_status: "Préparation et confection en cours",
    order_items_label: "Articles commandés",
    price_suffix: "/ pièce",
    customization_type: "FASHION_MEASURES",
  },
  ELECTRONICS: {
    domain: DOMAINS.ELECTRONICS,
    domain_label: "High-Tech & Électronique",
    item_singular: "Produit",
    item_plural: "Produits",
    catalog_title: "Catalogue High-Tech",
    catalog_selection: "Produits de la sélection",
    action_order: "Commander ce produit",
    action_order_direct: "Commander en direct",
    search_placeholder: "Rechercher un appareil, accessoire, modèle...",
    empty_catalog: "Aucun produit disponible pour le moment.",
    customization_title: "Options & Configuration",
    customization_default_prompt: "Précisez la couleur, la finition ou les accessoires souhaités",
    icon_default: "devices",
    icon_catalog: "inventory_2",
    preparation_status: "Vérification et préparation du colis",
    order_items_label: "Produits commandés",
    price_suffix: "",
    customization_type: "TECH_OPTIONS",
  },
  SERVICE: {
    domain: DOMAINS.SERVICE,
    domain_label: "Services & Prestations",
    item_singular: "Prestation",
    item_plural: "Prestations",
    catalog_title: "Prestations & Forfaits",
    catalog_selection: "Prestations sélectionnées",
    action_order: "Réserver cette prestation",
    action_order_direct: "Réserver en direct",
    search_placeholder: "Rechercher une prestation ou un service...",
    empty_catalog: "Aucune prestation disponible pour le moment.",
    customization_title: "Détails de la prestation",
    customization_default_prompt: "Décrivez votre besoin ou le créneau souhaité",
    icon_default: "handshake",
    icon_catalog: "event_available",
    preparation_status: "Prise en charge de votre rendez-vous",
    order_items_label: "Prestations réservées",
    price_suffix: "/ prestation",
    customization_type: "SERVICE_DETAILS",
  },
  GENERAL_COMMERCE: {
    domain: DOMAINS.GENERAL_COMMERCE,
    domain_label: "Commerce & Boutique",
    item_singular: "Produit",
    item_plural: "Produits",
    catalog_title: "Catalogue & Nouveautés",
    catalog_selection: "Articles de la sélection",
    action_order: "Commander cet article",
    action_order_direct: "Commander en direct",
    search_placeholder: "Rechercher dans la boutique...",
    empty_catalog: "Aucun produit disponible pour le moment.",
    customization_title: "Personnalisation de l'article",
    customization_default_prompt: "Précisez vos souhaits particuliers pour cet article",
    icon_default: "shopping_bag",
    icon_catalog: "inventory_2",
    preparation_status: "Préparation de votre commande",
    order_items_label: "Articles commandés",
    price_suffix: "",
    customization_type: "GENERIC_OPTIONS",
  },
};

/**
 * Resolves the business domain from store metadata in a prioritized, structured manner.
 */
export function resolveBusinessDomain(store) {
  if (!store) return DOMAINS.GENERAL_COMMERCE;

  // 1. Explicit activity_type
  const act = (store.activity_type || "").toUpperCase();
  if (act === "RESTAURANT" || act === "FOOD_COMMERCE" || act === "FOOD") return DOMAINS.FOOD;
  if (act === "FASHION" || act === "MODE" || act === "CLOTHING" || act === "TEXTILE") return DOMAINS.FASHION;
  if (act === "ELECTRONICS" || act === "TECH" || act === "GADGETS") return DOMAINS.ELECTRONICS;
  if (act === "SERVICE" || act === "SERVICES" || act === "BOOKING") return DOMAINS.SERVICE;

  // 2. Domain or Category attribute
  const cat = (store.domain || store.category || "").toUpperCase();
  if (cat.includes("FOOD") || cat.includes("RESTAU") || cat.includes("GARBA") || cat.includes("MANGER")) return DOMAINS.FOOD;
  if (cat.includes("FASHION") || cat.includes("MODE") || cat.includes("PAGNE") || cat.includes("DANFANI")) return DOMAINS.FASHION;
  if (cat.includes("TECH") || cat.includes("ELEC") || cat.includes("PHONE") || cat.includes("GADGET")) return DOMAINS.ELECTRONICS;
  if (cat.includes("SERVICE") || cat.includes("COIFFURE") || cat.includes("ARTISAN")) return DOMAINS.SERVICE;

  // 3. Store Slug / Name clues
  const slug = (store.slug || store.name || "").toLowerCase();
  if (slug.includes("garba") || slug.includes("kossodo") || slug.includes("fastfood") || slug.includes("restau") || slug.includes("saveur")) {
    return DOMAINS.FOOD;
  }
  if (slug.includes("danfani") || slug.includes("elegance") || slug.includes("mode") || slug.includes("couture") || slug.includes("wax")) {
    return DOMAINS.FASHION;
  }
  if (slug.includes("tech") || slug.includes("gadget") || slug.includes("phone") || slug.includes("electron")) {
    return DOMAINS.ELECTRONICS;
  }

  return DOMAINS.GENERAL_COMMERCE;
}

/**
 * Returns a complete Context object tailored to the specific store.
 */
export function getBusinessContext(store) {
  const domain = resolveBusinessDomain(store);
  const terms = TERMINOLOGY_PROFILES[domain] || TERMINOLOGY_PROFILES.GENERAL_COMMERCE;
  const storeName = store?.name || "Boutique";
  const storeLocation = store?.city || store?.delivery_city || store?.country || "Ouagadougou";

  return {
    domain,
    terms,
    storeName,
    storeLocation,
    icon: terms.icon_default,
    iconCatalog: terms.icon_catalog,
    
    // Dynamic Contextual Generators
    getOrderModalTitle: (step = "EDIT") => {
      if (step !== "EDIT") return "Commande transmise !";
      return `Commander chez ${storeName}`;
    },
    getOrderCtaLabel: (isCustomizable = false) => {
      if (isCustomizable) {
        return `Personnaliser & ${terms.action_order_direct}`;
      }
      return `${terms.action_order_direct} (Chat)`;
    },
    getDiscoverLabel: () => {
      return `Découvrir ${storeName}`;
    },
    formatPriceUnit: (price, currency = "FCFA") => {
      const formatted = Number(price || 0).toLocaleString("fr-FR");
      return terms.price_suffix ? `${formatted} ${currency} ${terms.price_suffix}` : `${formatted} ${currency}`;
    },
  };
}
