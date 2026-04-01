"""Script to verify MEDVAULT setup."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

def check_imports():
    """Check if all required packages are installed."""
    print("Checking imports...")
    
    required_packages = [
        ("fastapi", "FastAPI"),
        ("sqlalchemy", "SQLAlchemy"),
        ("pandas", "Pandas"),
        ("numpy", "NumPy"),
        ("networkx", "NetworkX"),
        ("simpy", "SimPy"),
        ("streamlit", "Streamlit"),
        ("plotly", "Plotly"),
        ("pydantic", "Pydantic"),
    ]
    
    missing = []
    for package, name in required_packages:
        try:
            __import__(package)
            print(f"  ✓ {name}")
        except ImportError:
            print(f"  ✗ {name} - MISSING")
            missing.append(name)
    
    return len(missing) == 0


def check_database():
    """Check database connection."""
    print("\nChecking database connection...")
    
    try:
        from database.base import engine
        from sqlalchemy import inspect
        
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        
        required_tables = ['hospitals', 'departments', 'resources', 'flow_events', 'metrics_cache']
        
        print(f"  Connected to database")
        print(f"  Found {len(tables)} tables")
        
        missing_tables = [t for t in required_tables if t not in tables]
        if missing_tables:
            print(f"  ✗ Missing tables: {', '.join(missing_tables)}")
            print(f"  Run: alembic upgrade head")
            return False
        else:
            print(f"  ✓ All required tables exist")
            return True
            
    except Exception as e:
        print(f"  ✗ Database connection failed: {e}")
        print(f"  Check your DATABASE_URL in .env file")
        return False


def check_project_structure():
    """Check if project structure is correct."""
    print("\nChecking project structure...")
    
    required_dirs = [
        'api',
        'domain',
        'database',
        'engines',
        'simulation',
        'ui',
        'config',
        'alembic'
    ]
    
    all_exist = True
    for dir_name in required_dirs:
        if Path(dir_name).exists():
            print(f"  ✓ {dir_name}/")
        else:
            print(f"  ✗ {dir_name}/ - MISSING")
            all_exist = False
    
    return all_exist


def main():
    """Run all checks."""
    print("=" * 50)
    print("MEDVAULT Setup Verification")
    print("=" * 50)
    
    checks = [
        ("Project Structure", check_project_structure),
        ("Python Packages", check_imports),
        ("Database", check_database),
    ]
    
    results = []
    for name, check_func in checks:
        try:
            result = check_func()
            results.append((name, result))
        except Exception as e:
            print(f"\n  Error in {name}: {e}")
            results.append((name, False))
    
    print("\n" + "=" * 50)
    print("Summary:")
    print("=" * 50)
    
    all_passed = True
    for name, result in results:
        status = "✓ PASS" if result else "✗ FAIL"
        print(f"  {status} - {name}")
        if not result:
            all_passed = False
    
    print("=" * 50)
    
    if all_passed:
        print("\n✅ All checks passed! MEDVAULT is ready to use.")
        print("\nNext steps:")
        print("  1. Start API: uvicorn api.main:app --reload")
        print("  2. Start UI: streamlit run ui/main.py")
        print("  3. Initialize data: python scripts/init_sample_data.py")
    else:
        print("\n❌ Some checks failed. Please fix the issues above.")
        sys.exit(1)


if __name__ == "__main__":
    main()
