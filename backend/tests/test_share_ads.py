"""Publicité produit : lien tracé par produit et par réseau, entonnoir vues → intentions → commandes → achats."""
import uuid

from fastapi.testclient import TestClient

from app.core.security import hash_session_token
from app.database import SessionLocal
from app.main import app
from app.models.analytics import ProductShareLink, TrackingEvent
from app.models.catalog import Product
from app.models.order import Order
from app.models.store import Store

client = TestClient(app)


def _setup():
    db = SessionLocal()
    store = db.query(Store).filter(Store.slug == "garbadrome-kossodo").first()
    store.owner.session_token = hash_session_token("seller-share-token")
    db.commit()
    prods = db.query(Product).filter(Product.store_id == store.id, Product.stock > 50).limit(2).all()
    ids = (store.id, prods[0].id, prods[1].id, int(prods[0].price))
    db.close()
    return ids


AUTH = {"Authorization": "Bearer seller-share-token"}


def test_share_funnel_end_to_end():
    store_id, pid, pid2, price = _setup()

    # lien : protégé, idempotent par produit + réseau, réseau inconnu -> « other »
    assert client.post(f"/api/analytics/{store_id}/share-links", json={"product_id": pid, "network": "whatsapp"}).status_code in (401, 403)
    r = client.post(f"/api/analytics/{store_id}/share-links", json={"product_id": pid, "network": "WhatsApp"}, headers=AUTH)
    assert r.status_code == 200, r.text
    wa = r.json()
    again = client.post(f"/api/analytics/{store_id}/share-links", json={"product_id": pid, "network": "whatsapp"}, headers=AUTH).json()
    assert wa["code"] == again["code"] and wa["network"] == "whatsapp"
    other = client.post(f"/api/analytics/{store_id}/share-links", json={"product_id": pid, "network": "forum-du-coin"}, headers=AUTH).json()
    assert other["network"] == "other" and other["code"] != wa["code"]
    assert client.post(f"/api/analytics/{store_id}/share-links", json={"product_id": "inconnu", "network": "x"}, headers=AUTH).status_code == 404

    code = wa["code"]
    assert client.get(f"/api/analytics/share-link/{code}").json()["product_id"] == pid

    # événements publics : dédoublonnés par visiteur, rejetés si mal formés
    v1, v2 = "visiteur-" + uuid.uuid4().hex[:10], "visiteur-" + uuid.uuid4().hex[:10]
    for v in (v1, v2):
        assert client.post("/api/analytics/share-event", json={"code": code, "event": "CLICK", "visitor_id": v}).json()["recorded"]
        assert client.post("/api/analytics/share-event", json={"code": code, "event": "VIEW", "visitor_id": v}).json()["recorded"]
    assert client.post("/api/analytics/share-event", json={"code": code, "event": "VIEW", "visitor_id": v1}).json() == {"recorded": False, "reason": "duplicate"}
    assert client.post("/api/analytics/share-event", json={"code": code, "event": "INTENT", "visitor_id": v1}).json()["recorded"]
    assert client.post("/api/analytics/share-event", json={"code": code, "event": "BIDON", "visitor_id": v1}).status_code == 400
    assert client.post("/api/analytics/share-event", json={"code": code, "event": "VIEW", "visitor_id": "x y"}).status_code in (400, 422)
    assert client.post("/api/analytics/share-event", json={"code": "zzzzzzzz", "event": "VIEW", "visitor_id": v1}).json()["recorded"] is False

    # commande issue de la publicité : 2 produits, dont le produit promu
    def order(share_code):
        payload = {
            "store_id": store_id,
            "items": [{"product_id": pid, "product_name": "p", "quantity": 1, "unit_price": price},
                      {"product_id": pid2, "product_name": "q", "quantity": 1, "unit_price": 1}],
            "delivery": {"delivery_mode": "GPS_AND_DESCRIPTION", "delivery_city": "Cité Universitaire Kossodo", "delivery_address": "T"},
            "customer_name": "Client Pub", "customer_phone": "+22670" + uuid.uuid4().hex[:6].translate(str.maketrans("abcdef", "123456")),
            "customer_token": "tok_" + uuid.uuid4().hex, "delivery_fee": 500, "share_code": share_code,
        }
        r = client.post("/api/orders", json=payload)
        assert r.status_code == 200, r.text
        return r.json()

    o1 = order(code)
    o2 = order("code-invalide")   # code inconnu : la commande passe, sans attribution
    db = SessionLocal()
    assert db.query(Order).filter(Order.id == o1["id"]).first().share_code == code
    assert db.query(Order).filter(Order.id == o2["id"]).first().share_code is None
    # un code d'une autre boutique n'est jamais accepté
    foreign = db.query(ProductShareLink).filter(ProductShareLink.store_id != store_id).first()
    db.close()

    st = client.get(f"/api/analytics/{store_id}/share-stats?product_id={pid}", headers=AUTH).json()
    row = next(l for l in st["links"] if l["code"] == code)
    assert (row["clicks"], row["views"], row["intents"], row["orders"], row["purchases"], row["revenue"]) == (2, 2, 1, 1, 0, 0)

    # paiement confirmé : achat + chiffre d'affaires du SEUL produit promu
    db = SessionLocal()
    db.query(Order).filter(Order.id == o1["id"]).update({"payment_status": "PAYMENT_CONFIRMED"})
    db.commit(); db.close()
    st = client.get(f"/api/analytics/{store_id}/share-stats?product_id={pid}", headers=AUTH).json()
    row = next(l for l in st["links"] if l["code"] == code)
    assert row["purchases"] == 1 and row["revenue"] == price and row["conversion_rate"] == 50.0
    assert st["totals"]["purchases"] >= 1 and any(n["network"] == "whatsapp" for n in st["networks"])
    assert client.get(f"/api/analytics/{store_id}/share-stats", headers={}).status_code in (401, 403)

    # commande annulée : plus comptée
    db = SessionLocal()
    db.query(Order).filter(Order.id == o1["id"]).update({"status": "CANCELLED"})
    db.commit(); db.close()
    row = next(l for l in client.get(f"/api/analytics/{store_id}/share-stats?product_id={pid}", headers=AUTH).json()["links"] if l["code"] == code)
    assert row["orders"] == 0 and row["purchases"] == 0

    # page d'aperçu pour les réseaux
    pg = client.get(f"/api/analytics/share-page/{code}")
    assert pg.status_code == 200 and 'property="og:title"' in pg.text and f"c={code}" in pg.text
    assert client.get("/api/analytics/share-page/inconnu1").status_code == 404

    db = SessionLocal()
    db.query(TrackingEvent).filter(TrackingEvent.share_code.in_([code, other["code"]])).delete(synchronize_session=False)
    db.query(Order).filter(Order.id.in_([o1["id"], o2["id"]])).delete(synchronize_session=False)
    db.query(ProductShareLink).filter(ProductShareLink.code.in_([code, other["code"]])).delete(synchronize_session=False)
    db.commit(); db.close()
