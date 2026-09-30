"""Test de fumée sur l'API actuelle (remplace les vérifications encore valides de l'ancien test_e2e)."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.catalog import Product

client = TestClient(app, base_url="https://gotoshop.example")


def test_racine_en_bonne_sante():
    r = client.get("/")
    assert r.status_code == 200


def test_liste_publique_des_boutiques():
    r = client.get("/api/store/list/public")
    assert r.status_code == 200
    assert isinstance(r.json(), list) and len(r.json()) > 0


def test_catalogue_public_repond():
    r = client.get("/api/catalog/products")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_routes_admin_refusees_sans_jeton():
    with SessionLocal() as db:
        p = db.query(Product).first()
    assert client.delete(f"/api/catalog/products/{p.id}").status_code in (401, 403)
    assert client.put(f"/api/store/{p.store_id}", json={"owner_bio": "x"}).status_code in (401, 403)
