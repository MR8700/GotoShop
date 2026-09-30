import os
from sqlalchemy import inspect, text

def _backfill_points_remaining(conn):
    """Rattrape les lots existants : les débits passés sont imputés sur les lots les plus anciens (FIFO).

    Idempotent : ne touche que les entrées positives dont points_remaining est encore NULL.
    """
    pending = conn.execute(text(
        "SELECT DISTINCT customer_id, store_id FROM loyalty_points_ledger "
        "WHERE points > 0 AND points_remaining IS NULL"
    )).fetchall()
    for customer_id, store_id in pending:
        rows = conn.execute(text(
            "SELECT id, points, is_expired, expires_at, created_at, entry_type FROM loyalty_points_ledger "
            "WHERE customer_id = :c AND store_id = :s ORDER BY created_at ASC"
        ), {"c": customer_id, "s": store_id}).fetchall()
        # Les entrées EXPIRED ne sont pas des consommations : les lots concernés sont déjà à 0 (is_expired).
        debited = sum(-r[1] for r in rows if r[1] < 0 and r[5] != "EXPIRED")
        lots = [r for r in rows if r[1] > 0]
        # même ordre que l'exécution : échéance la plus proche d'abord, sans échéance en dernier
        lots.sort(key=lambda r: (r[3] is None, str(r[3] or ""), str(r[4] or "")))
        for lot_id, points, is_expired, _exp, _created, _etype in lots:
            if is_expired:
                remaining = 0
            else:
                taken = min(points, debited)
                debited -= taken
                remaining = points - taken
            conn.execute(
                text("UPDATE loyalty_points_ledger SET points_remaining = :r WHERE id = :i"),
                {"r": remaining, "i": lot_id},
            )


def run_migrations(engine):
    """
    Idempotent schema migration for PostgreSQL and SQLite.
    Safely adds missing columns and creates new tables without losing data.
    """
    try:
        from app.database import Base
        import app.models  # ensure models registered
        Base.metadata.create_all(bind=engine)

        inspector = inspect(engine)
        table_names = inspector.get_table_names()
        
        with engine.begin() as conn:
            # 1. Stores
            if "stores" in table_names:
                store_cols = [c["name"] for c in inspector.get_columns("stores")]
                cols_to_add = [
                    ("owner_bio", "TEXT"),
                    ("primary_color", "VARCHAR(20) DEFAULT '#ec761e'"),
                    ("secondary_color", "VARCHAR(20) DEFAULT '#4EBE9E'"),
                    ("theme_preset", "VARCHAR(50) DEFAULT 'kinetic_amber'"),
                    ("is_custom_theme_active", "BOOLEAN DEFAULT TRUE"),
                    ("is_loyalty_active", "BOOLEAN DEFAULT TRUE"),
                    ("loyalty_spend_per_point", "INTEGER DEFAULT 1000"),
                    ("subscription_status", "VARCHAR(30) DEFAULT 'ACTIVE'"),
                    ("subscription_plan", "VARCHAR(30) DEFAULT 'PRO'"),
                    ("subscription_expires_at", "TIMESTAMP"),
                    ("custom_domain", "VARCHAR(150)"),
                    ("contact_whatsapp", "VARCHAR(30)"),
                    ("contact_email", "VARCHAR(100)"),
                    ("voice_note_subtitle", "VARCHAR(200) DEFAULT 'Écouter les conseils taille & qualité'"),
                    ("show_ratings_publicly", "BOOLEAN DEFAULT TRUE"),
                    ("show_sales_count_publicly", "BOOLEAN DEFAULT TRUE"),
                    ("show_reviews_publicly", "BOOLEAN DEFAULT TRUE"),
                    ("activity_type", "VARCHAR(50) DEFAULT 'GENERAL_COMMERCE'"),
                    ("capabilities", "TEXT"),
                    ("country", "VARCHAR(100) DEFAULT 'Burkina Faso'"),
                    ("city", "VARCHAR(100) DEFAULT 'Ouagadougou'"),
                    ("business_preferences", "TEXT"),
                    ("notification_profile", "TEXT"),
                    ("commerce_profile", "TEXT"),
                    ("communication_profile", "TEXT"),
                    ("qr_code_svg", "TEXT"),
                    ("followers_count", "INTEGER DEFAULT 0"),
                    ("is_open", "BOOLEAN DEFAULT TRUE"),
                    ("owner_last_seen_at", "TIMESTAMP"),
                ]
                for col_name, col_type in cols_to_add:
                    if col_name not in store_cols:
                        conn.execute(text(f"ALTER TABLE stores ADD COLUMN {col_name} {col_type}"))

            # 2. Customers
            if "customers" in table_names:
                cust_cols = [c["name"] for c in inspector.get_columns("customers")]
                cust_cols_to_add = [
                    ("country", "VARCHAR(100) DEFAULT 'Burkina Faso'"),
                    ("delivery_neighborhood", "VARCHAR(255)"),
                    ("notification_preferences", "TEXT"),
                    ("loyalty_card_no", "VARCHAR(32)"),
                    ("phone_verified", "BOOLEAN DEFAULT 0"),
                ]
                for col_name, col_type in cust_cols_to_add:
                    if col_name not in cust_cols:
                        conn.execute(text(f"ALTER TABLE customers ADD COLUMN {col_name} {col_type}"))

            # 3. Owners
            if "owners" in table_names:
                owner_cols = [c["name"] for c in inspector.get_columns("owners")]
                cols_to_add = [
                    ("bio", "TEXT"),
                    ("password_hash", "VARCHAR(255)"),
                    ("password_salt", "VARCHAR(64)"),
                    ("must_change_password", "BOOLEAN DEFAULT TRUE"),
                    ("session_token", "VARCHAR(128)"),
                    ("failed_login_attempts", "INTEGER DEFAULT 0"),
                    ("locked_until", "TIMESTAMP"),
                    ("last_login_at", "TIMESTAMP"),
                ]
                for col_name, col_type in cols_to_add:
                    if col_name not in owner_cols:
                        conn.execute(text(f"ALTER TABLE owners ADD COLUMN {col_name} {col_type}"))

            # 4. Order Intents
            if "order_intents" in table_names:
                intent_cols = [c["name"] for c in inspector.get_columns("order_intents")]
                cols_to_add = [
                    ("customer_location_url", "VARCHAR(500)"),
                    ("customer_coordinates", "VARCHAR(100)"),
                    ("customer_id", "VARCHAR(36)"),
                    ("client_status", "VARCHAR(50) DEFAULT 'PENDING'"),
                    ("client_feedback", "VARCHAR(255)"),
                    ("client_satisfaction_rating", "INTEGER"),
                    ("client_action_at", "TIMESTAMP"),
                    ("coherence_status", "VARCHAR(50) DEFAULT 'HARMONIZED_PENDING'"),
                    ("coherence_notes", "VARCHAR(255)"),
                    ("is_client_archived", "BOOLEAN DEFAULT FALSE"),
                    ("is_client_hidden", "BOOLEAN DEFAULT FALSE"),
                ]
                for col_name, col_type in cols_to_add:
                    if col_name not in intent_cols:
                        conn.execute(text(f"ALTER TABLE order_intents ADD COLUMN {col_name} {col_type}"))

            # 4b. Orders
            if "orders" in table_names:
                order_cols = [c["name"] for c in inspector.get_columns("orders")]
                order_cols_to_add = [
                    ("is_client_archived", "BOOLEAN DEFAULT FALSE"),
                    ("is_client_hidden", "BOOLEAN DEFAULT FALSE"),
                ]
                for col_name, col_type in order_cols_to_add:
                    if col_name not in order_cols:
                        conn.execute(text(f"ALTER TABLE orders ADD COLUMN {col_name} {col_type}"))

            # 4b. Lieux de retrait / livraison rattachés aux commandes
            if "order_deliveries" in table_names:
                od_cols = [c["name"] for c in inspector.get_columns("order_deliveries")]
                for col_name, col_type in [
                    ("fulfillment_type", "VARCHAR(20) DEFAULT 'HOME'"),
                    ("spot_id", "VARCHAR(36)"),
                    ("spot_snapshot", "TEXT"),
                    ("location_status", "VARCHAR(20)"),
                    ("location_distance_km", "FLOAT"),
                ]:
                    if col_name not in od_cols:
                        conn.execute(text(f"ALTER TABLE order_deliveries ADD COLUMN {col_name} {col_type}"))

            # 5. Delivery Cities
            if "delivery_cities" in table_names:
                city_cols = [c["name"] for c in inspector.get_columns("delivery_cities")]
                if "display_order" not in city_cols:
                    conn.execute(text("ALTER TABLE delivery_cities ADD COLUMN display_order INTEGER DEFAULT 0"))
                if "delivery_fee" not in city_cols:
                    conn.execute(text("ALTER TABLE delivery_cities ADD COLUMN delivery_fee INTEGER"))
                for col_name, col_type in [("latitude", "FLOAT"), ("longitude", "FLOAT"), ("radius_km", "FLOAT")]:
                    if col_name not in city_cols:
                        conn.execute(text(f"ALTER TABLE delivery_cities ADD COLUMN {col_name} {col_type}"))
                # Toute zone doit avoir un tarif explicite et, si la ville est connue, son GPS de référence
                from app.services.geo_service import DEFAULT_DELIVERY_FEE, suggest_gps
                conn.execute(text("UPDATE delivery_cities SET delivery_fee = :f WHERE delivery_fee IS NULL"),
                             {"f": DEFAULT_DELIVERY_FEE})
                for cid, cname in conn.execute(text(
                        "SELECT id, name FROM delivery_cities WHERE latitude IS NULL OR longitude IS NULL")).fetchall():
                    ref = suggest_gps(cname)
                    if ref:
                        conn.execute(text("UPDATE delivery_cities SET latitude=:a, longitude=:o, radius_km=COALESCE(radius_km,:r) WHERE id=:i"),
                                     {"a": ref["latitude"], "o": ref["longitude"], "r": ref["radius_km"], "i": cid})

            # 5b. Remises boutique : portée produit / catégorie
            if "store_discount_rules" in table_names:
                rule_cols = [c["name"] for c in inspector.get_columns("store_discount_rules")]
                for col_name, col_type in [
                    ("scope", "VARCHAR(20) NOT NULL DEFAULT 'STORE'"),
                    ("product_ids", "TEXT"),
                    ("category_ids", "TEXT"),
                ]:
                    if col_name not in rule_cols:
                        conn.execute(text(f"ALTER TABLE store_discount_rules ADD COLUMN {col_name} {col_type}"))

            # 5c. Publicité produit : attribution des vues / intentions / commandes au lien de partage
            for _tbl, _cols in (
                ("tracking_events", [("share_code", "VARCHAR(20)"), ("visitor_id", "VARCHAR(64)")]),
                ("orders", [("share_code", "VARCHAR(20)")]),
                ("order_intents", [("share_code", "VARCHAR(20)")]),
            ):
                if _tbl in table_names:
                    _have = [c["name"] for c in inspector.get_columns(_tbl)]
                    for _n, _t in _cols:
                        if _n not in _have:
                            conn.execute(text(f"ALTER TABLE {_tbl} ADD COLUMN {_n} {_t}"))

            # 6. Products (Polymorphic sales, units, measurements)
            if "products" in table_names:
                prod_cols = [c["name"] for c in inspector.get_columns("products")]
                cols_to_add = [
                    ("is_customizable", "BOOLEAN DEFAULT FALSE"),
                    ("customization_prompt", "VARCHAR(150) DEFAULT 'Précisez vos souhaits'"),
                    ("customization_options", "TEXT"),
                    ("sales_unit", "VARCHAR(50) DEFAULT 'PIECE'"),
                    ("sales_unit_label", "VARCHAR(50) DEFAULT 'pièce'"),
                    ("measurement_type", "VARCHAR(50) DEFAULT 'COUNT'"),
                    ("pricing_model", "VARCHAR(50) DEFAULT 'FIXED_PER_UNIT'"),
                    ("min_quantity", "FLOAT DEFAULT 1.0"),
                    ("max_quantity", "FLOAT DEFAULT 9999.0"),
                    ("quantity_step", "FLOAT DEFAULT 1.0"),
                    ("quantity_precision", "INTEGER DEFAULT 0"),
                    ("pack_size", "FLOAT DEFAULT 1.0"),
                    ("allow_custom_measurements", "BOOLEAN DEFAULT FALSE"),
                    ("measurement_specs", "TEXT"),
                ]
                for col_name, col_type in cols_to_add:
                    if col_name not in prod_cols:
                        conn.execute(text(f"ALTER TABLE products ADD COLUMN {col_name} {col_type}"))

            # 7. Order Items (Float quantity, unit snapshot)
            if "order_items" in table_names:
                item_cols = [c["name"] for c in inspector.get_columns("order_items")]
                item_cols_to_add = [
                    ("unit", "VARCHAR(50) DEFAULT 'PIECE'"),
                    ("unit_label", "VARCHAR(50) DEFAULT 'pièce'"),
                    ("pricing_model", "VARCHAR(50) DEFAULT 'FIXED_PER_UNIT'"),
                    ("measurements", "TEXT"),
                    ("sales_config_snapshot", "TEXT"),
                ]
                for col_name, col_type in item_cols_to_add:
                    if col_name not in item_cols:
                        conn.execute(text(f"ALTER TABLE order_items ADD COLUMN {col_name} {col_type}"))

            # 7b. Loyalty ledger : lots FIFO (points_remaining) pour l'expiration des points
            if "loyalty_points_ledger" in table_names:
                led_cols = [c["name"] for c in inspector.get_columns("loyalty_points_ledger")]
                if "points_remaining" not in led_cols:
                    conn.execute(text("ALTER TABLE loyalty_points_ledger ADD COLUMN points_remaining INTEGER"))
                _backfill_points_remaining(conn)

        # 7a'. Session client : colonne d'expiration (les sessions existantes reçoivent une durée de vie complète)
        if "customers" in table_names:
            with engine.begin() as conn_exp:
                ccols = [c["name"] for c in inspect(engine).get_columns("customers")]
                if "session_expires_at" not in ccols:
                    conn_exp.execute(text("ALTER TABLE customers ADD COLUMN session_expires_at TIMESTAMP"))
                from app.core.customer_session import session_expiry
                conn_exp.execute(text("UPDATE customers SET session_expires_at=:e WHERE session_token IS NOT NULL AND session_expires_at IS NULL"),
                                 {"e": session_expiry()})

        # 7b'. Jetons de session commerçant / super-admin : stockés hachés (les sessions actives restent valides,
        #      car le client présente toujours le jeton brut dont l'empreinte est recalculée à chaque requête).
        from app.core.security import hash_session_token, SESSION_HASH_PREFIX
        with engine.begin() as conn_tok:
            for tbl in ("owners", "super_admins", "customers"):
                if tbl in table_names:
                    rows = conn_tok.execute(text(
                        f"SELECT id, session_token FROM {tbl} WHERE session_token IS NOT NULL AND session_token NOT LIKE :p"
                    ), {"p": SESSION_HASH_PREFIX + "%"}).fetchall()
                    for rid, tok in rows:
                        conn_tok.execute(text(f"UPDATE {tbl} SET session_token=:h WHERE id=:i"), {"h": hash_session_token(tok), "i": rid})

        # 7c. Contraintes d'unicité absentes des bases créées avant le modèle (best-effort, index unique idempotents)
        for ddl in (
            "CREATE UNIQUE INDEX IF NOT EXISTS ux_customers_loyalty_card_no ON customers (loyalty_card_no)",
            "CREATE UNIQUE INDEX IF NOT EXISTS ux_ledger_order_entry ON loyalty_points_ledger (order_id, entry_type)",
            "CREATE UNIQUE INDEX IF NOT EXISTS ux_coupon_store_code ON loyalty_reward_coupons (store_id, code)",
            "CREATE INDEX IF NOT EXISTS ix_order_intents_customer_id ON order_intents (customer_id)",
            "CREATE INDEX IF NOT EXISTS ix_customers_store_phone ON customers (store_id, phone)",
        ):
            try:
                with engine.begin() as conn_idx:
                    conn_idx.execute(text(ddl))
            except Exception as e_idx:
                print("Notice: index non créé (données à réparer d'abord ?):", str(e_idx).splitlines()[0][:140])

        # 8. Seed sales units and profiles
        try:
            from app.database import SessionLocal
            from app.services.catalog_service import CatalogService
            db_seed = SessionLocal()
            try:
                CatalogService.seed_sales_units_and_profiles(db_seed)
            finally:
                db_seed.close()
        except Exception as e_seed:
            print("Notice: sales units seeding skipped or handled:", e_seed)

    except Exception as e:
        print("Schema migration notice:", e)
