// 100 Authentic West African & International Stores for GotoShop Platform
import { FALLBACK_PUBLIC_STORES } from "./stores100";
export { FALLBACK_PUBLIC_STORES };

export const FALLBACK_DETAILED_STORES = {
  "faso-danfani": {
    id: "store-faso-danfani-01",
    name: "Faso Danfani & Élégance",
    slug: "faso-danfani",
    tagline: "L'excellence du textile noble et du pagne tissé burkinabè",
    description: "Maison de haute couture et de confection artisanale en pagne Faso Danfani authentique tissé à la main au Burkina Faso. Livraison express à Ouagadougou, Bobo-Dioulasso et international.",
    owner_bio: "Créatrice burkinabè à Ouagadougou (Ouaga 2000). Nos étoffes de coton 100% bio sont tissées à la main par nos maîtres tisserands.",
    currency: "FCFA",
    logo_url: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=400&auto=format&fit=crop&q=80",
    avatar_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80",
    rating: 4.95,
    sales_count: 485,
    revenue: 14250000,
    is_verified: true,
    social_tunnel_badge: "WA/FB",
    social_tunnel_label: "Tunnel Social Actif",
    is_flash_active: true,
    flash_title: "Vente Spéciale Faso Danfani",
    flash_subtitle: "Ouagadougou & Bobo • Livraison en 2h chrono",
    flash_remaining_seconds: 14200,
    voice_note_title: "Besoin d'un conseil taille ou tissu ?",
    voice_note_subtitle: "Mariam Kaboré vous conseille personnellement en audio ou vidéo WhatsApp.",
    primary_color: "#ec761e",
    secondary_color: "#10b981",
    theme_preset: "kinetic_amber",
    is_custom_theme_active: true,
    is_loyalty_active: true,
    loyalty_spend_per_point: 1000,
    subscription_status: "ACTIVE",
    subscription_plan: "VIP",
    custom_domain: "fasodanfani.bf",
    contact_whatsapp: "+22670123456",
    contact_email: "mariam.kabore@fasodanfani.bf",
    trust_badges: [
      { id: "tb1", icon_name: "verified", label: "100% Tissé Main BF", badge_type: "primary" },
      { id: "tb2", icon_name: "local_shipping", label: "Paiement Livraison", badge_type: "secondary" },
      { id: "tb3", icon_name: "handshake", label: "Vente Directe Atelier", badge_type: "secondary-fixed" },
    ],
    delivery_cities: [
      { id: "dc1", name: "Ouagadougou (Ouaga 2000, Koulouba, Dassasgho)", display_label: "📍 Ouaga", is_default: true },
      { id: "dc2", name: "Bobo-Dioulasso (Belleville, Farakan)", display_label: "Bobo", is_default: false },
      { id: "dc3", name: "Koudougou", display_label: "Koudougou", is_default: false },
      { id: "dc4", name: "Abidjan (Côte d'Ivoire)", display_label: "Abidjan", is_default: false },
    ],
    channels: [
      { id: "ch1", channel_type: "WHATSAPP", display_title: "WhatsApp Direct", badge_text: "RECOMMANDÉ", badge_style: "primary", account_handle: "22670123456", subtitle: "Réponse moyenne en moins de 3 minutes", icon_name: "chat", theme_color: "#25D366", is_active: true, is_recommended: true },
      { id: "ch2", channel_type: "MESSENGER", display_title: "Messenger Facebook", badge_text: "Page Officielle", badge_style: "info", account_handle: "fasodanfanielegance", subtitle: "Messagerie Facebook certifiée", icon_name: "forum", theme_color: "#0084FF", is_active: true, is_recommended: false },
      { id: "ch3", channel_type: "CALL", display_title: "Appel Direct Atelier", badge_text: "Ouaga", badge_style: "secondary", account_handle: "+226 70 12 34 56", subtitle: "Ligne directe Mariam Kaboré", icon_name: "phone_in_talk", theme_color: "#ec761e", is_active: true, is_recommended: false },
    ],
    loyalty_tiers: [
      { id: "lt1", name: "Bronze Faso", min_points: 0, badge_label: "Découverte", perk_title: "Conseils personnalisés de Mariam", perk_description: "Accès direct par audio ou vidéo WhatsApp pour vos commandes sur mesure.", discount_percent: 0 },
      { id: "lt2", name: "Silver Danfani", min_points: 50, badge_label: "Privilège", perk_title: "Livraison Express Gratuite à Ouaga & Bobo", perk_description: "Expédition prioritaire sous 2h et remise de 5% sur tout le catalogue.", discount_percent: 5 },
      { id: "lt3", name: "Gold Élite Yennenga", min_points: 150, badge_label: "Grand Élite", perk_title: "10% de remise permanente & Arrivages Privés", perk_description: "Accès exclusif aux pièces uniques tissées avant leur publication en vitrine.", discount_percent: 10 },
    ],
  },
  "ouaga-tech": {
    id: "store-ouaga-tech-02",
    name: "Ouaga Tech & Gadgets",
    slug: "ouaga-tech",
    tagline: "Smartphones certifiés & High-Tech garanti à Ouagadougou",
    description: "Boutique d'équipements technologiques neufs et certifiés : smartphones avec garantie 12 mois, écouteurs sans fil haute fidélité, montres connectées et chargeurs solaires.",
    owner_bio: "Gérant d'Ouaga Tech à Zogona. Tous nos téléphones et accessoires sont authentiques et testés avec soin.",
    currency: "FCFA",
    logo_url: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400&auto=format&fit=crop&q=80",
    avatar_url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80",
    rating: 4.88,
    sales_count: 612,
    revenue: 21540000,
    is_verified: true,
    social_tunnel_badge: "WA/FB",
    social_tunnel_label: "Tunnel Social Actif",
    is_flash_active: true,
    flash_title: "Promo Smartphones 4G/5G",
    flash_subtitle: "Garantie 12 mois • Livraison moto gratuite à Ouaga",
    flash_remaining_seconds: 9800,
    voice_note_title: "Besoin d'aide pour choisir votre smartphone ?",
    voice_note_subtitle: "Ousmane vous répond instantanément sur WhatsApp avec conseils techniques.",
    primary_color: "#2563eb",
    secondary_color: "#10b981",
    theme_preset: "kinetic_blue",
    is_custom_theme_active: true,
    is_loyalty_active: true,
    loyalty_spend_per_point: 1000,
    subscription_status: "ACTIVE",
    subscription_plan: "PRO",
    custom_domain: "ouagatech.bf",
    contact_whatsapp: "+22676987654",
    contact_email: "ousmane.ouedraogo@ouagatech.bf",
    trust_badges: [
      { id: "tb4", icon_name: "verified_user", label: "Garantie 12 Mois", badge_type: "primary" },
      { id: "tb5", icon_name: "local_shipping", label: "Livraison Express Ouaga", badge_type: "secondary" },
      { id: "tb6", icon_name: "price_check", label: "Paiement Après Test", badge_type: "secondary-fixed" },
    ],
    delivery_cities: [
      { id: "dc5", name: "Ouagadougou (Zogona, 1200 Logements, Koulouba)", display_label: "📍 Ouaga", is_default: true },
      { id: "dc6", name: "Bobo-Dioulasso", display_label: "Bobo", is_default: false },
      { id: "dc7", name: "Ouahigouya", display_label: "Ouahigouya", is_default: false },
    ],
    channels: [
      { id: "ch4", channel_type: "WHATSAPP", display_title: "WhatsApp Tech Direct", badge_text: "RECOMMANDÉ", badge_style: "primary", account_handle: "22676987654", subtitle: "Support technique & commande en 2 min", icon_name: "chat", theme_color: "#25D366", is_active: true, is_recommended: true },
      { id: "ch5", channel_type: "CALL", display_title: "Appel Commercial Ouaga", badge_text: "Boutique", badge_style: "secondary", account_handle: "+226 76 98 76 54", subtitle: "Ligne directe Ousmane Ouédraogo", icon_name: "phone_in_talk", theme_color: "#2563eb", is_active: true, is_recommended: false },
    ],
    loyalty_tiers: [
      { id: "lt4", name: "Membre Tech", min_points: 0, badge_label: "Découverte", perk_title: "Assistance configuration offerte", perk_description: "Aide au paramétrage de vos nouveaux appareils par WhatsApp.", discount_percent: 0 },
      { id: "lt5", name: "VIP High-Tech", min_points: 50, badge_label: "Privilège", perk_title: "5% de remise + Film protecteur offert", perk_description: "Pose d'écran de protection gratuite sur chaque téléphone commandé.", discount_percent: 5 },
      { id: "lt6", name: "Titanium Club", min_points: 150, badge_label: "Élite", perk_title: "10% de remise permanente & Garantie étendue", perk_description: "Extension de garantie 6 mois supplémentaires offerte sur tout achat.", discount_percent: 10 },
    ],
  },
  "sya-beaute": {
    id: "store-sya-beaute-03",
    name: "Sya Beauté & Soins Naturels",
    slug: "sya-beaute",
    tagline: "Beauté bio au beurre de karité pur de Bobo-Dioulasso",
    description: "Cosmétiques 100% naturels et biologiques formulés avec le beurre de karité et l'huile de sésame de la région des Hauts-Bassins. Soins capillaires et corporels authentiques.",
    owner_bio: "Passionnée de cosmétologie africaine à Bobo-Dioulasso (Belleville). Nos soins sont sans produits chimiques et enrichis au karité certifié bio.",
    currency: "FCFA",
    logo_url: "https://images.unsplash.com/photo-1608248597359-2d19f6a7d573?w=400&auto=format&fit=crop&q=80",
    avatar_url: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&auto=format&fit=crop&q=80",
    rating: 4.92,
    sales_count: 374,
    revenue: 5430000,
    is_verified: true,
    social_tunnel_badge: "WA/FB",
    social_tunnel_label: "Tunnel Social Actif",
    is_flash_active: true,
    flash_title: "Offre Beauté Sya Naturelle",
    flash_subtitle: "Pour 2 pots de karité achetés, 1 savon noir bio offert !",
    flash_remaining_seconds: 18000,
    voice_note_title: "Conseil personnalisé type de peau & cheveux",
    voice_note_subtitle: "Fatoumata vous conseille selon vos besoins en audio WhatsApp.",
    primary_color: "#059669",
    secondary_color: "#f59e0b",
    theme_preset: "kinetic_emerald",
    is_custom_theme_active: true,
    is_loyalty_active: true,
    loyalty_spend_per_point: 1000,
    subscription_status: "ACTIVE",
    subscription_plan: "STARTER",
    custom_domain: "syabeaute.bf",
    contact_whatsapp: "+22678129876",
    contact_email: "fatoumata.traore@syabeaute.bf",
    trust_badges: [
      { id: "tb7", icon_name: "spa", label: "100% Karité Bio Bobo", badge_type: "primary" },
      { id: "tb8", icon_name: "local_shipping", label: "Livraison Bobo & Ouaga", badge_type: "secondary" },
      { id: "tb9", icon_name: "eco", label: "Zéro Produit Chimique", badge_type: "secondary-fixed" },
    ],
    delivery_cities: [
      { id: "dc8", name: "Bobo-Dioulasso (Belleville, Farakan, Bindougousso)", display_label: "📍 Bobo", is_default: true },
      { id: "dc9", name: "Ouagadougou", display_label: "Ouaga", is_default: false },
      { id: "dc10", name: "Banfora", display_label: "Banfora", is_default: false },
    ],
    channels: [
      { id: "ch6", channel_type: "WHATSAPP", display_title: "WhatsApp Beauté Direct", badge_text: "RECOMMANDÉ", badge_style: "primary", account_handle: "22678129876", subtitle: "Diagnostic peau/cheveux gratuit", icon_name: "chat", theme_color: "#25D366", is_active: true, is_recommended: true },
      { id: "ch7", channel_type: "CALL", display_title: "Ligne Conseil Bobo", badge_text: "Atelier", badge_style: "secondary", account_handle: "+226 78 12 98 76", subtitle: "Fatoumata Traoré", icon_name: "phone_in_talk", theme_color: "#059669", is_active: true, is_recommended: false },
    ],
    loyalty_tiers: [
      { id: "lt7", name: "Amie de Sya", min_points: 0, badge_label: "Découverte", perk_title: "Guide beauté naturelle offert", perk_description: "Conseils d'utilisation des beurres et huiles végétales par WhatsApp.", discount_percent: 0 },
      { id: "lt8", name: "Reine Karité", min_points: 50, badge_label: "Privilège", perk_title: "5% de remise + Échantillon offert", perk_description: "Un savon artisanal offert à chaque nouvelle commande.", discount_percent: 5 },
      { id: "lt9", name: "Princesse Guimbi", min_points: 150, badge_label: "Élite", perk_title: "10% de remise permanente & Cadeaux saisonniers", perk_description: "Cadeaux de fête exclusifs et remises VIP toute l'année.", discount_percent: 10 },
    ],
  },
  "garbadrome-kossodo": {
    id: "store-garbadrome-kossodo-00",
    name: "Garbadrome Kossodo",
    slug: "garbadrome-kossodo",
    tagline: "Le Garba authentique de la cité universitaire de Kossodo",
    description: "Spécialités de Garba ivoiro-burkinabè chaud et croustillant en direct de la cité universitaire de Kossodo. Poisson thon frit à la minute, attiéké frais de première qualité, oignons et piments dosés selon vos envies. Commandez et suivez votre plat en direct dans le chat !",
    owner_bio: "Moussa Traoré, garbatier passionné depuis 8 ans à Kossodo. Je sers les étudiants, résidents et professionnels du campus avec des portions généreuses et le vrai goût du garba au thon frais.",
    owner_name: "Moussa Traoré",
    currency: "FCFA",
    logo_url: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&auto=format&fit=crop&q=80",
    avatar_url: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&auto=format&fit=crop&q=80",
    rating: 4.96,
    sales_count: 520,
    revenue: 4250000,
    is_verified: true,
    social_tunnel_badge: "CHAT ACTIF",
    social_tunnel_label: "Commerce Conversationnel Natif",
    is_flash_active: true,
    flash_title: "Offre Spéciale Étudiant Kossodo",
    flash_subtitle: "Livraison directe en chambre ou amphi en moins de 15 min chrono",
    flash_remaining_seconds: 7200,
    voice_note_title: "Une envie de Garba bien dosé ?",
    voice_note_subtitle: "Moussa est aux fourneaux. Discutez directement dans le chat pour personnaliser votre plat !",
    primary_color: "#ea580c",
    secondary_color: "#16a34a",
    theme_preset: "kinetic_orange",
    is_custom_theme_active: true,
    is_loyalty_active: true,
    loyalty_spend_per_point: 500,
    subscription_status: "ACTIVE",
    subscription_plan: "PRO",
    contact_whatsapp: "+22676001045",
    contact_email: "moussa.traore@garbadrome-kossodo.bf",
    trust_badges: [
      { id: "tb-gk-1", icon_name: "restaurant", label: "Thon Frit Minute", badge_type: "primary" },
      { id: "tb-gk-2", icon_name: "local_shipping", label: "Livraison Cité Kossodo", badge_type: "secondary" },
      { id: "tb-gk-3", icon_name: "tune", label: "Plats Personnalisables", badge_type: "secondary-fixed" },
    ],
    delivery_cities: [
      { id: "dc-gk-1", name: "Cité Universitaire Kossodo (Pavillons A, B, C, D)", display_label: "📍 Cité Kossodo", is_default: true },
      { id: "dc-gk-2", name: "Kossodo Zone Industrielle & Écoles", display_label: "Zone Kossodo", is_default: false },
      { id: "dc-gk-3", name: "Somgandé & Nioko 1", display_label: "Somgandé", is_default: false },
    ],
    channels: [
      { id: "ch-gk-1", channel_type: "WHATSAPP", display_title: "WhatsApp Direct", badge_text: "RECOMMANDÉ", badge_style: "primary", account_handle: "22676001045", subtitle: "Commande en direct", icon_name: "chat", theme_color: "#25D366", is_active: true, is_recommended: true },
      { id: "ch-gk-2", channel_type: "CALL", display_title: "Appel Direct Cuisine", badge_text: "Kossodo", badge_style: "secondary", account_handle: "+226 76 00 10 45", subtitle: "Ligne directe Moussa Traoré", icon_name: "phone_in_talk", theme_color: "#ea580c", is_active: true, is_recommended: false },
    ],
    loyalty_tiers: [
      { id: "lt-gk-1", name: "Étudiant Gourmet", min_points: 0, badge_label: "Membre Kossodo", perk_title: "Piment & Oignons Supplémentaires", perk_description: "Garniture généreuse offerte à chaque commande.", discount_percent: 0 },
      { id: "lt-gk-2", name: "Fidèle Garbatier", min_points: 30, badge_label: "Habitué VIP", perk_title: "Boisson Offerte le Vendredi", perk_description: "Un jus de Bissap maison offert pour toute commande de Garba complet.", discount_percent: 5 },
      { id: "lt-gk-3", name: "Roi du Garba", min_points: 80, badge_label: "Club Élite", perk_title: "Livraison Gratuite Permanente", perk_description: "Toutes vos livraisons offertes sur tout le campus de Kossodo.", discount_percent: 10 },
    ],
  },
};

export const FALLBACK_CATEGORIES = {
  "faso-danfani": [
    { id: "cat-fd-all", name: "Tout", slug: "all", display_order: 0 },
    { id: "cat-fd-1", name: "Pagnes Faso Danfani", slug: "pagnes-faso-danfani", display_order: 1 },
    { id: "cat-fd-2", name: "Ensembles Kôkô Dunda", slug: "ensembles-koko-dunda", display_order: 2 },
    { id: "cat-fd-3", name: "Robes de Cérémonie", slug: "robes-ceremonie", display_order: 3 },
    { id: "cat-fd-4", name: "Écharpes & Accessoires", slug: "echarpes-accessoires", display_order: 4 },
  ],
  "ouaga-tech": [
    { id: "cat-ot-all", name: "Tout", slug: "all", display_order: 0 },
    { id: "cat-ot-1", name: "Smartphones Neufs", slug: "smartphones", display_order: 1 },
    { id: "cat-ot-2", name: "Écouteurs & Audio", slug: "audio", display_order: 2 },
    { id: "cat-ot-3", name: "Énergie & Solaire", slug: "energie", display_order: 3 },
    { id: "cat-ot-4", name: "Montres Connectées", slug: "montres", display_order: 4 },
  ],
  "sya-beaute": [
    { id: "cat-sb-all", name: "Tout", slug: "all", display_order: 0 },
    { id: "cat-sb-1", name: "Beurre de Karité", slug: "karite", display_order: 1 },
    { id: "cat-sb-2", name: "Soins Capillaires", slug: "cheveux", display_order: 2 },
    { id: "cat-sb-3", name: "Savons Bio du Sahel", slug: "savons", display_order: 3 },
    { id: "cat-sb-4", name: "Huiles Végétales Pures", slug: "huiles", display_order: 4 },
  ],
  "garbadrome-kossodo": [
    { id: "cat-gk-all", name: "Tout", slug: "all", display_order: 0 },
    { id: "cat-gk-1", name: "Garba & Spécialités", slug: "garba-specialites", display_order: 1 },
    { id: "cat-gk-2", name: "Portions Personnalisées", slug: "portions-personnalisees", display_order: 2 },
    { id: "cat-gk-3", name: "Accompagnements", slug: "accompagnements", display_order: 3 },
    { id: "cat-gk-4", name: "Boissons Fraîches", slug: "boissons", display_order: 4 },
  ],
};

export const FALLBACK_PRODUCTS = {
  "faso-danfani": [
    {
      id: "prod-fd-01",
      category_id: "cat-fd-1",
      name: "Pagne Faso Danfani Traditionnel Tissé Main (3 pièces)",
      slug: "pagne-faso-danfani-traditionnel-3-pieces",
      description: "Véritable Faso Danfani en pur coton burkinabè, tissé selon la tradition séculaire. Étoffe lourde, texture noble, teintes naturelles d'indigo et terre sahélienne. Parfait pour les grandes cérémonies et tenues d'apparat.",
      short_description: "100% pur coton burkinabè, 3 pièces complètes tissées main à Koudougou.",
      price: 45000,
      old_price: 55000,
      currency: "FCFA",
      stock: 8,
      stock_label: "Reste 8 pièces tissées",
      is_hero_deal: true,
      badge_tag: "Patrimoine National",
      active_discussions_count: 32,
      views_count: 1240,
      sales_count: 64,
      revenue: 2880000,
      guarantee_text: "100% Coton Pur Tissé",
      primary_image_url: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=800&auto=format&fit=crop&q=80",
      display_order: 0,
      variants: [
        { id: "v-fd-1", group_name: "Teinte", name: "Bleu Indigo Royal", is_default: true },
        { id: "v-fd-2", group_name: "Teinte", name: "Blanc Cassé & Ocre", is_default: false },
        { id: "v-fd-3", group_name: "Teinte", name: "Rouge Terre Sahélienne", is_default: false },
      ],
    },
    {
      id: "prod-fd-02",
      category_id: "cat-fd-2",
      name: "Ensemble Veste & Pantalon Homme Faso Danfani",
      slug: "ensemble-veste-pantalon-homme-faso-danfani",
      description: "Costume moderne pour homme d'affaires et réceptions officielles. Coupe ajustée, col mao élégant, tissage fin bicolore. Confectionné par nos maîtres tailleurs à Ouaga 2000.",
      short_description: "Coupe moderne slim, col mao prestige, tissage bicolore d'exception.",
      price: 55000,
      old_price: 68000,
      currency: "FCFA",
      stock: 5,
      stock_label: "Édition Limitée",
      is_hero_deal: false,
      badge_tag: "Collection Homme",
      active_discussions_count: 18,
      views_count: 850,
      sales_count: 38,
      revenue: 2090000,
      guarantee_text: "Couture Haute Définition",
      primary_image_url: "https://images.unsplash.com/photo-1617137984095-74e4e5e3613f?w=800&auto=format&fit=crop&q=80",
      display_order: 1,
      variants: [
        { id: "v-fd-4", group_name: "Taille", name: "M (40-42)", is_default: false },
        { id: "v-fd-5", group_name: "Taille", name: "L (44-46)", is_default: true },
        { id: "v-fd-6", group_name: "Taille", name: "XL (48-50)", is_default: false },
      ],
    },
    {
      id: "prod-fd-03",
      category_id: "cat-fd-3",
      name: "Robe d'Apparat Kôkô Dunda & Faso Danfani",
      slug: "robe-apparat-koko-dunda-faso-danfani",
      description: "Mariage somptueux entre le pagne teinté Kôkô Dunda de Bobo-Dioulasso et les motifs tissés du Faso Danfani. Silhouette royale avec finitions brodées à la main.",
      short_description: "Fusion féerique Kôkô Dunda de Bobo et Danfani de Ouaga.",
      price: 32500,
      old_price: 40000,
      currency: "FCFA",
      stock: 12,
      stock_label: "Fait Main",
      is_hero_deal: false,
      badge_tag: "Coup de Cœur",
      active_discussions_count: 24,
      views_count: 910,
      sales_count: 45,
      revenue: 1462500,
      guarantee_text: "Création Exclusive",
      primary_image_url: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&auto=format&fit=crop&q=80",
      display_order: 2,
    },
    {
      id: "prod-fd-04",
      category_id: "cat-fd-4",
      name: "Écharpe d'Honneur Tissée Main & Soie Sahélienne",
      slug: "echarpe-honneur-tissee-main-soie-sahelienne",
      description: "Écharpe de prestige pour cérémonies, réceptions et cadeaux d'affaires. Coton peigné et fil de soie, motifs géométriques mossi traditionnels.",
      short_description: "Écharpe de prestige tissée main, finitions à franges traditionnelles.",
      price: 12000,
      old_price: 15000,
      currency: "FCFA",
      stock: 15,
      stock_label: "En stock",
      is_hero_deal: false,
      badge_tag: "Cadeau de Prestige",
      active_discussions_count: 12,
      views_count: 430,
      sales_count: 52,
      revenue: 624000,
      guarantee_text: "Authentique Artisanal",
      primary_image_url: "https://images.unsplash.com/photo-1520903920243-00d872a2d1c9?w=800&auto=format&fit=crop&q=80",
      display_order: 3,
    },
  ],
  "ouaga-tech": [
    {
      id: "prod-ot-01",
      category_id: "cat-ot-1",
      name: "Samsung Galaxy A15 4G (128 Go, 6 Go RAM) - Neuf Scellé",
      slug: "samsung-galaxy-a15-4g-128go",
      description: "Smartphone Samsung original, écran Super AMOLED 90Hz lumineux même sous le soleil sahélien. Batterie 5000 mAh longue autonomie (2 jours), triple caméra 50 MP pour des photos nettes. Garantie 12 mois.",
      short_description: "Écran Super AMOLED 90Hz, 128 Go stockage, batterie 5000 mAh, garantie 1 an.",
      price: 95000,
      old_price: 110000,
      currency: "FCFA",
      stock: 10,
      stock_label: "10 pièces disponibles",
      is_hero_deal: true,
      badge_tag: "Top Vente Ouaga",
      active_discussions_count: 45,
      views_count: 2150,
      sales_count: 88,
      revenue: 8360000,
      guarantee_text: "Garantie 12 Mois Pièces & Main d'Œuvre",
      primary_image_url: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800&auto=format&fit=crop&q=80",
      display_order: 0,
      variants: [
        { id: "v-ot-1", group_name: "Couleur", name: "Bleu Nuit", is_default: true },
        { id: "v-ot-2", group_name: "Couleur", name: "Noir Sidéral", is_default: false },
        { id: "v-ot-3", group_name: "Couleur", name: "Jaune Lumineux", is_default: false },
      ],
    },
    {
      id: "prod-ot-02",
      category_id: "cat-ot-2",
      name: "Écouteurs Sans Fil Pro Bass ANC Bluetooth 5.3",
      slug: "ecouteurs-sans-fil-pro-bass-anc",
      description: "Écouteurs intra-auriculaires avec réduction active du bruit (ANC), son stéréo cristallin avec basses percutantes. Autonomie totale 32 heures avec le boîtier de charge rapide Type-C.",
      short_description: "Réduction active de bruit, son Hi-Fi, autonomie 32h, micro HD.",
      price: 18500,
      old_price: 25000,
      currency: "FCFA",
      stock: 22,
      stock_label: "En stock à Zogona",
      is_hero_deal: false,
      badge_tag: "Son Pure Bass",
      active_discussions_count: 21,
      views_count: 780,
      sales_count: 74,
      revenue: 1369000,
      guarantee_text: "Garantie 6 Mois Échange Neuf",
      primary_image_url: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800&auto=format&fit=crop&q=80",
      display_order: 1,
    },
    {
      id: "prod-ot-03",
      category_id: "cat-ot-3",
      name: "Chargeur Solaire Sahara PowerBank 20 000 mAh Ultra-Résistant",
      slug: "chargeur-solaire-sahara-powerbank-20000mah",
      description: "Batterie externe conçue pour les coupures de courant et les déplacements au Burkina. Double panneau solaire de secours, lampe torche LED puissante intégrée, 3 sorties USB charge rapide 22.5W.",
      short_description: "20 000 mAh réel, panneau solaire intégré, lampe torche puissante, coque antichoc.",
      price: 22000,
      old_price: 28000,
      currency: "FCFA",
      stock: 15,
      stock_label: "Idéal Déplacement & Coupures",
      is_hero_deal: false,
      badge_tag: "Spécial Sahel",
      active_discussions_count: 31,
      views_count: 1120,
      sales_count: 92,
      revenue: 2024000,
      guarantee_text: "Testé & Certifié Antichoc",
      primary_image_url: "https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=800&auto=format&fit=crop&q=80",
      display_order: 2,
    },
    {
      id: "prod-ot-04",
      category_id: "cat-ot-4",
      name: "Montre Connectée Sport Santé AMOLED Étanche",
      slug: "montre-connectee-sport-sante-amoled",
      description: "Montre connectée avec écran AMOLED incurvé, suivi cardiaque 24/7, saturation oxygène (SpO2), appels Bluetooth directs depuis le poignet, notifications WhatsApp et SMS. Étanche IP68.",
      short_description: "Appels Bluetooth, écran AMOLED HD, suivi sommeil & rythme cardiaque, étanche IP68.",
      price: 28000,
      old_price: 36000,
      currency: "FCFA",
      stock: 12,
      stock_label: "Disponible",
      is_hero_deal: false,
      badge_tag: "Nouveau Arrivage",
      active_discussions_count: 19,
      views_count: 650,
      sales_count: 48,
      revenue: 1344000,
      guarantee_text: "Garantie 6 Mois",
      primary_image_url: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80",
      display_order: 3,
    },
  ],
  "sya-beaute": [
    {
      id: "prod-sb-01",
      category_id: "cat-sb-1",
      name: "Baume Pur Karité Sauvage de Bobo (Pot 250g)",
      slug: "baume-pur-karite-sauvage-bobo-250g",
      description: "Beurre de karité 100% pur non raffiné, extrait artisanalement à froid par les groupements féminins de la région de Bobo-Dioulasso. Riche en vitamines A, E et F. Hydrate en profondeur la peau sèche et nourrit les cheveux crépus.",
      short_description: "100% pur non raffiné, pressé à froid par les coopératives de Bobo.",
      price: 6500,
      old_price: 8000,
      currency: "FCFA",
      stock: 35,
      stock_label: "Récolte Fraîche",
      is_hero_deal: true,
      badge_tag: "100% Bio & Artisanal",
      active_discussions_count: 38,
      views_count: 1450,
      sales_count: 115,
      revenue: 747500,
      guarantee_text: "Sans Conservateur ni Parfum Chimique",
      primary_image_url: "https://images.unsplash.com/photo-1608248597359-2d19f6a7d573?w=800&auto=format&fit=crop&q=80",
      display_order: 0,
      variants: [
        { id: "v-sb-1", group_name: "Format", name: "Pot 250g", is_default: true },
        { id: "v-sb-2", group_name: "Format", name: "Pot Économique 500g", is_default: false },
      ],
    },
    {
      id: "prod-sb-02",
      category_id: "cat-sb-2",
      name: "Sérum Capillaire Fortifiant Karité & Ricin (100ml)",
      slug: "serum-capillaire-fortifiant-karite-ricin",
      description: "Élixir puissant de repousse et d'anti-casse pour cheveux texturés, tressés ou défrisés. Synergie d'huile de ricin noir du Burkina, d'huile d'amande douce et d'extrait de karité fondu.",
      short_description: "Anti-casse & repousse rapide pour cheveux naturels, locks et tresses.",
      price: 8500,
      old_price: 11000,
      currency: "FCFA",
      stock: 20,
      stock_label: "Formule Enrichie",
      is_hero_deal: false,
      badge_tag: "Formule Pousse Rapide",
      active_discussions_count: 27,
      views_count: 890,
      sales_count: 82,
      revenue: 697000,
      guarantee_text: "Résultats visibles sous 3 semaines",
      primary_image_url: "https://images.unsplash.com/photo-1601049541289-9b1b7bbbfe19?w=800&auto=format&fit=crop&q=80",
      display_order: 1,
    },
    {
      id: "prod-sb-03",
      category_id: "cat-sb-3",
      name: "Savon Noir Artisanal aux Plantes du Sahel (Lot de 3)",
      slug: "savon-noir-artisanal-plantes-sahel-lot-3",
      description: "Savon traditionnel gommant saponifié à froid aux cendres de cabosses de cacao et feuilles de neem. Nettoie en profondeur les impuretés, atténue les taches et unifie le teint en douceur.",
      short_description: "Lot de 3 savons purifiants au neem, miel sauvage et karité bio.",
      price: 5000,
      old_price: 6500,
      currency: "FCFA",
      stock: 40,
      stock_label: "En stock",
      is_hero_deal: false,
      badge_tag: "Teint Lumineux",
      active_discussions_count: 19,
      views_count: 670,
      sales_count: 94,
      revenue: 470000,
      guarantee_text: "Gommage Doux Naturel",
      primary_image_url: "https://images.unsplash.com/photo-1607006314639-6593f6ea0f4a?w=800&auto=format&fit=crop&q=80",
      display_order: 2,
    },
    {
      id: "prod-sb-04",
      category_id: "cat-sb-4",
      name: "Huile Végétale Pure de Sésame Pressée à Froid (200ml)",
      slug: "huile-vegetale-pure-sesame-pressee-froid-200ml",
      description: "Huile de graines de sésame du terroir burkinabè, première pression à froid. Excellente pour les massages relaxants, la protection solaire naturelle et l'hydratation quotidienne de la peau.",
      short_description: "Huile précieuse corps & visage, première pression à froid sans solvant.",
      price: 7000,
      old_price: 9000,
      currency: "FCFA",
      stock: 25,
      stock_label: "Première Pression",
      is_hero_deal: false,
      badge_tag: "Éclat & Massage",
      active_discussions_count: 14,
      views_count: 510,
      sales_count: 60,
      revenue: 420000,
      guarantee_text: "100% Pure Sans Additif",
      primary_image_url: "https://images.unsplash.com/photo-1608248597359-2d19f6a7d573?w=800&auto=format&fit=crop&q=80",
      display_order: 3,
    },
  ],
  "garbadrome-kossodo": [
    {
      id: "prod-gk-01",
      category_id: "cat-gk-1",
      name: "Garba + Poisson Thon Frit Croustillant",
      slug: "garba-poisson-thon-frit-croustillant",
      description: "Le plat culte de la cité universitaire de Kossodo ! Pavé de thon frais frit à la minute, attiéké de première qualité assaisonné aux oignons émincés, tomates et piments frais selon votre goût.",
      short_description: "Attiéké frais de qualité supérieure avec gros pavé de thon frit à la minute.",
      price: 1500,
      old_price: 1750,
      currency: "FCFA",
      stock: 40,
      stock_label: "Disponible en continu",
      is_hero_deal: true,
      badge_tag: "Le Roi du Campus ★",
      active_discussions_count: 38,
      views_count: 1540,
      sales_count: 142,
      revenue: 213000,
      guarantee_text: "Thon Frais Garanti",
      primary_image_url: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80",
      is_customizable: true,
      customization_prompt: "Personnalise ton piment, oignons et cuisson",
      display_order: 0,
    },
    {
      id: "prod-gk-02",
      category_id: "cat-gk-1",
      name: "Garba Spécial Kossodo - Portion Royale",
      slug: "garba-special-kossodo-portion-royale",
      description: "Double portion d'attiéké frais, 2 gros morceaux de thon croustillant, tomates, oignons frits, piment pilé et un jus naturel de Bissap frais 50cl offert.",
      short_description: "Portion géante 2 thons + attiéké double + boisson Bissap offerte.",
      price: 3500,
      old_price: 4000,
      currency: "FCFA",
      stock: 25,
      stock_label: "En stock cuisine",
      is_hero_deal: false,
      badge_tag: "Festin Royal",
      active_discussions_count: 24,
      views_count: 920,
      sales_count: 85,
      revenue: 297500,
      guarantee_text: "Repas Complet",
      primary_image_url: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80",
      is_customizable: true,
      customization_prompt: "Niveau de piment et accompagnement",
      display_order: 1,
    },
    {
      id: "prod-gk-03",
      category_id: "cat-gk-2",
      name: "Pavé de Poisson Thon Frit Doré (Unité)",
      slug: "pave-de-poisson-thon-frit-dore",
      description: "Gros morceau de thon frais mariné aux épices locales et frit à la minute. Croustillant à l'extérieur, fondant à l'intérieur.",
      short_description: "Pavé de thon frais frit à la demande.",
      price: 1000,
      currency: "FCFA",
      stock: 35,
      stock_label: "Frit à la commande",
      is_hero_deal: false,
      badge_tag: "Extra Protéine",
      active_discussions_count: 14,
      views_count: 480,
      sales_count: 65,
      revenue: 65000,
      guarantee_text: "Friture Minute",
      primary_image_url: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80",
      display_order: 2,
    },
    {
      id: "prod-gk-04",
      category_id: "cat-gk-4",
      name: "Jus de Bissap Maison Menthe & Gingembre (50cl)",
      slug: "jus-de-bissap-maison-menthe-gingembre",
      description: "Boisson artisanale fraîche à base de fleurs d'hibiscus rouge, infusée à la menthe fraîche du jardin et relevée d'une touche de gingembre naturel.",
      short_description: "Bissap glacé artisanal 50cl.",
      price: 500,
      currency: "FCFA",
      stock: 50,
      stock_label: "Bien frais",
      is_hero_deal: false,
      badge_tag: "Glacé",
      active_discussions_count: 19,
      views_count: 620,
      sales_count: 110,
      revenue: 55000,
      guarantee_text: "100% Naturel",
      primary_image_url: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=800&auto=format&fit=crop&q=80",
      display_order: 3,
    },
  ],
};

export function getFallbackStore(slug) {
  if (!slug) return FALLBACK_DETAILED_STORES["faso-danfani"];
  const clean = slug.toLowerCase().trim();
  if (FALLBACK_DETAILED_STORES[clean]) {
    return FALLBACK_DETAILED_STORES[clean];
  }
  if (clean === "awa-chic" || clean === "awa-chic-tech") {
    return FALLBACK_DETAILED_STORES["faso-danfani"];
  }

  // Search in 100 authentic public stores list
  const basic = FALLBACK_PUBLIC_STORES.find(
    (s) => s.slug?.toLowerCase() === clean || s.id?.toLowerCase() === clean
  );
  if (basic) {
    const cityName = basic.delivery_city?.split("(")[0]?.trim() || "Burkina Faso";
    const phone = "+22670000000";
    return {
      id: basic.id,
      name: basic.name,
      slug: basic.slug,
      tagline: basic.tagline,
      description: basic.description,
      owner_bio: basic.owner_bio || `Responsable et gérant(e) chez ${basic.name}. Produits certifiés authentiques.`,
      owner_name: basic.owner_name || "Gérant(e)",
      currency: basic.currency || "FCFA",
      logo_url: basic.logo_url || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&auto=format&fit=crop&q=80",
      avatar_url: basic.avatar_url || "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&auto=format&fit=crop&q=80",
      rating: basic.rating || 4.9,
      sales_count: basic.sales_count || 120,
      revenue: (basic.sales_count || 120) * 12500,
      is_verified: basic.is_verified !== false,
      social_tunnel_badge: basic.social_tunnel_badge || "WA/DIRECT",
      social_tunnel_label: basic.social_tunnel_label || "Tunnel Direct Actif",
      is_flash_active: true,
      flash_title: `Offre Spéciale ${basic.name}`,
      flash_subtitle: `${cityName} • Livraison express avec paiement à la livraison`,
      flash_remaining_seconds: 14400,
      voice_note_title: `Besoin d'un renseignement ou d'un conseil ?`,
      voice_note_subtitle: `${basic.owner_name || "Le vendeur"} vous répond directement sur WhatsApp.`,
      primary_color: basic.primary_color || "#ec761e",
      secondary_color: basic.secondary_color || "#10b981",
      theme_preset: "custom",
      is_custom_theme_active: true,
      is_loyalty_active: true,
      loyalty_spend_per_point: 1000,
      subscription_status: "ACTIVE",
      subscription_plan: "PRO",
      contact_whatsapp: phone,
      contact_email: `${basic.slug}@gotoshop.bf`,
      trust_badges: [
        { id: `tb-${basic.slug}-1`, icon_name: "verified", label: "Commerçant Vérifié", badge_type: "primary" },
        { id: `tb-${basic.slug}-2`, icon_name: "local_shipping", label: "Paiement à la Livraison", badge_type: "secondary" },
        { id: `tb-${basic.slug}-3`, icon_name: "chat", label: "Commande Directe WhatsApp", badge_type: "secondary-fixed" },
      ],
      delivery_cities: [
        { id: `dc-${basic.slug}-1`, name: basic.delivery_city || "Ouagadougou", display_label: `📍 ${cityName}`, is_default: true },
        { id: `dc-${basic.slug}-2`, name: "Bobo-Dioulasso", display_label: "Bobo", is_default: false },
        { id: `dc-${basic.slug}-3`, name: "Expédition Sous-Régionale", display_label: "Sous-Région", is_default: false },
      ],
      channels: [
        { id: `ch-${basic.slug}-1`, channel_type: "WHATSAPP", display_title: "WhatsApp Direct", badge_text: "RECOMMANDÉ", badge_style: "primary", account_handle: phone.replace(/[^0-9]/g, ""), subtitle: "Réponse en moins de 5 min", icon_name: "chat", theme_color: "#25D366", is_active: true, is_recommended: true },
        { id: `ch-${basic.slug}-2`, channel_type: "CALL", display_title: "Appel Direct Vendeur", badge_text: cityName, badge_style: "secondary", account_handle: phone, subtitle: basic.owner_name || "Ligne directe commerçant", icon_name: "phone_in_talk", theme_color: basic.primary_color || "#ec761e", is_active: true, is_recommended: false },
      ],
      loyalty_tiers: [
        { id: `lt-${basic.slug}-1`, name: "Niveau Découverte", min_points: 0, badge_label: "Client Bienvenue", perk_title: "Conseils directs WhatsApp", perk_description: "Assistance et suivi direct de votre commande.", discount_percent: 0 },
        { id: `lt-${basic.slug}-2`, name: "Privilège Fidèle", min_points: 50, badge_label: "Client Privilège", perk_title: "5% de remise permanente", perk_description: "Remise appliquée automatiquement sur chaque achat.", discount_percent: 5 },
        { id: `lt-${basic.slug}-3`, name: "Club VIP Élite", min_points: 150, badge_label: "Client VIP", perk_title: "10% de remise & Cadeau surprise", perk_description: "Traitement prioritaire et cadeau sur mesure.", discount_percent: 10 },
      ]
    };
  }

  return FALLBACK_DETAILED_STORES["faso-danfani"];
}

export function getFallbackCategories(slug) {
  if (!slug) return FALLBACK_CATEGORIES["faso-danfani"];
  const clean = slug.toLowerCase().trim();
  if (FALLBACK_CATEGORIES[clean]) {
    return FALLBACK_CATEGORIES[clean];
  }
  const basic = FALLBACK_PUBLIC_STORES.find(
    (s) => s.slug?.toLowerCase() === clean || s.id?.toLowerCase() === clean
  );
  const catType = (basic?.category || "GENERAL").toUpperCase();
  if (catType === "FOOD") {
    return [
      { id: `cat-${clean}-all`, name: "Tout", slug: "all", display_order: 0 },
      { id: `cat-${clean}-1`, name: "Plats Chauds & Spécialités", slug: "plats-chauds", display_order: 1 },
      { id: `cat-${clean}-2`, name: "Accompagnements & Sauces", slug: "accompagnements", display_order: 2 },
      { id: `cat-${clean}-3`, name: "Boissons Fraîches Locales", slug: "boissons", display_order: 3 },
    ];
  } else if (catType === "FASHION") {
    return [
      { id: `cat-${clean}-all`, name: "Tout", slug: "all", display_order: 0 },
      { id: `cat-${clean}-1`, name: "Créations & Tenues Nobles", slug: "creations", display_order: 1 },
      { id: `cat-${clean}-2`, name: "Pagnes & Étoffes Rares", slug: "pagnes", display_order: 2 },
      { id: `cat-${clean}-3`, name: "Accessoires & Finitions", slug: "accessoires", display_order: 3 },
    ];
  } else if (catType === "TECH") {
    return [
      { id: `cat-${clean}-all`, name: "Tout", slug: "all", display_order: 0 },
      { id: `cat-${clean}-1`, name: "Appareils Neufs Garantis", slug: "appareils", display_order: 1 },
      { id: `cat-${clean}-2`, name: "Audio & Écouteurs Pro", slug: "audio", display_order: 2 },
      { id: `cat-${clean}-3`, name: "Accessoires & Connectique", slug: "accessoires", display_order: 3 },
    ];
  } else if (catType === "BEAUTY") {
    return [
      { id: `cat-${clean}-all`, name: "Tout", slug: "all", display_order: 0 },
      { id: `cat-${clean}-1`, name: "Soins Visage & Corps", slug: "soins", display_order: 1 },
      { id: `cat-${clean}-2`, name: "Beurres & Huiles Bio", slug: "huiles", display_order: 2 },
      { id: `cat-${clean}-3`, name: "Savons Artisanaux", slug: "savons", display_order: 3 },
    ];
  }
  return [
    { id: `cat-${clean}-all`, name: "Tout", slug: "all", display_order: 0 },
    { id: `cat-${clean}-1`, name: "Nouveautés & Arrivages", slug: "nouveautes", display_order: 1 },
    { id: `cat-${clean}-2`, name: "Meilleures Ventes", slug: "meilleures-ventes", display_order: 2 },
    { id: `cat-${clean}-3`, name: "Offres Vedettes", slug: "offres", display_order: 3 },
  ];
}

export function getFallbackProducts(slug, categoryId = null) {
  if (!slug) return FALLBACK_PRODUCTS["faso-danfani"];
  const clean = slug.toLowerCase().trim();
  let products = FALLBACK_PRODUCTS[clean];

  if (!products) {
    const basic = FALLBACK_PUBLIC_STORES.find(
      (s) => s.slug?.toLowerCase() === clean || s.id?.toLowerCase() === clean
    );
    const storeName = basic?.name || "Boutique";
    const catType = (basic?.category || "GENERAL").toUpperCase();
    const curr = basic?.currency || "FCFA";
    const img1 = basic?.logo_url || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80";
    const img2 = "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=800&auto=format&fit=crop&q=80";

    let p1_name = `Spécialité Vedette ${storeName}`;
    let p1_price = 15000;
    let p2_name = `Pack Sélection ${storeName}`;
    let p2_price = 8500;
    let p3_name = `Offre Découverte Exclusive`;
    let p3_price = 5000;

    if (catType === "FOOD") {
      p1_name = `Plat Signature Dégustation - ${storeName}`;
      p1_price = 3500;
      p2_name = `Portion Duo Gourmande avec Boisson Fraîche`;
      p2_price = 6000;
      p3_name = `Accompagnement & Sauce Maison Authentique`;
      p3_price = 1000;
    } else if (catType === "FASHION") {
      p1_name = `Création Prestige Sur-Mesure - ${storeName}`;
      p1_price = 32000;
      p2_name = `Ensemble Élégance Sahélienne`;
      p2_price = 22000;
      p3_name = `Parure ou Étoffe d'Apparat`;
      p3_price = 12000;
    } else if (catType === "TECH") {
      p1_name = `Pack High-Tech Ultra Garanti - ${storeName}`;
      p1_price = 65000;
      p2_name = `Écouteurs Pro Haute Définition Sans Fil`;
      p2_price = 16000;
      p3_name = `Batterie Externe Rapide & Câble Renforcé`;
      p3_price = 9000;
    } else if (catType === "BEAUTY") {
      p1_name = `Coffret Soin Éclat & Beauté Bio - ${storeName}`;
      p1_price = 9500;
      p2_name = `Pot Familial Beurre Pur Récolte Sauvage (500g)`;
      p2_price = 5500;
      p3_name = `Savon Surgras Purifiant au Miel Sahélien`;
      p3_price = 2500;
    }

    products = [
      {
        id: `prod-${clean}-01`,
        category_id: `cat-${clean}-1`,
        name: p1_name,
        slug: `hero-${clean}`,
        description: `Produit d'excellence sélectionné par ${storeName}. Confection soignée, authenticité certifiée et livraison rapide garantie avec paiement à la réception.`,
        short_description: `Offre vedette authentique chez ${storeName}, livraison directe.`,
        price: p1_price,
        old_price: Math.round(p1_price * 1.25),
        currency: curr,
        stock: 12,
        stock_label: "Disponible en stock",
        is_hero_deal: true,
        badge_tag: "Offre Vedette ★",
        active_discussions_count: 24,
        views_count: 780,
        sales_count: 42,
        revenue: 42 * p1_price,
        guarantee_text: "100% Authentique",
        primary_image_url: img1,
        display_order: 0,
      },
      {
        id: `prod-${clean}-02`,
        category_id: `cat-${clean}-2`,
        name: p2_name,
        slug: `pack-${clean}`,
        description: `Sélection premium appréciée des clients habitués de ${storeName}. Rapport qualité-prix imbattable.`,
        short_description: `Sélection premium ${storeName}, satisfaction client garantie.`,
        price: p2_price,
        old_price: Math.round(p2_price * 1.2),
        currency: curr,
        stock: 20,
        stock_label: "En stock",
        is_hero_deal: false,
        badge_tag: "Meilleure Vente",
        active_discussions_count: 15,
        views_count: 490,
        sales_count: 28,
        revenue: 28 * p2_price,
        guarantee_text: "Qualité Certifiée",
        primary_image_url: img2,
        display_order: 1,
      },
      {
        id: `prod-${clean}-03`,
        category_id: `cat-${clean}-3`,
        name: p3_name,
        slug: `decouverte-${clean}`,
        description: `Idéal pour découvrir les produits de ${storeName} à prix doux avec commande directe sur WhatsApp.`,
        short_description: `Offre découverte accessible avec commande directe et rapide.`,
        price: p3_price,
        old_price: Math.round(p3_price * 1.15),
        currency: curr,
        stock: 25,
        stock_label: "En stock",
        is_hero_deal: false,
        badge_tag: "Prix Spécial",
        active_discussions_count: 11,
        views_count: 320,
        sales_count: 19,
        revenue: 19 * p3_price,
        guarantee_text: "Paiement Livraison",
        primary_image_url: img1,
        display_order: 2,
      },
    ];
  }

  if (!categoryId || categoryId === "all" || categoryId.endsWith("-all")) {
    return products;
  }
  return products.filter((p) => p.category_id === categoryId);
}

export const FALLBACK_SUBSCRIPTION_PUBLIC_INFO = {
  plans: [
    {
      id: "plan-starter-1000",
      name: "Formule Starter (1 000 FCFA)",
      code: "STARTER",
      price: 1000,
      currency: "FCFA",
      duration_days: 30,
      description: "Parfait pour lancer votre boutique en ligne et tester vos ventes sur WhatsApp.",
      features: [
        "Vitrine mobile personnalisée 24h/24",
        "Catalogue jusqu'à 30 produits",
        "Tunnel de commande WhatsApp direct",
        "Lien vitrine partageable sur TikTok/Instagram",
        "Statistiques de base des visites"
      ],
      badge_label: "Idéal Débutant",
      is_popular: false,
      is_active: true,
      display_order: 1
    },
    {
      id: "plan-pro-3000",
      name: "Formule Pro Vendeur (3 000 FCFA)",
      code: "PRO",
      price: 3000,
      currency: "FCFA",
      duration_days: 30,
      description: "Pour les commerçants actifs souhaitant maximiser leurs ventes et fidéliser leurs clients.",
      features: [
        "Produits illimités & multi-variantes",
        "Programme de fidélité & Système VIP Points",
        "Ventes Flash & Bannières promotionnelles",
        "Suivi et géolocalisation livreurs",
        "Statistiques avancées des commandes",
        "Support prioritaire 7j/7"
      ],
      badge_label: "Le Plus Populaire",
      is_popular: true,
      is_active: true,
      display_order: 2
    },
    {
      id: "plan-vip-5000",
      name: "Formule VIP Élite (5 000 FCFA)",
      code: "VIP",
      price: 5000,
      currency: "FCFA",
      duration_days: 30,
      description: "Solution tout inclus pour les commerçants établis et les marques en forte croissance.",
      features: [
        "Toutes les fonctionnalités Pro incluses",
        "Thème graphique sur mesure aux couleurs de votre marque",
        "Relances automatiques des commandes par WhatsApp",
        "Badge officiel Marchand Certifié Vérifié",
        "Accès prioritaire aux nouvelles fonctionnalités"
      ],
      badge_label: "Excellence VIP",
      is_popular: false,
      is_active: true,
      display_order: 3
    }
  ],
  ussd_configs: [
    {
      id: "ussd-orange-ci",
      operator_name: "Orange Money",
      operator_code: "ORANGE",
      merchant_number: "65711741",
      ussd_template: "*144*2*1*{merchant_number}*{amount}#",
      instructions: "Cliquez sur le bouton pour composer automatiquement le code USSD Orange Money, validez avec votre code secret, puis chargez la capture d'écran du reçu SMS de confirmation ci-dessous.",
      brand_color: "#FF7900",
      text_color: "#FFFFFF",
      icon_type: "orange",
      is_active: true,
      display_order: 1
    },
    {
      id: "ussd-moov-ci",
      operator_name: "Moov Money",
      operator_code: "MOOV",
      merchant_number: "52045008",
      ussd_template: "*555*2*1*{merchant_number}*{amount}#",
      instructions: "Cliquez sur le bouton pour composer le code USSD Moov Money, confirmez le transfert sur votre téléphone avec votre code secret Moov, puis prenez une capture du SMS reçu et chargez-la ci-dessous.",
      brand_color: "#005BAA",
      text_color: "#FFFFFF",
      icon_type: "moov",
      is_active: true,
      display_order: 2
    },
    {
      id: "ussd-wave-ci",
      operator_name: "Wave Money",
      operator_code: "WAVE",
      merchant_number: "0759000000",
      ussd_template: "Wave direct au 0759000000",
      instructions: "Ouvrez votre application Wave, effectuez le transfert vers notre compte Wave officiel et chargez la capture d'écran du reçu dans le champ dédié.",
      brand_color: "#1dc4fe",
      text_color: "#FFFFFF",
      icon_type: "wave",
      is_active: true,
      display_order: 3
    }
  ],
  plans_with_ussd: [
    {
      plan: {
        id: "plan-starter-1000",
        name: "Formule Starter (1 000 FCFA)",
        code: "STARTER",
        price: 1000,
        currency: "FCFA",
        duration_days: 30,
        description: "Parfait pour lancer votre boutique en ligne et tester vos ventes sur WhatsApp.",
        features: [
          "Vitrine mobile personnalisée 24h/24",
          "Catalogue jusqu'à 30 produits",
          "Tunnel de commande WhatsApp direct",
          "Lien vitrine partageable sur TikTok/Instagram",
          "Statistiques de base des visites"
        ],
        badge_label: "Idéal Débutant",
        is_popular: false,
        is_active: true,
        display_order: 1
      },
      payment_options: [
        {
          operator_code: "ORANGE",
          operator_name: "Orange Money",
          brand_color: "#FF7900",
          text_color: "#FFFFFF",
          icon_type: "orange",
          merchant_number: "65711741",
          ussd_code: "*144*2*1*65711741*1010#",
          tel_link: "tel:*144*2*1*65711741*1010%23",
          instructions: "Cliquez sur le bouton pour composer automatiquement le code USSD Orange Money, validez avec votre code secret, puis chargez la capture d'écran du reçu SMS de confirmation ci-dessous."
        },
        {
          operator_code: "MOOV",
          operator_name: "Moov Money",
          brand_color: "#005BAA",
          text_color: "#FFFFFF",
          icon_type: "moov",
          merchant_number: "52045008",
          ussd_code: "*555*2*1*52045008*1010#",
          tel_link: "tel:*555*2*1*52045008*1010%23",
          instructions: "Cliquez sur le bouton pour composer le code USSD Moov Money, confirmez le transfert sur votre téléphone avec votre code secret Moov, puis prenez une capture du SMS reçu et chargez-la ci-dessous."
        },
        {
          operator_code: "WAVE",
          operator_name: "Wave Money",
          brand_color: "#1dc4fe",
          text_color: "#FFFFFF",
          icon_type: "wave",
          merchant_number: "0759000000",
          ussd_code: "Wave direct au 0759000000",
          tel_link: "tel:0759000000",
          instructions: "Ouvrez votre application Wave, effectuez le transfert vers notre compte Wave officiel et chargez la capture d'écran du reçu dans le champ dédié."
        }
      ]
    },
    {
      plan: {
        id: "plan-pro-3000",
        name: "Formule Pro Vendeur (3 000 FCFA)",
        code: "PRO",
        price: 3000,
        currency: "FCFA",
        duration_days: 30,
        description: "Pour les commerçants actifs souhaitant maximiser leurs ventes et fidéliser leurs clients.",
        features: [
          "Produits illimités & multi-variantes",
          "Programme de fidélité & Système VIP Points",
          "Ventes Flash & Bannières promotionnelles",
          "Suivi et géolocalisation livreurs",
          "Statistiques avancées des commandes",
          "Support prioritaire 7j/7"
        ],
        badge_label: "Le Plus Populaire",
        is_popular: true,
        is_active: true,
        display_order: 2
      },
      payment_options: [
        {
          operator_code: "ORANGE",
          operator_name: "Orange Money",
          brand_color: "#FF7900",
          text_color: "#FFFFFF",
          icon_type: "orange",
          merchant_number: "65711741",
          ussd_code: "*144*2*1*65711741*3000#",
          tel_link: "tel:*144*2*1*65711741*3000%23",
          instructions: "Cliquez sur le bouton pour composer automatiquement le code USSD Orange Money, validez avec votre code secret, puis chargez la capture d'écran du reçu SMS de confirmation ci-dessous."
        },
        {
          operator_code: "MOOV",
          operator_name: "Moov Money",
          brand_color: "#005BAA",
          text_color: "#FFFFFF",
          icon_type: "moov",
          merchant_number: "52045008",
          ussd_code: "*555*2*1*52045008*3000#",
          tel_link: "tel:*555*2*1*52045008*3000%23",
          instructions: "Cliquez sur le bouton pour composer le code USSD Moov Money, confirmez le transfert sur votre téléphone avec votre code secret Moov, puis prenez une capture du SMS reçu et chargez-la ci-dessous."
        },
        {
          operator_code: "WAVE",
          operator_name: "Wave Money",
          brand_color: "#1dc4fe",
          text_color: "#FFFFFF",
          icon_type: "wave",
          merchant_number: "0759000000",
          ussd_code: "Wave direct au 0759000000",
          tel_link: "tel:0759000000",
          instructions: "Ouvrez votre application Wave, effectuez le transfert vers notre compte Wave officiel et chargez la capture d'écran du reçu dans le champ dédié."
        }
      ]
    },
    {
      plan: {
        id: "plan-vip-5000",
        name: "Formule VIP Élite (5 000 FCFA)",
        code: "VIP",
        price: 5000,
        currency: "FCFA",
        duration_days: 30,
        description: "Solution tout inclus pour les commerçants établis et les marques en forte croissance.",
        features: [
          "Toutes les fonctionnalités Pro incluses",
          "Thème graphique sur mesure aux couleurs de votre marque",
          "Relances automatiques des commandes par WhatsApp",
          "Badge officiel Marchand Certifié Vérifié",
          "Accès prioritaire aux nouvelles fonctionnalités"
        ],
        badge_label: "Excellence VIP",
        is_popular: false,
        is_active: true,
        display_order: 3
      },
      payment_options: [
        {
          operator_code: "ORANGE",
          operator_name: "Orange Money",
          brand_color: "#FF7900",
          text_color: "#FFFFFF",
          icon_type: "orange",
          merchant_number: "65711741",
          ussd_code: "*144*2*1*65711741*5000#",
          tel_link: "tel:*144*2*1*65711741*5000%23",
          instructions: "Cliquez sur le bouton pour composer automatiquement le code USSD Orange Money, validez avec votre code secret, puis chargez la capture d'écran du reçu SMS de confirmation ci-dessous."
        },
        {
          operator_code: "MOOV",
          operator_name: "Moov Money",
          brand_color: "#005BAA",
          text_color: "#FFFFFF",
          icon_type: "moov",
          merchant_number: "52045008",
          ussd_code: "*555*2*1*52045008*5000#",
          tel_link: "tel:*555*2*1*52045008*5000%23",
          instructions: "Cliquez sur le bouton pour composer le code USSD Moov Money, confirmez le transfert sur votre téléphone avec votre code secret Moov, puis prenez une capture du SMS reçu et chargez-la ci-dessous."
        },
        {
          operator_code: "WAVE",
          operator_name: "Wave Money",
          brand_color: "#1dc4fe",
          text_color: "#FFFFFF",
          icon_type: "wave",
          merchant_number: "0759000000",
          ussd_code: "Wave direct au 0759000000",
          tel_link: "tel:0759000000",
          instructions: "Ouvrez votre application Wave, effectuez le transfert vers notre compte Wave officiel et chargez la capture d'écran du reçu dans le champ dédié."
        }
      ]
    }
  ]
};

