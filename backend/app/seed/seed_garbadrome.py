import uuid
import json
from datetime import datetime, timedelta
from app.database import SessionLocal, Base, engine
from app.core.security import hash_password
from app.models import (
    Owner, Store, TrustBadge, DeliveryCity, LoyaltyTier,
    Category, Product, ProductVariant, StoreChannel,
    Customer, Order, OrderItem, OrderDelivery, Payment, PaymentProof,
    Conversation, ConversationParticipant, ChatMessage, MessageAttachment,
    CallSession, AuditLog
)

def seed_garbadrome_kossodo(db):
    # 1. Owner Moussa Traoré
    owner_email = "moussa.traore@garbadrome-kossodo.bf"
    owner = db.query(Owner).filter(Owner.email == owner_email).first()
    pwd_hash, salt = hash_password("KossodoGarba2026!")

    if not owner:
        owner = Owner(
            id=str(uuid.uuid4()),
            full_name="Moussa Traoré",
            email=owner_email,
            phone_number="+22676001045",
            bio="Chef garbadrome de référence à la cité universitaire de Kossodo. Poisson thon frais frit minute, attiéké de qualité supérieure, piments frais et oignons croquants préparés avec amour.",
            password_hash=pwd_hash,
            password_salt=salt,
            must_change_password=False
        )
        db.add(owner)
        db.flush()
    else:
        owner.password_hash = pwd_hash
        owner.password_salt = salt
        owner.must_change_password = False

    # 2. Store Garbadrome Kossodo
    store = db.query(Store).filter(Store.slug == "garbadrome-kossodo").first()
    if not store:
        store = Store(
            id=str(uuid.uuid4()),
            owner_id=owner.id,
            name="Garbadrome Kossodo",
            slug="garbadrome-kossodo",
            tagline="Le Garba authentique de la cité universitaire de Kossodo",
            description="Spécialités de Garba ivoiro-burkinabè chaud et croustillant en direct de la cité universitaire de Kossodo. Poisson thon frit à la minute, attiéké frais de première qualité, oignons et piments dosés selon vos envies. Commandez et suivez votre plat en direct dans le chat !",
            owner_bio="Moussa Traoré, garbatier passionné depuis 8 ans à Kossodo. Je sers les étudiants, résidents et professionnels du campus avec des portions généreuses et le vrai goût du garba au thon frais.",
            currency="FCFA",
            logo_url="/media/store/logo.jpg",
            avatar_url="/media/store/awa_portrait.jpg",
            rating=4.96,
            sales_count=520,
            revenue=4250000,
            is_verified=True,
            social_tunnel_badge="CHAT ACTIF",
            social_tunnel_label="Commerce Conversationnel Natif",
            is_flash_active=True,
            flash_title="Offre Spéciale Étudiant Kossodo",
            flash_subtitle="Livraison directe en chambre ou amphi en moins de 15 min chrono",
            flash_remaining_seconds=11400,
            voice_note_title="Besoin d'un assaisonnement particulier ?",
            voice_note_subtitle="Moussa vous écoute et prépare votre garba exactement comme vous l'aimez.",
            primary_color="#ea580c", # Vibrant orange
            secondary_color="#16a34a", # Fresh green
            theme_preset="kinetic_amber",
            is_custom_theme_active=True,
            is_loyalty_active=True,
            loyalty_spend_per_point=500,
            subscription_status="ACTIVE",
            subscription_plan="PRO",
            custom_domain="garbadrome-kossodo.bf",
            contact_whatsapp="+22676001045",
            contact_email="moussa.traore@garbadrome-kossodo.bf"
        )
        db.add(store)
        db.flush()

        # Trust Badges
        db.add_all([
            TrustBadge(store_id=store.id, icon_name="restaurant", label="Thon Frit Minute", badge_type="primary", display_order=1),
            TrustBadge(store_id=store.id, icon_name="local_shipping", label="Livraison Cité Kossodo", badge_type="secondary", display_order=2),
            TrustBadge(store_id=store.id, icon_name="tune", label="Plats Personnalisables", badge_type="secondary-fixed", display_order=3),
        ])

        # Delivery Cities / Zones
        db.add_all([
            DeliveryCity(store_id=store.id, name="Cité Universitaire Kossodo (Pavillons A, B, C, D)", display_label="📍 Cité Kossodo", is_default=True, display_order=1),
            DeliveryCity(store_id=store.id, name="Kossodo Zone Industrielle & Écoles", display_label="Zone Kossodo", is_default=False, display_order=2),
            DeliveryCity(store_id=store.id, name="Somgandé & Nioko 1", display_label="Somgandé", is_default=False, display_order=3),
            DeliveryCity(store_id=store.id, name="Dassasgho & Koulouba", display_label="Dassasgho", is_default=False, display_order=4),
        ])

        # Loyalty Tiers
        db.add_all([
            LoyaltyTier(store_id=store.id, name="Étudiant Gourmet", min_points=0, badge_label="Membre Kossodo", perk_title="Piment & Oignons Supplémentaires", perk_description="Garniture généreuse offerte à chaque commande.", discount_percent=0, is_active=True, display_order=1),
            LoyaltyTier(store_id=store.id, name="Fidèle Garbatier", min_points=30, badge_label="Habitué VIP", perk_title="Boisson Offerte le Vendredi", perk_description="Un jus de Bissap maison offert pour toute commande de Garba complet.", discount_percent=5, is_active=True, display_order=2),
            LoyaltyTier(store_id=store.id, name="Roi du Garba", min_points=80, badge_label="Club Élite", perk_title="Livraison Gratuite Permanente", perk_description="Toutes vos livraisons offertes sur tout le campus de Kossodo.", discount_percent=10, is_active=True, display_order=3),
        ])

        # Channels
        db.add_all([
            StoreChannel(store_id=store.id, channel_type="WHATSAPP", display_title="WhatsApp Direct", account_handle="+22676001045", is_recommended=True, is_active=True, display_order=1),
            StoreChannel(store_id=store.id, channel_type="CALL", display_title="Appel Direct Cuisine", account_handle="+22676001045", is_recommended=False, is_active=True, display_order=2),
        ])

        # Categories
        cat_all = Category(store_id=store.id, name="Tout", slug="all", display_order=0)
        cat_garba = Category(store_id=store.id, name="Garba & Spécialités", slug="garba-specialites", display_order=1)
        cat_portions = Category(store_id=store.id, name="Portions Personnalisées", slug="portions-personnalisees", display_order=2)
        cat_accompagnements = Category(store_id=store.id, name="Accompagnements", slug="accompagnements", display_order=3)
        cat_boissons = Category(store_id=store.id, name="Boissons Fraîches", slug="boissons", display_order=4)
        cat_menus = Category(store_id=store.id, name="Menus Étudiants & Offres", slug="menus-etudiants", display_order=5)
        db.add_all([cat_all, cat_garba, cat_portions, cat_accompagnements, cat_boissons, cat_menus])
        db.flush()

        customization_options_json = json.dumps([
            {
                "group_name": "Niveau de piment",
                "required": True,
                "options": ["Sans piment", "Peu de piment", "Piment moyen", "Très pimenté 🔥"]
            },
            {
                "group_name": "Quantité d'oignons",
                "required": True,
                "options": ["Sans oignon", "Oignons normaux", "Beaucoup d'oignons 🧅"]
            },
            {
                "group_name": "Cuisson du poisson thon",
                "required": False,
                "options": ["Poisson tendre", "Poisson bien grillé et croustillant"]
            },
            {
                "group_name": "Portions d'attiéké",
                "required": False,
                "options": ["1 portion standard", "2 portions (+500 F)", "3 portions maxi (+1 000 F)"]
            }
        ], ensure_ascii=False)

        # Products
        p1 = Product(
            store_id=store.id,
            category_id=cat_garba.id,
            name="Garba Simple",
            slug="garba-simple",
            description="Attiéké fin et frais de Côte d'Ivoire, assaisonnement traditionnel avec oignons émincés, tomates fraîches et piment vert.",
            short_description="Attiéké fin frais, assaisonnement oignons et tomates émincés, piment vert doux.",
            price=1000,
            currency="FCFA",
            stock=50,
            stock_label="Disponible en continu",
            is_hero_deal=False,
            badge_tag="Classique",
            is_published=True,
            is_customizable=False,
            display_order=1
        )
        p2 = Product(
            store_id=store.id,
            category_id=cat_garba.id,
            name="Garba + Poisson Thon",
            slug="garba-poisson-thon",
            description="Le plat phare de Kossodo ! Portion généreuse d'attiéké surmontée d'un beau morceau de thon frais frit à point, croustillant à l'extérieur et moelleux à l'intérieur.",
            short_description="Portion généreuse d'attiéké avec beau morceau de thon frit croustillant minute.",
            price=1500,
            old_price=1750,
            currency="FCFA",
            stock=40,
            stock_label="40 portions prêtes",
            is_hero_deal=True,
            badge_tag="Plat Préféré Étudiants ★",
            is_published=True,
            is_customizable=True,
            customization_prompt="Précise ta cuisson et tes légumes",
            customization_options=customization_options_json,
            display_order=2
        )
        p3 = Product(
            store_id=store.id,
            category_id=cat_garba.id,
            name="Garba + Œuf",
            slug="garba-oeuf",
            description="Attiéké savoureux accompagné d'un œuf dur doré à l'huile aromatisée et garniture d'oignons fondants.",
            short_description="Attiéké onctueux accompagné d'un œuf dur doré à l'huile aromatisée.",
            price=1250,
            currency="FCFA",
            stock=30,
            is_published=True,
            is_customizable=False,
            display_order=3
        )
        p4 = Product(
            store_id=store.id,
            category_id=cat_garba.id,
            name="Garba Complet (Poisson + Œuf + Piment Spécial)",
            slug="garba-complet",
            description="La totale signature de Moussa : beau morceau de thon bien frit, œuf doré, double attiéké, oignons frais et piments écrasés au goût.",
            short_description="La totale Kossodo : Thon frit + œuf doré + cube maggi et oignons fondants.",
            price=2000,
            old_price=2200,
            currency="FCFA",
            stock=25,
            badge_tag="Chef Spécial 👑",
            is_published=True,
            is_customizable=True,
            customization_prompt="Personnalise ton Garba complet",
            customization_options=customization_options_json,
            display_order=4
        )
        p5 = Product(
            store_id=store.id,
            category_id=cat_portions.id,
            name="Garba Personnalisé « Décris ton plat »",
            slug="garba-personnalise-sur-mesure",
            description="Personnalisation totale selon vos goûts exacts : « Je veux beaucoup d'oignons, peu de piment, deux portions d'attiéké et un poisson bien grillé. »",
            short_description="Votre Garba composé exactement sur mesure avec vos instructions de cuisson.",
            price=2500,
            currency="FCFA",
            stock=35,
            badge_tag="100% Sur Mesure",
            is_published=True,
            is_customizable=True,
            customization_prompt="Décris ton plat en détail",
            customization_options=customization_options_json,
            display_order=5
        )
        p6 = Product(
            store_id=store.id,
            category_id=cat_menus.id,
            name="Menu Étudiant Kossodo",
            slug="menu-etudiant-kossodo",
            description="Formule complète et économique pour les étudiants : 1 Garba + poisson + 1 Jus de Bissap frais maison + 1 banane douce.",
            short_description="Formule étudiant : Garba poisson + Jus de Bissap frais 33cl + Banane douce.",
            price=2000,
            old_price=2500,
            currency="FCFA",
            stock=30,
            badge_tag="Tarif Étudiant 🎓",
            is_published=True,
            is_customizable=True,
            customization_prompt="Choix du piment et de la boisson",
            display_order=6
        )
        p7 = Product(
            store_id=store.id,
            category_id=cat_accompagnements.id,
            name="Alloco Croustillant (Banane plantain frite)",
            slug="alloco-croustillant",
            description="Portion d'alloco doré à l'huile végétale propre, servi chaud avec sauce pimentée maison.",
            short_description="Bananes plantains mûres frites dorées et croustillantes.",
            price=1000,
            currency="FCFA",
            stock=20,
            is_published=True,
            display_order=7
        )
        p8 = Product(
            store_id=store.id,
            category_id=cat_boissons.id,
            name="Jus de Bissap Maison Frais (33cl)",
            slug="jus-bissap-maison",
            description="Infusion naturelle de calices d'hibiscus rouge, menthe fraîche et touche de fleur d'oranger. Bien frais.",
            short_description="Fleur d'hibiscus infusée à la menthe fraîche et arôme vanille.",
            price=500,
            currency="FCFA",
            stock=40,
            badge_tag="Frais & Bio",
            is_published=True,
            display_order=8
        )
        p9 = Product(
            store_id=store.id,
            category_id=cat_boissons.id,
            name="Eau Minérale Lafi 1.5L",
            slug="eau-minerale-lafi",
            description="Bouteille d'eau minérale naturelle bien glacée.",
            short_description="Eau minérale naturelle 1.5L très fraîche.",
            price=500,
            currency="FCFA",
            stock=60,
            is_published=True,
            display_order=9
        )
        p10 = Product(
            store_id=store.id,
            category_id=cat_menus.id,
            name="Offre du Jour : Garba Capitaine VIP",
            slug="garba-capitaine-vip",
            description="Morceau noble de poisson Capitaine frit à la commande, double portion d'attiéké fin, légumes croquants et alloco inclus.",
            short_description="Filet de poisson Capitaine noble frit minute sur lit d'attiéké.",
            price=3000,
            old_price=3500,
            currency="FCFA",
            stock=15,
            badge_tag="Offre du Jour 🌟",
            is_published=True,
            is_customizable=True,
            customization_prompt="Instructions de cuisson et assaisonnement",
            display_order=10
        )
        db.add_all([p1, p2, p3, p4, p5, p6, p7, p8, p9, p10])
        db.flush()

        # 3. Seed Reference Customer Richard
        richard = db.query(Customer).filter(Customer.phone == "+22676001045").first()
        if not richard:
            richard = Customer(
                id=str(uuid.uuid4()),
                store_id=store.id,
                name="Richard",
                phone="+22676001045",
                email="richard@etudiant-kossodo.bf",
                city="Kossodo (Ouagadougou)",
                delivery_address="Cité universitaire de Kossodo, Pavillon B, Chambre 14, près de la porte principale",
                gps_coordinates="12.4172, -1.4889",
                gps_location_url="https://maps.google.com/?q=12.4172,-1.4889",
                session_token="token_richard_kossodo_2026"
            )
            db.add(richard)
            db.flush()

        # 4. Seed Reference Order #KSD-1045
        order_ksd = db.query(Order).filter(Order.order_number == "KSD-1045").first()
        if not order_ksd:
            order_id = str(uuid.uuid4())
            order_ksd = Order(
                id=order_id,
                order_number="KSD-1045",
                store_id=store.id,
                customer_id=richard.id,
                customer_token=richard.session_token,
                customer_name="Richard",
                customer_phone="+22676001045",
                customer_email="richard@etudiant-kossodo.bf",
                status="PREPARING",
                payment_status="PAYMENT_CONFIRMED",
                subtotal_amount=2000,
                delivery_fee=500,
                total_amount=2500,
                currency="FCFA",
                notes="Livrer rapidement si possible avant le début du cours de 14h.",
                created_at=datetime.utcnow() - timedelta(minutes=25)
            )
            db.add(order_ksd)
            db.flush()

            # Item 1: Garba + Poisson with custom details
            item1 = OrderItem(
                id=str(uuid.uuid4()),
                order_id=order_ksd.id,
                product_id=p2.id,
                product_name="Garba + Poisson Thon",
                quantity=1,
                unit_price=1500,
                total_price=1500,
                is_customized=True,
                customization_text="Je veux beaucoup d'oignons, peu de piment, deux portions d'attiéké et un poisson bien grillé.",
                customization_options=json.dumps({
                    "spice_level": "Peu de piment",
                    "onions": "Beaucoup d'oignons",
                    "cooking": "Poisson bien grillé et croustillant",
                    "attieke_portions": 2
                })
            )
            # Item 2: Jus de Bissap
            item2 = OrderItem(
                id=str(uuid.uuid4()),
                order_id=order_ksd.id,
                product_id=p8.id,
                product_name="Jus de Bissap Maison Frais",
                quantity=1,
                unit_price=500,
                total_price=500,
                is_customized=False
            )
            db.add_all([item1, item2])

            # Delivery: Exact GPS + Described
            delivery = OrderDelivery(
                id=str(uuid.uuid4()),
                order_id=order_ksd.id,
                delivery_mode="GPS_AND_DESCRIPTION",
                delivery_city="Cité universitaire de Kossodo",
                delivery_address="Pavillon B, entrée principale, devant le local étudiant.",
                latitude=12.4172,
                longitude=-1.4889,
                location_accuracy=5.2,
                location_captured_at=datetime.utcnow() - timedelta(minutes=25),
                delivery_notes="Appeler dès l'arrivée au portail du Pavillon B.",
                delivery_status="PREPARING"
            )
            db.add(delivery)

            # Payment & Proof
            payment = Payment(
                id=str(uuid.uuid4()),
                order_id=order_ksd.id,
                store_id=store.id,
                amount=2500,
                currency="FCFA",
                payment_method="MOBILE_MONEY_PROOF",
                status="PAYMENT_CONFIRMED",
                transaction_reference="OM-BF-892401",
                confirmed_by="Moussa Traoré",
                confirmed_at=datetime.utcnow() - timedelta(minutes=15)
            )
            db.add(payment)
            db.flush()

            proof = PaymentProof(
                id=str(uuid.uuid4()),
                payment_id=payment.id,
                order_id=order_ksd.id,
                sender_id=richard.id,
                file_url="/media/proofs/capture_paiement_ksd1045.jpg",
                file_name="capture_orange_money_ksd1045.jpg",
                file_size=248500,
                mime_type="image/jpeg",
                customer_note="Transfert Orange Money de 2 500 FCFA effectué avec succès.",
                status="VERIFIED",
                verified_by="Moussa Traoré",
                verified_at=datetime.utcnow() - timedelta(minutes=15)
            )
            db.add(proof)

            # 5. Order Conversation #KSD-1045
            conv_order = Conversation(
                id=str(uuid.uuid4()),
                store_id=store.id,
                order_id=order_ksd.id,
                context_type="ORDER",
                title="Commande #KSD-1045",
                customer_id=richard.id,
                customer_token=richard.session_token,
                customer_name="Richard",
                last_message_at=datetime.utcnow() - timedelta(minutes=10),
                last_message_preview="👨‍🍳 Commande en cours de préparation en cuisine !"
            )
            db.add(conv_order)
            db.flush()

            # Participants
            db.add(ConversationParticipant(
                id=str(uuid.uuid4()),
                conversation_id=conv_order.id,
                user_type="CUSTOMER",
                user_id=richard.id,
                display_name="Richard",
                last_read_at=datetime.utcnow()
            ))
            db.add(ConversationParticipant(
                id=str(uuid.uuid4()),
                conversation_id=conv_order.id,
                user_type="MERCHANT",
                user_id=owner.id,
                display_name="Garbadrome Kossodo",
                avatar_url=store.avatar_url,
                last_read_at=datetime.utcnow()
            ))

            # Messages sequence in conversation #KSD-1045
            # Msg 1: Initial Order Card
            m1 = ChatMessage(
                id=str(uuid.uuid4()),
                conversation_id=conv_order.id,
                sender_type="SYSTEM",
                sender_name="Système",
                message_type="ORDER",
                content="📦 Commande #KSD-1045 créée (Total : 2 500 FCFA). En attente de validation par le commerçant.",
                metadata_json=json.dumps({
                    "order_id": order_ksd.id,
                    "order_number": "KSD-1045",
                    "total_amount": 2500,
                    "currency": "FCFA",
                    "items_summary": "Garba + Poisson Thon × 1, Jus de Bissap Maison Frais × 1",
                    "status": "ACCEPTED",
                    "payment_status": "PAYMENT_CONFIRMED",
                    "delivery_address": "Pavillon B, entrée principale, Cité Kossodo",
                    "has_gps": True,
                    "latitude": 12.4172,
                    "longitude": -1.4889
                }),
                created_at=datetime.utcnow() - timedelta(minutes=24)
            )

            # Msg 2: Seller Accepted
            m2 = ChatMessage(
                id=str(uuid.uuid4()),
                conversation_id=conv_order.id,
                sender_type="SYSTEM",
                sender_name="Système",
                message_type="SYSTEM",
                content="✅ Le vendeur a accepté votre commande. Vous pouvez maintenant effectuer le paiement et envoyer la preuve dans cette conversation.",
                metadata_json=json.dumps({"status": "ACCEPTED"}),
                created_at=datetime.utcnow() - timedelta(minutes=22)
            )

            # Msg 3: Customer Chat
            m3 = ChatMessage(
                id=str(uuid.uuid4()),
                conversation_id=conv_order.id,
                sender_type="CUSTOMER",
                sender_name="Richard",
                message_type="TEXT",
                content="Bonjour chef ! J'ai bien précisé beaucoup d'oignons et poisson bien croustillant. Je vous envoie la capture Orange Money tout de suite.",
                created_at=datetime.utcnow() - timedelta(minutes=20)
            )

            # Msg 4: Payment proof
            m4 = ChatMessage(
                id=str(uuid.uuid4()),
                conversation_id=conv_order.id,
                sender_type="CUSTOMER",
                sender_name="Richard",
                message_type="PAYMENT_PROOF",
                content="💳 Preuve de paiement envoyée (capture_orange_money_ksd1045.jpg). Transfert de 2 500 FCFA effectué.",
                metadata_json=json.dumps({
                    "proof_id": proof.id,
                    "order_id": order_ksd.id,
                    "file_url": proof.file_url,
                    "file_name": proof.file_name,
                    "amount": 2500,
                    "currency": "FCFA",
                    "status": "VERIFIED"
                }),
                created_at=datetime.utcnow() - timedelta(minutes=18)
            )

            # Msg 5: Payment confirmed
            m5 = ChatMessage(
                id=str(uuid.uuid4()),
                conversation_id=conv_order.id,
                sender_type="SYSTEM",
                sender_name="Système",
                message_type="SYSTEM",
                content="🎉 Paiement confirmé par le commerçant ! Votre commande est validée et passe en préparation.",
                metadata_json=json.dumps({"payment_status": "PAYMENT_CONFIRMED", "status": "PAID"}),
                created_at=datetime.utcnow() - timedelta(minutes=15)
            )

            # Msg 6: Seller Chat Message
            m6 = ChatMessage(
                id=str(uuid.uuid4()),
                conversation_id=conv_order.id,
                sender_type="MERCHANT",
                sender_name="Moussa Traoré",
                message_type="TEXT",
                content="Reçu 5/5 Richard ! Le thon est déjà sur le feu pour être bien croustillant avec double portion d'oignons. Le livreur arrive dans 10 min au Pavillon B.",
                created_at=datetime.utcnow() - timedelta(minutes=12)
            )

            # Msg 7: Status PREPARING
            m7 = ChatMessage(
                id=str(uuid.uuid4()),
                conversation_id=conv_order.id,
                sender_type="SYSTEM",
                sender_name="Système",
                message_type="SYSTEM",
                content="👨‍🍳 Commande en cours de préparation en cuisine !",
                metadata_json=json.dumps({"status": "PREPARING"}),
                created_at=datetime.utcnow() - timedelta(minutes=10)
            )

            db.add_all([m1, m2, m3, m4, m5, m6, m7])

            # 6. General Store Conversation: Richard <-> Garbadrome Kossodo
            conv_general = Conversation(
                id=str(uuid.uuid4()),
                store_id=store.id,
                order_id=None,
                context_type="GENERAL_STORE",
                title="Discussion avec Garbadrome Kossodo",
                customer_id=richard.id,
                customer_token=richard.session_token,
                customer_name="Richard",
                last_message_at=datetime.utcnow() - timedelta(hours=2),
                last_message_preview="Oui bien sûr ! Nous servons en continu jusqu'à 22h à Kossodo."
            )
            db.add(conv_general)
            db.flush()

            db.add(ConversationParticipant(
                id=str(uuid.uuid4()),
                conversation_id=conv_general.id,
                user_type="CUSTOMER",
                user_id=richard.id,
                display_name="Richard"
            ))
            db.add(ConversationParticipant(
                id=str(uuid.uuid4()),
                conversation_id=conv_general.id,
                user_type="MERCHANT",
                user_id=owner.id,
                display_name="Garbadrome Kossodo",
                avatar_url=store.avatar_url
            ))

            mg1 = ChatMessage(
                id=str(uuid.uuid4()),
                conversation_id=conv_general.id,
                sender_type="CUSTOMER",
                sender_name="Richard",
                message_type="TEXT",
                content="Bonjour Moussa, vous êtes ouverts aujourd'hui ? Il reste du poisson thon pour midi ?",
                created_at=datetime.utcnow() - timedelta(hours=2, minutes=5)
            )
            mg2 = ChatMessage(
                id=str(uuid.uuid4()),
                conversation_id=conv_general.id,
                sender_type="MERCHANT",
                sender_name="Moussa Traoré",
                message_type="TEXT",
                content="Salut Richard ! Oui bien sûr ! Nous venons de recevoir du thon frais ce matin et nous servons en continu jusqu'à 22h à Kossodo.",
                created_at=datetime.utcnow() - timedelta(hours=2)
            )
            db.add_all([mg1, mg2])

            # 7. Call Session (Audio Call history)
            call1 = CallSession(
                id=str(uuid.uuid4()),
                conversation_id=conv_general.id,
                store_id=store.id,
                caller_type="CUSTOMER",
                caller_id=richard.id,
                caller_name="Richard",
                callee_type="MERCHANT",
                callee_id=store.id,
                callee_name="Garbadrome Kossodo",
                call_type="AUDIO",
                status="ENDED",
                started_at=datetime.utcnow() - timedelta(days=1, hours=3),
                answered_at=datetime.utcnow() - timedelta(days=1, hours=3) + timedelta(seconds=5),
                ended_at=datetime.utcnow() - timedelta(days=1, hours=3) + timedelta(minutes=2, seconds=15),
                duration_seconds=135
            )
            call2 = CallSession(
                id=str(uuid.uuid4()),
                conversation_id=conv_order.id,
                store_id=store.id,
                caller_type="CUSTOMER",
                caller_id=richard.id,
                caller_name="Richard",
                callee_type="MERCHANT",
                callee_id=store.id,
                callee_name="Garbadrome Kossodo",
                call_type="VIDEO",
                status="ENDED",
                started_at=datetime.utcnow() - timedelta(hours=5),
                answered_at=datetime.utcnow() - timedelta(hours=5) + timedelta(seconds=4),
                ended_at=datetime.utcnow() - timedelta(hours=5) + timedelta(minutes=4, seconds=42),
                duration_seconds=282
            )
            db.add_all([call1, call2])

        db.commit()
        print("Garbadrome Kossodo seeded successfully with complete conversational commerce scenario!")
