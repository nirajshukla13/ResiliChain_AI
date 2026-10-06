import logging
import uuid
from datetime import date, timedelta
from typing import Any

from app.utils.pagination import PaginationParams
from app.models.enums import AlertSeverity, EntityStatus, RiskLevel

logger = logging.getLogger(__name__)

TOOL_DEFINITIONS = [
    {
        "name": "get_dashboard_summary",
        "description": "Get high-level supply chain KPIs, resilience score, expected cost, carbon emissions, and overall inventory status.",
        "parameters": {
            "type": "object",
            "properties": {},
        }
    },
    {
        "name": "get_inventory_status",
        "description": "Search inventory items or get a summary. Used to check stockouts, low stock, or quantities.",
        "parameters": {
            "type": "object",
            "properties": {
                "status": {
                    "type": "string",
                    "description": "Optional status filter: 'in_stock', 'low_stock', 'out_of_stock'"
                }
            }
        }
    },
    {
        "name": "get_supplier_info",
        "description": "Search for suppliers by country or risk level to evaluate supplier reliability and risk.",
        "parameters": {
            "type": "object",
            "properties": {
                "country": {"type": "string"},
                "risk_level": {"type": "string", "description": "'low', 'medium', 'high', 'critical'"},
                "search": {"type": "string", "description": "Supplier name search"}
            }
        }
    },
    {
        "name": "get_warehouse_status",
        "description": "Get warehouse utilization, capacity, and current inventory levels.",
        "parameters": {
            "type": "object",
            "properties": {
                "search": {"type": "string", "description": "Warehouse name search"}
            }
        }
    },
    {
        "name": "get_recent_alerts",
        "description": "Get recent alerts regarding supply chain disruptions or risks.",
        "parameters": {
            "type": "object",
            "properties": {
                "severity": {"type": "string", "description": "'info', 'warning', 'critical'"},
                "unread_only": {"type": "boolean"}
            }
        }
    },
    {
        "name": "get_recommendations",
        "description": "Get rule-based AI recommendations for supply chain optimization, risk mitigation, and inventory rebalancing.",
        "parameters": {
            "type": "object",
            "properties": {}
        }
    },
    {
        "name": "get_simulation_history",
        "description": "Get recent disruption Monte Carlo simulation results to see stockout probability and expected costs under various scenarios.",
        "parameters": {
            "type": "object",
            "properties": {}
        }
    },
    {
        "name": "run_quick_forecast",
        "description": "Run a fast, simulated 30-day demand forecast for a random product/warehouse if IDs aren't provided. Provide product_id and warehouse_id to run for specific items.",
        "parameters": {
            "type": "object",
            "properties": {
                "product_id": {"type": "string"},
                "warehouse_id": {"type": "string"}
            }
        }
    }
]

async def execute_tool(tool_name: str, args: dict[str, Any], services: dict[str, Any]) -> dict[str, Any]:
    try:
        if tool_name == "get_dashboard_summary":
            result = await services["dashboard_service"].overview()
            return result.model_dump(mode="json")

        elif tool_name == "get_inventory_status":
            from app.models.enums import InventoryStatus
            status_val = None
            if args.get("status"):
                status_val = InventoryStatus(args["status"])
            
            summary = await services["inventory_service"].summary()
            items, _ = await services["inventory_service"].list(PaginationParams(size=5), status=status_val)
            
            return {
                "summary": summary.model_dump(mode="json"),
                "sample_items": [
                    {
                        "product_id": str(i.product_id),
                        "warehouse_id": str(i.warehouse_id),
                        "quantity": i.quantity,
                        "reorder_point": i.reorder_point,
                        "status": i.status.value
                    } for i in items
                ]
            }

        elif tool_name == "get_supplier_info":
            risk_val = None
            if args.get("risk_level"):
                risk_val = RiskLevel(args["risk_level"])
                
            items, _ = await services["supplier_service"].list(
                PaginationParams(size=5),
                country=args.get("country"),
                risk_level=risk_val,
                search=args.get("search")
            )
            return {
                "suppliers": [
                    {
                        "id": str(s.id),
                        "name": s.name,
                        "country": s.country,
                        "risk_level": s.risk_level.value,
                        "reliability_score": s.reliability_score
                    } for s in items
                ]
            }

        elif tool_name == "get_warehouse_status":
            items, _ = await services["warehouse_service"].list(
                PaginationParams(size=5),
                search=args.get("search")
            )
            return {
                "warehouses": [i.model_dump(mode="json") for i in items]
            }

        elif tool_name == "get_recent_alerts":
            sev_val = None
            if args.get("severity"):
                sev_val = AlertSeverity(args["severity"])
                
            summary = await services["alert_service"].summary()
            items, _ = await services["alert_service"].list(
                PaginationParams(size=5),
                severity=sev_val,
                unread_only=args.get("unread_only", False)
            )
            return {
                "summary": summary.model_dump(mode="json"),
                "recent_alerts": [
                    {
                        "id": str(a.id),
                        "title": a.title,
                        "severity": a.severity.value,
                        "message": a.message
                    } for a in items
                ]
            }

        elif tool_name == "get_recommendations":
            items = await services["recommendation_service"].generate()
            return {
                "recommendations": [
                    {
                        "id": str(r.id),
                        "title": r.title,
                        "category": r.category,
                        "priority": r.priority.value,
                        "suggested_action": r.suggested_action,
                        "reason": r.reason
                    } for r in items
                ]
            }

        elif tool_name == "get_simulation_history":
            items, _ = await services["simulation_service"].history(PaginationParams(size=3))
            return {
                "recent_simulations": [
                    {
                        "id": str(s.id),
                        "simulation_type": s.simulation_type.value,
                        "resilience_score": s.resilience_score,
                        "expected_cost": s.expected_cost,
                        "stockout_probability": s.stockout_probability,
                        "risk_level": s.risk_level.value
                    } for s in items
                ]
            }
            
        elif tool_name == "run_quick_forecast":
            from app.schemas.forecast import ForecastPredictRequest
            from app.models.enums import ForecastModel
            
            # Use random IDs if not provided to showcase functionality
            # This is a simplification for the chatbot
            product_id = args.get("product_id")
            warehouse_id = args.get("warehouse_id")
            
            if not product_id or not warehouse_id:
                # Get the first product and warehouse
                prods, _ = await services["inventory_service"].list_products(PaginationParams(size=1))
                whs, _ = await services["warehouse_service"].list(PaginationParams(size=1))
                if prods and whs:
                    product_id = prods[0].id
                    warehouse_id = whs[0].id
            
            if not product_id or not warehouse_id:
                return {"error": "No products or warehouses found in database"}
                
            req = ForecastPredictRequest(
                product_id=uuid.UUID(str(product_id)),
                warehouse_id=uuid.UUID(str(warehouse_id)),
                model=ForecastModel.PROPHET,
                start_date=date.today(),
                end_date=date.today() + timedelta(days=30)
            )
            result = await services["forecast_service"].predict(req, None)
            return {
                "product_id": str(result.product_id),
                "metrics": result.metrics,
                "confidence_level": result.confidence_level,
                "first_point": result.points[0].model_dump(mode="json"),
                "last_point": result.points[-1].model_dump(mode="json")
            }

        else:
            return {"error": f"Unknown tool: {tool_name}"}
            
    except Exception:
        # Keep internal exception details out of model context and user-visible
        # answers; the server log retains a full diagnostic for operators.
        logger.exception("Chatbot data tool %s failed", tool_name)
        return {"error": "This data request could not be completed."}
