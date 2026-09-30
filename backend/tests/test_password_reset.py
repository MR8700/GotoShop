from app.config import settings


def test_login_otp_off_by_default_in_config_source():
    import inspect, app.config as c
    assert 'getenv("REQUIRE_LOGIN_OTP", "false")' in inspect.getsource(c)


def test_reset_otp_flow(monkeypatch):
    from app.database import SessionLocal
    from app.models.store import Owner
    from app.core.security import hash_password
    from app.services import password_reset_service as prs
    sent = {}
    monkeypatch.setattr(prs, "send_whatsapp", lambda to, m: (sent.update(to=to, m=m) or (True, "ok")))
    db = SessionLocal()
    h, s = hash_password("Ancien#Pass2026x")
    o = Owner(full_name="T", email="reset@test.bf", phone_number="+22670112233", password_hash=h, password_salt=s)
    db.add(o); db.commit()
    assert prs.PasswordResetService.request(db, "inconnu@x.bf")["message"] == prs.GENERIC_MSG
    assert prs.PasswordResetService.request(db, "reset@test.bf")["message"] == prs.GENERIC_MSG
    code = sent["m"].split("est ")[1][:6]
    import pytest
    with pytest.raises(ValueError):
        prs.PasswordResetService.confirm(db, "reset@test.bf", "000000", "Nouveau#Mdp2model7", "Nouveau#Mdp2model7")
    prs.PasswordResetService.confirm(db, "reset@test.bf", code, "Nouveau#Mdp2model7", "Nouveau#Mdp2model7")
    with pytest.raises(ValueError):  # usage unique
        prs.PasswordResetService.confirm(db, "reset@test.bf", code, "Autre#Mdp3model9", "Autre#Mdp3model9")
    db.close()
