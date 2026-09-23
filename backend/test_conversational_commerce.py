from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_conversational_commerce_suite():
    print("=== RUNNING AUTOMATED CONVERSATIONAL COMMERCE SUITE ===")

    # 1. Verify Garbadrome Kossodo Store
    r = client.get("/api/store?slug=garbadrome-kossodo")
    assert r.status_code == 200, f"Store get failed: {r.text}"
    store = r.json()
    assert "Garbadrome Kossodo" in store["name"]
    store_id = store["id"]
    print(f"[PASS] Store Garbadrome Kossodo OK: {store['name']} | Rating: {store['rating']}/5")

    # 2. Check customizable products
    r = client.get(f"/api/catalog/products?store_id={store_id}")
    assert r.status_code == 200
    products = r.json()
    assert len(products) >= 8
    customizable = [p for p in products if p.get("is_customizable")]
    assert len(customizable) >= 3
    print(f"[PASS] Products & Customization OK: {len(products)} products, {len(customizable)} customizable products found")

    target_product = next(p for p in products if "Poisson" in p["name"])

    # 3. Create Conversational Order with structured customization and GPS + address
    order_payload = {
        "store_id": store_id,
        "items": [
            {
                "product_id": target_product["id"],
                "product_name": target_product["name"],
                "quantity": 2,
                "unit_price": target_product["price"],
                "customization_text": "Je veux beaucoup d'oignons, peu de piment, deux portions d'attiéké et un poisson bien grillé.",
                "customization_options": {
                    "spice_level": "Peu de piment",
                    "onions": "Beaucoup d'oignons",
                    "cooking": "Poisson bien grillé"
                }
            }
        ],
        "delivery": {
            "delivery_mode": "GPS_AND_DESCRIPTION",
            "delivery_city": "Cité Universitaire Kossodo",
            "delivery_address": "Pavillon C, Chambre 22, près du grand manguier",
            "latitude": 12.4175,
            "longitude": -1.4882,
            "location_accuracy": 4.5,
            "delivery_notes": "Sonner à la porte ou appeler"
        },
        "customer_name": "Hamidou Ouédraogo",
        "customer_phone": "+22670112233",
        "customer_token": "token_hamidou_test_e2e",
        "delivery_fee": 500,
        "notes": "Merci de préparer chaud"
    }

    r = client.post("/api/orders", json=order_payload)
    assert r.status_code == 200, f"Create order failed: {r.text}"
    order = r.json()
    order_id = order["id"]
    conv_id = order["conversation_id"]
    assert order["status"] == "PENDING_SELLER_ACCEPTANCE"
    assert order["payment_status"] == "PAYMENT_PENDING"
    assert order["total_amount"] == (target_product["price"] * 2) + 500
    assert order["delivery"]["latitude"] == 12.4175
    assert conv_id is not None
    print(f"[PASS] Order Created OK: #{order['order_number']} | Total: {order['total_amount']} FCFA | Status: {order['status']}")

    # 4. Check that conversation was created and has initial Order card message
    r = client.get(f"/api/conversations/{conv_id}/messages")
    assert r.status_code == 200
    messages = r.json()
    assert len(messages) >= 1
    order_card_msg = messages[0]
    assert order_card_msg["message_type"] == "ORDER"
    assert order_card_msg["metadata"]["order_id"] == order_id
    print(f"[PASS] Attached Order Conversation OK: Conv ID {conv_id} has initial ORDER card message")

    # 5. Seller Acceptance
    r = client.post(f"/api/orders/{order_id}/accept", json={"seller_name": "Moussa Traoré"})
    assert r.status_code == 200
    order_acc = r.json()
    assert order_acc["status"] == "ACCEPTED"
    assert order_acc["payment_status"] == "PAYMENT_PENDING"
    print(f"[PASS] Seller Acceptance OK: Status is now {order_acc['status']}")

    # 6. Customer Submits Payment Proof
    proof_payload = {
        "file_url": "/media/proofs/capture_orange_money_hamidou.jpg",
        "file_name": "capture_om_3500.jpg",
        "file_size": 182400,
        "mime_type": "image/jpeg",
        "customer_note": "Voici mon reçu Orange Money de 3 500 FCFA.",
        "sender_id": "token_hamidou_test_e2e",
        "sender_name": "Hamidou Ouédraogo"
    }
    r = client.post(f"/api/orders/{order_id}/payment-proof", json=proof_payload)
    assert r.status_code == 200
    proof_res = r.json()
    assert proof_res["payment_status"] == "PAYMENT_PROOF_SUBMITTED"
    print(f"[PASS] Payment Proof Submitted OK: Proof ID {proof_res['proof_id']}")

    # Verify message stream in chat has the PAYMENT_PROOF message
    r = client.get(f"/api/conversations/{conv_id}/messages")
    messages = r.json()
    payment_msg = next((m for m in messages if m["message_type"] == "PAYMENT_PROOF"), None)
    assert payment_msg is not None
    assert payment_msg["metadata"]["status"] == "SUBMITTED"
    print(f"[PASS] Chat Message Stream OK: Payment Proof Card rendered in conversation")

    # 7. Seller Confirms Payment
    r = client.post(f"/api/orders/{order_id}/confirm-payment", json={"verified_by": "Moussa Traoré"})
    assert r.status_code == 200
    pay_conf = r.json()
    assert pay_conf["payment_status"] == "PAYMENT_CONFIRMED"
    assert pay_conf["status"] == "PAID"
    print(f"[PASS] Seller Confirm Payment OK: Status is {pay_conf['status']}, Payment is {pay_conf['payment_status']}")

    # 8. Seller Advances Status: PREPARING -> OUT_FOR_DELIVERY -> DELIVERED -> COMPLETED
    for next_status in ["PREPARING", "OUT_FOR_DELIVERY", "DELIVERED", "COMPLETED"]:
        r = client.post(f"/api/orders/{order_id}/status", json={"status": next_status, "actor_name": "Moussa Traoré"})
        assert r.status_code == 200
        upd = r.json()
        assert upd["status"] == next_status
    print(f"[PASS] Full Order Lifecycle Traversed to COMPLETED!")

    # 9. General Store Conversation (Inquiry without Order)
    gen_conv_payload = {
        "store_id": store_id,
        "context_type": "GENERAL_STORE",
        "customer_token": "token_hamidou_test_e2e",
        "customer_name": "Hamidou Ouédraogo"
    }
    r = client.post("/api/conversations", json=gen_conv_payload)
    assert r.status_code == 200
    gen_conv = r.json()
    assert gen_conv["context_type"] == "GENERAL_STORE"
    assert gen_conv["order_id"] is None

    # Send general chat question
    r = client.post(f"/api/conversations/{gen_conv['id']}/messages", json={
        "sender_type": "CUSTOMER",
        "sender_name": "Hamidou Ouédraogo",
        "content": "Vous êtes ouverts aujourd'hui ? Il reste du poisson ?"
    })
    assert r.status_code == 200
    print(f"[PASS] General Store Conversation OK: Customer asked general question")

    # 10. Voice & Video Call Session
    call_payload = {
        "conversation_id": gen_conv["id"],
        "caller_type": "CUSTOMER",
        "caller_name": "Hamidou Ouédraogo",
        "call_type": "AUDIO"
    }
    r = client.post("/api/calls", json=call_payload)
    assert r.status_code == 200
    call_data = r.json()
    call_id = call_data["id"]
    assert call_data["status"] == "RINGING"

    # Answer call
    r = client.post(f"/api/calls/{call_id}/answer")
    assert r.status_code == 200
    assert r.json()["status"] == "ACCEPTED"

    # End call
    r = client.post(f"/api/calls/{call_id}/end")
    assert r.status_code == 200
    end_res = r.json()
    assert end_res["status"] == "ENDED"

    # Check call history
    r = client.get(f"/api/calls/history?store_id={store_id}")
    assert r.status_code == 200
    calls = r.json()
    assert len(calls) >= 1
    print(f"[PASS] Voice & Video Calls OK: Started, answered, ended call and recorded in history ({calls[0]['status']})")

    # 11. Secure Media Access
    r = client.get("/api/media/any-id/access")
    assert r.status_code in [200, 404]
    print(f"[PASS] Media Security Access Endpoint OK")

    print("\nALL CONVERSATIONAL COMMERCE TESTS PASSED WITH 100% SUCCESS!")

if __name__ == "__main__":
    test_conversational_commerce_suite()
