"""Automated background task to check platform state and create alerts."""

import asyncio
import logging
import uuid
from sqlalchemy import select, func, exists

from app.core.config import settings
from app.core.database import async_session_factory
from app.models.alert import Alert
from app.models.enums import AlertSeverity
from app.models.inventory import Inventory
from app.models.supplier import Supplier
from app.models.warehouse import Warehouse

logger = logging.getLogger("resilichain.alert_engine")

async def _check_and_create_alert(
    session, title: str, message: str, severity: AlertSeverity, entity_type: str, entity_id: uuid.UUID
) -> None:
    """Create an alert if a similar unread one does not already exist."""
    stmt = select(
        exists().where(
            Alert.title == title,
            Alert.entity_type == entity_type,
            Alert.entity_id == entity_id,
            Alert.is_read.is_(False),
        )
    )
    already_exists = await session.scalar(stmt)
    
    if not already_exists:
        new_alert = Alert(
            id=uuid.uuid4(),
            title=title,
            message=message,
            severity=severity,
            source="Automated Alert Engine",
            entity_type=entity_type,
            entity_id=entity_id,
        )
        session.add(new_alert)

async def _run_alert_checks() -> None:
    """Execute one cycle of alert checks."""
    async with async_session_factory() as session:
        try:
            # 1. Low Stock Alert
            low_stock_stmt = select(Inventory).where(
                Inventory.quantity <= Inventory.reorder_point,
                Inventory.quantity > 0
            )
            low_stock_res = await session.execute(low_stock_stmt)
            for inv in low_stock_res.scalars():
                await _check_and_create_alert(
                    session,
                    title="Low Stock Alert",
                    message=f"Low stock for product {inv.product_id} at warehouse {inv.warehouse_id} ({inv.quantity} left).",
                    severity=AlertSeverity.WARNING,
                    entity_type="Inventory",
                    entity_id=inv.id,
                )
            
            # 2. Stockout Alert
            stockout_stmt = select(Inventory).where(Inventory.quantity == 0)
            stockout_res = await session.execute(stockout_stmt)
            for inv in stockout_res.scalars():
                await _check_and_create_alert(
                    session,
                    title="Stockout Alert",
                    message=f"Stockout for product {inv.product_id} at warehouse {inv.warehouse_id}.",
                    severity=AlertSeverity.CRITICAL,
                    entity_type="Inventory",
                    entity_id=inv.id,
                )

            # 3. Supplier Risk Alert
            supplier_stmt = select(Supplier).where(Supplier.reliability_score < 70)
            supplier_res = await session.execute(supplier_stmt)
            for supp in supplier_res.scalars():
                await _check_and_create_alert(
                    session,
                    title="Supplier Risk Alert",
                    message=f"Supplier {supp.name} has a low reliability score ({supp.reliability_score}).",
                    severity=AlertSeverity.WARNING,
                    entity_type="Supplier",
                    entity_id=supp.id,
                )

            # 4 & 5. Warehouse Overload & Critical Alert
            warehouse_stmt = select(Warehouse)
            warehouse_res = await session.execute(warehouse_stmt)
            for wh in warehouse_res.scalars():
                inv_sum_stmt = select(func.coalesce(func.sum(Inventory.quantity), 0)).where(Inventory.warehouse_id == wh.id)
                total_qty = await session.scalar(inv_sum_stmt)
                
                if wh.capacity > 0:
                    utilization = (total_qty / wh.capacity) * 100
                    if utilization > 95:
                        await _check_and_create_alert(
                            session,
                            title="Warehouse Critical Alert",
                            message=f"Warehouse {wh.name} is critically overloaded ({utilization:.1f}% utilization).",
                            severity=AlertSeverity.CRITICAL,
                            entity_type="Warehouse",
                            entity_id=wh.id,
                        )
                    elif utilization > 90:
                        await _check_and_create_alert(
                            session,
                            title="Warehouse Overload Alert",
                            message=f"Warehouse {wh.name} is overloaded ({utilization:.1f}% utilization).",
                            severity=AlertSeverity.WARNING,
                            entity_type="Warehouse",
                            entity_id=wh.id,
                        )
            
            await session.commit()
        except Exception as e:
            logger.error("Error during alert engine checks: %s", e)
            await session.rollback()

async def start_alert_engine() -> None:
    """Background task loop for the alert engine."""
    if not settings.ALERT_ENGINE_ENABLED:
        logger.info("Alert engine is disabled.")
        return
    
    logger.info("Starting Automated Alert Engine in 30 seconds...")
    await asyncio.sleep(30)
    
    while True:
        try:
            logger.info("Running automated alert engine checks...")
            await _run_alert_checks()
        except Exception as e:
            logger.error("Unexpected error in alert engine loop: %s", e)
        
        await asyncio.sleep(settings.ALERT_ENGINE_INTERVAL_SECONDS)
