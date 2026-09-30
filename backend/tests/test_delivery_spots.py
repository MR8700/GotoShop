"""Lieux de retrait / livraison définis par le commerçant et rattachés aux commandes."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal, engine
from app.migrations import run_migrations
from app.models.catalog import Product
from app.models.store import DeliverySpot

run_migrations(engine)
db = SessionLocal()
client = TestClient(app, base_url="https://gotoshop.example")
product = db.query(Product).filter(Product.stock > 10).first()
STORE = product.store_id


def _spot(kind, fee=None, active=True, name="Lieu test"):
    s = DeliverySpot(store_id=STORE, kind=kind, name=name, city="Ouagadougou", address="Face à la mairie",
                     hours="Lun-Sam 9h-18h", delivery_fee=fee, is_active=active, image_urls='["/media/store/logo.png"]')
    db.add(s)
    db.commit()
    return s


def _order(spot_id, phone):
    return client.post("/api/orders", json={
        "store_id": STORE,
        "items": [{"product_id": product.id, "product_name": product.name, "quantity": 1, "unit_price": 1}],
        "delivery": {"delivery_mode": "ADDRESS_DESCRIPTION", "delivery_city": "Ouagadougou",
                     "delivery_address": "x", "spot_id": spot_id},
        "customer_name": "Test Lieu", "customer_phone": phone, "delivery_fee": 900,
    })


def test_liste_publique_masque_les_lieux_inactifs():
    a, b = _spot("PICKUP", name="Actif"), _spot("DELIVERY", active=False, name="Inactif")
    names = [s["name"] for s in client.get(f"/api/store/{STORE}/delivery-spots").json()]
    assert "Actif" in names and "Inactif" not in names
    assert a.id and b.id


def test_ecriture_refusee_sans_jeton():
    r = client.post(f"/api/store/{STORE}/delivery-spots", json={"kind": "PICKUP", "name": "Pirate"})
    assert r.status_code in (401, 403)


def test_retrait_gratuit_et_lieu_fige_sur_la_commande():
    s = _spot("PICKUP", fee=800)
    r = _order(s.id, "+22677200001")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["delivery_fee"] == 0
    d = body["delivery"]
    assert d["fulfillment_type"] == "PICKUP" and d["spot"]["name"] == "Lieu test"


def test_lieu_de_livraison_utilise_son_tarif():
    s = _spot("DELIVERY", fee=1200)
    r = _order(s.id, "+22677200002")
    assert r.status_code == 200, r.text
    assert r.json()["delivery_fee"] == 1200
    assert r.json()["delivery"]["fulfillment_type"] == "MEETING_POINT"


def test_lieu_inactif_ou_inconnu_refuse():
    s = _spot("PICKUP", active=False)
    assert _order(s.id, "+22677200003").status_code == 400
    assert _order("inconnu", "+22677200004").status_code == 400


def test_position_client_incoherente_signalee():
    from app.models.store import DeliveryCity
    db.query(DeliveryCity).filter(DeliveryCity.store_id == STORE, DeliveryCity.name == "Ouagadougou").delete()
    db.add(DeliveryCity(store_id=STORE, name="Ouagadougou", display_label="Ouaga", delivery_fee=700))
    db.commit()
    ok = client.post(f"/api/store/{STORE}/delivery-check", json={"city": "Ouagadougou", "latitude": 12.37, "longitude": -1.52}).json()
    far = client.post(f"/api/store/{STORE}/delivery-check", json={"city": "Ouagadougou", "latitude": 5.36, "longitude": -4.0}).json()
    assert ok["status"] == "OK" and far["status"] == "MISMATCH" and far["message"]
    assert client.post(f"/api/store/{STORE}/delivery-check", json={"city": "Ouagadougou"}).json()["status"] == "NO_GPS"


def test_toute_zone_a_un_tarif_et_un_gps_connu():
    from app.models.store import DeliveryCity
    c = db.query(DeliveryCity).filter(DeliveryCity.store_id == STORE, DeliveryCity.name == "Ouagadougou").first()
    assert c.delivery_fee is not None and c.latitude is not None and c.radius_km


def test_commande_hors_zone_marquee_et_gps_absent_non_invente():
    far = client.post("/api/orders", json={
        "store_id": STORE,
        "items": [{"product_id": product.id, "product_name": product.name, "quantity": 1, "unit_price": 1}],
        "delivery": {"delivery_mode": "GPS_AND_DESCRIPTION", "delivery_city": "Ouagadougou", "delivery_address": "x",
                     "latitude": 5.36, "longitude": -4.0},
        "customer_name": "Test Gps", "customer_phone": "+22677200011",
    })
    assert far.status_code == 200, far.text
    d = far.json()["delivery"]
    assert d["location_status"] == "MISMATCH" and d["location_distance_km"] > 100
