"""Frais de livraison décidés par le serveur + OTP à la connexion par téléphone (AUDIT §4 bis)."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from fastapi.testclient import TestClient
from app.main import app
from app.config import settings
from app.database import SessionLocal, engine
from app.migrations import run_migrations
from app.models.catalog import Product
from app.models.store import DeliveryCity

run_migrations(engine)
db = SessionLocal()
client = TestClient(app, base_url="https://gotoshop.example")
product = db.query(Product).filter(Product.stock > 10).first()
STORE = product.store_id


def _order(city, fee, phone):
    return client.post("/api/orders", json={
        "store_id": STORE,
        "items": [{"product_id": product.id, "product_name": product.name, "quantity": 1, "unit_price": 1}],
        "delivery": {"delivery_mode": "ADDRESS_DESCRIPTION", "delivery_city": city, "delivery_address": "x"},
        "customer_name": "Test Frais", "customer_phone": phone, "delivery_fee": fee,
    })


def test_tarif_configure_impose_au_client():
    db.add(DeliveryCity(store_id=STORE, name="Zone Tarifée Test", display_label="Zone Tarifée Test", delivery_fee=1500))
    db.commit()
    r = _order("Zone Tarifée Test", 0, "+22677100001")
    assert r.status_code == 200, r.text
    assert r.json()["delivery_fee"] == 1500


def test_frais_client_plafonne_si_ville_sans_tarif():
    r = _order("Ville Inconnue", 999999, "+22677100002")
    assert r.status_code == 200, r.text
    assert r.json()["delivery_fee"] == settings.MAX_UNCONFIGURED_DELIVERY_FEE


def test_login_exige_otp_quand_active(monkeypatch):
    monkeypatch.setattr(settings, "REQUIRE_LOGIN_OTP", True)
    phone = "+22677100003"
    r = client.post("/api/customer/quick-login", json={"phone": phone, "store_id": STORE})
    assert r.status_code == 400
    r = client.post("/api/customer/quick-login", json={"phone": phone, "store_id": STORE, "otp_code": "123456"})
    assert r.status_code == 400
    req = client.post("/api/customer/login/otp/request", json={"phone": phone, "store_id": STORE})
    assert req.status_code == 200, req.text
    code = req.json().get("simulated_code")
    assert code, "le simulateur doit exposer le code en local"
    ok = client.post("/api/customer/quick-login", json={"phone": phone, "store_id": STORE, "otp_code": code})
    assert ok.status_code == 200, ok.text
    assert ok.json()["access_token"]
    replay = client.post("/api/customer/quick-login", json={"phone": phone, "store_id": STORE, "otp_code": code})
    assert replay.status_code == 400  # code à usage unique


def test_login_sans_otp_reste_possible_par_defaut(monkeypatch):
    monkeypatch.setattr(settings, "REQUIRE_LOGIN_OTP", False)
    r = client.post("/api/customer/quick-login", json={"phone": "+22677100004", "store_id": STORE})
    assert r.status_code == 200, r.text
