import json
import uuid
import re
import secrets
from datetime import datetime
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session

from app.models.order import Order
from app.models.payment import Payment, PaymentProof
from app.models.chat import Conversation
from app.models.audit import AuditLog
from app.services.chat_service import ChatService
from app.services.notification_engine import NotificationEngine
from app.realtime.connection_manager import manager

class PaymentService:
    @staticmethod
    def submit_payment_proof(
        db: Session,
        order_id: str,
        file_url: str,
        file_name: str,
        file_size: int,
        mime_type: str = "image/jpeg",
        customer_note: Optional[str] = None,
        sender_id: Optional[str] = None,
        sender_name: str = "Client"
    ) -> Dict[str, Any]:
        order = db.query(Order).filter(Order.id == order_id).first()
        if not order:
            raise ValueError(f"Order {order_id} not found")

        # Find or create Payment record
        payment = db.query(Payment).filter(Payment.order_id == order.id).first()
        if not payment:
            payment = Payment(
                id=str(uuid.uuid4()),
                order_id=order.id,
                store_id=order.store_id,
                amount=order.total_amount,
                currency=order.currency,
                payment_method="MOBILE_MONEY_PROOF",
                status="PAYMENT_PENDING"
            )
            db.add(payment)
            db.flush()

        # Create proof
        proof = PaymentProof(
            id=str(uuid.uuid4()),
            payment_id=payment.id,
            order_id=order.id,
            sender_id=sender_id,
            file_url=file_url,
            file_name=file_name,
            file_size=file_size,
            mime_type=mime_type,
            customer_note=customer_note,
            status="SUBMITTED",
            created_at=datetime.utcnow()
        )
        db.add(proof)

        # Update payment & order status
        prev_payment_status = payment.status
        payment.status = "PAYMENT_PROOF_SUBMITTED"
        order.payment_status = "PAYMENT_PROOF_SUBMITTED"
        order.updated_at = datetime.utcnow()

        # Find conversation
        conv = db.query(Conversation).filter(Conversation.order_id == order.id).first()
        if conv:
            proof_metadata = {
                "proof_id": proof.id,
                "order_id": order.id,
                "order_number": order.order_number,
                "amount": payment.amount,
                "currency": payment.currency,
                "file_url": file_url,
                "file_name": file_name,
                "file_size": file_size,
                "mime_type": mime_type,
                "customer_note": customer_note,
                "status": "SUBMITTED"
            }

            ChatService.send_message(
                db=db,
                conversation_id=conv.id,
                sender_type="CUSTOMER",
                sender_name=sender_name,
                sender_id=sender_id,
                content=f"💳 Preuve de paiement envoyée ({file_name}). En attente de vérification par le vendeur.",
                message_type="PAYMENT_PROOF",
                metadata=proof_metadata,
                attachments=[{
                    "file_url": file_url,
                    "file_name": file_name,
                    "mime_type": mime_type,
                    "file_size": file_size
                }]
            )

        # Audit
        audit = AuditLog(
            id=str(uuid.uuid4()),
            event_name="PAYMENT_PROOF_SUBMITTED",
            actor_type="CUSTOMER",
            actor_id=sender_id,
            actor_name=sender_name,
            resource_type="PAYMENT",
            resource_id=payment.id,
            previous_state=prev_payment_status,
            new_state="PAYMENT_PROOF_SUBMITTED",
            metadata_json=json.dumps({"proof_id": proof.id, "file_name": file_name})
        )
        db.add(audit)
        db.commit()

        # Notify merchant of uploaded payment proof
        try:
            NotificationEngine.notify_payment_proof_submitted(
                db=db,
                order=order,
                store=order.store,
                conversation_id=conv.id if conv else None
            )
            db.commit()
        except Exception as e:
            print("Notice: notify_payment_proof_submitted failed:", e)

        # Broadcast via WebSocket
        if conv:
            manager.safe_broadcast_sync(conv.id, {
                "type": "payment.proof_submitted",
                "order_id": order.id,
                "payment_status": "PAYMENT_PROOF_SUBMITTED",
                "proof_id": proof.id
            })

        return {
            "proof_id": proof.id,
            "order_id": order.id,
            "payment_status": payment.status,
            "file_url": proof.file_url,
            "status": proof.status
        }

    @staticmethod
    def process_ligdicash_payment(
        db: Session,
        order_id: str,
        operator: str,
        phone_number: str,
        otp_code: str,
        customer_name: str = "Client",
        is_test_mode: bool = False
    ) -> Dict[str, Any]:
        order = db.query(Order).filter(Order.id == order_id).first()
        if not order:
            raise ValueError(f"Commande {order_id} introuvable")

        # 1. Validation de l'opérateur
        norm_operator = operator.upper().strip().replace(" ", "_")
        if norm_operator not in ["ORANGE_MONEY", "MOOV_MONEY", "ORANGE", "MOOV"]:
            raise ValueError("Opérateur invalide. Veuillez sélectionner Orange Money ou Moov Money.")
        operator_display = "Orange Money" if "ORANGE" in norm_operator else "Moov Money"

        # 2. Validation stricte du numéro de téléphone (au moins 8 chiffres)
        clean_phone = re.sub(r"[^\d+]", "", phone_number.strip())
        digits_only = re.sub(r"\D", "", clean_phone)
        if len(digits_only) < 8:
            raise ValueError("Numéro de téléphone invalide : au moins 8 chiffres requis.")

        # 3. Validation stricte du code OTP (exactement 6 chiffres)
        clean_otp = otp_code.strip()
        if not re.match(r"^\d{6}$", clean_otp):
            raise ValueError("Code OTP incorrect : exactement 6 chiffres requis.")

        # 4. Enregistrement ou récupération du paiement
        payment = db.query(Payment).filter(Payment.order_id == order.id).first()
        if not payment:
            payment = Payment(
                id=str(uuid.uuid4()),
                order_id=order.id,
                store_id=order.store_id,
                amount=order.total_amount,
                currency=order.currency,
                payment_method=f"LIGDICASH_{norm_operator}",
                status="PAYMENT_PENDING"
            )
            db.add(payment)
            db.flush()

        prev_payment_status = payment.status
        tx_ref = f"LGD-{norm_operator[:3]}-{secrets.token_hex(4).upper()}"
        payment.payment_method = f"LIGDICASH_{norm_operator}"
        payment.transaction_reference = tx_ref
        payment.status = "PAYMENT_CONFIRMED"
        payment.confirmed_by = "LIGDICASH_GATEWAY"
        payment.confirmed_at = datetime.utcnow()
        payment.rejection_reason = None

        # 5. Validation de la commande et passage en PAID
        order.payment_status = "PAYMENT_CONFIRMED"
        order.status = "PAID"
        order.updated_at = datetime.utcnow()

        # 6. Attribution de points fidélité / avantages au client (5% du montant)
        if order.customer:
            try:
                perk_points = int(order.total_amount * 0.05)
                order.customer.bonus_points = (order.customer.bonus_points or 0) + perk_points
            except Exception as e_pts:
                print("Notice: bonus points calculation skipped:", e_pts)

        # 7. Notification dans la conversation interne
        conv = db.query(Conversation).filter(Conversation.order_id == order.id).first()
        if conv:
            ChatService.post_system_message(
                db=db,
                conversation_id=conv.id,
                content=f"🎉 Paiement Mobile Money validé via LigdiCash ({operator_display} : {clean_phone}) ! Réf : {tx_ref}. Montant : {order.total_amount:,} {order.currency}. 🚚 La livraison express garantie (délai : 45 min à 2h) est déclenchée !",
                metadata={
                    "order_id": order.id,
                    "status": "PAID",
                    "payment_status": "PAYMENT_CONFIRMED",
                    "operator": operator_display,
                    "transaction_reference": tx_ref,
                    "delivery_delay": "45 min - 2h",
                    "is_test_mode": is_test_mode
                }
            )

        # 8. Journal d'audit
        audit = AuditLog(
            id=str(uuid.uuid4()),
            event_name="LIGDICASH_PAYMENT_SUCCESS",
            actor_type="CUSTOMER",
            actor_name=customer_name,
            resource_type="PAYMENT",
            resource_id=payment.id,
            previous_state=prev_payment_status,
            new_state="PAYMENT_CONFIRMED",
            metadata_json=json.dumps({
                "operator": operator_display,
                "phone": clean_phone,
                "transaction_reference": tx_ref,
                "amount": payment.amount,
                "currency": payment.currency,
                "is_test_mode": is_test_mode
            })
        )
        db.add(audit)
        db.commit()

        # 9. Notification push / temps réel
        try:
            NotificationEngine.notify_payment_verified(
                db=db,
                order=order,
                store=order.store,
                conversation_id=conv.id if conv else None
            )
            db.commit()
        except Exception as e:
            print("Notice: notify_payment_verified failed:", e)

        # 10. Diffusion temps réel WebSocket
        if conv:
            manager.safe_broadcast_sync(conv.id, {
                "type": "payment.confirmed",
                "order_id": order.id,
                "status": "PAID",
                "payment_status": "PAYMENT_CONFIRMED",
                "transaction_reference": tx_ref,
                "operator": operator_display,
                "delivery_delay": "45 min - 2h"
            })

        return {
            "order_id": order.id,
            "status": order.status,
            "payment_status": payment.status,
            "transaction_reference": tx_ref,
            "operator": operator_display,
            "delivery_delay": "45 min - 2h",
            "confirmed_at": payment.confirmed_at.isoformat()
        }

    @staticmethod
    def confirm_payment(
        db: Session,
        order_id: str,
        verified_by: str = "Commerçant",
        verification_note: Optional[str] = None
    ) -> Dict[str, Any]:
        order = db.query(Order).filter(Order.id == order_id).first()
        if not order:
            raise ValueError(f"Order {order_id} not found")

        payment = db.query(Payment).filter(Payment.order_id == order.id).first()
        if not payment:
            raise ValueError(f"Payment for order {order_id} not found")

        prev_payment_status = payment.status
        payment.status = "PAYMENT_CONFIRMED"
        payment.confirmed_by = verified_by
        payment.confirmed_at = datetime.utcnow()
        payment.rejection_reason = None

        # Also mark all submitted proofs as verified
        for proof in payment.proofs:
            if proof.status == "SUBMITTED":
                proof.status = "VERIFIED"
                proof.verified_by = verified_by
                proof.verified_at = datetime.utcnow()
                proof.verification_note = verification_note

        order.payment_status = "PAYMENT_CONFIRMED"
        # Advance order to PAID / PREPARING
        order.status = "PAID"
        order.updated_at = datetime.utcnow()

        conv = db.query(Conversation).filter(Conversation.order_id == order.id).first()
        if conv:
            ChatService.post_system_message(
                db=db,
                conversation_id=conv.id,
                content="🎉 Paiement confirmé par le commerçant ! Votre commande est validée et passe en préparation.",
                metadata={"order_id": order.id, "status": "PAID", "payment_status": "PAYMENT_CONFIRMED"}
            )

        # Audit
        audit = AuditLog(
            id=str(uuid.uuid4()),
            event_name="PAYMENT_CONFIRMED",
            actor_type="MERCHANT",
            actor_name=verified_by,
            resource_type="PAYMENT",
            resource_id=payment.id,
            previous_state=prev_payment_status,
            new_state="PAYMENT_CONFIRMED",
            metadata_json=json.dumps({"amount": payment.amount, "currency": payment.currency})
        )
        db.add(audit)
        db.commit()

        # Notify customer of payment confirmation
        try:
            NotificationEngine.notify_payment_verified(
                db=db,
                order=order,
                store=order.store,
                conversation_id=conv.id if conv else None
            )
            db.commit()
        except Exception as e:
            print("Notice: notify_payment_verified failed:", e)

        if conv:
            manager.safe_broadcast_sync(conv.id, {
                "type": "payment.confirmed",
                "order_id": order.id,
                "status": "PAID",
                "payment_status": "PAYMENT_CONFIRMED"
            })

        return {
            "order_id": order.id,
            "status": order.status,
            "payment_status": payment.status,
            "confirmed_at": payment.confirmed_at.isoformat()
        }

    @staticmethod
    def reject_payment(
        db: Session,
        order_id: str,
        reason: str = "Preuve de paiement illisible ou montant incorrect",
        verified_by: str = "Commerçant"
    ) -> Dict[str, Any]:
        order = db.query(Order).filter(Order.id == order_id).first()
        if not order:
            raise ValueError(f"Order {order_id} not found")

        payment = db.query(Payment).filter(Payment.order_id == order.id).first()
        if not payment:
            raise ValueError(f"Payment for order {order_id} not found")

        prev_payment_status = payment.status
        payment.status = "PAYMENT_REJECTED"
        payment.rejection_reason = reason
        order.payment_status = "PAYMENT_REJECTED"
        order.updated_at = datetime.utcnow()

        for proof in payment.proofs:
            if proof.status == "SUBMITTED":
                proof.status = "REJECTED"
                proof.verified_by = verified_by
                proof.verified_at = datetime.utcnow()
                proof.verification_note = reason

        conv = db.query(Conversation).filter(Conversation.order_id == order.id).first()
        if conv:
            ChatService.post_system_message(
                db=db,
                conversation_id=conv.id,
                content=f"⚠️ Problème avec la preuve de paiement signalée par le vendeur : {reason}. Veuillez envoyer une nouvelle capture valide.",
                metadata={"order_id": order.id, "payment_status": "PAYMENT_REJECTED", "reason": reason}
            )

        audit = AuditLog(
            id=str(uuid.uuid4()),
            event_name="PAYMENT_REJECTED",
            actor_type="MERCHANT",
            actor_name=verified_by,
            resource_type="PAYMENT",
            resource_id=payment.id,
            previous_state=prev_payment_status,
            new_state="PAYMENT_REJECTED",
            metadata_json=json.dumps({"reason": reason})
        )
        db.add(audit)
        db.commit()

        # Notify customer of payment rejection
        try:
            NotificationEngine.notify_payment_rejected(
                db=db,
                order=order,
                store=order.store,
                reason=reason,
                conversation_id=conv.id if conv else None
            )
            db.commit()
        except Exception as e:
            print("Notice: notify_payment_rejected failed:", e)

        if conv:
            manager.safe_broadcast_sync(conv.id, {
                "type": "payment.rejected",
                "order_id": order.id,
                "payment_status": "PAYMENT_REJECTED",
                "reason": reason
            })

        return {
            "order_id": order.id,
            "payment_status": payment.status,
            "rejection_reason": payment.rejection_reason
        }
