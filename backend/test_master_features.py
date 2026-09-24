import sys
import uuid
from datetime import datetime, timedelta
from app.database import SessionLocal, engine, Base
from app.models.store import Store, StoreSubscription, StoreAccessHistory
from app.models.customer import Customer
from app.models.order import Order
from app.models.notifications import AppNotification
from app.services.capability_service import (
    CapabilityService,
    CAP_ORDERING,
    CAP_PAYMENT_PROOF,
    CAP_MENU,
    CAP_FOLLOWERS,
    CAP_STORE_NEWS,
    CAP_QR_ACCESS
)
from app.services.qr_service import QrService
from app.services.notification_engine import NotificationEngine
from app.services.order_service import OrderService


def run_all_tests():
    print("=" * 60)
    print("RUNNING MASTER FEATURES VERIFICATION SUITE")
    print("=" * 60)

    db = SessionLocal()

    try:
        # TEST 1: QR Service SVG & Print Presets
        print("\n[TEST 1] Testing Pure-Python Vector QR Service & Print Presets...")
        svg_content = QrService.generate_store_qr_svg("garbadrome-kossodo", store_name="Garbadrome Kossodo", format_preset="square")
        assert "<svg" in svg_content, "SVG element missing"
        assert "</svg>" in svg_content, "SVG closing element missing"
        assert "garbadrome-kossodo" in svg_content or "http" in svg_content, "QR target missing"
        print("  -> Square SVG generated successfully (length: %d chars)" % len(svg_content))

        poster_svg = QrService.generate_store_qr_svg("garbadrome-kossodo", store_name="Garbadrome Kossodo", format_preset="poster_a4")
        assert "Affiche Vitrine" in poster_svg or "Scannez pour commander" in poster_svg
        print("  -> Poster A4 SVG preset verified.")

        badge_svg = QrService.generate_store_qr_svg("garbadrome-kossodo", store_name="Garbadrome Kossodo", format_preset="business_card")
        assert "<svg" in badge_svg
        print("  -> Business Card preset verified.")

        # TEST 2: Polymorphic Capabilities Engine
        print("\n[TEST 2] Testing Polymorphic Capabilities Engine...")
        # Get or create test store
        existing_store = db.query(Store).first()
        owner_id = existing_store.owner_id if existing_store else str(uuid.uuid4())
        test_store = db.query(Store).filter(Store.slug == "test-cap-store").first()
        if not test_store:
            test_store = Store(
                id=str(uuid.uuid4()),
                owner_id=owner_id,
                name="Cap Test Store",
                slug="test-cap-store",
                activity_type="RESTAURANT",
                created_at=datetime.utcnow()
            )
            db.add(test_store)
            db.commit()

        # Restaurant default includes MENU and ORDERING
        caps = CapabilityService.get_capabilities_for_store(test_store)
        assert CAP_ORDERING in caps, "Expected ORDERING in RESTAURANT domain"
        assert CAP_MENU in caps, "Expected MENU in RESTAURANT domain"
        assert CapabilityService.has_capability(test_store, CAP_ORDERING) is True

        # Capability override test
        CapabilityService.set_store_capability_override(db, test_store, CAP_MENU, False)
        caps_overridden = CapabilityService.get_capabilities_for_store(test_store)
        assert CAP_MENU not in caps_overridden, "CAP_MENU should have been disabled by override"
        print("  -> Domain matrix and custom capability overrides work seamlessly.")

        # Restore
        CapabilityService.set_store_capability_override(db, test_store, CAP_MENU, True)

        # TEST 3: Centralized Notification Engine & Non-Judgmental Decision Support
        print("\n[TEST 3] Testing Notification Engine & Decision Insights...")
        notif = NotificationEngine.dispatch(
            db=db,
            recipient_type="STORE_OWNER",
            recipient_id=test_store.id,
            store_id=test_store.id,
            title="Commande Test #101",
            message="Un client a passé une commande.",
            category="TRANSACTIONAL",
            event_type="ORDER_CREATED",
            urgency="HIGH"
        )
        assert notif.id is not None
        assert notif.recipient_id == test_store.id
        db.commit()
        print("  -> Notification dispatched and persisted: %s" % notif.title)

        # Query notifications
        from app.routers.notifications import list_notifications
        result = list_notifications(
            recipient_type="STORE_OWNER",
            store_id=test_store.id,
            db=db
        )
        assert result["unread_count"] >= 1, "Unread count should be >= 1"
        assert any(n["id"] == notif.id for n in result["notifications"])
        print("  -> Notification retrieval and unread counter verified.")

        # Decision Insights (Factual framing)
        insights = NotificationEngine.get_merchant_decision_insights(db, test_store)
        assert isinstance(insights, list)
        print("  -> Merchant decision insights generated (%d cues found)." % len(insights))

        # TEST 4: Store Subscription & Strict "Achat != Abonnement"
        print("\n[TEST 4] Testing Store Subscriptions (Achat != Abonnement)...")
        # Create test customer
        test_customer = db.query(Customer).filter(Customer.phone == "+22670009988").first()
        if not test_customer:
            test_customer = Customer(
                id=str(uuid.uuid4()),
                store_id=test_store.id,
                phone="+22670009988",
                name="Aïcha Ouedraogo",
                created_at=datetime.utcnow()
            )
            db.add(test_customer)
            db.commit()

        # Follow store explicitly
        sub = db.query(StoreSubscription).filter(
            StoreSubscription.store_id == test_store.id,
            StoreSubscription.customer_id == test_customer.id
        ).first()
        if not sub:
            sub = StoreSubscription(
                id=str(uuid.uuid4()),
                store_id=test_store.id,
                customer_id=test_customer.id,
                status="ACTIVE",
                created_at=datetime.utcnow()
            )
            db.add(sub)
            db.commit()
        assert sub.status == "ACTIVE"
        print("  -> Explicit subscription created.")

        # Test Announcement broadcast to subscribers
        NotificationEngine.notify_store_announcement(
            db=db,
            store=test_store,
            announcement_title="Nouveau plat disponible !",
            announcement_body="Venez déguster notre spécialité du jour."
        )
        db.commit()

        sub_notifs = db.query(AppNotification).filter(
            AppNotification.recipient_id == test_customer.id,
            AppNotification.event_type == "STORE_ANNOUNCEMENT"
        ).all()
        assert len(sub_notifs) > 0, "Subscriber should have received store announcement"
        print("  -> Broadcast announcement delivered to subscriber successfully.")

        # TEST 5: Seamless Checkout Onboarding (5 Fields + Auto-Registration)
        print("\n[TEST 5] Testing Seamless Checkout Onboarding...")
        fresh_phone = f"+22670{uuid.uuid4().hex[:6]}"
        created_order_dict = OrderService.create_order(
            db=db,
            store_id=test_store.id,
            items_data=[{"name": "Alloco Portion", "quantity": 2, "unit_price": 500}],
            delivery_data={"delivery_city": "Ouagadougou", "delivery_neighborhood": "Kossodo, face pharmacie", "delivery_address": "Kossodo, face pharmacie"},
            customer_name="Salif Sanou",
            customer_phone=fresh_phone,
            register_account=True,
            country="Burkina Faso",
            city="Ouagadougou",
            delivery_neighborhood="Kossodo, face pharmacie"
        )
        assert created_order_dict.get("id") is not None
        assert created_order_dict.get("order_number") is not None
        session_token = created_order_dict.get("customer_token")
        assert session_token is not None, "Seamless registration must return a session_token"

        # Verify auto-created customer
        auto_cust = db.query(Customer).filter(Customer.phone == fresh_phone).first()
        assert auto_cust is not None, "Customer should have been created in database"
        assert auto_cust.name == "Salif Sanou"
        assert auto_cust.city == "Ouagadougou"
        assert auto_cust.delivery_neighborhood == "Kossodo, face pharmacie"
        print("  -> Customer seamlessly created with token: %s..." % session_token[:12])

        # Strict Verification: Achat != Abonnement
        # Order placement should NOT auto-create a StoreSubscription
        unsolicited_sub = db.query(StoreSubscription).filter(
            StoreSubscription.store_id == test_store.id,
            StoreSubscription.customer_id == auto_cust.id
        ).first()
        assert unsolicited_sub is None, "PURCHASE MUST NOT AUTO-SUBSCRIBE! (Achat != Abonnement violated)"

        # But it MUST create a StoreAccessHistory record
        access_hist = db.query(StoreAccessHistory).filter(
            StoreAccessHistory.store_id == test_store.id,
            StoreAccessHistory.customer_id == auto_cust.id,
            StoreAccessHistory.interaction_type == "ORDER"
        ).first()
        assert access_hist is not None, "Access history must record the order interaction"
        print("  -> Strict rule verified: Achat != Abonnement verified. AccessHistory recorded.")

        print("\n" + "=" * 60)
        print("ALL 5 CORE VERIFICATION TESTS PASSED WITH 100% SUCCESS!")
        print("=" * 60)

    finally:
        db.close()

if __name__ == "__main__":
    run_all_tests()
