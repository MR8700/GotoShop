"""Géolocalisation des zones de livraison : coordonnées de référence, distance et contrôle de cohérence.

Les coordonnées ci-dessous sont des centres de villes (précision ~ ville) avec un rayon de couverture ; le
commerçant peut les affiner dans Réglages. Les zones d'expédition sans lieu précis n'ont pas de GPS (pas de contrôle).
"""
import math
import re
import unicodedata
from typing import Any, Dict, List, Optional

DEFAULT_DELIVERY_FEE = 500  # tarif appliqué à toute nouvelle zone tant que le commerçant n'en fixe pas un autre

# (mots-clés normalisés, libellé, latitude, longitude, rayon km). Le premier motif trouvé l'emporte : les quartiers
# de Ouagadougou sont regroupés sous la ville (Kossodo, Ouaga 2000, Dassasgho, Koulouba... tiennent dans ~20 km).
GAZETTEER = [
    (("expedition", "toutes regions", "sous-region", "sous region"), None, None, None, None),
    (("ouagadougou", "ouaga", "kossodo", "dassasgho", "koulouba", "somgande", "nioko", "zogona", "1200 logements",
      "cite universitaire"), "Ouagadougou", 12.3714, -1.5197, 20.0),
    (("bobo",), "Bobo-Dioulasso", 11.1771, -4.2979, 15.0),
    (("koudougou",), "Koudougou", 12.2526, -2.3627, 10.0),
    (("ouahigouya",), "Ouahigouya", 13.5828, -2.4216, 10.0),
    (("banfora",), "Banfora", 10.6333, -4.7667, 10.0),
    (("abidjan", "cocody"), "Abidjan", 5.3600, -4.0083, 25.0),
    (("dakar",), "Dakar", 14.7167, -17.4677, 25.0),
    (("bamako",), "Bamako", 12.6392, -8.0029, 20.0),
]


def _norm(s: Optional[str]) -> str:
    s = unicodedata.normalize("NFKD", (s or "").lower())
    return re.sub(r"\s+", " ", "".join(c for c in s if not unicodedata.combining(c))).strip()


def suggest_gps(name: Optional[str]) -> Optional[Dict[str, Any]]:
    """Coordonnées de référence pour un nom de zone ; None si inconnu ou zone sans lieu précis."""
    n = _norm(name)
    for keys, label, lat, lng, radius in GAZETTEER:
        if any(k in n for k in keys):
            return None if lat is None else {"label": label, "latitude": lat, "longitude": lng, "radius_km": radius}
    return None


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0088
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def valid_coords(lat: Any, lng: Any) -> bool:
    try:
        lat, lng = float(lat), float(lng)
    except (TypeError, ValueError):
        return False
    return -90 <= lat <= 90 and -180 <= lng <= 180 and not (lat == 0 and lng == 0)


def find_city(cities: List[Any], wanted: Optional[str]) -> Optional[Any]:
    w = _norm(wanted)
    if not w:
        return None
    for c in cities:
        if w in {_norm(c.name), _norm(c.display_label)}:
            return c
    return None


def check_location(cities: List[Any], city_name: Optional[str], lat: Any, lng: Any) -> Dict[str, Any]:
    """Compare la position du client à la zone de livraison choisie.

    status : OK | MISMATCH (loin de la zone choisie) | OUT_OF_ZONE (dans aucune zone livrée) |
             UNVERIFIABLE (zone sans GPS) | NO_GPS (client sans position).
    """
    if not valid_coords(lat, lng):
        return {"status": "NO_GPS", "distance_km": None, "radius_km": None, "nearest": None}
    lat, lng = float(lat), float(lng)
    ranked = []
    for c in cities:
        if valid_coords(c.latitude, c.longitude):
            d = haversine_km(lat, lng, float(c.latitude), float(c.longitude))
            ranked.append((d, c))
    ranked.sort(key=lambda x: x[0])
    inside = [(d, c) for d, c in ranked if d <= float(c.radius_km or 15)]
    nearest = None
    if inside:
        d, c = inside[0]
        nearest = {"id": c.id, "name": c.name, "display_label": c.display_label, "distance_km": round(d, 1)}
    chosen = find_city(cities, city_name)
    if chosen is not None:
        if not valid_coords(chosen.latitude, chosen.longitude):
            return {"status": "UNVERIFIABLE", "distance_km": None, "radius_km": None, "nearest": nearest}
        d = haversine_km(lat, lng, float(chosen.latitude), float(chosen.longitude))
        radius = float(chosen.radius_km or 15)
        return {"status": "OK" if d <= radius else "MISMATCH", "distance_km": round(d, 1), "radius_km": radius,
                "nearest": nearest if d > radius else None, "city": chosen.name}
    if not ranked:
        return {"status": "UNVERIFIABLE", "distance_km": None, "radius_km": None, "nearest": None}
    return {"status": "OK" if inside else "OUT_OF_ZONE", "distance_km": round(ranked[0][0], 1),
            "radius_km": None, "nearest": nearest or {"id": ranked[0][1].id, "name": ranked[0][1].name,
                                                       "display_label": ranked[0][1].display_label,
                                                       "distance_km": round(ranked[0][0], 1)}}


def alert_message(res: Dict[str, Any], city_name: Optional[str]) -> str:
    status = res.get("status")
    if status == "MISMATCH":
        dist = res.get("distance_km")
        rad = res.get("radius_km")
        dist_str = f"{dist:g}" if dist is not None else "?"
        rad_str = f"{rad:g}" if rad is not None else "?"
        target_city = city_name or "la zone choisie"
        return f"Votre position GPS est à {dist_str} km de « {target_city} » (zone de livraison : {rad_str} km)."
    if status == "OUT_OF_ZONE":
        return "Votre position GPS est en dehors des zones livrées par cette boutique."
    return ""

