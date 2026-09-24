import json
import uuid
from app.database import SessionLocal
from app.models.store import Store
from app.models.catalog import Product, Category, SalesUnit, SalesProfile
from app.models.order import Order, OrderItem
from app.services.catalog_service import CatalogService
from app.services.order_service import OrderService

def test_sales_polymorphic_engine():
    print("=" * 65)
    print("RUNNING POLYMORPHIC SALES & MEASUREMENT SUITE")
    print("=" * 65)

    db = SessionLocal()
    try:
        # Seed standard sales units and profiles
        CatalogService.seed_sales_units_and_profiles(db)
        units = CatalogService.get_sales_units(db)
        profiles = CatalogService.get_sales_profiles(db)

        print(f"[TEST 1] Sales Units & Profiles Seeding...")
        print(f"  -> Found {len(units)} standard units (PAGNE, METER, KG, PAIR, HOUR, etc.)")
        print(f"  -> Found {len(profiles)} preconfigured sales profiles")
        assert len(units) >= 10, "Should have at least 10 standard units"
        assert len(profiles) >= 6, "Should have at least 6 standard profiles"

        # Get or create store for test
        store = db.query(Store).filter(Store.slug == "faso-danfani-elegance").first()
        if not store:
            store = db.query(Store).first()
        assert store is not None, "Store must exist"

        print(f"\n[TEST 2] Pagne Fractional Sale (0.5 / 1 / 1.5 / 2.5)...")
        # Create or fetch pagne product
        pagne_prod = Product(
            id=str(uuid.uuid4()),
            store_id=store.id,
            name="Pagne Faso Danfani Indigo Test",
            slug=f"pagne-test-{uuid.uuid4().hex[:4]}",
            price=15000,
            stock=10.0,
            sales_unit="PAGNE",
            sales_unit_label="pagne",
            measurement_type="COUNT",
            pricing_model="FIXED_PER_UNIT",
            min_quantity=0.5,
            max_quantity=20.0,
            quantity_step=0.5,
            quantity_precision=1,
            is_published=True
        )
        db.add(pagne_prod)
        db.commit()

        # Place order for 2.5 pagnes
        order_res = OrderService.create_order(
            db=db,
            store_id=store.id,
            items_data=[{
                "product_id": pagne_prod.id,
                "quantity": 2.5,
                "unit": "PAGNE",
                "unit_label": "pagne",
                "customization_text": "Finitions ourlets soignés"
            }],
            delivery_data={"delivery_mode": "ADDRESS_DESCRIPTION", "delivery_address": "Ouaga 2000"},
            customer_name="Amina Ouedraogo",
            customer_phone="+22670112233",
            delivery_fee=1000
        )

        created_order = db.query(Order).filter(Order.id == order_res["id"]).first()
        assert created_order is not None
        assert len(created_order.items) == 1
        item = created_order.items[0]

        print(f"  -> Order #{created_order.order_number} created successfully")
        print(f"  -> Item: {item.product_name} | Qty: {item.quantity} {item.unit_label}")
        print(f"  -> Unit Price: {item.unit_price} FCFA | Total Item: {item.total_price} FCFA")
        print(f"  -> Total Order (with delivery): {created_order.total_amount} FCFA")

        assert item.quantity == 2.5, f"Expected 2.5, got {item.quantity}"
        assert item.total_price == 37500, f"Expected 37500 FCFA, got {item.total_price}"
        assert created_order.total_amount == 38500, f"Expected 38500 FCFA, got {created_order.total_amount}"
        assert item.unit == "PAGNE"
        assert item.unit_label == "pagne"

        # Check snapshot
        snapshot = json.loads(item.sales_config_snapshot)
        assert snapshot["sales_unit"] == "PAGNE"
        assert snapshot["quantity_step"] == 0.5
        print(f"  -> Snapshot preserved: {snapshot}")

        # Check stock deduction
        db.refresh(pagne_prod)
        print(f"  -> Stock updated: 10.0 - 2.5 = {pagne_prod.stock} pagnes")
        assert pagne_prod.stock == 7.5, f"Expected 7.5, got {pagne_prod.stock}"

        print(f"\n[TEST 3] Fabric by Length / Meter Sale (e.g. 3.50 m)...")
        tissu_prod = Product(
            id=str(uuid.uuid4()),
            store_id=store.id,
            name="Tissu Coton au Mètre Test",
            slug=f"tissu-test-{uuid.uuid4().hex[:4]}",
            price=2500,
            stock=50.0,
            sales_unit="METER",
            sales_unit_label="m",
            measurement_type="LENGTH",
            pricing_model="FIXED_PER_UNIT",
            min_quantity=0.5,
            max_quantity=100.0,
            quantity_step=0.5,
            quantity_precision=2,
            is_published=True
        )
        db.add(tissu_prod)
        db.commit()

        order_res_2 = OrderService.create_order(
            db=db,
            store_id=store.id,
            items_data=[{
                "product_id": tissu_prod.id,
                "quantity": 3.5,
                "unit": "METER",
                "unit_label": "m",
            }],
            delivery_data={"delivery_mode": "ADDRESS_DESCRIPTION", "delivery_address": "Dassasgho"},
            customer_name="Moussa Sawadogo",
            customer_phone="+22678001122"
        )
        item_2 = db.query(OrderItem).filter(OrderItem.order_id == order_res_2["id"]).first()
        print(f"  -> Order #{order_res_2['order_number']} | Qty: {item_2.quantity} {item_2.unit_label} | Total: {item_2.total_price} FCFA")
        assert item_2.quantity == 3.5
        assert item_2.total_price == 8750  # 3.5 * 2500 = 8750

        print(f"\n[TEST 4] Step & Min Quantity Validation...")
        # Try ordering 0.2 pagne (below min 0.5) -> should raise ValueError
        try:
            OrderService.create_order(
                db=db,
                store_id=store.id,
                items_data=[{"product_id": pagne_prod.id, "quantity": 0.2}],
                delivery_data={"delivery_mode": "ADDRESS_DESCRIPTION"},
                customer_name="Test Fail"
            )
            assert False, "Should have failed on min_quantity"
        except ValueError as e_val:
            print(f"  -> Successfully caught invalid min_quantity: {e_val}")

        # Try ordering 1.2 pagnes (violates step 0.5) -> should raise ValueError
        try:
            OrderService.create_order(
                db=db,
                store_id=store.id,
                items_data=[{"product_id": pagne_prod.id, "quantity": 1.2}],
                delivery_data={"delivery_mode": "ADDRESS_DESCRIPTION"},
                customer_name="Test Fail Step"
            )
            assert False, "Should have failed on quantity_step"
        except ValueError as e_val2:
            print(f"  -> Successfully caught invalid step: {e_val2}")

        print(f"\n[TEST 5] Shoes (Pair) & Service (Hours) Polymorphic Orders...")
        # Pair of shoes
        shoes_prod = Product(
            id=str(uuid.uuid4()),
            store_id=store.id,
            name="Sandales Cuir Bobo",
            slug=f"sandales-{uuid.uuid4().hex[:4]}",
            price=12000,
            stock=15.0,
            sales_unit="PAIR",
            sales_unit_label="paire",
            min_quantity=1.0,
            quantity_step=1.0,
            is_published=True
        )
        # Service by hour
        service_prod = Product(
            id=str(uuid.uuid4()),
            store_id=store.id,
            name="Retouche & Ajustement Couturier",
            slug=f"service-{uuid.uuid4().hex[:4]}",
            price=5000,
            stock=100.0,
            sales_unit="HOUR",
            sales_unit_label="h",
            min_quantity=1.0,
            quantity_step=1.0,
            is_published=True
        )
        db.add_all([shoes_prod, service_prod])
        db.commit()

        multi_res = OrderService.create_order(
            db=db,
            store_id=store.id,
            items_data=[
                {"product_id": shoes_prod.id, "quantity": 2.0, "unit": "PAIR", "unit_label": "paire"},
                {"product_id": service_prod.id, "quantity": 3.0, "unit": "HOUR", "unit_label": "h"}
            ],
            delivery_data={"delivery_mode": "ADDRESS_DESCRIPTION", "delivery_address": "Atelier"},
            customer_name="Fatou Traoré",
            delivery_fee=0
        )
        multi_order = db.query(Order).filter(Order.id == multi_res["id"]).first()
        assert len(multi_order.items) == 2
        print(f"  -> Multi-item polymorphic order created: #{multi_order.order_number}")
        for it in multi_order.items:
            print(f"     * {it.product_name} -> {it.quantity} {it.unit_label} = {it.total_price} FCFA")
        assert multi_order.total_amount == (2 * 12000) + (3 * 5000)  # 24000 + 15000 = 39000

        print("\n" + "=" * 65)
        print("ALL POLYMORPHIC SALES & MEASUREMENT TESTS PASSED (100%)!")
        print("=" * 65)

    finally:
        db.close()

if __name__ == "__main__":
    test_sales_polymorphic_engine()
