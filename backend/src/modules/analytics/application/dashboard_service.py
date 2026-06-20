"""سرویس داشبورد — کوئری‌های تجمیعی (روی Read Model/Materialized View)."""


class DashboardService:
    async def summary(self, tenant_id: str | None) -> dict:
        # در پیاده‌سازی واقعی: کوئری روی Materialized View برای کارایی بالا
        return {
            "calls_today": 0, "calls_week": 0,
            "hot_leads": 0, "warm_leads": 0, "cold_leads": 0,
            "followups_today": 0, "conversion_rate": 0.0,
        }

    async def funnel(self, tenant_id: str | None) -> dict:
        # توزیع سرنخ‌ها بر اساس sales_stages.order_index
        return {"stages": []}

    async def team_performance(self, tenant_id: str | None) -> dict:
        return {"agents": []}

    async def followups_today(self, owner_id: str) -> dict:
        return {"items": []}
