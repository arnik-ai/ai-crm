"""اسکریپت seed — ایجاد نقش‌ها، مجوزها، کاربر ادمین و مراحل فروش پیش‌فرض.

اجرا:  python -m app.seed
متغیرها:  SEED_ADMIN_EMAIL، SEED_ADMIN_PASSWORD (اختیاری)
"""
import asyncio
import os

from sqlalchemy import select

from src.modules.crm.infrastructure.models import SalesStage
from src.modules.identity.infrastructure.models import Permission, Role, User
from src.shared.db.base import SessionLocal
from src.shared.security.password import hash_password

# مجوزهای پایه (resource:action)
PERMISSIONS = [
    "students:read", "students:write",
    "courses:write",
    "calls:read", "calls:write",
    "followups:read", "followups:write",
    "dashboard:read",
    "ai:read", "ai:write",
    "assistant:read",
    "users:read", "users:write",
]

# نگاشت نقش → مجوزها
ROLE_PERMS = {
    "admin": PERMISSIONS,
    "sales_manager": ["students:read", "students:write", "calls:read", "calls:write",
                      "followups:read", "followups:write", "dashboard:read",
                      "ai:read", "assistant:read", "courses:write",
                      "users:read", "users:write"],
    "sales_agent": ["students:read", "students:write", "calls:read", "calls:write",
                    "followups:read", "followups:write", "ai:read",
                    "assistant:read"],
    "viewer": ["students:read", "calls:read", "dashboard:read"],
}

# مراحل پیش‌فرض قیف فروش
STAGES = [
    ("New Lead", 1, False, "#94a3b8"),
    ("Contacted", 2, False, "#60a5fa"),
    ("Interested", 3, False, "#34d399"),
    ("Consultation", 4, False, "#fbbf24"),
    ("Negotiation", 5, False, "#f97316"),
    ("Registration Completed", 6, True, "#22c55e"),
    ("Lost", 7, True, "#ef4444"),
]


async def seed() -> None:
    async with SessionLocal() as s:
        # مجوزها
        perm_objs: dict[str, Permission] = {}
        for code in PERMISSIONS:
            existing = await s.scalar(select(Permission).where(Permission.code == code))
            if existing is None:
                existing = Permission(code=code, description=code)
                s.add(existing)
            perm_objs[code] = existing
        await s.flush()

        # نقش‌ها
        role_objs: dict[str, Role] = {}
        for role_name, perm_codes in ROLE_PERMS.items():
            role = await s.scalar(select(Role).where(Role.name == role_name))
            if role is None:
                role = Role(name=role_name, description=role_name)
                s.add(role)
                await s.flush()
            role.permissions = [perm_objs[c] for c in perm_codes]
            role_objs[role_name] = role
        await s.flush()

        # کاربر ادمین
        admin_email = os.getenv("SEED_ADMIN_EMAIL", "admin@crm.local")
        admin_pass = os.getenv("SEED_ADMIN_PASSWORD", "Admin@12345")
        admin = await s.scalar(select(User).where(User.email == admin_email))
        if admin is None:
            admin = User(
                email=admin_email,
                hashed_password=hash_password(admin_pass),
                full_name="مدیر سیستم",
                is_active=True,
            )
            admin.roles = [role_objs["admin"]]
            s.add(admin)
            print(f"کاربر ادمین ساخته شد: {admin_email} / {admin_pass}")
        else:
            print(f"کاربر ادمین از قبل وجود دارد: {admin_email}")

        # مراحل فروش
        for name, order, terminal, color in STAGES:
            exists = await s.scalar(select(SalesStage).where(SalesStage.name == name))
            if exists is None:
                s.add(SalesStage(name=name, order_index=order,
                                 is_terminal=terminal, color=color))

        await s.commit()
        print("seed با موفقیت انجام شد.")


if __name__ == "__main__":
    asyncio.run(seed())
