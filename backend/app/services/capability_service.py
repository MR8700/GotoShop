import json
from typing import List, Dict, Any, Optional

# Capability Identifier Constants
CAP_PRODUCT_CATALOG = "PRODUCT_CATALOG"
CAP_PRODUCT_VARIANTS = "PRODUCT_VARIANTS"
CAP_INVENTORY = "INVENTORY"
CAP_PROMOTIONS = "PROMOTIONS"
CAP_MENU = "MENU"
CAP_CUSTOM_ORDER = "CUSTOM_ORDER"
CAP_ORDERING = "ORDERING"
CAP_PAYMENT = "PAYMENT"
CAP_PAYMENT_PROOF = "PAYMENT_PROOF"
CAP_DELIVERY = "DELIVERY"
CAP_PICKUP = "PICKUP"
CAP_BOOKING = "BOOKING"
CAP_APPOINTMENT = "APPOINTMENT"
CAP_SERVICES = "SERVICES"
CAP_SUBSCRIPTION = "SUBSCRIPTION"
CAP_LOYALTY = "LOYALTY"
CAP_REVIEWS = "REVIEWS"
CAP_TIPPING = "TIPPING"
CAP_FOLLOWERS = "FOLLOWERS"
CAP_STORE_NEWS = "STORE_NEWS"
CAP_MESSAGING = "MESSAGING"
CAP_VOICE_CALL = "VOICE_CALL"
CAP_MEDIA_SHARING = "MEDIA_SHARING"
CAP_GEO_TRACKING = "GEO_TRACKING"
CAP_QR_ACCESS = "QR_ACCESS"
CAP_CUSTOM_DOMAIN = "CUSTOM_DOMAIN"
CAP_ANALYTICS = "ANALYTICS"

CAPABILITIES_CATALOG: Dict[str, Dict[str, str]] = {
    "PRODUCT_CATALOG": {
        "name": "Catalogue de Produits",
        "description": "Affichage et organisation des articles en vitrine",
        "icon": "inventory_2",
        "category": "COMMERCE",
    },
    "PRODUCT_VARIANTS": {
        "name": "Variantes de Produits",
        "description": "Gestion des tailles, pointures, coloris et finitions",
        "icon": "palette",
        "category": "COMMERCE",
    },
    "INVENTORY": {
        "name": "Gestion des Stocks",
        "description": "Suivi des quantités et alertes de rupture",
        "icon": "archive",
        "category": "COMMERCE",
    },
    "PROMOTIONS": {
        "name": "Promotions & Ventes Flash",
        "description": "Compte à rebours, bannières et réductions temporaires",
        "icon": "timer",
        "category": "COMMERCE",
    },
    "MENU": {
        "name": "Menu / Carte Restauration",
        "description": "Présentation des plats du jour, formules et boissons",
        "icon": "restaurant",
        "category": "FOOD",
    },
    "CUSTOM_ORDER": {
        "name": "Personnalisation sur Mesure",
        "description": "Choix des assaisonnements, portions, cuissons ou mesures",
        "icon": "tune",
        "category": "COMMERCE",
    },
    "ORDERING": {
        "name": "Prise de Commande Directe",
        "description": "Tunnel de commande intégré avec sélection et validation",
        "icon": "shopping_bag",
        "category": "COMMERCE",
    },
    "PAYMENT": {
        "name": "Paiement Mobile Money",
        "description": "Encaissement via Orange Money, Moov Money, Wave",
        "icon": "payments",
        "category": "PAYMENT",
    },
    "PAYMENT_PROOF": {
        "name": "Preuve de Paiement Sécurisée",
        "description": "Envoi et vérification visuelle de capture de reçu",
        "icon": "receipt",
        "category": "PAYMENT",
    },
    "DELIVERY": {
        "name": "Livraison Géolocalisée",
        "description": "Localisation GPS exacte et repères de livraison quartier",
        "icon": "local_shipping",
        "category": "LOGISTICS",
    },
    "PICKUP": {
        "name": "Retrait en Magasin / Sur Place",
        "description": "Click & Collect ou retrait direct au comptoir",
        "icon": "storefront",
        "category": "LOGISTICS",
    },
    "BOOKING": {
        "name": "Réservations",
        "description": "Réservation de tables, créneaux ou prestations",
        "icon": "schedule",
        "category": "SERVICES",
    },
    "APPOINTMENT": {
        "name": "Prise de Rendez-vous",
        "description": "Planning horaire pour artisans, stylistes et experts",
        "icon": "alarm",
        "category": "SERVICES",
    },
    "SERVICES": {
        "name": "Prestations & Devis",
        "description": "Offres de services, forfaits horaires ou forfaits fixes",
        "icon": "handshake",
        "category": "SERVICES",
    },
    "SUBSCRIPTION": {
        "name": "Formules d'Abonnement",
        "description": "Accès régulier ou livraisons périodiques programmées",
        "icon": "autorenew",
        "category": "COMMERCE",
    },
    "LOYALTY": {
        "name": "Programme de Fidélité",
        "description": "Attribution de points et paliers VIP (Bronze, Silver, Gold)",
        "icon": "loyalty",
        "category": "RELATION",
    },
    "STORE_NEWS": {
        "name": "Actualités & Annonces",
        "description": "Diffusion de nouveautés et messages auprès des abonnés",
        "icon": "notifications",
        "category": "COMMUNICATION",
    },
    "MESSAGING": {
        "name": "Messagerie Conversationnelle",
        "description": "Chat direct intégré entre client et commerçant",
        "icon": "forum",
        "category": "COMMUNICATION",
    },
    "VOICE_MESSAGE": {
        "name": "Notes Vocales",
        "description": "Enregistrement et écoute de messages audio en direct",
        "icon": "mic",
        "category": "COMMUNICATION",
    },
    "VOICE_CALL": {
        "name": "Appels Vocaux",
        "description": "Communications audio directes sans quitter l'application",
        "icon": "phone_in_talk",
        "category": "COMMUNICATION",
    },
    "VIDEO_CALL": {
        "name": "Appels Vidéo",
        "description": "Visio pour essayage virtuel ou présentation des créations",
        "icon": "videocam",
        "category": "COMMUNICATION",
    },
    "LOCATION": {
        "name": "Position & Plan d'Accès",
        "description": "Coordonnées géographiques et guidage de repérage",
        "icon": "pin_drop",
        "category": "LOGISTICS",
    },
    "QR_ACCESS": {
        "name": "Accès Instantané QR Code",
        "description": "QR codes physiques imprimables et partageables",
        "icon": "qr_code_2",
        "category": "DISCOVERY",
    },
    "FOLLOWERS": {
        "name": "Abonnement à la Boutique",
        "description": "Permet aux utilisateurs de suivre la boutique dans 'Mes boutiques'",
        "icon": "stars",
        "category": "RELATION",
    },
    "REVIEWS": {
        "name": "Avis & Retours Clients",
        "description": "Notes étoiles et témoignages d'acheteurs vérifiés",
        "icon": "verified",
        "category": "REPUTATION",
    },
    "ANNOUNCEMENTS": {
        "name": "Affiches & Communications",
        "description": "Bannières et actualités officielles de la boutique",
        "icon": "campaign",
        "category": "COMMUNICATION",
    },
    "DOCUMENTS": {
        "name": "Partage de Fichiers & Reçus",
        "description": "Transmission de factures et documents officiels",
        "icon": "attach_file",
        "category": "COMMERCE",
    },
}

DEFAULT_CAPABILITIES_BY_ACTIVITY: Dict[str, List[str]] = {
    "RESTAURANT": [
        "MENU", "CUSTOM_ORDER", "ORDERING", "PAYMENT_PROOF", "DELIVERY",
        "PICKUP", "STORE_NEWS", "FOLLOWERS", "MESSAGING", "VOICE_MESSAGE",
        "VOICE_CALL", "QR_ACCESS", "REVIEWS", "ANNOUNCEMENTS"
    ],
    "FOOD_COMMERCE": [
        "MENU", "CUSTOM_ORDER", "ORDERING", "PAYMENT_PROOF", "DELIVERY",
        "PICKUP", "STORE_NEWS", "FOLLOWERS", "MESSAGING", "QR_ACCESS", "REVIEWS"
    ],
    "FASHION": [
        "PRODUCT_CATALOG", "PRODUCT_VARIANTS", "INVENTORY", "PROMOTIONS",
        "ORDERING", "PAYMENT", "PAYMENT_PROOF", "DELIVERY", "STORE_NEWS",
        "FOLLOWERS", "MESSAGING", "VOICE_MESSAGE", "VOICE_CALL", "VIDEO_CALL",
        "QR_ACCESS", "REVIEWS", "LOYALTY"
    ],
    "ELECTRONICS": [
        "PRODUCT_CATALOG", "PRODUCT_VARIANTS", "INVENTORY", "PROMOTIONS",
        "ORDERING", "PAYMENT", "PAYMENT_PROOF", "DELIVERY", "STORE_NEWS",
        "FOLLOWERS", "MESSAGING", "QR_ACCESS", "REVIEWS"
    ],
    "SERVICE": [
        "SERVICES", "BOOKING", "APPOINTMENT", "MESSAGING", "VOICE_MESSAGE",
        "VOICE_CALL", "LOCATION", "FOLLOWERS", "STORE_NEWS", "QR_ACCESS",
        "REVIEWS", "ANNOUNCEMENTS"
    ],
    "CRAFT": [
        "PRODUCT_CATALOG", "CUSTOM_ORDER", "ORDERING", "PAYMENT_PROOF",
        "DELIVERY", "STORE_NEWS", "FOLLOWERS", "MESSAGING", "VOICE_MESSAGE",
        "QR_ACCESS", "REVIEWS"
    ],
    "GENERAL_COMMERCE": [
        "PRODUCT_CATALOG", "ORDERING", "PAYMENT_PROOF", "DELIVERY",
        "STORE_NEWS", "FOLLOWERS", "MESSAGING", "VOICE_MESSAGE", "QR_ACCESS", "REVIEWS"
    ],
}

class CapabilityService:
    @staticmethod
    def get_catalog() -> Dict[str, Dict[str, str]]:
        return CAPABILITIES_CATALOG

    @staticmethod
    def get_store_capabilities(store) -> List[str]:
        if not store:
            return []
        
        # 1. If explicit capabilities stored in DB as JSON list
        if getattr(store, "capabilities", None):
            try:
                caps = json.loads(store.capabilities)
                if isinstance(caps, list) and len(caps) > 0:
                    return caps
            except Exception:
                pass
        
        # 2. Derive from activity_type
        activity = getattr(store, "activity_type", None) or "GENERAL_COMMERCE"
        return DEFAULT_CAPABILITIES_BY_ACTIVITY.get(
            activity, DEFAULT_CAPABILITIES_BY_ACTIVITY["GENERAL_COMMERCE"]
        )

    @staticmethod
    def has_capability(store, capability: str) -> bool:
        caps = CapabilityService.get_store_capabilities(store)
        return capability.upper() in [c.upper() for c in caps]

    @staticmethod
    def set_store_capabilities(store, capabilities: List[str]) -> None:
        valid_caps = [c.upper() for c in capabilities if c.upper() in CAPABILITIES_CATALOG]
        store.capabilities = json.dumps(valid_caps)

    @staticmethod
    def set_store_capability_override(db, store, capability: str, enabled: bool) -> None:
        caps = list(CapabilityService.get_store_capabilities(store))
        cap_upper = capability.upper()
        if enabled and cap_upper not in caps:
            caps.append(cap_upper)
        elif not enabled and cap_upper in caps:
            caps = [c for c in caps if c != cap_upper]
        store.capabilities = json.dumps(caps)
        if db:
            db.commit()

    get_capabilities_for_store = get_store_capabilities
