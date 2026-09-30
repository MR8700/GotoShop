"""Remises boutique par produit / catégorie, filtrées par public (audience)."""
import json

import pytest

from app.database import SessionLocal
from app.models.catalog import Category, Product
from app.models.store import Store, StoreDiscountRule
from app.services import discount_service as ds


@pytest.fixture()
def ctx():
    db = SessionLocal()
    store = db.query(Store).first()
    assert store, "base de test sans boutique"
    cats = db.query(Category).filter(Category.store_id == store.id).limit(2).all()
    prods = db.query(Product).filter(Product.store_id == store.id).all()
    created = []
    try:
        yield db, store, cats, prods, created
    finally:
        for r in created:
            db.query(StoreDiscountRule).filter(StoreDiscountRule.id == r.id).delete()
        db.commit()
        db.close()


def _rule(db, store, created, **kw):
    base = dict(name="t", percent=10, audience="ALL", scope="STORE", is_active=True, min_order_amount=0)
    base.update(kw)
    r = StoreDiscountRule(store_id=store.id, **base)
    db.add(r)
    db.commit()
    created.append(r)
    return r


def test_product_rule_only_on_matching_line(ctx):
    db, store, cats, prods, created = ctx
    a, b = prods[0], prods[1]
    _rule(db, store, created, percent=20, scope="PRODUCT", product_ids=json.dumps([a.id]))
    lines = [{"product_id": a.id, "category_id": a.category_id, "amount": 10000},
             {"product_id": b.id, "category_id": b.category_id, "amount": 5000}]
    res = ds.best_for(db, store.id, None, 15000, lines)
    assert res and res["amount"] == 2000 and res["scope"] == "PRODUCT" and res["eligible_amount"] == 10000


def test_category_rule(ctx):
    db, store, cats, prods, created = ctx
    p = next(x for x in prods if x.category_id)
    _rule(db, store, created, percent=10, scope="CATEGORY", category_ids=json.dumps([p.category_id]))
    lines = [{"product_id": p.id, "category_id": p.category_id, "amount": 8000}]
    res = ds.best_for(db, store.id, None, 8000, lines)
    assert res and res["amount"] == 800


def test_scoped_rule_needs_lines_and_match(ctx):
    db, store, cats, prods, created = ctx
    _rule(db, store, created, scope="PRODUCT", product_ids=json.dumps([prods[0].id]))
    assert ds.best_for(db, store.id, None, 10000) is None  # pas de lignes -> rien
    other = [{"product_id": prods[1].id, "category_id": prods[1].category_id, "amount": 10000}]
    assert ds.best_for(db, store.id, None, 10000, other) is None


def test_audience_filters_scoped_rule(ctx):
    db, store, cats, prods, created = ctx
    p = prods[0]
    _rule(db, store, created, percent=30, scope="PRODUCT", product_ids=json.dumps([p.id]), audience="CLIENTS")
    lines = [{"product_id": p.id, "category_id": p.category_id, "amount": 10000}]
    assert ds.best_for(db, store.id, None, 10000, lines) is None  # visiteur : exclu
    client = type("C", (), {"id": "x", "custom_discount_percent": 0})()  # client identifié
    res = ds.best_for(db, store.id, client, 10000, lines)
    assert res and res["amount"] == 3000


def test_strongest_amount_wins_not_strongest_percent(ctx):
    db, store, cats, prods, created = ctx
    p = prods[0]
    _rule(db, store, created, percent=50, scope="PRODUCT", product_ids=json.dumps([p.id]))   # 50 % de 1 000
    _rule(db, store, created, percent=10, scope="STORE")                                      # 10 % de 21 000
    lines = [{"product_id": p.id, "category_id": p.category_id, "amount": 1000},
             {"product_id": prods[1].id, "category_id": prods[1].category_id, "amount": 20000}]
    res = ds.best_for(db, store.id, None, 21000, lines)
    assert res["scope"] == "STORE" and res["amount"] == 2100


def test_validation(ctx):
    db, store, cats, prods, created = ctx
    base = {"name": "Promo", "percent": 10, "audience": "ALL"}
    with pytest.raises(ValueError):
        ds.validate_payload(db, store.id, {**base, "scope": "PRODUCT", "product_ids": []})
    with pytest.raises(ValueError):
        ds.validate_payload(db, store.id, {**base, "scope": "PRODUCT", "product_ids": ["inconnu"]})
    with pytest.raises(ValueError):
        ds.validate_payload(db, store.id, {**base, "scope": "CATEGORY", "category_ids": ["inconnue"]})
    with pytest.raises(ValueError):
        ds.validate_payload(db, store.id, {**base, "scope": "AUTRE"})
    ok = ds.validate_payload(db, store.id, {**base, "scope": "PRODUCT", "product_ids": [prods[0].id]})
    assert json.loads(ok["product_ids"]) == [prods[0].id] and ok["category_ids"] is None
    if cats:
        ok = ds.validate_payload(db, store.id, {**base, "scope": "CATEGORY", "category_ids": [cats[0].id]})
        assert ok["product_ids"] is None
    assert ds.validate_payload(db, store.id, base)["scope"] == "STORE"


def test_e2e_preview_and_order_with_product_rule():
    """Aperçu et commande réelle : la remise ne porte que sur le produit ciblé."""
    from fastapi.testclient import TestClient
    from app.main import app
    c = TestClient(app)
    db = SessionLocal()
    store = db.query(Store).filter(Store.slug == "garbadrome-kossodo").first()
    prods = db.query(Product).filter(Product.store_id == store.id, Product.stock > 50).limit(2).all()
    a, b = prods[0], prods[1]
    rule = StoreDiscountRule(store_id=store.id, name="e2e", percent=10, audience="ALL", scope="PRODUCT",
                             product_ids=json.dumps([a.id]), is_active=True, min_order_amount=0)
    db.add(rule)
    db.commit()
    try:
        pa, pb = int(a.price), int(b.price)
        r = c.post("/api/orders/shop-discount", json={
            "store_id": store.id, "order_amount": pa + pb,
            "items": [{"product_id": a.id, "amount": pa}, {"product_id": b.id, "amount": pb}]})
        j = r.json()
        assert r.status_code == 200 and j["applicable"] and j["amount"] == pa * 10 // 100 and j["scope"] == "PRODUCT"
        r = c.post("/api/orders/shop-discount", json={
            "store_id": store.id, "order_amount": pb, "items": [{"product_id": b.id, "amount": pb}]})
        assert r.json()["applicable"] is False

        payload = {
            "store_id": store.id,
            "items": [{"product_id": a.id, "product_name": a.name, "quantity": 1, "unit_price": pa},
                      {"product_id": b.id, "product_name": b.name, "quantity": 1, "unit_price": pb}],
            "delivery": {"delivery_mode": "GPS_AND_DESCRIPTION", "delivery_city": "Cité Universitaire Kossodo",
                         "delivery_address": "Test"},
            "customer_name": "Test Remise", "customer_phone": "+22670999888",
            "customer_token": "tok_scoped_discount_e2e", "delivery_fee": 500,
        }
        r = c.post("/api/orders", json=payload)
        assert r.status_code == 200, r.text
        o = r.json()
        assert o["discount_amount"] == pa * 10 // 100
        assert o["total_amount"] == o["subtotal_amount"] - o["discount_amount"] + (o.get("delivery_fee") or 500)
    finally:
        db.query(StoreDiscountRule).filter(StoreDiscountRule.id == rule.id).delete()
        db.commit()
        db.close()
