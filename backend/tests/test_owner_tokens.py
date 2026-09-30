"""Jetons commerçant / super-admin hachés en base ; jeton de démo prévisible refusé (AUDIT §4 bis)."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from fastapi.testclient import TestClient
from app.main import app
from app.config import settings
from app.database import SessionLocal, engine
from app.migrations import run_migrations
from app.models.store import Owner, Store
from app.core.security import hash_session_token, hash_password
from app.services.auth_service import AuthService

run_migrations(engine)
db = SessionLocal()
client = TestClient(app, base_url="https://gotoshop.example")


def test_hash_idempotent_et_non_reversible():
    h = hash_session_token("abc")
    assert h.startswith("h1$") and "abc" not in h
    assert hash_session_token(h) == h


def test_jeton_owner_stocke_hache_et_jeton_brut_valide():
    owner = db.query(Owner).first()
    h, salt = hash_password("Test#Passw0rd!x")
    owner.password_hash, owner.password_salt = h, salt
    owner.failed_login_attempts, owner.locked_until = 0, None
    db.commit()
    from types import SimpleNamespace
    _, raw = AuthService.authenticate(db, SimpleNamespace(identifier=owner.email, password="Test#Passw0rd!x"))
    db.expire_all()
    stored = db.query(Owner).filter(Owner.id == owner.id).first().session_token
    assert stored != raw and stored == hash_session_token(raw)
    assert AuthService.get_owner_by_token(db, raw).id == owner.id
    assert AuthService.get_owner_by_token(db, stored) is None  # l'empreinte ne sert pas de jeton


def test_migration_hache_les_jetons_en_clair():
    owner = db.query(Owner).first()
    owner.session_token = "legacy-plain-token"
    db.commit()
    run_migrations(engine)
    db.expire_all()
    assert db.query(Owner).filter(Owner.id == owner.id).first().session_token == hash_session_token("legacy-plain-token")
    assert AuthService.get_owner_by_token(db, "legacy-plain-token").id == owner.id  # session existante toujours valable


def test_jeton_demo_previsible_refuse_par_defaut(monkeypatch):
    monkeypatch.setattr(settings, "ALLOW_DEMO_ACCESS", False)
    store = db.query(Store).first()
    assert AuthService.get_owner_by_token(db, f"demo_owner_token_{store.slug}") is None
    assert AuthService.get_owner_by_token(db, "demo_owner_token_nimportequoi") is None


def test_token_absent_ne_correspond_pas_aux_comptes_deconnectes():
    from app.core.security import lookup_hash
    owner = db.query(Owner).first()
    owner.session_token = None  # déconnecté
    db.commit()
    assert AuthService.get_owner_by_token(db, "") is None
    assert AuthService.get_owner_by_token(db, None) is None
    assert db.query(Owner).filter(Owner.session_token == lookup_hash(None)).first() is None
