"""Passkeys (WebAuthn) + codes de récupération : un authentificateur logiciel signe de vraies preuves ES256."""
import hashlib
import json
import os
import struct
import sys
import uuid

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import cbor2
from app.core.security import hash_session_token
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi.testclient import TestClient
from webauthn.helpers import base64url_to_bytes, bytes_to_base64url

from app.config import settings
from app.core.clock import utcnow
from app.database import SessionLocal
from app.main import app
from app.models.customer import Customer
from app.models.passkey import AuthChallenge, PasskeyCredential, RecoveryCode
from app.models.store import Store
from app.services.passkey_service import _origins, _rp_id

client = TestClient(app, base_url="https://gotoshop.example")
b64 = bytes_to_base64url


class SoftAuthenticator:
    """Authentificateur logiciel : génère une vraie paire ES256 ; la clé privée ne quitte jamais ce test."""

    def __init__(self):
        self.key = ec.generate_private_key(ec.SECP256R1())
        self.cred_id = os.urandom(32)
        self.counter = 0

    def _client_data(self, typ, challenge_b64, origin=None):
        return json.dumps({"type": typ, "challenge": challenge_b64, "origin": origin or _origins()[0]}).encode()

    def register(self, options, origin=None):
        pub = self.key.public_key().public_numbers()
        cose = {1: 2, 3: -7, -1: 1, -2: pub.x.to_bytes(32, "big"), -3: pub.y.to_bytes(32, "big")}
        auth = (hashlib.sha256(_rp_id().encode()).digest() + bytes([0x45]) + struct.pack(">I", 0)
                + b"\x00" * 16 + struct.pack(">H", len(self.cred_id)) + self.cred_id + cbor2.dumps(cose))
        att = cbor2.dumps({"fmt": "none", "attStmt": {}, "authData": auth})
        cd = self._client_data("webauthn.create", options["challenge"], origin)
        return {"id": b64(self.cred_id), "rawId": b64(self.cred_id), "type": "public-key",
                "response": {"clientDataJSON": b64(cd), "attestationObject": b64(att), "transports": ["internal"]}}

    def assertion(self, options, origin=None, counter=None, user_id=None):
        self.counter = counter if counter is not None else self.counter + 1
        auth = hashlib.sha256(_rp_id().encode()).digest() + bytes([0x05]) + struct.pack(">I", self.counter)
        cd = self._client_data("webauthn.get", options["challenge"], origin)
        sig = self.key.sign(auth + hashlib.sha256(cd).digest(), ec.ECDSA(hashes.SHA256()))
        return {"id": b64(self.cred_id), "rawId": b64(self.cred_id), "type": "public-key",
                "response": {"clientDataJSON": b64(cd), "authenticatorData": b64(auth), "signature": b64(sig),
                             "userHandle": b64(user_id) if user_id else None}}


def _customer():
    client.cookies.clear()  # chaque scénario = un nouvel appareil sans cookie de session
    with SessionLocal() as db:
        store = db.query(Store).first()
        token = "cust-" + uuid.uuid4().hex
        c = Customer(store_id=store.id, name="Test Passkey", phone="+2267" + str(uuid.uuid4().int)[:7], session_token=hash_session_token(token))
        db.add(c)
        db.commit()
        return c.id, c.phone, store.id, {"Authorization": f"Bearer {token}"}


def _enroll(auth, headers):
    r = client.post("/api/auth/passkeys/register/options", headers=headers)
    assert r.status_code == 200, r.text
    opt = r.json()
    body = {"challenge_id": opt["challenge_id"], "credential": auth.register(opt["options"]), "friendly_name": "Mon téléphone"}
    return client.post("/api/auth/passkeys/register/verify", json=body, headers=headers)


def _login(auth, **kw):
    opt = client.post("/api/auth/passkeys/login/options").json()
    return client.post("/api/auth/passkeys/login/verify",
                       json={"challenge_id": opt["challenge_id"], "credential": auth.assertion(opt["options"], **kw)})


def test_enrolement_puis_connexion_sans_mot_de_passe():
    cid, phone, sid, h = _customer()
    auth = SoftAuthenticator()
    r = _enroll(auth, h)
    assert r.status_code == 200, r.text
    data = r.json()
    assert len(data["recovery_codes"]) == 10 and len(set(data["recovery_codes"])) == 10
    # la base ne contient que des hash, jamais les codes en clair
    with SessionLocal() as db:
        hashes_ = [x.code_hash for x in db.query(RecoveryCode).filter(RecoveryCode.customer_id == cid).all()]
        assert len(hashes_) == 10 and not any(c in hashes_ for c in data["recovery_codes"])
        assert db.query(Customer).filter(Customer.id == cid).first().phone_verified in (False, None)  # jamais auto-vérifié
    r = _login(auth)
    assert r.status_code == 200, r.text
    tok = r.json()["access_token"]
    assert client.get("/api/auth/passkeys", headers={"Authorization": f"Bearer {tok}"}).json()["passkeys"][0]["last_used_at"]


def test_defi_a_usage_unique_et_mauvaise_origine_refusee():
    cid, phone, sid, h = _customer()
    auth = SoftAuthenticator()
    _enroll(auth, h)
    opt = client.post("/api/auth/passkeys/login/options").json()
    proof = auth.assertion(opt["options"])
    ok = client.post("/api/auth/passkeys/login/verify", json={"challenge_id": opt["challenge_id"], "credential": proof})
    assert ok.status_code == 200
    replay = client.post("/api/auth/passkeys/login/verify", json={"challenge_id": opt["challenge_id"], "credential": proof})
    assert replay.status_code == 401  # rejeu : défi déjà consommé
    assert _login(auth, origin="https://evil.example").status_code == 401  # mauvaise origine
    with SessionLocal() as db:  # défi expiré
        opt2 = client.post("/api/auth/passkeys/login/options").json()
        db.query(AuthChallenge).filter(AuthChallenge.id == opt2["challenge_id"]).update({"expires_at": utcnow()})
        db.commit()
    r = client.post("/api/auth/passkeys/login/verify", json={"challenge_id": opt2["challenge_id"], "credential": auth.assertion(opt2["options"])})
    assert r.status_code == 401


def test_signature_falsifiee_et_compteur_regressif_refuses():
    cid, phone, sid, h = _customer()
    auth = SoftAuthenticator()
    _enroll(auth, h)
    assert _login(auth, counter=5).status_code == 200
    assert _login(auth, counter=3).status_code == 401  # signCount qui recule = clone possible
    intruder = SoftAuthenticator()
    intruder.cred_id = auth.cred_id  # même credential_id, autre clé privée : la preuve cryptographique échoue
    assert _login(intruder, counter=9).status_code == 401


def test_revocation_passkey_et_garde_derniere_passkey():
    cid, phone, sid, h = _customer()
    a1, a2 = SoftAuthenticator(), SoftAuthenticator()
    _enroll(a1, h)
    _enroll(a2, h)
    pk = client.get("/api/auth/passkeys", headers=h).json()["passkeys"]
    assert len(pk) == 2
    assert client.patch(f"/api/auth/passkeys/{pk[0]['id']}", json={"friendly_name": "Tablette"}, headers=h).json()["friendly_name"] == "Tablette"
    assert client.delete(f"/api/auth/passkeys/{pk[0]['id']}", headers=h).status_code == 200
    assert _login(a1).status_code == 401  # révoquée
    r = _login(a2)
    assert r.status_code == 200
    h = {"Authorization": f"Bearer {r.json()['access_token']}"}  # la connexion ouvre une nouvelle session (session unique)
    # une seule Passkey restante ET codes de récupération disponibles -> révocation permise
    client.post("/api/auth/recovery-codes/revoke", headers=h)
    assert client.delete(f"/api/auth/passkeys/{pk[1]['id']}", headers=h).status_code == 409  # plus aucun moyen de rentrer


def test_recuperation_par_code_usage_unique_puis_nouvelle_passkey():
    cid, phone, sid, h = _customer()
    old = SoftAuthenticator()
    codes = _enroll(old, h).json()["recovery_codes"]
    body = {"phone": phone, "code": codes[0].lower(), "store_id": sid}  # insensible à la casse
    r = client.post("/api/auth/recovery-codes/use", json=body)
    assert r.status_code == 200, r.text
    rt = {"X-Recovery-Token": r.json()["recovery_token"]}
    assert client.post("/api/auth/recovery-codes/use", json=body).status_code == 401  # code déjà consommé
    # le jeton de récupération ne donne accès à rien d'autre
    assert client.get("/api/auth/passkeys", headers=rt).status_code == 401
    new = SoftAuthenticator()
    r = _enroll(new, rt)
    assert r.status_code == 200 and r.json()["access_token"]
    assert client.post("/api/auth/passkeys/register/options", headers=rt).status_code == 401  # jeton consommé
    assert _login(new).status_code == 200


def test_regeneration_invalide_les_anciens_codes():
    cid, phone, sid, h = _customer()
    old_codes = _enroll(SoftAuthenticator(), h).json()["recovery_codes"]
    new_codes = client.post("/api/auth/recovery-codes/generate", headers=h).json()["codes"]
    assert not set(old_codes) & set(new_codes)
    assert client.post("/api/auth/recovery-codes/use", json={"phone": phone, "code": old_codes[0], "store_id": sid}).status_code == 401
    assert client.post("/api/auth/recovery-codes/use", json={"phone": phone, "code": new_codes[0], "store_id": sid}).status_code == 200


def test_anti_bruteforce_recuperation_par_numero():
    cid, phone, sid, h = _customer()
    _enroll(SoftAuthenticator(), h)
    from app.core.ratelimit import reset_rate_limits
    codes = []
    for i in range(10):
        reset_rate_limits()  # on isole la limite par numéro de la limite par IP
        codes.append(client.post("/api/auth/recovery-codes/use", json={"phone": phone, "code": f"ZZZZ-{i:04d}", "store_id": sid}))
    assert codes[0].status_code == 401 and codes[-1].status_code == 401
    assert "Trop de tentatives" in codes[-1].json()["detail"]


def test_revocation_des_sessions_et_journal():
    cid, phone, sid, h = _customer()
    _enroll(SoftAuthenticator(), h)
    ev = client.get("/api/auth/security/events", headers=h).json()["events"]
    assert any(e["event_type"] == "passkey_registered" for e in ev)
    assert client.post("/api/auth/sessions/revoke-all", headers=h).status_code == 200
    assert client.get("/api/auth/passkeys", headers=h).status_code == 401


def test_mot_de_passe_desactivable_pour_les_commercants(monkeypatch):
    monkeypatch.setattr(settings, "PASSWORD_AUTH_ENABLED", False)
    assert client.post("/api/auth/login", json={"identifier": "x", "password": "y"}).status_code == 403


def test_mot_de_passe_temporaire_aleatoire_hors_dev(monkeypatch):
    from app.services.auth_service import AuthService, DEFAULT_ADMIN_TEMP_PASSWORD
    from app.core.security import validate_strong_password, verify_password
    from app.models.store import Owner
    monkeypatch.setattr(settings, "APP_ENV", "production")
    with SessionLocal() as db:
        owner = db.query(Owner).first()
        saved = (owner.password_hash, owner.password_salt, owner.must_change_password)
        t1 = AuthService.reset_to_default_credentials(db, owner)
        t2 = AuthService.reset_to_default_credentials(db, owner)
        assert t1 != t2 and t1 != DEFAULT_ADMIN_TEMP_PASSWORD and validate_strong_password(t1)[0]
        assert not verify_password(DEFAULT_ADMIN_TEMP_PASSWORD, owner.password_hash, owner.password_salt)
        owner.password_hash, owner.password_salt, owner.must_change_password = saved
        db.commit()
