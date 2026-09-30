from typing import Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.store import Store
from app.models.catalog import Product
from app.models.commerce import OrderIntent
from app.models.analytics import TrafficSource, TrackingEvent
from app.schemas.analytics import AnalyticsOverview, ChannelMetric, TopProductMetric, TrafficSourceMetric
from app.core.clock import utcnow

class AnalyticsService:
    @staticmethod
    def get_overview(db: Session, store_id: str, period: str = "today") -> AnalyticsOverview:
        store = db.query(Store).filter(Store.id == store_id).first()
        if not store:
            raise ValueError("Boutique introuvable")

        # Intentions count
        total_intents = db.query(OrderIntent).filter(OrderIntent.store_id == store_id).count()
        total_sold = db.query(OrderIntent).filter(OrderIntent.store_id == store_id, OrderIntent.status == "SOLD").count()

        # Coherence & Satisfaction metrics
        satisfied_clients_count = db.query(OrderIntent).filter(
            OrderIntent.store_id == store_id,
            OrderIntent.client_status == "SATISFIED"
        ).count()

        cancelled_orders_count = db.query(OrderIntent).filter(
            OrderIntent.store_id == store_id,
            (OrderIntent.client_status == "CANCELLED") | (OrderIntent.status == "CANCELLED")
        ).count()

        discrepancies_count = db.query(OrderIntent).filter(
            OrderIntent.store_id == store_id,
            OrderIntent.coherence_status.in_(["DISCREPANCY_CONFLICT", "DISCREPANCY_SURPRISE"])
        ).count()

        # Discrepancy conflict revenue to deduct from net consolidated revenue
        conflict_intents = db.query(OrderIntent).filter(
            OrderIntent.store_id == store_id,
            OrderIntent.coherence_status == "DISCREPANCY_CONFLICT"
        ).all()
        discrepancy_amount = sum(c.total_amount for c in conflict_intents)

        total_evaluated = satisfied_clients_count + cancelled_orders_count
        if total_evaluated > 0:
            satisfaction_rate = round((satisfied_clients_count / total_evaluated) * 100, 1)
        else:
            satisfaction_rate = 0.0  # aucune évaluation client : pas de taux inventé

        # Fenêtre temporelle réelle selon la période (aucune valeur inventée)
        from datetime import datetime, timedelta
        now = utcnow()
        if period == "today":
            start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        elif period == "7days":
            start = now - timedelta(days=7)
        elif period == "month":
            start = now - timedelta(days=30)
        else:
            start = None
        span = (now - start) if start else None
        prev_start = (start - span) if start else None

        def _intents(q_start, q_end=None):
            q = db.query(OrderIntent).filter(OrderIntent.store_id == store_id)
            if q_start is not None:
                q = q.filter(OrderIntent.created_at >= q_start)
            if q_end is not None:
                q = q.filter(OrderIntent.created_at < q_end)
            return q

        cur_rows = _intents(start).all()
        sold_rows = [i for i in cur_rows if i.status == "SOLD"]
        cur_intents = len(cur_rows)
        cur_sold = len(sold_rows)
        cur_revenue = sum(int(i.total_amount or 0) for i in sold_rows)

        if start is not None:
            prev_sold = [i for i in _intents(prev_start, start).all() if i.status == "SOLD"]
            prev_revenue = sum(int(i.total_amount or 0) for i in prev_sold)
            growth = round((cur_revenue - prev_revenue) / prev_revenue * 100, 1) if prev_revenue > 0 else 0.0
        else:
            growth = 0.0

        vq = db.query(func.count(TrackingEvent.id)).filter(
            TrackingEvent.store_id == store_id, TrackingEvent.event_type == "STORE_VIEW"
        )
        if start is not None:
            vq = vq.filter(TrackingEvent.created_at >= start)
        cur_visitors = int(vq.scalar() or 0)

        # Sparkline : chiffre d'affaires réel réparti en 10 tranches de temps (normalisé 0-100)
        sparkline = [0] * 10
        if sold_rows:
            t0 = start or min(i.created_at for i in sold_rows)
            width = max((now - t0).total_seconds(), 1) / 10
            buckets = [0] * 10
            for i in sold_rows:
                idx = min(9, max(0, int((i.created_at - t0).total_seconds() / width)))
                buckets[idx] += int(i.total_amount or 0)
            peak = max(buckets) or 1
            sparkline = [int(v * 100 / peak) for v in buckets]

        consolidated_revenue = max(0, cur_revenue - discrepancy_amount)
        consolidated_sales_count = max(0, cur_sold - discrepancies_count)
        conv_rate = round((cur_sold / cur_intents * 100), 1) if cur_intents > 0 else 0.0

        # Canaux : agrégés depuis les intentions réelles
        channel_meta = {
            "WHATSAPP": ("WhatsApp Direct", "#10b981"),
            "MESSENGER": ("Messenger FB", "#6366f1"),
            "TIKTOK": ("TikTok Shop / DM", "#ff5733"),
        }
        agg = {}
        for i in cur_rows:
            key = (i.channel_type or "AUTRE").upper()
            d = agg.setdefault(key, [0, 0])
            d[0] += 1
            if i.status == "SOLD":
                d[1] += 1
        max_clicks = max([v[0] for v in agg.values()] or [1])
        channels = []
        for key, (clicks, sales) in sorted(agg.items(), key=lambda kv: -kv[1][0]):
            name, color = channel_meta.get(key, (key.title(), "#94a3b8"))
            channels.append(ChannelMetric(
                channel_type=key,
                display_name=name,
                clicks=clicks,
                confirmed_sales=sales,
                conversion_rate=round(sales / clicks * 100, 1) if clicks else 0.0,
                badge_label=None,
                color_hex=color,
                percentage_bar=round(clicks / max_clicks * 100, 1),
            ))

        # Top products
        db_products = db.query(Product).filter(Product.store_id == store_id, Product.is_published == True).order_by(Product.sales_count.desc()).limit(3).all()
        top_products = []
        for idx, prod in enumerate(db_products, 1):
            top_products.append(TopProductMetric(
                rank=idx,
                product_id=prod.id,
                product_name=prod.name,
                image_url=prod.primary_image_url,
                confirmed_sales=prod.sales_count,
                revenue=prod.revenue,
                currency=prod.currency
            ))

        # Traffic sources from DB
        db_sources = db.query(TrafficSource).filter(TrafficSource.store_id == store_id).order_by(TrafficSource.display_order.asc()).all()
        if not db_sources:
            traffic_sources = []
        else:
            total_visits = sum(s.visits_count for s in db_sources) or 1
            traffic_sources = [
                TrafficSourceMetric(
                    source_name=s.source_name,
                    source_code=s.source_code,
                    percentage=round((s.visits_count / total_visits) * 100, 1),
                    visits_count=s.visits_count,
                    color_hex=s.color_hex,
                ) for s in db_sources
            ]

        return AnalyticsOverview(
            period=period,
            total_revenue=cur_revenue,
            consolidated_revenue=consolidated_revenue,
            revenue_growth_percentage=growth,
            visitors_count=cur_visitors,
            intentions_count=cur_intents,
            confirmed_sales_count=cur_sold,
            consolidated_sales_count=consolidated_sales_count,
            satisfaction_rate=satisfaction_rate,
            satisfied_clients_count=satisfied_clients_count,
            cancelled_orders_count=cancelled_orders_count,
            discrepancies_count=discrepancies_count,
            overall_conversion_rate=conv_rate,
            currency=store.currency,
            channels=channels,
            top_products=top_products,
            traffic_sources=traffic_sources,
            sparkline_points=sparkline,
        )

    @staticmethod
    def track_visit(db: Session, store_id: str, source_code: str) -> None:
        source_code = source_code.lower().strip()
        ts = db.query(TrafficSource).filter(
            TrafficSource.store_id == store_id,
            TrafficSource.source_code == source_code
        ).first()

        name_map = {
            "tiktok_bio": "TikTok Bio",
            "tiktok": "TikTok",
            "fb_post": "FB Post",
            "facebook": "Facebook Post",
            "wa_status": "Statut WA",
            "whatsapp": "WhatsApp Direct",
            "instagram": "Instagram",
            "twitter": "X / Twitter",
            "qr": "QR Code Boutique",
        }
        color_map = {
            "tiktok_bio": "#ff5733",
            "tiktok": "#FE2C55",
            "fb_post": "#6366f1",
            "facebook": "#0084FF",
            "wa_status": "#10b981",
            "whatsapp": "#25D366",
            "instagram": "#E1306C",
            "twitter": "#1DA1F2",
            "qr": "#f59e0b",
        }

        if ts:
            ts.visits_count += 1
        else:
            ts = TrafficSource(
                store_id=store_id,
                source_name=name_map.get(source_code, source_code.capitalize()),
                source_code=source_code,
                color_hex=color_map.get(source_code, "#ff5733"),
                visits_count=1,
                display_order=99
            )
            db.add(ts)

        # Record TrackingEvent
        db.add(TrackingEvent(
            store_id=store_id,
            event_type="STORE_VIEW",
            source=source_code,
        ))
        db.commit()
