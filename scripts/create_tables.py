"""
One-time database table creation script for MEDVAULT.
"""

import sys
from pathlib import Path

# -------------------------------------------------
# Ensure project root is on PYTHONPATH
# -------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

# -------------------------------------------------
# Imports AFTER path fix
# -------------------------------------------------
from database.base import engine, Base
import database.models  # IMPORTANT: registers all models


def main():
    print("Creating all database tables...")
    Base.metadata.create_all(bind=engine)
    print("All tables created successfully.")


if __name__ == "__main__":
    main()
