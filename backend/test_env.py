"""
Talk2Tasks AI — Environment and Dependency Verification Script
"""

import asyncio
import sys

print("Checking critical Python libraries:")
modules = [
    "fastapi",
    "uvicorn",
    "aiosqlite",
    "pydantic",
    "httpx",
    "faster_whisper",
]

missing = []
for m in modules:
    try:
        __import__(m)
        print(f"  [OK] {m}")
    except ImportError as e:
        print(f"  [MISSING] {m}: {e}")
        missing.append(m)

if missing:
    print(f"\nError: Missing modules: {missing}")
    sys.exit(1)

print("\nVerifying Talk2Tasks Database Initialization:")
try:
    from app.database import init_db, get_db_path

    async def check_db():
        await init_db()
        path = await get_db_path()
        print(f"  [OK] Database initialized at: {path}")

    asyncio.run(check_db())
except Exception as e:
    print(f"  [FAIL] Database initialization failed: {e}")
    sys.exit(1)

print("\nVerifying Talk2Tasks Demo Data Service:")
try:
    from app.services.demo import get_demo_chunks, get_demo_analysis
    chunks = get_demo_chunks()
    analysis = get_demo_analysis()
    print(f"  [OK] Demo dataset ready: {len(chunks)} chunks, {len(analysis.action_items)} action items")
except Exception as e:
    print(f"  [FAIL] Demo data error: {e}")
    sys.exit(1)

print("\n=== ALL BACKEND CHECKS PASSED ===")
