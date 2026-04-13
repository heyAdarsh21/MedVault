"""
Seed demo users for MedVault authentication testing.
Run: python seed_demo_users.py
"""
from database.base import SessionLocal
from database.models import User
from core.security import hash_password

DEMO_USERS = [
    {"username": "admin",  "password": "admin123",  "role": "admin"},
    {"username": "staff",  "password": "staff123",  "role": "analyst"},
    {"username": "viewer", "password": "viewer123", "role": "viewer"},
]


def seed():
    db = SessionLocal()
    created = 0
    try:
        for u in DEMO_USERS:
            existing = db.query(User).filter(User.username == u["username"]).first()
            if existing:
                print(f"  SKIP: '{u['username']}' already exists (id={existing.id})")
                continue
            user = User(
                username=u["username"],
                hashed_password=hash_password(u["password"]),
                role=u["role"],
                is_active=True,
            )
            db.add(user)
            created += 1
            print(f"  CREATE: '{u['username']}' role={u['role']}")
        db.commit()
        print(f"\nDone. {created} user(s) created.")
    except Exception as exc:
        db.rollback()
        print(f"ERROR: {exc}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    print("Seeding demo users...")
    seed()
