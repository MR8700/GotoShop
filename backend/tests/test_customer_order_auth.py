"""Customer checkout authentication and order creation test."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal, engine
from app.migrations import run_migrations
from app.models.store import Store
from app.models.customer import Customer
from app.models.catalog import Product

run_migrations(engine)
db = SessionLocal()
store = db.query(Store).first()
assert store is not None, "A store must exist for testing"
product = db.query(Product).filter(Product.store_id == store.id).first()
if not product:
    product = db.query(Product).first()

client = TestClient(app, base_url="https://gotoshop.example")


def test_customer_quick_register_and_login():
    test_phone = "+22670999888"
    test_name = "Oumar Savadogo"

    # Clean existing test customer if any
    existing = db.query(Customer).filter(Customer.phone == test_phone).first()
    if existing:
        db.delete(existing)
        db.commit()

    # 1. Quick register
    reg_resp = client.post(
        "/api/customer/quick-register",
        json={
          "name": test_name,
          "phone": test_phone,
          "city": "Ouagadougou (Kossodo)",
          "store_id": store.id,
        },
    )
    assert reg_resp.status_code == 200, reg_resp.text
    data = reg_resp.json()
    assert "access_token" in data
    assert data["customer"]["name"] == test_name
    token = data["access_token"]

    # 2. Get profile with token
    me_resp = client.get("/api/customer/me", headers={"Authorization": f"Bearer {token}"})
    assert me_resp.status_code == 200
    assert me_resp.json()["name"] == test_name


def test_order_creation_with_customer():
    test_phone = "+22670112233"
    test_name = "Fanta Ouedraogo"

    existing = db.query(Customer).filter(Customer.phone == test_phone).first()
    if existing:
        db.delete(existing)
        db.commit()

    order_payload = {
        "store_id": store.id,
        "items": [
            {
                "product_id": product.id if product else None,
                "product_name": product.name if product else "Robe Faso Danfani",
                "quantity": 2,
                "unit_price": 15000,
                "unit": "PIECE",
                "unit_label": "pièce",
            }
        ],
        "delivery": {
            "delivery_mode": "ADDRESS_DESCRIPTION",
            "delivery_city": "Ouagadougou",
            "delivery_address": "Kossodo, secteur 22",
        },
        "customer_name": test_name,
        "customer_phone": test_phone,
        "register_account": True,
        "delivery_fee": 500,
    }

    res = client.post("/api/orders", json=order_payload)
    assert res.status_code == 200, res.text
    order_data = res.json()
    assert "order_number" in order_data
    assert order_data["customer_name"] == test_name
    assert order_data["subtotal_amount"] == 30000
    assert order_data["total_amount"] in [30500, 29000]  # with or without tier loyalty discount
    assert "customer" in order_data
    assert order_data["customer"]["name"] == test_name
