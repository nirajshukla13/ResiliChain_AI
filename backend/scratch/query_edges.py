import asyncio
from app.core.database import async_session_factory
from sqlalchemy import text

async def run():
    async with async_session_factory() as db:
        res = await db.execute(text("SELECT count(*) FROM routes WHERE status='disrupted'"))
        print(f"Disrupted routes: {res.scalar()}")
        
        # Check all statuses
        res = await db.execute(text("SELECT status, count(*) FROM routes GROUP BY status"))
        for row in res.all():
            print(row)

if __name__ == "__main__":
    asyncio.run(run())
