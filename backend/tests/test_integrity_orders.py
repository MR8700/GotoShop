"""Non-régression des correctifs d'intégrité (voir AUDIT_GOTOSHOP.md)."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal, engine
from app.migrations import run_migrations
from app.models.catalog import Product
from app.models.customer import Customer
from app.models.store import DeliveryCity

run_migrations(engine)
db = SessionLocal()
client = TestClient(app, base_url="https://gotoshop.example")
# Boutique sans tarif de ville configuré : le test des frais bornés ne dépend pas des données de démonstration
product = (
    db.query(Product)
    .filter(Product.stock > 10)
    .filter(~Product.store_id.in_(db.query(DeliveryCity.store_id).filter(DeliveryCity.delivery_fee.isnot(None))))
    .first()
) or db.query(Product).filter(Product.stock > 10).first()
STORE = product.store_id


def _order(**over):
    payload = {
        "store_id": STORE,
        "items": [{"product_id": product.id, "product_name": product.name, "quantity": 1, "unit_price": 1}],
        "delivery": {"delivery_mode": "ADDRESS_DESCRIPTION", "delivery_city": "Ouagadougou", "delivery_address": "x"},
        "customer_name": "Test Intégrité", "customer_phone": "+22677000111", "register_account": True, "delivery_fee": 500,
    }
    payload.update(over)
    return client.post("/api/orders", json=payload)


def test_prix_client_ignore_et_frais_non_negatifs():
    r = _order(delivery_fee=-9999)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["subtotal_amount"] == int(round(product.price))
    # le tarif vient de la zone configurée par le commerçant, jamais du montant envoyé par le client
    assert d["delivery_fee"] >= 0 and d["total_amount"] >= d["subtotal_amount"]


def test_telephone_seul_ne_donne_pas_le_jeton_d_un_compte_existant():
    first = _order(customer_phone="+22677000222")
    assert first.status_code == 200
    victim_token = first.json().get("customer_token") or first.json().get("access_token")
    client.cookies.clear()  # attaquant = autre appareil : pas le cookie HttpOnly de la victime
    second = _order(customer_phone="+22677000222", customer_token=None)  # attaquant : connaît seulement le numéro
    assert second.status_code == 200
    d = second.json()
    assert victim_token not in (d.get("customer_token"), d.get("access_token"))
    assert "customer" not in d or d["customer"]["id"] != first.json()["customer"]["id"]


def test_stock_insuffisant_refuse():
    r = _order(items=[{"product_id": product.id, "product_name": product.name, "quantity": 10 ** 6}])
    assert r.status_code >= 400


def test_double_annulation_ne_regonfle_pas_le_stock():
    db.expire_all()
    start = db.query(Product).filter(Product.id == product.id).first().stock
    o = _order(customer_phone="+22677000333").json()
    db.expire_all()
    assert db.query(Product).filter(Product.id == product.id).first().stock == start - 1
    body = {"customer_id": (o.get("customer") or {}).get("id"), "customer_token": o.get("access_token") or o.get("customer_token")}
    for _ in range(2):
        r = client.post(f"/api/orders/{o['id']}/cancel", json=body)
        assert r.status_code == 200, r.text
        db.expire_all()
        assert db.query(Product).filter(Product.id == product.id).first().stock == start  # remis en stock UNE seule fois
