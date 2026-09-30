"""Loyalty card anti-forgery test."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.core.security import hash_session_token
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal, engine
from app.migrations import run_migrations
from app.models.customer import Customer
from app.models.store import Store
from app.services import card_service

def test_loyalty_card_flow():
    run_migrations(engine)
    db = SessionLocal()
    store = db.query(Store).first()
    if not store:
        store = Store(name="Boutique Test", slug="boutique-test")
        db.add(store); db.commit()
    cust = db.query(Customer).filter(Customer.store_id == store.id).first()
    if not cust:
        cust = Customer(store_id=store.id, name="Awa Koné", phone="+22670000001", session_token=hash_session_token("tok-test-card"))
        db.add(cust); db.commit()
    cust.session_token = hash_session_token("tok-test-card"); db.commit()
    tok = "tok-test-card"

    c = TestClient(app, base_url="https://gotoshop.example")
    r = c.get("/api/customer/loyalty-card", headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 200, r.text
    card = r.json()
    no, code = card["card_number"], card["security_code"]
    assert card_service.luhn_valid(no) and len(no) == 16 and no.startswith("7")
    assert card["verify_url"] == f"https://gotoshop.example/verify/{no}/{code}", card["verify_url"]
    # stable: same number the second time
    assert c.get("/api/customer/loyalty-card", headers={"Authorization": f"Bearer {tok}"}).json()["card_number"] == no

    ok = c.get(f"/api/loyalty/verify/{no}/{code}").json()
    assert ok["valid"] is True and ok["status"] == "ACTIVE", ok
    assert "phone" not in str(ok).lower() and ok["holder"].split()[0] == cust.name.split()[0]

    # Forgeries must all fail
    forged_code = code[:-1] + ("A" if code[-1] != "A" else "B")
    other_no = no[:-2] + ("00" if no[-2:] != "00" else "11")
    for label, n, k in [("edited code", no, forged_code), ("edited number", other_no, code),
                        ("random code", no, "A" * 16), ("short code", no, code[:8]), ("letters in number", "abcd", code)]:
        assert c.get(f"/api/loyalty/verify/{n}/{k}").json()["valid"] is False, label
    # lower-case / dashes are tolerated (typing by hand)
    assert c.get(f"/api/loyalty/verify/{card['card_number_formatted'].replace(' ', '')}/{card['security_code_formatted'].lower()}").json()["valid"] is True

    # Suspended client is flagged
    cust.is_blocked = True; db.commit()
    assert c.get(f"/api/loyalty/verify/{no}/{code}").json()["status"] == "SUSPENDED"
    cust.is_blocked = False; db.commit()

    # Merchant endpoint requires a token
    assert c.get(f"/api/customer/merchant/clients/{cust.id}/loyalty-card").status_code == 401
    db.close()
