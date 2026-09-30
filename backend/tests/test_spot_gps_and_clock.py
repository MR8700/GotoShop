"""F5 : vérification GPS non bloquante d'un lieu de retrait. F3 : horloge UTC naïve sans avertissement."""
import os
import sys
import warnings
from datetime import datetime

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.store import Store, Owner, DeliveryCity
from app.core.security import hash_session_token
from app.core.clock import utcnow

client = TestClient(app, base_url="https://gotoshop.example")


def _owner_store():
    with SessionLocal() as db:
        store = db.query(Store).filter(Store.owner_id.isnot(None)).first()
        owner = db.query(Owner).filter(Owner.id == store.owner_id).first()
        raw = "test-owner-token-" + os.urandom(6).hex()
        owner.session_token = hash_session_token(raw)
        # zone de référence : Ouagadougou
        for c in db.query(DeliveryCity).filter(DeliveryCity.store_id == store.id).all():
            db.delete(c)
        db.add(DeliveryCity(store_id=store.id, name="Ouagadougou", display_label="Ouagadougou", is_default=True,
                            latitude=12.3714, longitude=-1.5197, radius_km=30))
        db.commit()
        return store.id, {"Authorization": f"Bearer {raw}"}


def _payload(**kw):
    base = {"kind": "PICKUP", "name": "Boutique GPS test", "city": "Ouagadougou", "address": "Centre"}
    base.update(kw)
    return base


def test_lieu_dans_la_zone_sans_alerte():
    sid, h = _owner_store()
    r = client.post(f"/api/store/{sid}/delivery-spots", json=_payload(latitude=12.37, longitude=-1.52), headers=h)
    assert r.status_code == 200, r.text
    assert r.json()["gps_check"]["status"] == "OK" and not r.json()["gps_check"]["message"]


def test_lieu_hors_zone_alerte_non_bloquante():
    sid, h = _owner_store()
    # Abidjan alors que la zone choisie est Ouagadougou : enregistré quand même, avec une alerte
    r = client.post(f"/api/store/{sid}/delivery-spots", json=_payload(latitude=5.35, longitude=-4.02), headers=h)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["gps_check"]["status"] in ("MISMATCH", "OUT_OF_ZONE")
    assert "ce lieu" in body["gps_check"]["message"] and "Votre position" not in body["gps_check"]["message"]
    assert body["latitude"] == 5.35 and body["longitude"] == -4.02


def test_lieu_sans_gps_reste_valide():
    sid, h = _owner_store()
    r = client.post(f"/api/store/{sid}/delivery-spots", json=_payload(), headers=h)
    assert r.status_code == 200 and r.json()["gps_check"]["status"] == "NO_GPS"


def test_latitude_sans_longitude_refusee():
    sid, h = _owner_store()
    r = client.post(f"/api/store/{sid}/delivery-spots", json=_payload(latitude=12.3), headers=h)
    assert r.status_code == 400 and "longitude" in r.json()["detail"].lower()


def test_horloge_utc_naive_identique_a_utcnow():
    with warnings.catch_warnings():
        warnings.simplefilter("error")  # aucun DeprecationWarning toléré
        now = utcnow()
    assert now.tzinfo is None  # comparable aux dates naïves stockées en base
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        legacy = datetime.utcnow()
    assert abs((legacy - now).total_seconds()) < 2
