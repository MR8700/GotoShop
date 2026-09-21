import uuid
import secrets
import json
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from urllib.parse import quote
from sqlalchemy.orm import Session

from app.models.subscription import SubscriptionPlan, PaymentUssdConfig, SubscriptionRequest
from app.models.store import Store, Owner
from app.schemas.subscription import (
    SubscriptionPlanSchema,
    SubscriptionPlanCreateSchema,
    SubscriptionPlanUpdateSchema,
    PaymentUssdConfigSchema,
    PaymentUssdConfigUpdateSchema,
    UssdDialOptionSchema,
    PublicPlanWithUssdSchema,
    SubscriptionPublicInfoResponse,
    SubscriptionRequestSubmitSchema,
    SubscriptionRequestReviewSchema,
    SubscriptionRequestItemSchema
)
from app.schemas.super_admin import SuperAdminStoreCreateRequest
from app.services.catalog_service import save_base64_media
from app.services.super_admin_service import SuperAdminService
from app.config import settings

class SubscriptionService:
    @staticmethod
    def seed_defaults(db: Session):
        """Seed default plans and USSD configurations if not present."""
        # 1. Plans
        plans_count = db.query(SubscriptionPlan).count()
        if plans_count == 0:
            default_plans = [
                SubscriptionPlan(
                    id="plan-starter-1000",
                    name="Formule Starter (1 000 FCFA)",
                    code="STARTER",
                    price=1000,
                    currency="FCFA",
                    duration_days=30,
                    description="Parfait pour lancer votre boutique en ligne et tester vos ventes sur WhatsApp.",
                    features=json.dumps([
                        "Vitrine mobile personnalisée 24h/24",
                        "Catalogue jusqu'à 30 produits",
                        "Tunnel de commande WhatsApp direct",
                        "Lien vitrine partageable sur TikTok/Instagram",
                        "Statistiques de base des visites"
                    ]),
                    badge_label="Idéal Débutant",
                    is_popular=False,
                    is_active=True,
                    display_order=1
                ),
                SubscriptionPlan(
                    id="plan-pro-3000",
                    name="Formule Pro Vendeur (3 000 FCFA)",
                    code="PRO",
                    price=3000,
                    currency="FCFA",
                    duration_days=30,
                    description="Pour les commerçants actifs souhaitant maximiser leurs ventes et fidéliser leurs clients.",
                    features=json.dumps([
                        "Produits illimités & multi-variantes",
                        "Programme de fidélité & Système VIP Points",
                        "Ventes Flash & Bannières promotionnelles",
                        "Suivi et géolocalisation livreurs",
                        "Statistiques avancées des commandes",
                        "Support prioritaire 7j/7"
                    ]),
                    badge_label="Le Plus Populaire",
                    is_popular=True,
                    is_active=True,
                    display_order=2
                ),
                SubscriptionPlan(
                    id="plan-vip-5000",
                    name="Formule VIP Élite (5 000 FCFA)",
                    code="VIP",
                    price=5000,
                    currency="FCFA",
                    duration_days=30,
                    description="Solution tout inclus pour les commerçants établis et les marques en forte croissance.",
                    features=json.dumps([
                        "Toutes les fonctionnalités Pro incluses",
                        "Thème graphique sur mesure aux couleurs de votre marque",
                        "Relances automatiques des commandes par WhatsApp",
                        "Badge officiel Marchand Certifié Vérifié",
                        "Accès prioritaire aux nouvelles fonctionnalités"
                    ]),
                    badge_label="Excellence VIP",
                    is_popular=False,
                    is_active=True,
                    display_order=3
                )
            ]
            db.add_all(default_plans)
            db.commit()

        # 2. USSD Configs
        ussd_count = db.query(PaymentUssdConfig).count()
        if ussd_count == 0:
            default_ussd = [
                PaymentUssdConfig(
                    id="ussd-orange-ci",
                    operator_name="Orange Money",
                    operator_code="ORANGE",
                    merchant_number="65711741",
                    ussd_template="*144*2*1*{merchant_number}*{amount}#",
                    instructions="Cliquez sur le bouton pour composer automatiquement le code USSD Orange Money, validez avec votre code secret, puis chargez la capture d'écran du reçu SMS de confirmation ci-dessous.",
                    brand_color="#FF7900",
                    text_color="#FFFFFF",
                    icon_type="orange",
                    is_active=True,
                    display_order=1
                ),
                PaymentUssdConfig(
                    id="ussd-moov-ci",
                    operator_name="Moov Money",
                    operator_code="MOOV",
                    merchant_number="52045008",
                    ussd_template="*555*2*1*{merchant_number}*{amount}#",
                    instructions="Cliquez sur le bouton pour composer le code USSD Moov Money, confirmez le transfert sur votre téléphone avec votre code secret Moov, puis prenez une capture du SMS reçu et chargez-la ci-dessous.",
                    brand_color="#005BAA",
                    text_color="#FFFFFF",
                    icon_type="moov",
                    is_active=True,
                    display_order=2
                ),
                PaymentUssdConfig(
                    id="ussd-wave-ci",
                    operator_name="Wave Money",
                    operator_code="WAVE",
                    merchant_number="0759000000",
                    ussd_template="Wave direct au 0759000000",
                    instructions="Ouvrez votre application Wave, effectuez le transfert vers notre compte Wave officiel et chargez la capture d'écran du reçu dans le champ dédié.",
                    brand_color="#1dc4fe",
                    text_color="#FFFFFF",
                    icon_type="wave",
                    is_active=True,
                    display_order=3
                )
            ]
            db.add_all(default_ussd)
            db.commit()

    @staticmethod
    def compute_ussd_code(template: str, merchant_number: str, amount: int) -> str:
        """Formats the USSD dial code for a given merchant and amount."""
        code = template.replace("{merchant_number}", merchant_number).replace("{merchant}", merchant_number)
        # Note: if amount is 1000 and template is for Orange/Moov, replace {amount} with actual amount (or 1010 if specific fee)
        # We replace {amount} with string of amount
        code = code.replace("{amount}", str(amount))
        return code

    @staticmethod
    def get_public_info(db: Session) -> SubscriptionPublicInfoResponse:
        """Returns active plans, USSD providers, and precomputed dial options."""
        SubscriptionService.seed_defaults(db)

        plans = db.query(SubscriptionPlan).filter(SubscriptionPlan.is_active == True).order_by(SubscriptionPlan.display_order.asc()).all()
        ussd_configs = db.query(PaymentUssdConfig).filter(PaymentUssdConfig.is_active == True).order_by(PaymentUssdConfig.display_order.asc()).all()

        plans_with_ussd: List[PublicPlanWithUssdSchema] = []
        for plan in plans:
            options: List[UssdDialOptionSchema] = []
            for cfg in ussd_configs:
                # If amount is 1000 and operator is Orange or Moov as specified by user, we can support *144*2*1*65711741*1010#
                amount_for_code = plan.price
                if plan.price == 1000 and cfg.operator_code in ["ORANGE", "MOOV"]:
                    # user specification explicitly gave *144*2*1*65711741*1010# for 1000F
                    amount_for_code = 1010

                ussd_code = SubscriptionService.compute_ussd_code(cfg.ussd_template, cfg.merchant_number, amount_for_code)
                # Tel link with %23 for hash
                tel_code = ussd_code.replace("#", "%23")
                tel_link = f"tel:{tel_code}" if ussd_code.startswith("*") else f"tel:{cfg.merchant_number}"

                options.append(UssdDialOptionSchema(
                    operator_code=cfg.operator_code,
                    operator_name=cfg.operator_name,
                    brand_color=cfg.brand_color,
                    text_color=cfg.text_color,
                    icon_type=cfg.icon_type,
                    merchant_number=cfg.merchant_number,
                    ussd_code=ussd_code,
                    tel_link=tel_link,
                    instructions=cfg.instructions or ""
                ))

            plans_with_ussd.append(PublicPlanWithUssdSchema(
                plan=plan,
                payment_options=options
            ))

        return SubscriptionPublicInfoResponse(
            plans=plans,
            ussd_configs=ussd_configs,
            plans_with_ussd=plans_with_ussd
        )

    @staticmethod
    def submit_request(db: Session, req_data: SubscriptionRequestSubmitSchema) -> SubscriptionRequest:
        """Processes and saves a new subscription or renewal request with payment proof."""
        if not req_data.store_name or not req_data.owner_name:
            raise ValueError("Le nom de la boutique et le nom du commerçant sont obligatoires.")

        if not req_data.owner_email and not req_data.owner_phone:
            raise ValueError("Veuillez renseigner un Email ou un numéro WhatsApp fonctionnel.")

        if not req_data.payment_proof_data:
            raise ValueError("La capture d'écran du paiement est obligatoire.")

        # Find plan
        plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.code == req_data.plan_code).first()
        if not plan:
            plan = db.query(SubscriptionPlan).first()

        # Find USSD config
        ussd_cfg = db.query(PaymentUssdConfig).filter(PaymentUssdConfig.operator_code == req_data.operator_code).first()
        ussd_code_used = None
        if ussd_cfg and plan:
            amount_val = 1010 if (plan.price == 1000 and ussd_cfg.operator_code in ["ORANGE", "MOOV"]) else plan.price
            ussd_code_used = SubscriptionService.compute_ussd_code(ussd_cfg.ussd_template, ussd_cfg.merchant_number, amount_val)

        # Save proof image
        proof_url = save_base64_media(req_data.payment_proof_data, prefix="proof")
        if not proof_url:
            proof_url = req_data.payment_proof_data

        sub_req = SubscriptionRequest(
            id=str(uuid.uuid4()),
            request_type=req_data.request_type or "NEW_STORE",
            store_id=req_data.store_id,
            store_name=req_data.store_name.strip(),
            owner_name=req_data.owner_name.strip(),
            owner_email=req_data.owner_email.strip().lower() if req_data.owner_email else "",
            owner_phone=req_data.owner_phone.strip() if req_data.owner_phone else "",
            plan_id=plan.id if plan else None,
            plan_code=plan.code if plan else req_data.plan_code,
            plan_name=plan.name if plan else "Abonnement",
            amount=plan.price if plan else 1000,
            currency=plan.currency if plan else "FCFA",
            duration_days=plan.duration_days if plan else 30,
            operator_code=req_data.operator_code or "ORANGE",
            ussd_code_used=ussd_code_used,
            payment_proof_url=proof_url,
            status="PENDING",
            notes=req_data.notes
        )

        db.add(sub_req)
        db.commit()
        db.refresh(sub_req)
        return sub_req

    @staticmethod
    def get_requests(db: Session, status: Optional[str] = None) -> List[SubscriptionRequest]:
        query = db.query(SubscriptionRequest)
        if status and status != "ALL":
            query = query.filter(SubscriptionRequest.status == status)
        return query.order_by(SubscriptionRequest.created_at.desc()).all()

    @staticmethod
    def get_request_by_id(db: Session, req_id: str) -> Optional[SubscriptionRequest]:
        return db.query(SubscriptionRequest).filter(SubscriptionRequest.id == req_id).first()

    @staticmethod
    def review_request(
        db: Session,
        req_id: str,
        review: SubscriptionRequestReviewSchema,
        admin_name: str = "Super Administrateur"
    ) -> SubscriptionRequest:
        sub_req = SubscriptionService.get_request_by_id(db, req_id)
        if not sub_req:
            raise ValueError("Demande d'abonnement introuvable.")

        if sub_req.status == "APPROVED":
            raise ValueError("Cette demande a déjà été validée.")

        if review.status == "REJECTED":
            sub_req.status = "REJECTED"
            sub_req.rejection_reason = review.rejection_reason or "Paiement non confirmé ou reçu non lisible."
            sub_req.reviewed_at = datetime.utcnow()
            sub_req.reviewed_by = admin_name
            db.commit()
            db.refresh(sub_req)
            return sub_req

        if review.status == "APPROVED":
            # 1. NEW_STORE flow
            if sub_req.request_type == "NEW_STORE":
                # Generate a secure, friendly password
                pwd_token = secrets.token_hex(3)
                generated_password = f"GotoShop!{pwd_token}"

                # Ensure unique email if empty
                owner_email = sub_req.owner_email
                if not owner_email:
                    clean_name = sub_req.owner_name.lower().replace(" ", "")
                    owner_email = f"{clean_name}_{secrets.token_hex(2)}@gotoshop.com"

                create_payload = SuperAdminStoreCreateRequest(
                    name=sub_req.store_name,
                    owner_name=sub_req.owner_name,
                    owner_email=owner_email,
                    owner_phone=sub_req.owner_phone or "+225 00000000",
                    password=generated_password,
                    subscription_plan=sub_req.plan_code,
                    trial_days=sub_req.duration_days,
                    primary_color="#ec761e",
                    theme_preset="kinetic_amber"
                )

                created_item = SuperAdminService.create_merchant_store(db, create_payload)
                sub_req.created_store_id = created_item.id
                sub_req.generated_password = generated_password
                sub_req.owner_email = owner_email

            # 2. RENEWAL / UPGRADE flow
            elif sub_req.request_type in ["RENEWAL", "UPGRADE"]:
                store = None
                if sub_req.store_id:
                    store = db.query(Store).filter(Store.id == sub_req.store_id).first()
                if not store and sub_req.owner_email:
                    # search by owner email
                    owner = db.query(Owner).filter(Owner.email == sub_req.owner_email).first()
                    if owner and owner.stores:
                        store = owner.stores[0]

                if store:
                    # Calculate new expiration date
                    now = datetime.utcnow()
                    base_date = store.subscription_expires_at if (store.subscription_expires_at and store.subscription_expires_at > now) else now
                    store.subscription_expires_at = base_date + timedelta(days=sub_req.duration_days)
                    store.subscription_status = "ACTIVE"
                    store.subscription_plan = sub_req.plan_code
                    db.flush()

            sub_req.status = "APPROVED"
            sub_req.reviewed_at = datetime.utcnow()
            sub_req.reviewed_by = admin_name
            db.commit()
            db.refresh(sub_req)
            return sub_req

        raise ValueError(f"Statut inconnu: {review.status}")

    @staticmethod
    def get_store_subscription_status(db: Session, store_id: str) -> Dict[str, Any]:
        """Returns details about a store's current subscription."""
        store = db.query(Store).filter(Store.id == store_id).first()
        if not store:
            raise ValueError("Boutique introuvable.")

        days_remaining = 0
        if store.subscription_expires_at:
            delta = store.subscription_expires_at - datetime.utcnow()
            days_remaining = max(0, delta.days)

        is_expired = store.subscription_status == "EXPIRED" or (store.subscription_expires_at and store.subscription_expires_at < datetime.utcnow())

        return {
            "store_id": store.id,
            "store_name": store.name,
            "subscription_plan": store.subscription_plan or "STARTER",
            "subscription_status": "EXPIRED" if is_expired else (store.subscription_status or "ACTIVE"),
            "subscription_expires_at": store.subscription_expires_at.isoformat() if store.subscription_expires_at else None,
            "days_remaining": days_remaining,
            "is_active": not is_expired and store.subscription_status in ["ACTIVE", "TRIAL"]
        }

    # Admin Management for Plans & USSD
    @staticmethod
    def update_plan(db: Session, plan_id: str, data: SubscriptionPlanUpdateSchema) -> Optional[SubscriptionPlan]:
        plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == plan_id).first()
        if not plan:
            return None
        for key, val in data.dict(exclude_unset=True).items():
            setattr(plan, key, val)
        plan.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(plan)
        return plan

    @staticmethod
    def update_ussd_config(db: Session, config_id: str, data: PaymentUssdConfigUpdateSchema) -> Optional[PaymentUssdConfig]:
        cfg = db.query(PaymentUssdConfig).filter(PaymentUssdConfig.id == config_id).first()
        if not cfg:
            return None
        for key, val in data.dict(exclude_unset=True).items():
            setattr(cfg, key, val)
        cfg.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(cfg)
        return cfg
