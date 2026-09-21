from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.store import Owner
from app.services.auth_service import AuthService

client = TestClient(app)

def run_e2e_verification():
    print("=== STARTING FULL END-TO-END VERIFICATION ===")

    # 1. Frontend Serving
    res = client.get("/")
    assert res.status_code == 200, f"Frontend root failed: {res.status_code}"
    assert "Awa Chic & Tech" in res.text or "root" in res.text
    print("[PASS] E2E: Frontend HTML is served successfully on root path (/)")

    # 2. Media Serving
    res_img = client.get("/media/products/samsung_galaxy_a15.jpg")
    assert res_img.status_code == 200, f"Media product image failed: {res_img.status_code}"
    assert len(res_img.content) > 1000
    print(f"[PASS] E2E: Product media served correctly ({len(res_img.content)} bytes)")

    res_logo = client.get("/media/store/logo.jpg")
    assert res_logo.status_code == 200, f"Store logo failed: {res_logo.status_code}"
    print(f"[PASS] E2E: Store logo media served correctly ({len(res_logo.content)} bytes)")

    # 3. Store API Data
    r_store = client.get("/api/store")
    assert r_store.status_code == 200
    store = r_store.json()
    assert store["name"] == "Awa Chic & Tech"
    assert store["currency"] == "FCFA"
    assert len(store["trust_badges"]) == 3
    print(f"[PASS] E2E: Store API returned: {store['name']} | Badges: {len(store['trust_badges'])}")

    # 4. Catalog API Data
    r_cat = client.get("/api/catalog/products")
    assert r_cat.status_code == 200
    prods = r_cat.json()
    assert len(prods) >= 8
    hero = next(p for p in prods if p["is_hero_deal"])
    if hero["stock"] < 2:
        client.put(f"/api/catalog/products/{hero['id']}", json={"stock": 5})
        hero = client.get(f"/api/catalog/products/{hero['id']}").json()
    initial_stock = hero["stock"]
    initial_sales = hero["sales_count"]
    print(f"[PASS] E2E: Catalog API returned {len(prods)} products. Hero stock = {initial_stock}")

    # 5. Order Intent Creation (Simulating user clicking Commander on WhatsApp)
    intent_payload = {
        "store_id": store["id"],
        "product_id": hero["id"],
        "channel_type": "WHATSAPP",
        "quantity": 1,
        "selected_color": "Bleu Nuit",
        "delivery_city": "Cocody (Abidjan)",
        "customer_source": "TIKTOK_BIO",
        "customer_name": "Kouamé D.",
        "customer_phone": "+225 07 12 34 56"
    }
    r_intent = client.post("/api/intents", json=intent_payload)
    assert r_intent.status_code == 200
    intent = r_intent.json()
    intent_id = intent["id"]
    ref_code = intent["reference_code"]
    assert ref_code.startswith("CMD-")
    assert "wa.me/2250700000000" in intent["redirect_url"]
    print(f"[PASS] E2E: Created intent {ref_code} with redirect URL {intent['redirect_url'][:45]}...")

    # 6. Verify 24h Pending Follow-up queue
    r_followup = client.get("/api/intents/pending-followup")
    assert r_followup.status_code == 200
    pending_list = r_followup.json()
    found_in_pending = any(p["id"] == intent_id for p in pending_list)
    assert found_in_pending, "New intent was not found in pending follow-up queue!"
    print(f"[PASS] E2E: Intent {ref_code} confirmed present in 24h follow-up queue ({len(pending_list)} pending)")

    # 7. Arbitrate 24h Follow-up: Merchant clicks OUI, VENTE CONCLUE
    r_confirm = client.post(f"/api/intents/{intent_id}/confirm", json={"is_sold": True})
    assert r_confirm.status_code == 200
    conf_data = r_confirm.json()
    assert conf_data["status"] == "SOLD"
    print(f"[PASS] E2E: Sale confirmation OUI successful: {conf_data['message']}")

    # 8. Verify Database State Mutations
    r_hero_updated = client.get(f"/api/catalog/products/{hero['id']}")
    assert r_hero_updated.status_code == 200
    hero_updated = r_hero_updated.json()
    assert hero_updated["stock"] == initial_stock - 1, f"Stock was not decremented: {hero_updated['stock']}"
    assert hero_updated["sales_count"] == initial_sales + 1, f"Sales count not incremented: {hero_updated['sales_count']}"
    print(f"[PASS] E2E: Product stock decremented to {hero_updated['stock']} and sales count incremented to {hero_updated['sales_count']}")

    # 9. Verify Analytics Aggregates
    r_stats = client.get("/api/analytics/overview?period=today")
    assert r_stats.status_code == 200
    stats = r_stats.json()
    assert stats["total_revenue"] > 0
    print(f"[PASS] E2E: Analytics aggregate updated with CA = {stats['total_revenue']} {stats['currency']}")

    # 10. Verify SMS Channel Intent Creation
    sms_payload = {
        "store_id": store["id"],
        "product_id": hero["id"],
        "channel_type": "SMS",
        "quantity": 1,
        "selected_color": "Bleu Nuit",
        "delivery_city": "Cocody (Abidjan)",
        "customer_source": "DIRECT",
        "customer_name": "Test SMS Client",
    }
    r_sms = client.post("/api/intents", json=sms_payload)
    assert r_sms.status_code == 200
    sms_intent = r_sms.json()
    assert sms_intent["redirect_url"].startswith("sms:")
    print(f"[PASS] E2E: SMS Channel Intent created with URL: {sms_intent['redirect_url'][:40]}...")

    # 11. Verify New Product Creation (Photo instantanée + Vidéo + PDF)
    fake_png_base64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    new_prod_payload = {
        "store_id": store["id"],
        "name": "Bague Saphir Royale",
        "category_id": store.get("categories", [{}])[0].get("id") if store.get("categories") else None,
        "price": 45000,
        "stock": 5,
        "description": "Bague artisanale ornée d'un saphir bleu éclatant",
        "image_data": fake_png_base64,
        "video_data": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
        "pdf_data": "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"
    }
    r_new_prod = client.post("/api/catalog/products", json=new_prod_payload)
    assert r_new_prod.status_code == 200, f"Create product failed: {r_new_prod.text}"
    created_prod = r_new_prod.json()
    assert created_prod["name"] == "Bague Saphir Royale"
    assert created_prod["primary_image_url"].startswith("/media/products/")
    assert created_prod["video_url"] is not None
    assert created_prod["pdf_catalog_url"] is not None
    print(f"[PASS] E2E: Created new product {created_prod['name']} with image, video & PDF catalog")

    # 12. Verify Campaign Traffic Tracking
    r_track = client.post("/api/analytics/track-visit?source=tiktok_bio")
    assert r_track.status_code == 200
    track_res = r_track.json()
    assert track_res["success"] is True
    r_stats_after = client.get("/api/analytics/overview?period=today")
    assert r_stats_after.status_code == 200
    stats_sources = [s["source_name"].lower() for s in r_stats_after.json().get("traffic_sources", [])]
    assert any("tiktok" in s for s in stats_sources)
    print(f"[PASS] E2E: Dynamic traffic visit tracked and reflected in analytics")

    # 13. Clean up created product
    r_del = client.delete(f"/api/catalog/products/{created_prod['id']}")
    assert r_del.status_code == 200
    print(f"[PASS] E2E: Cleaned up test product {created_prod['id']}")

    # 14. Verify Store Owner Profile Avatar & Bio Update
    new_bio = "Créatrice passionnée & experte Tech à Cocody. Articles 100% garantis."
    fake_avatar_base64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAADklEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    r_store_up = client.put(f"/api/store/{store['id']}", json={
        "owner_bio": new_bio,
        "avatar_data": fake_avatar_base64
    })
    assert r_store_up.status_code == 200, f"Store update failed: {r_store_up.text}"
    store_updated = r_store_up.json()
    assert store_updated["owner_bio"] == new_bio
    assert store_updated["avatar_url"].startswith("/media/store/avatar_")
    print(f"[PASS] E2E: Store Owner profile photo updated ({store_updated['avatar_url']}) and bio set successfully")

    # 15. Verify Customer Exact GPS Location Sharing in Intent & Messaging
    gps_coords = "5.3599, -3.9920"
    gps_maps_url = "https://maps.google.com/?q=5.3599,-3.9920"
    gps_intent_payload = {
        "store_id": store["id"],
        "product_id": hero["id"],
        "channel_type": "WHATSAPP",
        "quantity": 1,
        "selected_color": "Bleu Nuit",
        "delivery_city": "Cocody (Abidjan)",
        "customer_source": "GPS_DELIVERY",
        "customer_name": "Fatou D.",
        "customer_location_url": gps_maps_url,
        "customer_coordinates": gps_coords,
    }
    r_gps_intent = client.post("/api/intents", json=gps_intent_payload)
    assert r_gps_intent.status_code == 200
    gps_intent = r_gps_intent.json()
    assert gps_intent["customer_location_url"] == gps_maps_url
    assert gps_intent["customer_coordinates"] == gps_coords
    assert "maps.google.com" in gps_intent["redirect_url"]
    assert "maps.google.com" in gps_intent["prefilled_message"]
    print(f"[PASS] E2E: Customer exact GPS location injected into intent & WhatsApp message: {gps_intent['redirect_url'][:60]}...")

    # 16. Verify Owner Authentication with initial credentials
    with SessionLocal() as db_session:
        owner_obj = db_session.query(Owner).first()
        if owner_obj:
            AuthService.reset_to_default_credentials(db_session, owner_obj)

    r_login = client.post("/api/auth/login", json={
        "identifier": "awa@chictech.bf",
        "password": "AwaChic2026!"
    })
    assert r_login.status_code == 200, f"Login failed: {r_login.text}"
    login_data = r_login.json()
    assert login_data["must_change_password"] is True
    assert login_data["access_token"]
    temp_token = login_data["access_token"]
    print(f"[PASS] E2E: Owner login succeeded with temporary password, must_change_password flag is True")

    # 17. Verify Password Validation Rules Rejection
    # 17a. Weak password (< 8 chars)
    r_val1 = client.post("/api/auth/validate-password", json={"password": "Abc1!"})
    assert r_val1.status_code == 200
    assert r_val1.json()["is_valid"] is False

    # 17b. Password with spaces
    r_val2 = client.post("/api/auth/validate-password", json={"password": "Awa Chic 2026!"})
    assert r_val2.status_code == 200
    assert r_val2.json()["is_valid"] is False

    # 17c. Password with repeating consecutive characters (e.g. 'aa' or '22')
    r_val3 = client.post("/api/auth/validate-password", json={"password": "SikaaTech#2026"})
    assert r_val3.status_code == 200
    val3_data = r_val3.json()
    assert val3_data["is_valid"] is False
    no_repeat_chk = next(c for c in val3_data["checks"] if c["key"] == "no_repeat")
    assert no_repeat_chk["passed"] is False

    # 17d. Attempting change-password with invalid password must return 400
    r_chg_fail = client.post(
        "/api/auth/change-password",
        headers={"Authorization": f"Bearer {temp_token}"},
        json={
            "current_password": "AwaChic2026!",
            "new_password": "SikaaTech#2026",
            "confirm_password": "SikaaTech#2026"
        }
    )
    assert r_chg_fail.status_code == 400
    print(f"[PASS] E2E: Password security validation strictly enforced (rejected <8 chars, spaces, repeated chars)")

    # 18. Verify Successful Mandatory Password Change & Subsequent Login
    strong_pwd = "SikaTech#2026"
    r_chg_ok = client.post(
        "/api/auth/change-password",
        headers={"Authorization": f"Bearer {temp_token}"},
        json={
            "current_password": "AwaChic2026!",
            "new_password": strong_pwd,
            "confirm_password": strong_pwd
        }
    )
    assert r_chg_ok.status_code == 200, f"Password change failed: {r_chg_ok.text}"
    chg_data = r_chg_ok.json()
    assert chg_data["success"] is True
    assert chg_data["must_change_password"] is False
    new_token = chg_data["access_token"]

    # Verify session via /api/auth/me
    r_me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {new_token}"})
    assert r_me.status_code == 200
    me_data = r_me.json()
    assert me_data["is_authenticated"] is True
    assert me_data["must_change_password"] is False

    # Verify old password is now rejected
    r_old_login = client.post("/api/auth/login", json={
        "identifier": "awa@chictech.bf",
        "password": "AwaChic2026!"
    })
    assert r_old_login.status_code == 401

    # Verify new strong password logs in cleanly
    r_new_login = client.post("/api/auth/login", json={
        "identifier": "awa@chictech.bf",
        "password": strong_pwd
    })
    assert r_new_login.status_code == 200
    assert r_new_login.json()["must_change_password"] is False
    print(f"[PASS] E2E: Mandatory password changed to strong password, old rejected, new verified with active session token")

    # 19. Verify Customer Quick Registration (Friction-Free 3-Second Onboarding)
    r_cust_reg = client.post("/api/customer/quick-register", json={
        "name": "Aminata Traoré",
        "phone": "+225 07 99 88 77",
        "city": "Ouagadougou (Centre)"
    })
    assert r_cust_reg.status_code == 200, f"Customer registration failed: {r_cust_reg.text}"
    cust_auth = r_cust_reg.json()
    assert cust_auth["customer"]["name"] == "Aminata Traoré"
    assert cust_auth["access_token"]
    cust_token = cust_auth["access_token"]
    cust_id = cust_auth["customer"]["id"]
    print(f"[PASS] E2E: Customer ultra-fast registration succeeded for {cust_auth['customer']['name']} ({cust_id})")

    # 20. Verify Customer Profile Completion with Saved GPS & Notes
    gps_ouaga = "12.3714, -1.5197"
    maps_ouaga = "https://maps.google.com/?q=12.3714,-1.5197"
    r_cust_prof = client.put(
        "/api/customer/profile",
        headers={"Authorization": f"Bearer {cust_token}"},
        json={
            "name": "Aminata Traoré K.",
            "delivery_address": "Zone du Bois, Rue 14.25",
            "gps_coordinates": gps_ouaga,
            "gps_location_url": maps_ouaga,
            "preferred_channel": "WHATSAPP",
            "notes": "Sonner à la villa blanche au portail marron"
        }
    )
    assert r_cust_prof.status_code == 200, f"Customer profile update failed: {r_cust_prof.text}"
    updated_cust = r_cust_prof.json()
    assert updated_cust["name"] == "Aminata Traoré K."
    assert updated_cust["gps_coordinates"] == gps_ouaga
    assert updated_cust["delivery_address"] == "Zone du Bois, Rue 14.25"
    print(f"[PASS] E2E: Customer completed profile with saved GPS ({gps_ouaga}) and delivery address")

    # 21. Verify Customer Order Intent Creation with customer_id & Orders List Retrieval
    r_cust_order = client.post("/api/intents", json={
        "store_id": store["id"],
        "product_id": hero["id"],
        "channel_type": "WHATSAPP",
        "quantity": 1,
        "selected_color": "Bleu Nuit",
        "delivery_city": "Ouagadougou (Centre)",
        "customer_source": "CLIENT_PORTAL",
        "customer_name": updated_cust["name"],
        "customer_phone": updated_cust["phone"],
        "customer_id": cust_id,
        "customer_location_url": maps_ouaga,
        "customer_coordinates": gps_ouaga,
    })
    assert r_cust_order.status_code == 200
    cust_order_data = r_cust_order.json()
    created_cmd_id = cust_order_data["id"]

    # Retrieve customer orders
    r_my_orders = client.get("/api/customer/orders", headers={"Authorization": f"Bearer {cust_token}"})
    assert r_my_orders.status_code == 200
    my_orders = r_my_orders.json()
    assert len(my_orders) >= 1
    found_order = next((o for o in my_orders if o["id"] == created_cmd_id), None)
    assert found_order is not None
    assert found_order["reference_code"] == cust_order_data["reference_code"]
    assert "maps.google.com" in found_order["customer_location_url"]
    assert "https://wa.me/" in found_order["redirect_url"]
    print(f"[PASS] E2E: Customer order #{found_order['reference_code']} retrieved with direct WhatsApp follow-up link")

    # 22. Verify Customer Loyalty Stats & Points Accumulation
    # Confirm the sale to credit points
    r_conf = client.post(f"/api/intents/{created_cmd_id}/confirm", json={"is_sold": True})
    assert r_conf.status_code == 200

    r_cust_stats = client.get("/api/customer/stats", headers={"Authorization": f"Bearer {cust_token}"})
    assert r_cust_stats.status_code == 200
    cust_stats = r_cust_stats.json()
    print("DEBUG cust_stats:", cust_stats)
    assert cust_stats["confirmed_orders"] >= 1
    assert cust_stats["total_spent"] > 0
    assert cust_stats["loyalty_tier"] in ["Bronze", "Silver VIP", "Gold Élite", "Silver", "Gold VIP"]
    print(f"[PASS] E2E: Customer loyalty stats verified (Spent: {cust_stats['total_spent']} FCFA, Points: {cust_stats['loyalty_points']} pts, Tier: {cust_stats['loyalty_tier']})")

    # 23. Verify GPS Opt-in Exclusivity (GPS is NEVER sent unless explicitly agreed in payload)
    r_no_gps_order = client.post("/api/intents", json={
        "store_id": store["id"],
        "product_id": hero["id"],
        "channel_type": "WHATSAPP",
        "quantity": 1,
        "selected_color": "Bleu Nuit",
        "delivery_city": "Abidjan (Plateau)",
        "customer_source": "CLIENT_PORTAL",
        "customer_name": updated_cust["name"],
        "customer_phone": updated_cust["phone"],
        "customer_id": cust_id,
        "customer_location_url": None, # Client deliberately unchecked GPS
        "customer_coordinates": None,
    })
    assert r_no_gps_order.status_code == 200
    no_gps_order_data = r_no_gps_order.json()
    assert no_gps_order_data["customer_location_url"] is None
    assert no_gps_order_data["customer_coordinates"] is None
    assert "maps.google.com" not in no_gps_order_data["redirect_url"]
    print(f"[PASS] E2E: GPS Opt-in verified: When client disables GPS toggle, coordinates are strictly omitted from DB & message")

    # 24. Verify Merchant Theme & Color Customization API
    r_theme_update = client.put(f"/api/store/{store['id']}", json={
        "primary_color": "#10B981",
        "secondary_color": "#3B82F6",
        "theme_preset": "EMERAUDE_ROYALE",
        "is_custom_theme_active": True
    })
    assert r_theme_update.status_code == 200
    store_theme = r_theme_update.json()
    assert store_theme["primary_color"] == "#10B981"
    assert store_theme["secondary_color"] == "#3B82F6"
    assert store_theme["theme_preset"] == "EMERAUDE_ROYALE"
    assert store_theme["is_custom_theme_active"] is True
    print(f"[PASS] E2E: Merchant custom colors applied (Primary: {store_theme['primary_color']}, Preset: {store_theme['theme_preset']})")

    # 25. Verify Merchant Loyalty Program Configuration & Loyalty Tier CRUD
    # Update store loyalty settings
    r_loyalty_conf = client.put(f"/api/store/{store['id']}", json={
        "is_loyalty_active": True,
        "loyalty_spend_per_point": 500
    })
    assert r_loyalty_conf.status_code == 200
    assert r_loyalty_conf.json()["loyalty_spend_per_point"] == 500

    # Create a new custom Loyalty Tier
    r_create_tier = client.post(f"/api/store/{store['id']}/loyalty-tiers", json={
        "name": "Platine Élite",
        "min_points": 300,
        "badge_label": "Membre Platine Prestige",
        "perk_title": "Cadeau de Luxe + Remise VIP -15%",
        "perk_description": "Accès exclusif aux collections privées avant tout le monde et cadeau premium offert.",
        "discount_percent": 15,
        "is_active": True,
        "display_order": 4
    })
    assert r_create_tier.status_code == 200
    created_tier = r_create_tier.json()
    tier_id = created_tier["id"]
    assert created_tier["name"] == "Platine Élite"
    assert created_tier["discount_percent"] == 15

    # List tiers
    r_tiers_list = client.get(f"/api/store/{store['id']}/loyalty-tiers")
    assert r_tiers_list.status_code == 200
    tiers_list = r_tiers_list.json()
    assert any(t["id"] == tier_id for t in tiers_list)
    print(f"[PASS] E2E: Loyalty tiers configured & custom tier 'Platine Élite' created successfully ({len(tiers_list)} tiers in store)")

    # Verify Customer Stats reflects new tiers and rule dynamically
    r_cust_stats_v2 = client.get("/api/customer/stats", headers={"Authorization": f"Bearer {cust_token}"})
    assert r_cust_stats_v2.status_code == 200
    cust_stats_v2 = r_cust_stats_v2.json()
    assert cust_stats_v2["loyalty_spend_per_point"] == 500
    assert cust_stats_v2["is_loyalty_active"] is True
    assert len(cust_stats_v2["all_tiers"]) >= 4
    assert any(t["name"] == "Platine Élite" for t in cust_stats_v2["all_tiers"])
    print(f"[PASS] E2E: Customer Stats dynamically reflects merchant's loyalty rule (1 pt / 500 FCFA) and tiers")

    # Clean up custom tier
    r_del_tier = client.delete(f"/api/store/{store['id']}/loyalty-tiers/{tier_id}")
    assert r_del_tier.status_code == 200
    print("[PASS] E2E: Custom loyalty tier cleaned up")

    # 26. Verify Client Satisfaction Feedback & Merchant Notification Reminder
    r_satisfy_order = client.post("/api/intents", json={
        "store_id": store["id"],
        "product_id": hero["id"],
        "channel_type": "WHATSAPP",
        "quantity": 1,
        "selected_color": "Bleu Nuit",
        "delivery_city": "Abidjan (Cocody)",
        "customer_name": "Marcella K.",
        "customer_phone": "+225 07 44 33 22",
    })
    assert r_satisfy_order.status_code == 200
    satisfy_cmd = r_satisfy_order.json()
    satisfy_cmd_id = satisfy_cmd["id"]

    # Client marks order as SATISFIED (5 stars)
    r_action_sat = client.post(f"/api/intents/{satisfy_cmd_id}/client-action", json={
        "action": "SATISFY",
        "reason": "Produit reçu en parfait état, super rapide !",
        "rating": 5
    })
    assert r_action_sat.status_code == 200
    sat_res = r_action_sat.json()
    assert sat_res["client_status"] == "SATISFIED"
    assert sat_res["coherence_status"] == "CLIENT_CONFIRMED_PENDING_MERCHANT"
    print(f"[PASS] E2E: Client marked order #{sat_res['reference_code']} Satisfied (5 stars) -> coherence is CLIENT_CONFIRMED_PENDING_MERCHANT")

    # Verify merchant notification was generated to remind if product was actually sold
    r_notifs = client.get("/api/notifications")
    assert r_notifs.status_code == 200
    notifs_data = r_notifs.json()
    found_sat_notif = any(n["notification_type"] == "CLIENT_SATISFIED" and satisfy_cmd["reference_code"] in n["title"] for n in notifs_data["notifications"])
    assert found_sat_notif, "Notification CLIENT_SATISFIED was not generated for merchant!"
    print(f"[PASS] E2E: Merchant notification generated to remind merchant of real sale confirmation")

    # 27. Merchant confirms sale on client-satisfied order -> Harmonizes to CONSOLIDATED_SALE
    r_confirm_sat = client.post(f"/api/intents/{satisfy_cmd_id}/confirm", json={"is_sold": True})
    assert r_confirm_sat.status_code == 200
    assert r_confirm_sat.json()["coherence_status"] == "CONSOLIDATED_SALE"
    print(f"[PASS] E2E: Bilateral confirmation achieved -> coherence harmonized to CONSOLIDATED_SALE")

    # 28. Verify Early Client Order Cancellation
    r_cancel_order = client.post("/api/intents", json={
        "store_id": store["id"],
        "product_id": hero["id"],
        "channel_type": "WHATSAPP",
        "quantity": 1,
        "selected_color": "Bleu Nuit",
        "delivery_city": "Bouaké",
        "customer_name": "Yao N.",
        "customer_phone": "+225 05 11 22 33",
    })
    assert r_cancel_order.status_code == 200
    cancel_cmd = r_cancel_order.json()
    cancel_cmd_id = cancel_cmd["id"]

    # Client cancels order
    r_action_cancel = client.post(f"/api/intents/{cancel_cmd_id}/client-action", json={
        "action": "CANCEL",
        "reason": "Changement d'avis"
    })
    assert r_action_cancel.status_code == 200
    cancel_res = r_action_cancel.json()
    assert cancel_res["client_status"] == "CANCELLED"
    assert cancel_res["status"] == "CANCELLED"
    assert cancel_res["coherence_status"] == "CLIENT_CANCELLED_EARLY"
    print(f"[PASS] E2E: Client cancelled order #{cancel_res['reference_code']} -> Status is CANCELLED")

    # 29. Verify Discrepancy Conflict Detection (Merchant says SOLD, but Client cancels)
    stocky_prod = next(p for p in client.get("/api/catalog/products").json() if p["stock"] >= 5)
    hero_stock_before_conflict = stocky_prod["stock"]

    r_conflict_order = client.post("/api/intents", json={
        "store_id": store["id"],
        "product_id": stocky_prod["id"],
        "channel_type": "WHATSAPP",
        "quantity": 1,
        "selected_color": "Bleu Nuit",
        "delivery_city": "Yamoussoukro",
        "customer_name": "Bamba S.",
        "customer_phone": "+225 01 22 33 44",
    })
    assert r_conflict_order.status_code == 200
    conflict_cmd = r_conflict_order.json()
    conflict_cmd_id = conflict_cmd["id"]

    # Merchant initially confirms sale -> stock decrements by 1
    r_merch_yes = client.post(f"/api/intents/{conflict_cmd_id}/confirm", json={"is_sold": True})
    assert r_merch_yes.status_code == 200
    assert client.get(f"/api/catalog/products/{stocky_prod['id']}").json()["stock"] == hero_stock_before_conflict - 1

    # But client subsequently declares cancellation (e.g. package never arrived or refused)
    r_client_conflict = client.post(f"/api/intents/{conflict_cmd_id}/client-action", json={
        "action": "CANCEL",
        "reason": "Colis non reçu, coursier injoignable"
    })
    assert r_client_conflict.status_code == 200
    conflict_res = r_client_conflict.json()
    assert conflict_res["coherence_status"] == "DISCREPANCY_CONFLICT"

    # Verify it appears in discrepancies list
    r_disc_list = client.get("/api/intents/discrepancies")
    assert r_disc_list.status_code == 200
    disc_items = r_disc_list.json()
    assert any(d["id"] == conflict_cmd_id for d in disc_items)
    print(f"[PASS] E2E: Discrepancy Conflict detected (#{conflict_res['reference_code']}) when merchant confirmed but client cancelled")

    # 30. Verify Merchant Discrepancy Resolution (ACCEPT_CANCELLATION resets stock & CA)
    r_resolve = client.post(f"/api/intents/{conflict_cmd_id}/resolve-discrepancy", json={
        "resolution": "ACCEPT_CANCELLATION",
        "notes": "Annulation confirmée après vérification auprès du coursier."
    })
    assert r_resolve.status_code == 200
    resolved_res = r_resolve.json()
    assert resolved_res["coherence_status"] == "MUTUAL_ABANDON"
    assert resolved_res["status"] == "CANCELLED"

    # Verify stock restored
    hero_stock_after_resolve = client.get(f"/api/catalog/products/{stocky_prod['id']}").json()["stock"]
    assert hero_stock_after_resolve == hero_stock_before_conflict, "Stock was not restored after resolving cancellation discrepancy!"
    print(f"[PASS] E2E: Merchant discrepancy resolved with ACCEPT_CANCELLATION -> stock restored and harmonized to MUTUAL_ABANDON")

    # 31. Verify Guest Orders Batch Lookup & Account Linking
    r_guest_cmd = client.post("/api/intents", json={
        "store_id": store["id"],
        "product_id": hero["id"],
        "channel_type": "WHATSAPP",
        "quantity": 1,
        "selected_color": "Bleu Nuit",
        "delivery_city": "Abidjan",
        "customer_name": "Invité Test",
        "customer_phone": None,
        "customer_id": None
    })
    assert r_guest_cmd.status_code == 200
    guest_cmd_id = r_guest_cmd.json()["id"]

    # Lookup batch
    r_batch = client.post("/api/intents/batch-lookup", json={"intent_ids": [guest_cmd_id]})
    assert r_batch.status_code == 200
    assert len(r_batch.json()) == 1
    assert r_batch.json()[0]["id"] == guest_cmd_id

    # Link guest order to registered customer
    r_link = client.post(
        "/api/customer/link-guest-orders",
        headers={"Authorization": f"Bearer {cust_token}"},
        json={"order_ids": [guest_cmd_id]}
    )
    assert r_link.status_code == 200
    assert r_link.json()["linked_count"] >= 1
    print(f"[PASS] E2E: Guest orders batch lookup verified and {r_link.json()['linked_count']} order linked to customer account")

    # 32. Verify Merchant Notifications API & Read All
    r_read_all = client.post("/api/notifications/read-all")
    assert r_read_all.status_code == 200
    assert r_read_all.json()["success"] is True
    r_notifs_after = client.get("/api/notifications")
    assert r_notifs_after.json()["unread_count"] == 0
    print(f"[PASS] E2E: Merchant notifications marked read successfully")

    # 33. Verify Global Analytics Reflection (Satisfaction Rate, Consolidated Revenue)
    r_analytics_final = client.get("/api/analytics/overview?period=today")
    assert r_analytics_final.status_code == 200
    analytics_final = r_analytics_final.json()
    assert "satisfaction_rate" in analytics_final
    assert "consolidated_revenue" in analytics_final
    assert analytics_final["satisfaction_rate"] > 0
    assert analytics_final["consolidated_revenue"] > 0
    assert analytics_final["satisfied_clients_count"] >= 1
    print(f"[PASS] E2E: Global Analytics verifies satisfaction rate ({analytics_final['satisfaction_rate']}%), consolidated CA ({analytics_final['consolidated_revenue']} {analytics_final['currency']})")

    # Cleanly restore default credentials so DB is always ready with AwaChic2026!
    r_reset_auth = client.post("/api/auth/reset-credentials")
    assert r_reset_auth.status_code == 200
    print("[PASS] E2E: Owner credentials cleanly restored to initial default (awa@chictech.bf / AwaChic2026!)")

    # Restore canonical store avatar & logo
    from app.models.store import Store
    _db = SessionLocal()
    _st = _db.query(Store).first()
    if _st:
        _st.avatar_url = "/media/store/awa_portrait.jpg"
        _st.logo_url = "/media/store/logo.jpg"
        _db.commit()
    _db.close()

    print("\n>>> ALL 33 END-TO-END VALIDATION PHASES PASSED WITH ZERO MOCKS! <<<")

if __name__ == "__main__":
    run_e2e_verification()




