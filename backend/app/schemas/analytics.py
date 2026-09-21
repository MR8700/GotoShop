from typing import List, Optional
from pydantic import BaseModel

class ChannelMetric(BaseModel):
    channel_type: str
    display_name: str
    clicks: int
    confirmed_sales: int
    conversion_rate: float
    badge_label: Optional[str] = None
    color_hex: str
    percentage_bar: float

class TopProductMetric(BaseModel):
    rank: int
    product_id: str
    product_name: str
    image_url: Optional[str] = None
    confirmed_sales: int
    revenue: int
    currency: str

class TrafficSourceMetric(BaseModel):
    source_name: str
    source_code: str
    percentage: float
    visits_count: int
    color_hex: str

class AnalyticsOverview(BaseModel):
    period: str # today, 7days, month, all
    total_revenue: int
    consolidated_revenue: int = 0
    revenue_growth_percentage: float
    visitors_count: int
    intentions_count: int
    confirmed_sales_count: int
    consolidated_sales_count: int = 0
    satisfaction_rate: float = 100.0
    satisfied_clients_count: int = 0
    cancelled_orders_count: int = 0
    discrepancies_count: int = 0
    overall_conversion_rate: float
    currency: str
    channels: List[ChannelMetric]
    top_products: List[TopProductMetric]
    traffic_sources: List[TrafficSourceMetric]
    sparkline_points: List[int]
