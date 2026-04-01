# MEDVAULT - Healthcare Systems Intelligence Platform

## Core Idea

MEDVAULT is a system that measures, analyzes, and explains why healthcare systems fail operationally, not clinically.

## Architecture

**Event-Driven Layered Systems Architecture with Analytical Engines**

### Layers

1. **Event Capture Layer** - Captures all patient flow events
2. **System Representation Layer** - Models hospitals, departments, resources
3. **Analytical Engine Layer** - Flow, Bottleneck, and Capacity engines
4. **Orchestration & API Layer** - FastAPI endpoints
5. **Visualization & UX Layer** - Streamlit dashboards

## Tech Stack

- **Backend**: Python 3.11, FastAPI, SQLAlchemy, Alembic
- **Analytics**: Pandas, NumPy, NetworkX
- **Simulation**: SimPy
- **Database**: PostgreSQL
- **UI**: Streamlit, Plotly

## Core Philosophy

MEDVAULT thinks in **EVENTS**, not states. All intelligence is derived from:
```
(event_type, timestamp, location, resource)
```

## Project Structure

```
medvault/
├── domain/          # Domain models and schemas (Pydantic)
├── engines/         # Analytical engines (Flow, Bottleneck, Capacity)
│   ├── flow_engine.py       # NetworkX-based flow analysis
│   ├── bottleneck_engine.py # Pandas/NumPy delay analysis
│   └── capacity_engine.py   # Utilization and stress testing
├── simulation/      # SimPy simulation engine
│   └── patient_flow_simulator.py  # Discrete-event simulation
├── api/            # FastAPI layer
│   ├── main.py     # FastAPI app
│   └── endpoints.py # REST endpoints
├── ui/             # Streamlit dashboards
│   ├── main.py     # Main Streamlit app
│   └── pages/      # Individual pages
│       ├── system_health.py
│       ├── hospital_analysis.py
│       ├── bottleneck_analysis.py
│       └── simulation_control.py
├── database/       # SQLAlchemy models and migrations
│   ├── models.py   # Database models
│   └── base.py     # Database session management
├── config/         # Configuration
│   └── settings.py # Pydantic settings
├── scripts/        # Utility scripts
│   ├── init_sample_data.py
│   └── verify_setup.py
└── alembic/        # Database migrations
```

## Quick Start

See [SETUP.md](SETUP.md) for detailed setup instructions.

**Quick setup:**
```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Configure database in .env file
# DATABASE_URL=postgresql://user:password@localhost/medvault

# 3. Run migrations
alembic upgrade head

# 4. Initialize sample data (optional)
python scripts/init_sample_data.py

# 5. Verify setup
python scripts/verify_setup.py

# 6. Start API (terminal 1)
uvicorn api.main:app --reload

# 7. Start UI (terminal 2)
streamlit run ui/main.py
```

## Key Features

- **Event-Driven**: All patient movements are events
- **Flow Analysis**: NetworkX-based workflow modeling
- **Bottleneck Detection**: Pandas/NumPy delay analysis
- **Capacity Planning**: Utilization and stress testing
- **Simulation**: Discrete-event simulation with SimPy
- **Explainability**: Every metric traces back to events
