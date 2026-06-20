"""Alembic environment — async + autogenerate از مدل‌های همه‌ی ماژول‌ها."""
import asyncio
from logging.config import fileConfig

from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config
from sqlalchemy import pool

from alembic import context

from src.shared.config.settings import get_settings
from src.shared.db.base import Base

# import مدل‌ها تا در metadata ثبت شوند
from src.modules.identity.infrastructure import models as _identity  # noqa: F401
from src.modules.crm.infrastructure import models as _crm  # noqa: F401
from src.modules.telephony.infrastructure import models as _tel  # noqa: F401
from src.modules.ai_analysis.infrastructure import models as _ai  # noqa: F401

config = context.config
config.set_main_option("sqlalchemy.url", get_settings().database_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata,
                      compare_type=True)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.", poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


run_migrations_online()
