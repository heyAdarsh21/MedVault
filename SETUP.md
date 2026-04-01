# MEDVAULT Setup Guide

## Prerequisites

- Python 3.11 or higher
- PostgreSQL 12 or higher
- pip (Python package manager)

## Step 1: Install Dependencies

```bash
pip install -r requirements.txt
```

## Step 2: Configure Database

1. Create a PostgreSQL database:
```sql
CREATE DATABASE medvault;
```

2. Create a `.env` file in the project root:
```bash
cp .env.example .env
```

3. Edit `.env` and set your database URL:
```
DATABASE_URL=postgresql://username:password@localhost/medvault
```

## Step 3: Run Database Migrations

```bash
alembic upgrade head
```

This will create all the necessary tables:
- `hospitals`
- `departments`
- `resources`
- `flow_events` (THE GROUND TRUTH)
- `metrics_cache`

## Step 4: Initialize Sample Data (Optional)

```bash
python scripts/init_sample_data.py
```

This creates:
- 1 hospital (City General Hospital)
- 3 departments (ER, ICU, Ward)
- 8 resources (beds, equipment, staff)

## Step 5: Start the FastAPI Server

```bash
uvicorn api.main:app --reload
```

The API will be available at `http://localhost:8000`

API documentation: `http://localhost:8000/docs`

## Step 6: Start the Streamlit UI

In a new terminal:

```bash
streamlit run ui/main.py
```

The UI will open in your browser at `http://localhost:8501`

## Architecture Overview

```
┌─────────────────────────────────────────┐
│         Streamlit UI Layer              │
│  (System Health, Analysis, Simulation)  │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│         FastAPI Layer                   │
│  (REST Endpoints, Request Handling)     │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│      Analytical Engines Layer          │
│  • Flow Engine (NetworkX)              │
│  • Bottleneck Engine (Pandas/NumPy)     │
│  • Capacity Engine                      │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│      Simulation Engine (SimPy)         │
│  (Discrete-Event Patient Flow)         │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│      Domain Layer                       │
│  (Pydantic Schemas, Event Types)       │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│      Database Layer (PostgreSQL)        │
│  • hospitals                            │
│  • departments                           │
│  • resources                             │
│  • flow_events (GROUND TRUTH)           │
│  • metrics_cache                         │
└─────────────────────────────────────────┘
```

## Key Concepts

### Event-Driven Architecture

MEDVAULT stores **events**, not states:
- `ARRIVAL` - Patient arrives
- `TRANSFER` - Patient moves between departments
- `RESOURCE_REQUEST` - Patient requests a resource
- `RESOURCE_RELEASE` - Patient releases a resource
- `DEPARTURE` - Patient leaves

All analytics are derived from these events.

### Flow Analysis

The Flow Engine uses NetworkX to model patient flow as a directed graph:
- Nodes = Departments
- Edges = Patient movements
- Edge weights = Average delay

### Bottleneck Detection

The Bottleneck Engine calculates delays between events:
- `delay = next_event_time - current_event_time`
- Groups by department
- Identifies worst performers

### Capacity Planning

The Capacity Engine calculates utilization:
- `utilization = demand / capacity`
- If > 1.0 → overloaded

## Testing the System

1. **Run a Simulation:**
   - Go to "Simulation Control" page
   - Select a hospital
   - Set parameters (duration, arrival rate)
   - Click "Run Simulation"

2. **View Results:**
   - Check "System Health" for overall status
   - Check "Hospital Analysis" for flow graphs
   - Check "Bottleneck Analysis" for delay analysis

## Troubleshooting

### Database Connection Error
- Verify PostgreSQL is running
- Check `.env` file has correct `DATABASE_URL`
- Ensure database exists

### API Connection Error (in UI)
- Ensure FastAPI server is running (`uvicorn api.main:app --reload`)
- Check API is accessible at `http://localhost:8000`

### No Data Available
- Run `python scripts/init_sample_data.py` to create sample data
- Or create hospitals/departments/resources via API
- Run a simulation to generate flow events

## Next Steps

1. Create your own hospitals and departments
2. Run simulations with different parameters
3. Analyze bottlenecks and capacity
4. Extend the engines with custom metrics

## Production Considerations

- Set up proper authentication for API
- Configure CORS appropriately
- Use environment-specific settings
- Set up database backups
- Monitor performance metrics
- Consider caching for heavy analytics
