import os
from sqlalchemy import inspect, text

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
                ]
                for col_name, col_type in cols_to_add:
                    if col_name not in intent_cols:
                        conn.execute(text(f"ALTER TABLE order_intents ADD COLUMN {col_name} {col_type}"))

            # 5. Delivery Cities
            if "delivery_cities" in table_names:
                city_cols = [c["name"] for c in inspector.get_columns("delivery_cities")]
                if "display_order" not in city_cols:
                    conn.execute(text("ALTER TABLE delivery_cities ADD COLUMN display_order INTEGER DEFAULT 0"))

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
