from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_all_api_endpoints():
    print("=== RUNNING AUTOMATED BACKEND INTEGRITY TESTS ===")
    
    # 1. Health
    r = client.get("/health")
    assert r.status_code == 200, f"Healthcheck failed: {r.text}"
    print("[PASS] Healthcheck OK:", r.json())

    # 2. Store
    r = client.get("/api/store")
    assert r.status_code == 200, f"Store get failed: {r.text}"
    store = r.json()
    assert store["name"] == "Awa Chic & Tech"
    assert len(store["trust_badges"]) == 3
    assert len(store["delivery_cities"]) == 3
    print(f"[PASS] Store verification OK: {store['name']} | Rating: {store['rating']}/5 | Sales: {store['sales_count']}")

    # 3. Catalog & Categories
    r = client.get("/api/catalog/categories")
    assert r.status_code == 200
    cats = r.json()
    assert len(cats) >= 5
    print(f"[PASS] Categories OK: {len(cats)} categories found ({[c['name'] for c in cats]})")

    # 4. Products & Hero Deal
    r = client.get("/api/catalog/products")
    assert r.status_code == 200
    products = r.json()
    assert len(products) >= 8
    hero = next(p for p in products if p["is_hero_deal"])
    assert hero["name"] == "Samsung Galaxy A15 128Go"
    assert len(hero["variants"]) >= 3
    print(f"[PASS] Products OK: {len(products)} products, Hero product: {hero['name']} ({hero['price']} FCFA)")

    # 5. Channels
    r = client.get("/api/channels")
    assert r.status_code == 200
    channels = r.json()
    assert len(channels) >= 4
    wa = next(c for c in channels if c["channel_type"] == "WHATSAPP")
    assert wa["is_recommended"] == True
    print(f"[PASS] Channels OK: {len(channels)} channels configured ({[c['display_title'] for c in channels]})")

    # 6. Create Intent (WhatsApp)
    intent_req = {
        "store_id": store["id"],
        "product_id": hero["id"],
        "channel_type": "WHATSAPP",
        "quantity": 1,
        "selected_color": "Bleu Nuit",
        "delivery_city": "Cocody (Abidjan)",
        "customer_source": "TIKTOK",
        "customer_name": "Test Client",
    }
    r = client.post("/api/intents", json=intent_req)
    assert r.status_code == 200, f"Create intent failed: {r.text}"
    intent = r.json()
    assert intent["reference_code"].startswith("CMD-")
    assert "wa.me" in intent["redirect_url"]
    assert "CMD-" in intent["prefilled_message"]
    print(f"[PASS] Create Intent OK: Ref {intent['reference_code']} -> Redirect: {intent['redirect_url'][:40]}...")

    # 7. Pending 24h followups
    r = client.get("/api/intents/pending-followup")
    assert r.status_code == 200
    pending = r.json()
    target = next((p for p in pending if p["reference_code"] == "CMD-8F29A1"), pending[0])
    assert target["total_amount"] > 0
    print(f"[PASS] Pending followups OK: Found target {target['reference_code']}")

    # 8. Confirm Sale OUI (Verification Card in Screen 3)
    confirm_req = {"is_sold": True, "reason": "Conclue en boutique"}
    r = client.post(f"/api/intents/{target['id']}/confirm", json=confirm_req)
    assert r.status_code == 200
    res = r.json()
    assert res["success"] == True
    assert res["status"] == "SOLD"
    print(f"[PASS] Confirm Sale OUI OK: {res['message']} -> Status is SOLD")

    # 9. Analytics Overview
    r = client.get("/api/analytics/overview?period=today")
    assert r.status_code == 200
    analytics = r.json()
    assert analytics["total_revenue"] >= 8945000
    assert len(analytics["channels"]) == 3
    assert len(analytics["top_products"]) == 3
    print(f"[PASS] Analytics Overview OK: CA={analytics['total_revenue']} FCFA | Conversion={analytics['overall_conversion_rate']}%")

    print("\nALL BACKEND & BUSINESS LOGIC TESTS PASSED SUCCESSFULLY! 100% DATABASE DRIVEN.")

if __name__ == "__main__":
    test_all_api_endpoints()
