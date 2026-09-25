import json
import uuid
import secrets
from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.order import Order, OrderItem, OrderDelivery
from app.models.payment import Payment, PaymentProof
from app.models.chat import Conversation
from app.models.store import Store, StoreAccessHistory
from app.models.catalog import Product, ProductVariant
from app.models.customer import Customer
from app.models.audit import AuditLog
from app.models.commerce import OrderIntent
from app.services.chat_service import ChatService
from app.services.store_service import StoreService
from app.services.notification_engine import NotificationEngine
from app.realtime.connection_manager import manager

class OrderService:
    @staticmethod
    def generate_order_number(db: Session, store_slug: Optional[str] = None) -> str:
        prefix = "CMD"
        if store_slug and "kossodo" in store_slug.lower():
            prefix = "KSD"
        elif store_slug and "danfani" in store_slug.lower():
            prefix = "FSD"
        
        # Count existing orders and ensure unique order_number
        count = db.query(Order).count() + 1040
        candidate = f"{prefix}-{count}"
        offset = 0
        while db.query(Order).filter(Order.order_number == candidate).first():
            offset += 1
            candidate = f"{prefix}-{count + offset}"
        return candidate

    @staticmethod
    def create_order(
        db: Session,
        store_id: str,
        items_data: List[Dict[str, Any]],
        delivery_data: Dict[str, Any],
        customer_name: str,
        customer_phone: Optional[str] = None,
        customer_email: Optional[str] = None,
        customer_id: Optional[str] = None,
        customer_token: Optional[str] = None,
        delivery_fee: int = 500,
        notes: Optional[str] = None,
        register_account: bool = False,
        country: Optional[str] = "Burkina Faso",
        city: Optional[str] = "Ouagadougou",
        delivery_neighborhood: Optional[str] = None,
    ) -> Dict[str, Any]:
        try:
            store = StoreService.resolve_store(db, slug=store_id)
            if not store:
                store = StoreService.get_default_store(db)
            if not store:
                raise ValueError(f"Boutique introuvable ({store_id})")

            actual_store_id = store.id

            if not items_data:
                raise ValueError("Veuillez ajouter au moins un produit à votre commande.")

            # Validate or auto-create customer for seamless checkout onboarding
            actual_customer_id = None
            cust = None
            if customer_id:
                cust = db.query(Customer).filter(Customer.id == customer_id).first()
            if not cust and customer_phone:
                cust = db.query(Customer).filter(Customer.phone == customer_phone).first()

            if cust:
                actual_customer_id = cust.id
                if customer_token:
                    cust.session_token = customer_token
                elif not cust.session_token:
                    cust.session_token = secrets.token_hex(24)
                customer_token = cust.session_token
                if country:
                    cust.country = country
                if city:
                    cust.city = city
                if delivery_neighborhood:
                    cust.delivery_neighborhood = delivery_neighborhood
            elif (register_account or customer_phone) and customer_name:
                new_session_token = customer_token or secrets.token_hex(24)
                cust = Customer(
                    id=str(uuid.uuid4()),
                    store_id=actual_store_id,
                    name=customer_name or "Client",
                    phone=customer_phone or "00000000",
                    email=customer_email,
                    country=country or "Burkina Faso",
                    city=city or "Ouagadougou",
                    delivery_neighborhood=delivery_neighborhood,
                    session_token=new_session_token,
                    created_at=datetime.utcnow()
                )
                db.add(cust)
                db.flush()
                actual_customer_id = cust.id
                customer_token = new_session_token

            order_number = OrderService.generate_order_number(db, store.slug)
            order_id = str(uuid.uuid4())

            # Calculate items subtotal
            # Calculate items subtotal
            subtotal = 0
            order_items = []
            for it in items_data:
                product_id = it.get("product_id")
                variant_id = it.get("variant_id")
                qty = float(it.get("quantity", 1.0))
                if qty <= 0:
                    qty = 1.0

                product = None
                if product_id:
                    product = db.query(Product).filter(Product.id == product_id).first()
                    if not product and hasattr(Product, "slug"):
                        product = db.query(Product).filter(Product.slug == product_id).first()

                if not product:
                    product = db.query(Product).filter(Product.store_id == actual_store_id).first()

                # Polymorphic unit and pricing model resolution
                unit = it.get("unit") or (getattr(product, "sales_unit", None) or "PIECE")
                unit_label = it.get("unit_label") or (getattr(product, "sales_unit_label", None) or "pièce")
                pricing_model = it.get("pricing_model") or (getattr(product, "pricing_model", None) or "FIXED_PER_UNIT")

                # Validate constraints against product sales configuration if configured
                if product:
                    min_q = getattr(product, "min_quantity", 0.1) or 0.1
                    max_q = getattr(product, "max_quantity", 9999.0) or 9999.0
                    step_q = getattr(product, "quantity_step", 1.0) or 1.0
                    if qty < min_q:
                        raise ValueError(f"La quantité minimale pour {product.name} est de {min_q} {unit_label}.")
                    if qty > max_q:
                        raise ValueError(f"La quantité maximale pour {product.name} est de {max_q} {unit_label}.")
                    # Tolerant step validation
                    quotient = qty / step_q
                    if abs(quotient - round(quotient)) > 1e-3:
                        raise ValueError(f"La quantité ({qty}) doit être un multiple de {step_q} {unit_label} pour {product.name}.")

                product_name = it.get("product_name") or (product.name if product else "Produit")
                unit_price = int(it.get("unit_price", 0)) if it.get("unit_price") is not None else 0
                if not unit_price and product:
                    unit_price = product.price

                var = None
                variant_name = it.get("variant_name")
                if variant_id:
                    var = db.query(ProductVariant).filter(ProductVariant.id == variant_id).first()
                    if var:
                        variant_name = var.name
                        if var.price_override:
                            unit_price = var.price_override

                total_price = int(round(unit_price * qty))
                subtotal += total_price

                customization_text = it.get("customization_text")
                customization_options = it.get("customization_options")
                if isinstance(customization_options, (dict, list)):
                    customization_options = json.dumps(customization_options, ensure_ascii=False)

                measurements = it.get("measurements")
                if isinstance(measurements, (dict, list)):
                    measurements = json.dumps(measurements, ensure_ascii=False)

                is_customized = bool(customization_text or customization_options or measurements)

                # Store snapshot of sales configuration
                sales_config_snapshot = json.dumps({
                    "sales_unit": unit,
                    "sales_unit_label": unit_label,
                    "measurement_type": getattr(product, "measurement_type", "COUNT") if product else "COUNT",
                    "pricing_model": pricing_model,
                    "quantity_step": getattr(product, "quantity_step", 1.0) if product else 1.0,
                    "quantity_precision": getattr(product, "quantity_precision", 0) if product else 0,
                    "min_quantity": getattr(product, "min_quantity", 1.0) if product else 1.0,
                    "max_quantity": getattr(product, "max_quantity", 9999.0) if product else 9999.0,
                }, ensure_ascii=False)

                # Atomically decrement stock if tracked
                if product and product.stock is not None:
                    product.stock = max(0.0, round(float(product.stock) - qty, 3))
                    product.stock_label = f"Stock: {product.stock} {unit_label}".strip()

                # Store only valid ForeignKeys
                actual_product_id = product.id if product else None
                actual_variant_id = var.id if var else None

                item = OrderItem(
                    id=str(uuid.uuid4()),
                    order_id=order_id,
                    product_id=actual_product_id,
                    variant_id=actual_variant_id,
                    product_name=product_name,
                    variant_name=variant_name,
                    quantity=qty,
                    unit=unit,
                    unit_label=unit_label,
                    unit_price=unit_price,
                    total_price=total_price,
                    pricing_model=pricing_model,
                    measurements=measurements,
                    sales_config_snapshot=sales_config_snapshot,
                    is_customized=is_customized,
                    customization_text=customization_text,
                    customization_options=customization_options
                )
                order_items.append(item)

            total_amount = subtotal + delivery_fee

            order = Order(
                id=order_id,
                order_number=order_number,
                store_id=actual_store_id,
                customer_id=actual_customer_id,
                customer_token=customer_token,
                customer_name=customer_name,
                customer_phone=customer_phone,
                customer_email=customer_email,
                status="PENDING_SELLER_ACCEPTANCE",
                payment_status="PAYMENT_PENDING",
                subtotal_amount=subtotal,
                delivery_fee=delivery_fee,
                discount_amount=0,
                total_amount=total_amount,
                currency=store.currency or "FCFA",
                notes=notes,
                created_at=datetime.utcnow()
            )
            db.add(order)
            db.flush()

            for itm in order_items:
                db.add(itm)

            # Delivery details
            delivery = OrderDelivery(
                id=str(uuid.uuid4()),
                order_id=order.id,
                delivery_mode=delivery_data.get("delivery_mode", "GPS_AND_DESCRIPTION"),
                delivery_city=delivery_data.get("delivery_city", "Kossodo (Ouagadougou)"),
                delivery_address=delivery_data.get("delivery_address"),
                latitude=delivery_data.get("latitude"),
                longitude=delivery_data.get("longitude"),
                location_accuracy=delivery_data.get("location_accuracy"),
                location_captured_at=datetime.utcnow() if delivery_data.get("latitude") else None,
                delivery_notes=delivery_data.get("delivery_notes"),
                delivery_status="PENDING"
            )
            db.add(delivery)

            # Initial pending payment record
            payment = Payment(
                id=str(uuid.uuid4()),
                order_id=order.id,
                store_id=actual_store_id,
                amount=total_amount,
                currency=order.currency,
                payment_method="MOBILE_MONEY_PROOF",
                status="PAYMENT_PENDING"
            )
            db.add(payment)

            # Also create a bridging OrderIntent so existing analytics & metrics reflect this sale
            try:
                intent_product = db.query(Product).filter(Product.id == order_items[0].product_id).first() if order_items and order_items[0].product_id else None
                if not intent_product:
                    intent_product = db.query(Product).filter(Product.store_id == actual_store_id).first() or db.query(Product).first()

                if intent_product:
                    intent = OrderIntent(
                        id=str(uuid.uuid4()),
                        reference_code=order_number,
                        store_id=actual_store_id,
                        product_id=intent_product.id,
                        channel_type="IN_APP_CHAT",
                        customer_name=customer_name,
                        customer_phone=customer_phone,
                        customer_source="CONVERSATIONAL_COMMERCE",
                        customer_location_url=f"https://maps.google.com/?q={delivery.latitude},{delivery.longitude}" if delivery.latitude else None,
                        customer_coordinates=f"{delivery.latitude}, {delivery.longitude}" if delivery.latitude else None,
                        customer_id=actual_customer_id,
                        quantity=order_items[0].quantity if order_items else 1,
                        selected_color=order_items[0].variant_name if order_items else "Standard",
                        delivery_city=delivery.delivery_city,
                        unit_price=order_items[0].unit_price if order_items else total_amount,
                        total_amount=total_amount,
                        currency=order.currency,
                        status="CREATED",
                        client_status="PENDING",
                        coherence_status="HARMONIZED_PENDING"
                    )
                    db.add(intent)
            except Exception as e_intent:
                print("Notice: OrderIntent bridge skipped:", e_intent)

            # Create or link order conversation
            conv = ChatService.get_or_create_conversation(
                db=db,
                store_id=actual_store_id,
                context_type="ORDER",
                order_id=order.id,
                customer_id=actual_customer_id,
                customer_token=customer_token,
                customer_name=customer_name
            )

            # Post initial interactive Order Card into conversation
            def format_item_summary(it):
                qty = it.quantity
                qty_str = f"{int(qty)}" if qty == int(qty) else f"{qty:g}".replace(".", ",")
                unit = (it.unit_label or "").strip()
                if unit and unit != "pièce" and unit != "pcs":
                    if qty > 1 and not unit.endswith("s") and not unit.endswith("x") and unit not in ["m", "cm", "kg", "g", "L", "ml", "h", "j"]:
                        unit = f"{unit}s"
                    return f"{it.product_name} ({qty_str} {unit})"
                elif qty > 1:
                    return f"{it.product_name} ({qty_str} pcs)"
                return f"{it.product_name} ({qty_str})"

            items_summary = ", ".join([format_item_summary(it) for it in order_items])
            order_card_metadata = {
                "order_id": order.id,
                "order_number": order.order_number,
                "total_amount": order.total_amount,
                "currency": order.currency,
                "items_count": len(order_items),
                "items_summary": items_summary,
                "items": [
                    {
                        "product_name": it.product_name,
                        "quantity": it.quantity,
                        "unit": it.unit,
                        "unit_label": it.unit_label,
                        "unit_price": it.unit_price,
                        "total_price": it.total_price,
                    }
                    for it in order_items
                ],
                "status": order.status,
                "payment_status": order.payment_status,
                "delivery_address": delivery.delivery_address,
                "has_gps": bool(delivery.latitude and delivery.longitude),
                "latitude": delivery.latitude,
                "longitude": delivery.longitude
            }

            ChatService.send_message(
                db=db,
                conversation_id=conv.id,
                sender_type="SYSTEM",
                sender_name="Système",
                content=f"📦 Nouvelle commande #{order.order_number} créée pour un total de {order.total_amount:,} {order.currency}. En attente de validation par le commerçant.",
                message_type="ORDER",
                metadata=order_card_metadata
            )

            # Audit log
            audit = AuditLog(
                id=str(uuid.uuid4()),
                event_name="ORDER_CREATED",
                actor_type="CUSTOMER",
                actor_id=customer_id or customer_token,
                actor_name=customer_name,
                resource_type="ORDER",
                resource_id=order.id,
                previous_state=None,
                new_state=order.status,
                metadata_json=json.dumps({"order_number": order.order_number, "total_amount": order.total_amount})
            )
            db.add(audit)

            # Access history touchpoint
            try:
                hist = StoreAccessHistory(
                    id=str(uuid.uuid4()),
                    store_id=actual_store_id,
                    customer_id=actual_customer_id,
                    guest_token=customer_token,
                    interaction_type="ORDER",
                    last_interacted_at=datetime.utcnow()
                )
                db.add(hist)
            except Exception as e_hist:
                print("Notice: StoreAccessHistory skipped:", e_hist)

            db.commit()
            db.refresh(order)

            # Centralized notification dispatch to store owner
            try:
                NotificationEngine.notify_order_created(
                    db=db,
                    order=order,
                    store=store,
                    conversation_id=conv.id
                )
                db.commit()
            except Exception as e_notif:
                print("Notice: notify_order_created skipped:", e_notif)

            # Broadcast via WebSocket to store owner / user
            manager.safe_broadcast_sync(conv.id, {
                "type": "order.created",
                "order_id": order.id,
                "order_number": order.order_number,
                "store_id": actual_store_id,
                "total_amount": order.total_amount,
                "currency": order.currency,
                "customer_name": customer_name,
                "conversation_id": conv.id
            })

            formatted = OrderService.format_order_dict(order, conversation_id=conv.id)
            if cust:
                formatted["customer_token"] = cust.session_token
                formatted["customer"] = {
                    "id": cust.id,
                    "name": cust.name,
                    "phone": cust.phone,
                    "city": cust.city,
                    "country": cust.country,
                    "delivery_neighborhood": cust.delivery_neighborhood,
                    "bonus_points": cust.bonus_points or 0,
                }
            return formatted
        except Exception as e:
            db.rollback()
            raise e

    @staticmethod
    def accept_order(db: Session, order_id: str, seller_name: str = "Commerçant") -> Dict[str, Any]:
        order = db.query(Order).filter(Order.id == order_id).first()
        if not order:
            raise ValueError(f"Order {order_id} not found")

        prev_status = order.status
        order.status = "ACCEPTED"
        order.payment_status = "PAYMENT_PENDING"
        order.updated_at = datetime.utcnow()

        # Find conversation
        conv = db.query(Conversation).filter(Conversation.order_id == order.id).first()
        if conv:
            ChatService.post_system_message(
                db=db,
                conversation_id=conv.id,
                content="✅ Votre commande a été acceptée par le vendeur. Vous pouvez maintenant effectuer le paiement et envoyer la preuve dans cette conversation.",
                metadata={"order_id": order.id, "status": "ACCEPTED", "payment_status": "PAYMENT_PENDING"}
            )

        # Audit
        audit = AuditLog(
            id=str(uuid.uuid4()),
            event_name="ORDER_ACCEPTED",
            actor_type="MERCHANT",
            actor_name=seller_name,
            resource_type="ORDER",
            resource_id=order.id,
            previous_state=prev_status,
            new_state="ACCEPTED"
        )
        db.add(audit)
        db.commit()
        db.refresh(order)

        # Notify customer
        try:
            NotificationEngine.notify_order_accepted(
                db=db,
                order=order,
                store=order.store,
                conversation_id=conv.id if conv else None
            )
            db.commit()
        except Exception as e:
            print("Notice: notify_order_accepted failed:", e)

        # Broadcast
        if conv:
            manager.safe_broadcast_sync(conv.id, {
                "type": "order.status_updated",
                "order_id": order.id,
                "status": "ACCEPTED",
                "payment_status": "PAYMENT_PENDING"
            })

        return OrderService.format_order_dict(order)

    @staticmethod
    def reject_order(db: Session, order_id: str, reason: Optional[str] = None, seller_name: str = "Commerçant") -> Dict[str, Any]:
        order = db.query(Order).filter(Order.id == order_id).first()
        if not order:
            raise ValueError(f"Order {order_id} not found")

        prev_status = order.status
        order.status = "REJECTED"
        order.rejection_reason = reason or "Indisponibilité temporaire des ingrédients"
        order.updated_at = datetime.utcnow()

        conv = db.query(Conversation).filter(Conversation.order_id == order.id).first()
        if conv:
            msg = f"❌ La commande a été refusée par le vendeur. Motif : {order.rejection_reason}"
            ChatService.post_system_message(
                db=db,
                conversation_id=conv.id,
                content=msg,
                metadata={"order_id": order.id, "status": "REJECTED", "reason": order.rejection_reason}
            )

        audit = AuditLog(
            id=str(uuid.uuid4()),
            event_name="ORDER_REJECTED",
            actor_type="MERCHANT",
            actor_name=seller_name,
            resource_type="ORDER",
            resource_id=order.id,
            previous_state=prev_status,
            new_state="REJECTED",
            metadata_json=json.dumps({"reason": order.rejection_reason})
        )
        db.add(audit)
        db.commit()
        db.refresh(order)

        # Notify customer
        try:
            NotificationEngine.notify_order_rejected(
                db=db,
                order=order,
                store=order.store,
                reason=order.rejection_reason,
                conversation_id=conv.id if conv else None
            )
            db.commit()
        except Exception as e:
            print("Notice: notify_order_rejected failed:", e)

        if conv:
            manager.safe_broadcast_sync(conv.id, {
                "type": "order.status_updated",
                "order_id": order.id,
                "status": "REJECTED",
                "reason": order.rejection_reason
            })

        return OrderService.format_order_dict(order)

    @staticmethod
    def update_order_status(db: Session, order_id: str, new_status: str, notes: Optional[str] = None, actor_name: str = "Commerçant") -> Dict[str, Any]:
        order = db.query(Order).filter(Order.id == order_id).first()
        if not order:
            raise ValueError(f"Order {order_id} not found")

        prev_status = order.status
        order.status = new_status
        order.updated_at = datetime.utcnow()

        status_messages = {
            "PREPARING": "👨‍🍳 Commande en cours de préparation en cuisine !",
            "READY_FOR_DELIVERY": "🥡 Commande prête et emballée ! En attente du coursier.",
            "OUT_FOR_DELIVERY": "🛵 La commande est en route vers votre lieu de livraison.",
            "DELIVERED": "📍 Commande livrée avec succès ! Bon appétit.",
            "COMPLETED": "🎉 Commande terminée et archivée avec succès. Merci pour votre confiance !"
        }

        content = status_messages.get(new_status, f"Statut de la commande mis à jour : {new_status}")
        if notes:
            content += f" ({notes})"

        conv = db.query(Conversation).filter(Conversation.order_id == order.id).first()
        if conv:
            ChatService.post_system_message(
                db=db,
                conversation_id=conv.id,
                content=content,
                metadata={"order_id": order.id, "status": new_status, "notes": notes}
            )

        audit = AuditLog(
            id=str(uuid.uuid4()),
            event_name="ORDER_STATUS_CHANGED",
            actor_type="MERCHANT",
            actor_name=actor_name,
            resource_type="ORDER",
            resource_id=order.id,
            previous_state=prev_status,
            new_state=new_status,
            metadata_json=json.dumps({"notes": notes})
        )
        db.add(audit)
        db.commit()
        db.refresh(order)

        # Notify customer
        try:
            NotificationEngine.notify_order_status_updated(
                db=db,
                order=order,
                store=order.store,
                new_status=new_status,
                conversation_id=conv.id if conv else None
            )
            db.commit()
        except Exception as e:
            print("Notice: notify_order_status_updated failed:", e)

        if conv:
            manager.safe_broadcast_sync(conv.id, {
                "type": "order.status_updated",
                "order_id": order.id,
                "status": new_status
            })

        return OrderService.format_order_dict(order)

    @staticmethod
    def cancel_order(db: Session, order_id: str, reason: Optional[str] = "Annulé par le client", actor_name: str = "Client") -> Dict[str, Any]:
        order = db.query(Order).filter(Order.id == order_id).first()
        if not order:
            raise ValueError(f"Commande {order_id} introuvable")

        prev_status = order.status
        order.status = "CANCELLED"
        order.rejection_reason = reason or "Annulé par le client"
        order.updated_at = datetime.utcnow()

        # Restock products if stock was tracked
        for it in (order.items or []):
            if it.product_id:
                prod = db.query(Product).filter(Product.id == it.product_id).first()
                if prod and prod.stock is not None:
                    prod.stock = round(float(prod.stock) + float(it.quantity), 3)
                    prod.stock_label = f"Stock: {prod.stock} {it.unit_label}".strip()

        # Update linked conversation
        conv = db.query(Conversation).filter(Conversation.order_id == order.id).first()
        if conv:
            msg = f"❌ La commande #{order.order_number} a été annulée. Motif : {order.rejection_reason}"
            ChatService.post_system_message(
                db=db,
                conversation_id=conv.id,
                content=msg,
                metadata={"order_id": order.id, "status": "CANCELLED", "reason": order.rejection_reason}
            )

        # Audit log
        audit = AuditLog(
            id=str(uuid.uuid4()),
            event_name="ORDER_CANCELLED",
            actor_type="CUSTOMER" if "client" in (actor_name or "").lower() else "MERCHANT",
            actor_name=actor_name,
            resource_type="ORDER",
            resource_id=order.id,
            previous_state=prev_status,
            new_state="CANCELLED",
            metadata_json=json.dumps({"reason": order.rejection_reason})
        )
        db.add(audit)
        db.commit()
        db.refresh(order)

        # Centralized notification dispatch
        try:
            NotificationEngine.notify_order_cancelled(
                db=db,
                order=order,
                store=order.store,
                reason=order.rejection_reason,
                cancelled_by=actor_name,
                conversation_id=conv.id if conv else None
            )
            db.commit()
        except Exception as e:
            print("Notice: notify_order_cancelled failed:", e)

        if conv:
            manager.safe_broadcast_sync(conv.id, {
                "type": "order.status_updated",
                "order_id": order.id,
                "status": "CANCELLED",
                "reason": order.rejection_reason
            })

        return OrderService.format_order_dict(order)

    @staticmethod
    def list_orders(
        db: Session,
        store_id: Optional[str] = None,
        customer_id: Optional[str] = None,
        customer_token: Optional[str] = None,
        status: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        query = db.query(Order)
        if store_id:
            query = query.filter(Order.store_id == store_id)
        if customer_id:
            query = query.filter(Order.customer_id == customer_id)
        elif customer_token:
            query = query.filter(
                (Order.customer_token == customer_token) |
                (Order.customer_id.in_(
                    db.query(Customer.id).filter(Customer.session_token == customer_token)
                ))
            )
        if status:
            query = query.filter(Order.status == status)

        orders = query.order_by(desc(Order.created_at)).all()
        return [OrderService.format_order_dict(o) for o in orders]

    @staticmethod
    def get_order_by_id(db: Session, order_id: str) -> Optional[Dict[str, Any]]:
        order = db.query(Order).filter(Order.id == order_id).first()
        if not order:
            return None
        return OrderService.format_order_dict(order)

    @staticmethod
    def format_order_dict(order: Order, conversation_id: Optional[str] = None) -> Dict[str, Any]:
        conv_id = conversation_id
        if not conv_id and order.conversations:
            conv_id = order.conversations[0].id

        delivery_info = None
        if order.delivery:
            delivery_info = {
                "id": order.delivery.id,
                "delivery_mode": order.delivery.delivery_mode,
                "delivery_city": order.delivery.delivery_city,
                "delivery_address": order.delivery.delivery_address,
                "latitude": order.delivery.latitude,
                "longitude": order.delivery.longitude,
                "location_accuracy": order.delivery.location_accuracy,
                "delivery_notes": order.delivery.delivery_notes,
                "delivery_status": order.delivery.delivery_status,
                "maps_url": f"https://maps.google.com/?q={order.delivery.latitude},{order.delivery.longitude}" if order.delivery.latitude else None
            }

        items_info = []
        for it in (order.items or []):
            opts = None
            if it.customization_options:
                try:
                    opts = json.loads(it.customization_options)
                except Exception:
                    opts = it.customization_options

            measurements = None
            if getattr(it, "measurements", None):
                try:
                    measurements = json.loads(it.measurements)
                except Exception:
                    measurements = it.measurements

            snapshot = None
            if getattr(it, "sales_config_snapshot", None):
                try:
                    snapshot = json.loads(it.sales_config_snapshot)
                except Exception:
                    snapshot = it.sales_config_snapshot

            items_info.append({
                "id": it.id,
                "product_id": it.product_id,
                "variant_id": it.variant_id,
                "product_name": it.product_name,
                "variant_name": it.variant_name,
                "quantity": it.quantity,
                "unit": getattr(it, "unit", "PIECE") or "PIECE",
                "unit_label": getattr(it, "unit_label", "pièce") or "pièce",
                "unit_price": it.unit_price,
                "total_price": it.total_price,
                "pricing_model": getattr(it, "pricing_model", "FIXED_PER_UNIT") or "FIXED_PER_UNIT",
                "measurements": measurements,
                "sales_config_snapshot": snapshot,
                "is_customized": it.is_customized,
                "customization_text": it.customization_text,
                "customization_options": opts
            })

        latest_payment = order.payments[-1] if order.payments else None
        payment_info = None
        if latest_payment:
            proofs_info = [
                {
                    "id": p.id,
                    "file_url": p.file_url,
                    "file_name": p.file_name,
                    "mime_type": p.mime_type,
                    "file_size": p.file_size,
                    "status": p.status,
                    "customer_note": p.customer_note,
                    "verified_at": p.verified_at.isoformat() if p.verified_at else None,
                    "created_at": p.created_at.isoformat() if p.created_at else None
                }
                for p in latest_payment.proofs
            ]
            payment_info = {
                "id": latest_payment.id,
                "amount": latest_payment.amount,
                "currency": latest_payment.currency,
                "status": latest_payment.status,
                "payment_method": latest_payment.payment_method,
                "transaction_reference": latest_payment.transaction_reference,
                "confirmed_at": latest_payment.confirmed_at.isoformat() if latest_payment.confirmed_at else None,
                "rejection_reason": latest_payment.rejection_reason,
                "proofs": proofs_info
            }

        store_name = ""
        store_slug = ""
        try:
            if order.store:
                store_name = order.store.name or ""
                store_slug = order.store.slug or ""
        except Exception:
            pass

        return {
            "id": order.id,
            "order_number": order.order_number,
            "store_id": order.store_id,
            "store_name": store_name,
            "store_slug": store_slug,
            "customer_id": order.customer_id,
            "customer_name": order.customer_name,
            "customer_phone": order.customer_phone,
            "customer_email": order.customer_email,
            "status": order.status,
            "payment_status": order.payment_status,
            "subtotal_amount": order.subtotal_amount,
            "delivery_fee": order.delivery_fee,
            "discount_amount": order.discount_amount,
            "total_amount": order.total_amount,
            "currency": order.currency,
            "notes": order.notes,
            "rejection_reason": order.rejection_reason,
            "created_at": order.created_at.isoformat() if order.created_at else None,
            "updated_at": order.updated_at.isoformat() if order.updated_at else None,
            "conversation_id": conv_id,
            "items": items_info,
            "delivery": delivery_info,
            "payment": payment_info
        }
