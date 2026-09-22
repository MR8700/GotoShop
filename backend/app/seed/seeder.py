from datetime import datetime, timedelta
import uuid
from app.database import SessionLocal, Base, engine
from app.core.security import hash_password
from app.models import (
    Owner, Store, TrustBadge, DeliveryCity,
    Category, Product, ProductVariant, ProductImage,
    StoreChannel, OrderIntent, FollowUpTask, SaleConfirmation,
    TrafficSource, ShareLink
)
from app.models.customer import Customer
from app.models.super_admin import SuperAdmin
from app.models.store import LoyaltyTier

def seed_database():
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        # =====================================================================
        # 0. SUPER ADMINISTRATEUR PLATFORM
        # =====================================================================
        for email in ["admin@gotoshop.com", "admin@conversastore.com"]:
            existing_sa = db.query(SuperAdmin).filter(SuperAdmin.email == email).first()
            pwd_hash, salt = hash_password("SuperAdmin2026!")
            if not existing_sa:
                sa = SuperAdmin(
                    id=str(uuid.uuid4()),
                    email=email,
                    full_name="Super Administrateur GotoShop",
                    password_hash=pwd_hash,
                    password_salt=salt,
                    created_at=datetime.utcnow()
                )
                db.add(sa)
            else:
                existing_sa.password_hash = pwd_hash
                existing_sa.password_salt = salt
        db.flush()

        # =====================================================================
        # 1. BOUTIQUE 1 : FASO DANFANI & ÉLÉGANCE (Ouagadougou, Burkina Faso)
        # =====================================================================
        owner_1 = db.query(Owner).filter(Owner.email == "mariam.kabore@fasodanfani.bf").first()
        pwd_hash_1, salt_1 = hash_password("FasoDanfani2026!")
        if not owner_1:
            owner_1 = Owner(
                full_name="Mariam Kaboré",
                email="mariam.kabore@fasodanfani.bf",
                phone_number="+22670123456",
                bio="Styliste burkinabè et artisane passionnée. Valorisation du Faso Danfani et du Kôkô Dunda à Ouagadougou.",
                password_hash=pwd_hash_1,
                password_salt=salt_1,
                must_change_password=False
            )
            db.add(owner_1)
            db.flush()
        else:
            owner_1.password_hash = pwd_hash_1
            owner_1.password_salt = salt_1
            owner_1.must_change_password = False

        store_1 = db.query(Store).filter(Store.slug == "faso-danfani").first()
        if not store_1:
            store_1 = Store(
                owner_id=owner_1.id,
                name="Faso Danfani & Élégance",
                slug="faso-danfani",
                tagline="L'excellence du textile noble et du pagne tissé burkinabè",
                description="Maison de haute couture et de confection artisanale en pagne Faso Danfani authentique tissé à la main au Burkina Faso. Livraison express à Ouagadougou, Bobo-Dioulasso et international.",
                owner_bio="Créatrice burkinabè à Ouagadougou (Ouaga 2000). Nos étoffes de coton 100% bio sont tissées à la main par nos maîtres tisserands.",
                currency="FCFA",
                logo_url="/media/store/logo.jpg",
                avatar_url="/media/store/awa_portrait.jpg",
                rating=4.95,
                sales_count=485,
                revenue=14250000,
                is_verified=True,
                social_tunnel_badge="WA/FB",
                social_tunnel_label="Tunnel Social Actif",
                is_flash_active=True,
                flash_title="Vente Spéciale Faso Danfani",
                flash_subtitle="Ouagadougou & Bobo • Livraison en 2h chrono",
                flash_remaining_seconds=14200,
                voice_note_title="Besoin d'un conseil taille ou tissu ?",
                voice_note_subtitle="Mariam Kaboré vous conseille personnellement en audio ou vidéo WhatsApp.",
                primary_color="#ec761e",
                secondary_color="#10b981",
                theme_preset="kinetic_amber",
                is_custom_theme_active=True,
                is_loyalty_active=True,
                loyalty_spend_per_point=1000,
                subscription_status="ACTIVE",
                subscription_plan="VIP",
                custom_domain="fasodanfani.bf",
                contact_whatsapp="+22670123456",
                contact_email="mariam.kabore@fasodanfani.bf",
            )
            db.add(store_1)
            db.flush()

            # Trust Badges
            db.add_all([
                TrustBadge(store_id=store_1.id, icon_name="verified", label="100% Tissé Main BF", badge_type="primary", display_order=1),
                TrustBadge(store_id=store_1.id, icon_name="local_shipping", label="Paiement Livraison", badge_type="secondary", display_order=2),
                TrustBadge(store_id=store_1.id, icon_name="handshake", label="Vente Directe Atelier", badge_type="secondary-fixed", display_order=3),
            ])

            # Delivery Cities
            db.add_all([
                DeliveryCity(store_id=store_1.id, name="Ouagadougou (Ouaga 2000, Koulouba, Dassasgho)", display_label="📍 Ouaga", is_default=True, display_order=1),
                DeliveryCity(store_id=store_1.id, name="Bobo-Dioulasso (Belleville, Farakan)", display_label="Bobo", is_default=False, display_order=2),
                DeliveryCity(store_id=store_1.id, name="Koudougou", display_label="Koudougou", is_default=False, display_order=3),
                DeliveryCity(store_id=store_1.id, name="Abidjan (Côte d'Ivoire)", display_label="Abidjan", is_default=False, display_order=4),
                DeliveryCity(store_id=store_1.id, name="Bamako (Mali)", display_label="Bamako", is_default=False, display_order=5),
            ])

            # Categories
            cat_all_1 = Category(store_id=store_1.id, name="Tout", slug="all", display_order=0)
            cat_danfani_1 = Category(store_id=store_1.id, name="Pagnes Faso Danfani", slug="pagnes-faso-danfani", display_order=1)
            cat_koko_1 = Category(store_id=store_1.id, name="Ensembles Kôkô Dunda", slug="ensembles-koko-dunda", display_order=2)
            cat_robes_1 = Category(store_id=store_1.id, name="Robes de Cérémonie", slug="robes-ceremonie", display_order=3)
            cat_accessoires_1 = Category(store_id=store_1.id, name="Écharpes & Accessoires", slug="echarpes-accessoires", display_order=4)
            db.add_all([cat_all_1, cat_danfani_1, cat_koko_1, cat_robes_1, cat_accessoires_1])
            db.flush()

            # Products
            p1_1 = Product(
                store_id=store_1.id,
                category_id=cat_danfani_1.id,
                name="Pagne Faso Danfani Traditionnel Tissé Main (3 pièces)",
                slug="pagne-faso-danfani-traditionnel-3-pieces",
                description="Véritable Faso Danfani en pur coton burkinabè, tissé selon la tradition séculaire. Étoffe lourde, texture noble, teintes naturelles d'indigo et terre sahélienne. Parfait pour les grandes cérémonies et tenues d'apparat.",
                short_description="100% pur coton burkinabè, 3 pièces complètes tissées main à Koudougou.",
                price=45000,
                old_price=55000,
                currency="FCFA",
                stock=8,
                stock_label="Reste 8 pièces tissées",
                is_hero_deal=True,
                badge_tag="Patrimoine National",
                active_discussions_count=32,
                views_count=1240,
                sales_count=64,
                revenue=2880000,
                guarantee_text="100% Coton Pur Tissé",
                primary_image_url="/media/products/pagne_wax_authentique.jpg",
                display_order=0,
            )
            p1_2 = Product(
                store_id=store_1.id,
                category_id=cat_koko_1.id,
                name="Ensemble Veste & Pantalon Kôkô Dunda Royal",
                slug="ensemble-veste-koko-dunda-royal",
                description="Ensemble moderne haut de gamme confectionné avec le célèbre Kôkô Dunda teinté à Bobo-Dioulasso. Coupe contemporaine pour homme et femme d'affaires, doublure en satin de soie.",
                short_description="Kôkô Dunda authentique de Bobo, coupe élégante contemporaine.",
                price=35000,
                old_price=42000,
                currency="FCFA",
                stock=5,
                stock_label="Plus que 5",
                is_hero_deal=False,
                badge_tag="Tendance Bobo",
                active_discussions_count=21,
                views_count=820,
                sales_count=43,
                revenue=1505000,
                guarantee_text="Teinture Grand Teint",
                primary_image_url="/media/products/tailleur_veste_babi_boss.jpg",
                display_order=1,
            )
            p1_3 = Product(
                store_id=store_1.id,
                category_id=cat_robes_1.id,
                name="Robe Sirène Faso Danfani \"Princesse Yennenga\"",
                slug="robe-sirene-faso-danfani-yennenga",
                description="Sublime création couture épousant la silhouette, alliance du Faso Danfani fin et de dentelle noire précieuse. Finitions haute couture pour galas, mariages et réceptions.",
                short_description="Coupe sirène impériale, Faso Danfani fin et dentelle noble.",
                price=38000,
                old_price=48000,
                currency="FCFA",
                stock=4,
                stock_label="Création Limitée",
                is_hero_deal=False,
                badge_tag="Haute Couture",
                active_discussions_count=18,
                views_count=650,
                sales_count=29,
                revenue=1102000,
                guarantee_text="Couture Garantie",
                primary_image_url="/media/products/robe_ankara_reine_sika.jpg",
                display_order=2,
            )
            p1_4 = Product(
                store_id=store_1.id,
                category_id=cat_accessoires_1.id,
                name="Écharpe d'Honneur Tissée Faso Danfani",
                slug="echarpe-honneur-tissee-faso-danfani",
                description="Écharpe officielle de prestige aux couleurs du Burkina Faso ou motifs royaux géométriques. Idéale pour les réceptions, cadeaux officiels ou parure élégante au quotidien.",
                short_description="Écharpe de prestige tissée main, finitions à franges traditionnelles.",
                price=12000,
                old_price=15000,
                currency="FCFA",
                stock=15,
                stock_label="En stock",
                is_hero_deal=False,
                badge_tag="Cadeau de Prestige",
                active_discussions_count=12,
                views_count=430,
                sales_count=52,
                revenue=624000,
                guarantee_text="Authentique Artisanal",
                primary_image_url="/media/products/coffret_parure_ecouteurs.jpg",
                display_order=3,
            )
            db.add_all([p1_1, p1_2, p1_3, p1_4])
            db.flush()

            # Variants
            db.add_all([
                ProductVariant(product_id=p1_1.id, group_name="Teinte", name="Bleu Indigo Royal", is_default=True, display_order=1),
                ProductVariant(product_id=p1_1.id, group_name="Teinte", name="Blanc Cassé & Ocre", is_default=False, display_order=2),
                ProductVariant(product_id=p1_1.id, group_name="Teinte", name="Rouge Terre Sahélienne", is_default=False, display_order=3),
                ProductVariant(product_id=p1_2.id, group_name="Taille", name="M (40-42)", is_default=False, display_order=1),
                ProductVariant(product_id=p1_2.id, group_name="Taille", name="L (44-46)", is_default=True, display_order=2),
                ProductVariant(product_id=p1_2.id, group_name="Taille", name="XL (48-50)", is_default=False, display_order=3),
            ])

            # Channels
            db.add_all([
                StoreChannel(
                    store_id=store_1.id,
                    channel_type="WHATSAPP",
                    display_title="WhatsApp Direct",
                    badge_text="RECOMMANDÉ",
                    badge_style="primary",
                    account_handle="22670123456",
                    subtitle="Réponse moyenne en moins de 3 minutes",
                    icon_name="chat",
                    theme_color="#25D366",
                    is_active=True,
                    is_recommended=True,
                    display_order=1
                ),
                StoreChannel(
                    store_id=store_1.id,
                    channel_type="MESSENGER",
                    display_title="Messenger Facebook",
                    badge_text="Page Officielle",
                    badge_style="info",
                    account_handle="fasodanfanielegance",
                    subtitle="Messagerie Facebook certifiée",
                    icon_name="forum",
                    theme_color="#0084FF",
                    is_active=True,
                    is_recommended=False,
                    display_order=2
                ),
                StoreChannel(
                    store_id=store_1.id,
                    channel_type="TIKTOK",
                    display_title="TikTok Direct",
                    badge_text="@fasodanfani",
                    badge_style="danger",
                    account_handle="@fasodanfani",
                    subtitle="Vidéos des coulisses de tissage",
                    icon_name="smart_display",
                    theme_color="#FE2C55",
                    is_active=True,
                    is_recommended=False,
                    display_order=3
                ),
                StoreChannel(
                    store_id=store_1.id,
                    channel_type="CALL",
                    display_title="Appel Direct Ouaga",
                    badge_text="Atelier",
                    badge_style="secondary",
                    account_handle="+226 70 12 34 56",
                    subtitle="Ligne directe Mariam Kaboré",
                    icon_name="phone_in_talk",
                    theme_color="#ff5733",
                    is_active=True,
                    is_recommended=False,
                    display_order=4
                ),
            ])

            # Loyalty Tiers
            db.add_all([
                LoyaltyTier(
                    store_id=store_1.id,
                    name="Bronze Faso",
                    min_points=0,
                    badge_label="Découverte",
                    perk_title="Conseils personnalisés de Mariam",
                    perk_description="Accès direct par audio ou vidéo WhatsApp pour vos commandes sur mesure.",
                    discount_percent=0,
                    is_active=True,
                    display_order=1
                ),
                LoyaltyTier(
                    store_id=store_1.id,
                    name="Silver Danfani",
                    min_points=50,
                    badge_label="Privilège",
                    perk_title="Livraison Express Gratuite à Ouaga & Bobo",
                    perk_description="Expédition prioritaire sous 2h et remise de 5% sur tout le catalogue.",
                    discount_percent=5,
                    is_active=True,
                    display_order=2
                ),
                LoyaltyTier(
                    store_id=store_1.id,
                    name="Gold Élite Yennenga",
                    min_points=150,
                    badge_label="Grand Élite",
                    perk_title="10% de remise permanente & Arrivages Privés",
                    perk_description="Accès exclusif aux pièces uniques tissées avant leur publication en vitrine.",
                    discount_percent=10,
                    is_active=True,
                    display_order=3
                ),
            ])

        # =====================================================================
        # 2. BOUTIQUE 2 : OUAGA TECH & GADGETS (Ouagadougou, Burkina Faso)
        # =====================================================================
        owner_2 = db.query(Owner).filter(Owner.email == "ousmane.ouedraogo@ouagatech.bf").first()
        pwd_hash_2, salt_2 = hash_password("OuagaTech2026!")
        if not owner_2:
            owner_2 = Owner(
                full_name="Ousmane Ouédraogo",
                email="ousmane.ouedraogo@ouagatech.bf",
                phone_number="+22676987654",
                bio="Expert en téléphonie mobile et solutions high-tech à Ouagadougou. Produits certifiés neufs avec garantie locale.",
                password_hash=pwd_hash_2,
                password_salt=salt_2,
                must_change_password=False
            )
            db.add(owner_2)
            db.flush()
        else:
            owner_2.password_hash = pwd_hash_2
            owner_2.password_salt = salt_2
            owner_2.must_change_password = False

        store_2 = db.query(Store).filter(Store.slug == "ouaga-tech").first()
        if not store_2:
            store_2 = Store(
                owner_id=owner_2.id,
                name="Ouaga Tech & Gadgets",
                slug="ouaga-tech",
                tagline="Smartphones certifiés & High-Tech garanti à Ouagadougou",
                description="Boutique d'équipements technologiques neufs et certifiés : smartphones avec garantie 12 mois, écouteurs sans fil haute fidélité, montres connectées et chargeurs solaires.",
                owner_bio="Gérant d'Ouaga Tech à Zogona. Tous nos téléphones et accessoires sont authentiques et testés avec soin.",
                currency="FCFA",
                logo_url="/media/products/samsung_galaxy_a15.jpg",
                avatar_url="/media/products/samsung_galaxy_a15_thumb.jpg",
                rating=4.88,
                sales_count=612,
                revenue=21540000,
                is_verified=True,
                social_tunnel_badge="WA/FB",
                social_tunnel_label="Tunnel Social Actif",
                is_flash_active=True,
                flash_title="Promo Smartphones 4G/5G",
                flash_subtitle="Garantie 12 mois • Livraison moto gratuite à Ouaga",
                flash_remaining_seconds=9800,
                voice_note_title="Besoin d'aide pour choisir votre smartphone ?",
                voice_note_subtitle="Ousmane vous répond instantanément sur WhatsApp avec conseils techniques.",
                primary_color="#2563eb",
                secondary_color="#10b981",
                theme_preset="kinetic_blue",
                is_custom_theme_active=True,
                is_loyalty_active=True,
                loyalty_spend_per_point=1000,
                subscription_status="ACTIVE",
                subscription_plan="PRO",
                custom_domain="ouagatech.bf",
                contact_whatsapp="+22676987654",
                contact_email="ousmane.ouedraogo@ouagatech.bf",
            )
            db.add(store_2)
            db.flush()

            # Trust Badges
            db.add_all([
                TrustBadge(store_id=store_2.id, icon_name="verified_user", label="Garantie 12 Mois", badge_type="primary", display_order=1),
                TrustBadge(store_id=store_2.id, icon_name="local_shipping", label="Livraison Express Ouaga", badge_type="secondary", display_order=2),
                TrustBadge(store_id=store_2.id, icon_name="price_check", label="Paiement Après Test", badge_type="secondary-fixed", display_order=3),
            ])

            # Delivery Cities
            db.add_all([
                DeliveryCity(store_id=store_2.id, name="Ouagadougou (Zogona, 1200 Logements, Koulouba)", display_label="📍 Ouaga", is_default=True, display_order=1),
                DeliveryCity(store_id=store_2.id, name="Bobo-Dioulasso", display_label="Bobo", is_default=False, display_order=2),
                DeliveryCity(store_id=store_2.id, name="Ouahigouya", display_label="Ouahigouya", is_default=False, display_order=3),
                DeliveryCity(store_id=store_2.id, name="Koudougou", display_label="Koudougou", is_default=False, display_order=4),
            ])

            # Categories
            cat_all_2 = Category(store_id=store_2.id, name="Tout", slug="all", display_order=0)
            cat_smartphones_2 = Category(store_id=store_2.id, name="Smartphones Neufs", slug="smartphones-neufs", display_order=1)
            cat_audio_2 = Category(store_id=store_2.id, name="Audio & Écouteurs TWS", slug="audio-ecouteurs", display_order=2)
            cat_montres_2 = Category(store_id=store_2.id, name="Montres Connectées", slug="montres-connectees", display_order=3)
            cat_energie_2 = Category(store_id=store_2.id, name="Énergie & Solaire", slug="energie-solaire", display_order=4)
            db.add_all([cat_all_2, cat_smartphones_2, cat_audio_2, cat_montres_2, cat_energie_2])
            db.flush()

            # Products
            p2_1 = Product(
                store_id=store_2.id,
                category_id=cat_smartphones_2.id,
                name="Samsung Galaxy A15 128Go (Garanti 12 Mois)",
                slug="samsung-galaxy-a15-ouagatech",
                description="Écran Super AMOLED 90Hz 6.5 pouces, Triple caméra 50MP haute résolution, Batterie longue autonomie 5000mAh avec charge rapide 25W, Double SIM 4G LTE. Produit original scellé.",
                short_description="Super AMOLED 90Hz, Caméra 50MP, Batterie 5000mAh, Garantie 12 mois.",
                price=85000,
                old_price=98000,
                currency="FCFA",
                stock=6,
                stock_label="En stock à Ouaga",
                is_hero_deal=True,
                badge_tag="Meilleure Vente",
                active_discussions_count=45,
                views_count=1890,
                sales_count=82,
                revenue=6970000,
                guarantee_text="Garantie 12 Mois",
                primary_image_url="/media/products/samsung_galaxy_a15.jpg",
                display_order=0,
            )
            p2_2 = Product(
                store_id=store_2.id,
                category_id=cat_audio_2.id,
                name="Écouteurs Pro TWS Sans Fil Réduction Active de Bruit",
                slug="ecouteurs-pro-tws-ouagatech",
                description="Son spatialisé immersif avec basses profondes, réduction active du bruit ambiant (ANC), autonomie 32h avec boîtier de charge sans fil. Compatible Android et iPhone.",
                short_description="Réduction active du bruit, 32h d'autonomie, son haute fidélité.",
                price=18000,
                old_price=24000,
                currency="FCFA",
                stock=12,
                stock_label="En stock",
                is_hero_deal=False,
                badge_tag="Son Spatialisé",
                active_discussions_count=19,
                views_count=610,
                sales_count=54,
                revenue=972000,
                guarantee_text="Garantie 6 Mois",
                primary_image_url="/media/products/ecouteurs_pro_tws.jpg",
                display_order=1,
            )
            p2_3 = Product(
                store_id=store_2.id,
                category_id=cat_montres_2.id,
                name="Montre Connectée S3 AMOLED Fitness & WhatsApp",
                slug="montre-connectee-s3-ouagatech",
                description="Écran AMOLED lumineux tactile avec appels Bluetooth directs, lecture des notifications WhatsApp en direct, cardiofréquencemètre et étanchéité IP68.",
                short_description="Écran AMOLED, appels Bluetooth, notifications WhatsApp, étanche IP68.",
                price=38000,
                old_price=45000,
                currency="FCFA",
                stock=5,
                stock_label="Plus que 5",
                is_hero_deal=False,
                badge_tag="Top Tendance",
                active_discussions_count=14,
                views_count=480,
                sales_count=31,
                revenue=1178000,
                guarantee_text="Garantie 6 Mois",
                primary_image_url="/media/products/montre_connectee_s3.jpg",
                display_order=2,
            )
            p2_4 = Product(
                store_id=store_2.id,
                category_id=cat_energie_2.id,
                name="PowerBank Solaire Ultra-Rapide 30 000 mAh",
                slug="powerbank-solaire-30000mah-ouagatech",
                description="Batterie externe géante 30 000mAh avec capteur solaire d'urgence, 4 ports de sortie rapide USB-C Power Delivery 22.5W et lampe torche LED puissante pour le délestage.",
                short_description="30 000mAh, recharge solaire intégrée, USB-C 22.5W, torche de secours.",
                price=22000,
                old_price=28000,
                currency="FCFA",
                stock=14,
                stock_label="Indispensable Ouaga",
                is_hero_deal=False,
                badge_tag="Autonomie Sahélienne",
                active_discussions_count=28,
                views_count=920,
                sales_count=71,
                revenue=1562000,
                guarantee_text="Garantie 6 Mois",
                primary_image_url="/media/products/samsung_galaxy_a15_thumb.jpg",
                display_order=3,
            )
            db.add_all([p2_1, p2_2, p2_3, p2_4])
            db.flush()

            # Channels
            db.add(StoreChannel(
                store_id=store_2.id,
                channel_type="WHATSAPP",
                display_title="WhatsApp Ouaga Tech",
                badge_text="CONSEILS EN DIRECT",
                badge_style="primary",
                account_handle="22676987654",
                subtitle="Réponse instantanée par Ousmane",
                icon_name="chat",
                theme_color="#25D366",
                is_active=True,
                is_recommended=True,
                display_order=1
            ))

        # =====================================================================
        # 3. BOUTIQUE 3 : SYA BEAUTÉ & SOINS BIO (Bobo-Dioulasso, Burkina Faso)
        # =====================================================================
        owner_3 = db.query(Owner).filter(Owner.email == "fatoumata.traore@syabeaute.bf").first()
        pwd_hash_3, salt_3 = hash_password("SyaBeaute2026!")
        if not owner_3:
            owner_3 = Owner(
                full_name="Fatoumata Traoré",
                email="fatoumata.traore@syabeaute.bf",
                phone_number="+22678456789",
                bio="Ingénieure agronome et cosmétologue naturelle à Bobo-Dioulasso. Valorisation du karité sauvage et des plantes médicinales du Burkina Faso.",
                password_hash=pwd_hash_3,
                password_salt=salt_3,
                must_change_password=False
            )
            db.add(owner_3)
            db.flush()
        else:
            owner_3.password_hash = pwd_hash_3
            owner_3.password_salt = salt_3
            owner_3.must_change_password = False

        store_3 = db.query(Store).filter(Store.slug == "sya-beaute").first()
        if not store_3:
            store_3 = Store(
                owner_id=owner_3.id,
                name="Sya Beauté & Soins Bio",
                slug="sya-beaute",
                tagline="Cosmétiques purs au beurre de karité bio de Bobo-Dioulasso",
                description="Gamme de cosmétiques et soins du corps 100% naturels, confectionnés à base de beurre de karité sauvage bio de la région des Hauts-Bassins (Bobo-Dioulasso). Bienfaits nourrissants et réparateurs garantis.",
                owner_bio="Fondatrice de Sya Beauté à Bobo-Dioulasso (Belleville). Tous nos produits sont certifiés 100% bio et formulés sans produits chimiques.",
                currency="FCFA",
                logo_url="/media/products/coffret_parure_ecouteurs.jpg",
                avatar_url="/media/store/awa_portrait.jpg",
                rating=4.98,
                sales_count=528,
                revenue=8460000,
                is_verified=True,
                social_tunnel_badge="WA/FB",
                social_tunnel_label="Tunnel Social Actif",
                is_flash_active=True,
                flash_title="Promo Karité Bio Pur",
                flash_subtitle="Direct coopératives de Bobo • Livraison Ouaga & Bobo",
                flash_remaining_seconds=18400,
                voice_note_title="Besoin d'un diagnostic peau ou cheveux ?",
                voice_note_subtitle="Fatoumata vous conseille selon votre type de peau en audio WhatsApp.",
                primary_color="#059669",
                secondary_color="#f59e0b",
                theme_preset="kinetic_emerald",
                is_custom_theme_active=True,
                is_loyalty_active=True,
                loyalty_spend_per_point=1000,
                subscription_status="ACTIVE",
                subscription_plan="VIP",
                custom_domain="syabeaute.bf",
                contact_whatsapp="+22678456789",
                contact_email="fatoumata.traore@syabeaute.bf",
            )
            db.add(store_3)
            db.flush()

            # Trust Badges
            db.add_all([
                TrustBadge(store_id=store_3.id, icon_name="eco", label="100% Bio & Naturel", badge_type="primary", display_order=1),
                TrustBadge(store_id=store_3.id, icon_name="verified", label="Coopératives Bobo", badge_type="secondary", display_order=2),
                TrustBadge(store_id=store_3.id, icon_name="local_shipping", label="Paiement Livraison", badge_type="secondary-fixed", display_order=3),
            ])

            # Delivery Cities
            db.add_all([
                DeliveryCity(store_id=store_3.id, name="Bobo-Dioulasso (Belleville, Farakan, Bindougousso)", display_label="📍 Bobo", is_default=True, display_order=1),
                DeliveryCity(store_id=store_3.id, name="Ouagadougou (Point Relais & Livraison à domicile)", display_label="Ouaga", is_default=False, display_order=2),
                DeliveryCity(store_id=store_3.id, name="Banfora", display_label="Banfora", is_default=False, display_order=3),
                DeliveryCity(store_id=store_3.id, name="Bamako (Mali)", display_label="Bamako", is_default=False, display_order=4),
            ])

            # Categories
            cat_all_3 = Category(store_id=store_3.id, name="Tout", slug="all", display_order=0)
            cat_karite_3 = Category(store_id=store_3.id, name="Beurres de Karité Bio", slug="beurres-karite-bio", display_order=1)
            cat_savons_3 = Category(store_id=store_3.id, name="Savons Noirs Sahéliens", slug="savons-noirs", display_order=2)
            cat_huiles_3 = Category(store_id=store_3.id, name="Huiles Végétales Pures", slug="huiles-vegetales", display_order=3)
            cat_coffrets_3 = Category(store_id=store_3.id, name="Coffrets Soin Éclat", slug="coffrets-soin", display_order=4)
            db.add_all([cat_all_3, cat_karite_3, cat_savons_3, cat_huiles_3, cat_coffrets_3])
            db.flush()

            # Products
            p3_1 = Product(
                store_id=store_3.id,
                category_id=cat_karite_3.id,
                name="Beurre de Karité Brut Non Raffiné de Bobo (Pot 500g)",
                slug="beurre-de-karite-brut-bobo-500g",
                description="Beurre de karité sauvage d'excellence récolté et extrait artisanalement à froid par les femmes de Bobo-Dioulasso. Couleur ivoire naturelle, riche en vitamines A, E et F. Hydrate en profondeur la peau et nourrit les cheveux crépus et bouclés.",
                short_description="100% pur brut, extrait à froid à Bobo, pot familial 500g.",
                price=6500,
                old_price=8000,
                currency="FCFA",
                stock=25,
                stock_label="En stock frais",
                is_hero_deal=True,
                badge_tag="100% Bio Certifié",
                active_discussions_count=36,
                views_count=1450,
                sales_count=120,
                revenue=780000,
                guarantee_text="Origine Bobo Certifiée",
                primary_image_url="/media/products/coffret_parure_ecouteurs.jpg",
                display_order=0,
            )
            p3_2 = Product(
                store_id=store_3.id,
                category_id=cat_savons_3.id,
                name="Savon Noir Traditionnel au Karité & Miel Sauvage (Lot de 3)",
                slug="savon-noir-traditionnel-karite-miel",
                description="Savon noir surgras saponifié à froid aux cendres de cabosses de cacao et enrichi au miel sauvage du Burkina. Nettoie en douceur, purifie le teint et estompe les taches d'acné sans assécher.",
                short_description="Savon surgras au karité et miel sauvage, lot de 3 pains.",
                price=4500,
                old_price=6000,
                currency="FCFA",
                stock=30,
                stock_label="En stock",
                is_hero_deal=False,
                badge_tag="Anti-Taches Naturel",
                active_discussions_count=24,
                views_count=890,
                sales_count=95,
                revenue=427500,
                guarantee_text="Zéro Produit Chimique",
                primary_image_url="/media/products/pagne_wax_authentique.jpg",
                display_order=1,
            )
            p3_3 = Product(
                store_id=store_3.id,
                category_id=cat_huiles_3.id,
                name="Huile Végétale Pure de Sésame & Balanites (100ml)",
                slug="huile-sesame-balanites-100ml",
                description="Synergie d'huiles végétales précieuses pressées à froid au Burkina Faso : le sésame réparateur et le dattier du désert (Balanites) régénérant. Fini sec, ne colle pas.",
                short_description="Pressée à froid au Burkina, soin visage et pointes de cheveux.",
                price=5500,
                old_price=7000,
                currency="FCFA",
                stock=18,
                stock_label="En stock",
                is_hero_deal=False,
                badge_tag="Fini Soyeux",
                active_discussions_count=15,
                views_count=520,
                sales_count=48,
                revenue=264000,
                guarantee_text="100% Huiles Pures",
                primary_image_url="/media/products/tailleur_veste_babi_boss.jpg",
                display_order=2,
            )
            p3_4 = Product(
                store_id=store_3.id,
                category_id=cat_coffrets_3.id,
                name="Coffret Rituel Soin Éclat & Douceur Sahélienne",
                slug="coffret-rituel-soin-eclat-sahelienne",
                description="Le coffret complet pour une peau éclatante : 1 pot de karité pur 250g, 2 savons noirs au miel, 1 flacon d'huile de dattier du désert 50ml et 1 baume à lèvres protecteur offert.",
                short_description="Le rituel complet beauté naturelle de Bobo-Dioulasso.",
                price=18500,
                old_price=23000,
                currency="FCFA",
                stock=8,
                stock_label="Idéal Cadeau",
                is_hero_deal=False,
                badge_tag="Coffret Cadeau",
                active_discussions_count=29,
                views_count=780,
                sales_count=36,
                revenue=666000,
                guarantee_text="Gamme Complète Bio",
                primary_image_url="/media/products/coffret_parure_ecouteurs.jpg",
                display_order=3,
            )
            db.add_all([p3_1, p3_2, p3_3, p3_4])
            db.flush()

            # Channels
            db.add(StoreChannel(
                store_id=store_3.id,
                channel_type="WHATSAPP",
                display_title="WhatsApp Sya Beauté",
                badge_text="CONSEILS PEAU BIO",
                badge_style="primary",
                account_handle="22678456789",
                subtitle="Diagnostic beauté personnalisé par Fatoumata",
                icon_name="chat",
                theme_color="#25D366",
                is_active=True,
                is_recommended=True,
                display_order=1
            ))

        # =====================================================================
        # 4. REAL CLIENTS & ORDERS FOR ALL 3 STORES
        # =====================================================================
        real_customers = [
            {
                "name": "Kouamé Desiré",
                "phone": "+22507123456",
                "city": "Ouagadougou (Ouaga 2000)",
                "delivery_address": "Ouaga 2000, Zone des Ambassades, Rue 15.42",
                "gps_coordinates": "12.3168, -1.4921",
                "gps_location_url": "https://maps.google.com/?q=12.3168,-1.4921",
                "store_id": store_1.id
            },
            {
                "name": "Wendkouni Sawadogo",
                "phone": "+22670998877",
                "city": "Ouagadougou (Dassasgho)",
                "delivery_address": "Dassasgho, face Pharmacie de la Paix",
                "gps_coordinates": "12.3789, -1.4856",
                "gps_location_url": "https://maps.google.com/?q=12.3789,-1.4856",
                "store_id": store_1.id
            },
            {
                "name": "Aminata Sanogo",
                "phone": "+22676112233",
                "city": "Bobo-Dioulasso (Belleville)",
                "delivery_address": "Belleville, Secteur 21, à 200m du grand marché",
                "gps_coordinates": "11.1764, -4.2978",
                "gps_location_url": "https://maps.google.com/?q=11.1764,-4.2978",
                "store_id": store_3.id
            }
        ]

        for c_data in real_customers:
            existing_c = db.query(Customer).filter(Customer.phone == c_data["phone"]).first()
            if not existing_c:
                c_obj = Customer(
                    id=str(uuid.uuid4()),
                    store_id=c_data["store_id"],
                    name=c_data["name"],
                    phone=c_data["phone"],
                    city=c_data["city"],
                    delivery_address=c_data["delivery_address"],
                    gps_coordinates=c_data["gps_coordinates"],
                    gps_location_url=c_data["gps_location_url"],
                    preferred_channel="WHATSAPP",
                    session_token="token_" + secrets.token_hex(16)
                )
                db.add(c_obj)

        db.commit()
        print("Database fully seeded with real Burkinabè boutiques, authentic products, customers and SuperAdmin!")

    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    import secrets
    seed_database()
