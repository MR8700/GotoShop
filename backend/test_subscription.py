import base64
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

# Dummy 1x1 png base64
TINY_PNG_B64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

def test_subscription_flow():
    # 1. Public Info
    res = client.get("/api/subscription/public-info")
    assert res.status_code == 200
    data = res.json()
    assert "plans" in data
    assert "ussd_configs" in data
    assert "plans_with_ussd" in data
    assert len(data["plans"]) >= 3

    # Check that for 1000F plan, Orange USSD is *144*2*1*65711741*1010# and Moov is *555*2*1*52045008*1010#
    starter_plan_info = next((p for p in data["plans_with_ussd"] if p["plan"]["code"] == "STARTER"), None)
    assert starter_plan_info is not None
    orange_opt = next((opt for opt in starter_plan_info["payment_options"] if opt["operator_code"] == "ORANGE"), None)
    moov_opt = next((opt for opt in starter_plan_info["payment_options"] if opt["operator_code"] == "MOOV"), None)
    assert orange_opt is not None
    assert "*144*2*1*65711741*1010#" in orange_opt["ussd_code"]
    assert moov_opt is not None
    assert "*555*2*1*52045008*1010#" in moov_opt["ussd_code"]

    # 2. Submit new store subscription request
    payload = {
        "request_type": "NEW_STORE",
        "store_name": "Kadi Mode Boutique",
        "owner_name": "Kadiatou Traoré",
        "owner_email": "kadi.mode@gotoshop.com",
        "owner_phone": "+22507080910",
        "plan_code": "STARTER",
        "operator_code": "ORANGE",
        "payment_proof_data": TINY_PNG_B64,
        "notes": "Paiement Orange Money de 1000F effectué ce matin"
    }
    submit_res = client.post("/api/subscription/submit", json=payload)
    assert submit_res.status_code == 200
    sub_data = submit_res.json()
    req_id = sub_data["id"]
    assert sub_data["status"] == "PENDING"
    assert "/media/proofs/" in sub_data["payment_proof_url"]

    # 3. Super Admin Login & Review
    admin_login = client.post("/api/super-admin/login", json={
        "email": "admin@conversastore.com",
        "password": "SuperAdmin2026!"
    })
    assert admin_login.status_code == 200
    token = admin_login.json()["session_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # List requests
    reqs_res = client.get("/api/subscription/requests", headers=headers)
    assert reqs_res.status_code == 200
    req_list = reqs_res.json()
    assert any(r["id"] == req_id for r in req_list)

    # Approve request
    review_res = client.post(f"/api/subscription/requests/{req_id}/review", json={
        "status": "APPROVED",
        "notes": "Reçu vérifié sur le compte Orange Money marchand."
    }, headers=headers)
    assert review_res.status_code == 200
    reviewed_data = review_res.json()
    assert reviewed_data["status"] == "APPROVED"
    assert reviewed_data["generated_password"] is not None
    assert reviewed_data["created_store_id"] is not None

    created_store_id = reviewed_data["created_store_id"]

    # Check store status
    status_res = client.get(f"/api/subscription/store/{created_store_id}/status")
    assert status_res.status_code == 200
    st_info = status_res.json()
    assert st_info["subscription_plan"] == "STARTER"
    assert st_info["is_active"] is True
    assert st_info["days_remaining"] >= 29

    # 4. Renewal flow for existing store
    renew_payload = {
        "request_type": "RENEWAL",
        "store_id": created_store_id,
        "store_name": "Kadi Mode Boutique",
        "owner_name": "Kadiatou Traoré",
        "owner_email": "kadi.mode@gotoshop.com",
        "owner_phone": "+22507080910",
        "plan_code": "PRO",
        "operator_code": "MOOV",
        "payment_proof_data": TINY_PNG_B64,
        "notes": "Renouvellement et passage au plan Pro"
    }
    renew_res = client.post("/api/subscription/submit", json=renew_payload)
    assert renew_res.status_code == 200
    renew_id = renew_res.json()["id"]

    # Admin approves renewal
    renew_approve = client.post(f"/api/subscription/requests/{renew_id}/review", json={
        "status": "APPROVED"
    }, headers=headers)
    assert renew_approve.status_code == 200

    # Verify store updated to PRO and extended
    status_res_after = client.get(f"/api/subscription/store/{created_store_id}/status")
    assert status_res_after.status_code == 200
    st_after = status_res_after.json()
    assert st_after["subscription_plan"] == "PRO"
    assert st_after["days_remaining"] >= 58
