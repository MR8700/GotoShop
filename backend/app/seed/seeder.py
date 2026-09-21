from datetime import datetime, timedelta
from app.database import SessionLocal, Base, engine
from app.models import (
    Owner, Store, TrustBadge, DeliveryCity,
    Category, Product, ProductVariant, ProductImage,
    StoreChannel, OrderIntent, FollowUpTask, SaleConfirmation,
    TrafficSource, ShareLink
)

def seed_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        # 1. Owner
        owner = Owner(
            full_name="Awa Traoré",
            email="awa@chictech.bf",
            phone_number="+2250700000000",
            bio="Styliste et entrepreneure passionnée, fondatrice de Awa Chic & Tech.",
        )
        db.add(owner)
        db.flush()

        # 2. Store
        store = Store(
            owner_id=owner.id,
            name="Awa Chic & Tech",
            slug="awa-chic-tech",
            tagline="Prêt-à-porter haut de gamme & High-Tech vérifié",
            description="Le carrefour de l'élégance africaine et de la tech de pointe à Abidjan et Ouaga.",
            owner_bio="Créatrice passionnée & experte Tech à Abidjan. Tous mes articles sont minutieusement inspectés avant expédition express.",
            currency="FCFA",
            logo_url="/media/store/logo.jpg",
            avatar_url="/media/store/awa_portrait.jpg",
            rating=4.9,
            sales_count=342,
            revenue=8945000,
            is_verified=True,
            social_tunnel_badge="WA/FB",
            social_tunnel_label="Tunnel Social Actif",
            is_flash_active=True,
            flash_title="Vente Flash Express",
            flash_subtitle="Ouaga & Abidjan • Envoi sous 2h chrono",
            flash_remaining_seconds=15502,
            voice_note_title="Besoin d'une taille sur mesure ?",
            voice_note_subtitle="Awa vous conseille personnellement en audio ou vidéo sur WhatsApp.",
        )
        db.add(store)
        db.flush()

        # 3. Trust Badges
        trust_badges = [
            TrustBadge(store_id=store.id, icon_name="local_shipping", label="Paiement Réception", badge_type="secondary", display_order=1),
            TrustBadge(store_id=store.id, icon_name="verified_user", label="100% Authentique", badge_type="primary", display_order=2),
            TrustBadge(store_id=store.id, icon_name="swap_horizontal_circle", label="Échange 48h", badge_type="secondary-fixed", display_order=3),
        ]
        db.add_all(trust_badges)

        # 4. Delivery Cities
        cities = [
            DeliveryCity(store_id=store.id, name="Cocody (Abidjan)", display_label="📍 Cocody", is_default=True, display_order=1),
            DeliveryCity(store_id=store.id, name="Ouagadougou", display_label="Ouaga", is_default=False, display_order=2),
            DeliveryCity(store_id=store.id, name="Dakar", display_label="Dakar", is_default=False, display_order=3),
        ]
        db.add_all(cities)

        # 5. Categories
        cat_all = Category(store_id=store.id, name="Tout", slug="all", display_order=0)
        cat_wax = Category(store_id=store.id, name="Robes Ankara", slug="robes-ankara", display_order=1)
        cat_tech = Category(store_id=store.id, name="Smartphones & Accessoires", slug="smartphones-accessoires", display_order=2)
        cat_bijoux = Category(store_id=store.id, name="Bijoux & Parfums", slug="bijoux-parfums", display_order=3)
        cat_promo = Category(store_id=store.id, name="Packs Promo", slug="packs-promo", display_order=4)
        db.add_all([cat_all, cat_wax, cat_tech, cat_bijoux, cat_promo])
        db.flush()

        # 6. Products
        # 6.1 Hero Product: Samsung Galaxy A15 128Go
        p_galaxy = Product(
            store_id=store.id,
            category_id=cat_tech.id,
            name="Samsung Galaxy A15 128Go",
            slug="samsung-galaxy-a15-128go",
            description="Écran Super AMOLED 90Hz 6.5 pouces, Triple caméra 50MP haute résolution, Batterie longue autonomie 5000mAh avec charge rapide 25W, Double SIM 4G LTE.",
            short_description="Écran Super AMOLED 90Hz, Caméra 50MP, Batterie 5000mAh, Double SIM 4G.",
            price=85000,
            old_price=98000,
            currency="FCFA",
            stock=3,
            stock_label="Plus que 3 en stock !",
            is_hero_deal=True,
            badge_tag="Top Vente High-Tech",
            active_discussions_count=24,
            views_count=763,
            sales_count=37,
            revenue=3145000,
            guarantee_text="Garantie 12 Mois",
            primary_image_url="/media/products/samsung_galaxy_a15.jpg",
            display_order=0,
        )
        db.add(p_galaxy)
        db.flush()

        # Variants for Galaxy
        galaxy_variants = [
            ProductVariant(product_id=p_galaxy.id, group_name="Coloris", name="Bleu Nuit", is_default=True, display_order=1),
            ProductVariant(product_id=p_galaxy.id, group_name="Coloris", name="Noir Chic", is_default=False, display_order=2),
            ProductVariant(product_id=p_galaxy.id, group_name="Coloris", name="Bleu Ciel", is_default=False, display_order=3),
            ProductVariant(product_id=p_galaxy.id, group_name="Coloris", name="Or Jaune", is_default=False, display_order=4),
        ]
        db.add_all(galaxy_variants)

        # 6.2 Robe Ankara Reine Sika
        p_robe = Product(
            store_id=store.id,
            category_id=cat_wax.id,
            name="Robe Ankara \"Reine Sika\" Évasée",
            slug="robe-ankara-reine-sika",
            description="Tissu 100% Coton Wax hollandais véritable, coupe princesse ajustable avec ceinture intégrée, finitions coutures royales (Tailles disponibles : M, L, XL, XXL).",
            short_description="Tissu 100% Coton Wax hollandais véritable, coupe princesse ajustable (Tailles M à XXL).",
            price=25000,
            old_price=30000,
            currency="FCFA",
            stock=2,
            stock_label="Reste 2",
            is_hero_deal=False,
            badge_tag="Création Originale",
            active_discussions_count=18,
            views_count=427,
            sales_count=29,
            revenue=1015000,
            guarantee_text="Coton Garanti",
            primary_image_url="/media/products/robe_ankara_reine_sika.jpg",
            display_order=1,
        )
        db.add(p_robe)

        # 6.3 Coffret Chic Parure & Écouteurs
        p_coffret = Product(
            store_id=store.id,
            category_id=cat_promo.id,
            name="Coffret Chic : Parure Or 18k + Écouteurs ANC",
            slug="coffret-chic-parure-ecouteurs",
            description="L'alliance sublime de l'orfèvrerie artisanale et de la technologie audio sans fil avec réduction de bruit active. Le cadeau d'excellence.",
            short_description="L'alliance parfaite de l'élégance et du son haute fidélité. Idéal pour offrir.",
            price=35000,
            old_price=45000,
            currency="FCFA",
            stock=8,
            stock_label="En Stock",
            is_hero_deal=False,
            badge_tag="Pack Duo Cadeau",
            active_discussions_count=41,
            views_count=512,
            sales_count=14,
            revenue=490000,
            guarantee_text="Garantie 6 Mois",
            primary_image_url="/media/products/coffret_parure_ecouteurs.jpg",
            display_order=2,
        )
        db.add(p_coffret)

        # 6.4 Tailleur Veste Ankara Babi Boss
        p_tailleur = Product(
            store_id=store.id,
            category_id=cat_wax.id,
            name="Tailleur Veste Ankara \"Babi Boss\"",
            slug="tailleur-veste-ankara-babi-boss",
            description="Coupe contemporaine cintrée pour femme active, finitions doublées en satin de soie, col velours élégant résistant.",
            short_description="Coupe contemporaine cintrée, finitions doublées en satin, col velours élégant.",
            price=32000,
            old_price=40000,
            currency="FCFA",
            stock=1,
            stock_label="Plus que 1 !",
            is_hero_deal=False,
            badge_tag="Édition Limitée",
            active_discussions_count=11,
            views_count=310,
            sales_count=12,
            revenue=384000,
            guarantee_text="Sur Mesure",
            primary_image_url="/media/products/tailleur_veste_babi_boss.jpg",
            display_order=3,
        )
        db.add(p_tailleur)

        # Additional products for inventory & stats
        p_casque = Product(
            store_id=store.id,
            category_id=cat_tech.id,
            name="Casque Bluetooth Pro",
            slug="casque-bluetooth-pro",
            description="Son spatialisé ultra immersif et réduction active du bruit ambiant.",
            price=35000,
            stock=5,
            primary_image_url="/media/products/casque_bluetooth_pro.jpg",
            display_order=4,
        )
        p_pagne = Product(
            store_id=store.id,
            category_id=cat_wax.id,
            name="Pagne Wax Authentique",
            slug="pagne-wax-authentique",
            description="Pagne traditionnel 6 yards en coton ciré haut de gamme.",
            price=22000,
            stock=10,
            primary_image_url="/media/products/pagne_wax_authentique.jpg",
            display_order=5,
        )
        p_montre = Product(
            store_id=store.id,
            category_id=cat_tech.id,
            name="Montre Connectée S3",
            slug="montre-connectee-s3",
            description="Écran AMOLED tactile, suivi cardiaque et notifications instantanées.",
            price=45000,
            stock=4,
            primary_image_url="/media/products/montre_connectee_s3.jpg",
            display_order=6,
        )
        p_ecouteurs = Product(
            store_id=store.id,
            category_id=cat_tech.id,
            name="Écouteurs Pro TWS",
            slug="ecouteurs-pro-tws",
            description="Stéréo sans fil, boitier de charge rapide magnétique.",
            price=15000,
            stock=7,
            sales_count=21,
            revenue=315000,
            primary_image_url="/media/products/ecouteurs_pro_tws.jpg",
            display_order=7,
        )
        p_bague = Product(
            store_id=store.id,
            category_id=cat_bijoux.id,
            name="Bague Saphir Royale & Or Blanc",
            slug="bague-saphir-royale-or-blanc",
            description="Bague de haute joaillerie sertie d'un saphir bleu royal 2.5 carats et or blanc 18k avec certificat d'authenticité.",
            short_description="Saphir bleu royal 2.5 carats et or blanc 18k certifié.",
            price=65000,
            old_price=78000,
            currency="FCFA",
            stock=4,
            stock_label="Plus que 4",
            badge_tag="Bijou Précieux",
            active_discussions_count=19,
            views_count=340,
            sales_count=9,
            revenue=585000,
            guarantee_text="Certificat Or 18k",
            primary_image_url="/media/products/coffret_parure_ecouteurs.jpg",
            display_order=8,
        )
        p_parfum = Product(
            store_id=store.id,
            category_id=cat_bijoux.id,
            name="Parfum Nuit d'Orient & Ambre",
            slug="parfum-ambre-royal",
            description="Fragrance orientale d'exception aux notes d'ambre précieux, fleur d'oranger et bois de santal. Tenue garantie 48h.",
            short_description="Fragrance orientale ambrée d'exception, tenue 48h.",
            price=38000,
            old_price=45000,
            currency="FCFA",
            stock=6,
            stock_label="En stock",
            badge_tag="Fragrance d'Élite",
            active_discussions_count=15,
            views_count=290,
            sales_count=8,
            revenue=304000,
            guarantee_text="Authentique",
            primary_image_url="/media/products/coffret_parure_ecouteurs.jpg",
            display_order=9,
        )
        db.add_all([p_casque, p_pagne, p_montre, p_ecouteurs, p_bague, p_parfum])
        db.flush()

        # 7. Store Channels
        channels = [
            StoreChannel(
                store_id=store.id,
                channel_type="WHATSAPP",
                display_title="WhatsApp Direct",
                badge_text="RECOMMANDÉ",
                badge_style="primary",
                account_handle="2250700000000",
                subtitle="Réponse moyenne en < 3 minutes",
                icon_name="chat",
                theme_color="#25D366",
                is_active=True,
                is_recommended=True,
                display_order=1
            ),
            StoreChannel(
                store_id=store.id,
                channel_type="MESSENGER",
                display_title="Messenger",
                badge_text="Page Officielle",
                badge_style="info",
                account_handle="awachic",
                subtitle="Messagerie Facebook certifiée",
                icon_name="forum",
                theme_color="#0084FF",
                is_active=True,
                is_recommended=False,
                display_order=2
            ),
            StoreChannel(
                store_id=store.id,
                channel_type="TIKTOK",
                display_title="TikTok Message",
                badge_text="@awachic",
                badge_style="danger",
                account_handle="@awachic",
                subtitle="Discussion avec la créatrice",
                icon_name="smart_display",
                theme_color="#FE2C55",
                is_active=True,
                is_recommended=False,
                display_order=3
            ),
            StoreChannel(
                store_id=store.id,
                channel_type="CALL",
                display_title="Appel Direct",
                badge_text=None,
                badge_style=None,
                account_handle="+225 07 00 11 22 33",
                subtitle="Ligne Standard Appels Directs",
                icon_name="phone_in_talk",
                theme_color="#ff5733",
                is_active=True,
                is_recommended=False,
                display_order=4
            ),
            StoreChannel(
                store_id=store.id,
                channel_type="SMS",
                display_title="SMS Direct",
                badge_text="Messagerie",
                badge_style="secondary",
                account_handle="+225 07 00 44 55 66",
                subtitle="Messagerie SMS instantanée",
                icon_name="sms",
                theme_color="#8084ff",
                is_active=True,
                is_recommended=False,
                display_order=5
            ),
        ]
        db.add_all(channels)
        db.flush()

        ch_wa = channels[0]

        # 8. Seed Active 24h Order Intent for Verification Card (Screen 3)
        # CMD-8F29A1 created 23h40 ago!
        intent_urgent = OrderIntent(
            reference_code="CMD-8F29A1",
            store_id=store.id,
            product_id=p_galaxy.id,
            channel_id=ch_wa.id,
            channel_type="WHATSAPP",
            customer_name="Amadou K.",
            customer_phone="+225 07 48 ••",
            customer_source="TIKTOK",
            quantity=1,
            selected_color="Bleu Nuit",
            delivery_city="Cocody (Abidjan)",
            unit_price=85000,
            total_amount=85000,
            currency="FCFA",
            status="PENDING_24H",
            is_urgent_followup=True,
            created_at=datetime.utcnow() - timedelta(hours=23, minutes=40),
            redirected_at=datetime.utcnow() - timedelta(hours=23, minutes=40),
        )
        db.add(intent_urgent)
        db.flush()

        followup_urgent = FollowUpTask(
            order_intent_id=intent_urgent.id,
            secure_token="token_8f29a1_demo",
            scheduled_for=datetime.utcnow() + timedelta(minutes=20),
            status="READY",
        )
        db.add(followup_urgent)

        # Recent feed intents (Screen 3 flux)
        it_casque = OrderIntent(
            reference_code="CMD-7A12C3",
            store_id=store.id,
            product_id=p_casque.id,
            channel_type="MESSENGER",
            customer_name="Salif T.",
            customer_source="INSTAGRAM",
            quantity=1,
            unit_price=35000,
            total_amount=35000,
            currency="FCFA",
            status="REDIRECTED",
            created_at=datetime.utcnow() - timedelta(minutes=15),
        )
        it_pagne = OrderIntent(
            reference_code="CMD-5B88D9",
            store_id=store.id,
            product_id=p_pagne.id,
            channel_type="WHATSAPP",
            customer_name="Aïssata B.",
            customer_source="WHATSAPP",
            quantity=1,
            unit_price=22000,
            total_amount=22000,
            currency="FCFA",
            status="CREATED",
            created_at=datetime.utcnow() - timedelta(hours=5),
        )
        it_montre = OrderIntent(
            reference_code="CMD-9C44E1",
            store_id=store.id,
            product_id=p_montre.id,
            channel_type="TIKTOK",
            customer_name="Marc K.",
            customer_source="TIKTOK",
            quantity=1,
            unit_price=45000,
            total_amount=45000,
            currency="FCFA",
            status="SOLD",
            created_at=datetime.utcnow() - timedelta(hours=14),
        )
        db.add_all([it_casque, it_pagne, it_montre])

        # 9. Traffic Sources (Screen 4)
        sources = [
            TrafficSource(store_id=store.id, source_name="TikTok Bio", source_code="tiktok_bio", percentage=45.0, visits_count=5779, color_hex="#ff5733", display_order=1),
            TrafficSource(store_id=store.id, source_name="FB Post", source_code="fb_post", percentage=35.0, visits_count=4495, color_hex="#6366f1", display_order=2),
            TrafficSource(store_id=store.id, source_name="Statut WA", source_code="wa_status", percentage=20.0, visits_count=2569, color_hex="#10b981", display_order=3),
        ]
        db.add_all(sources)

        db.commit()
        print("Database initialized and fully seeded with zero mock data!")

    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
