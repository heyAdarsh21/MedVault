# MEDVAULT Architecture Documentation

## Architecture Style

**Event-Driven Layered Systems Architecture with Analytical Engines**

This is a formal architecture name suitable for academic/professional documentation.

## Layer Breakdown

### Layer 1: Event Capture Layer
**Responsibility:** Capture all patient flow events

**Implementation:**
- `database/models.py` - `FlowEvent` model
- `api/endpoints.py` - POST `/flow-events` endpoint
- `simulation/patient_flow_simulator.py` - Event logging during simulation

**Key Principle:** Events are immutable facts. Once logged, they are never modified.

### Layer 2: System Representation Layer
**Responsibility:** Model hospitals, departments, and resources

**Implementation:**
- `database/models.py` - `Hospital`, `Department`, `Resource` models
- These represent the physical/logical structure of the healthcare system

**Key Principle:** Structure enables analysis. Without proper modeling, bottlenecks cannot be identified.

### Layer 3: Analytical Engine Layer
**Responsibility:** Compute intelligence from events

**Engines:**

#### Flow Engine (`engines/flow_engine.py`)
- **Technology:** NetworkX
- **Purpose:** Model workflow as directed graph
- **Output:** Critical path, bottlenecks, efficiency score
- **Algorithm:** Longest path (critical path method), betweenness centrality

#### Bottleneck Engine (`engines/bottleneck_engine.py`)
- **Technology:** Pandas, NumPy
- **Purpose:** Find where time is lost
- **Output:** Delay statistics, worst departments, threshold violations
- **Algorithm:** Event-to-event delay calculation, statistical aggregation

#### Capacity Engine (`engines/capacity_engine.py`)
- **Technology:** Pandas
- **Purpose:** Determine system stress
- **Output:** Utilization metrics, overload detection
- **Algorithm:** `utilization = demand / capacity`

**Key Principle:** Engines are pure computation. They read events, compute metrics, return results.

### Layer 4: Orchestration & API Layer
**Responsibility:** Expose engines via REST API

**Implementation:**
- `api/main.py` - FastAPI application
- `api/endpoints.py` - REST endpoints

**Key Principle:** API does not compute intelligence. It orchestrates engines and returns results.

### Layer 5: Visualization & UX Layer
**Responsibility:** Present insights to users

**Implementation:**
- `ui/main.py` - Streamlit application
- `ui/pages/*.py` - Individual dashboard pages

**Key Principle:** UI reads from API, never directly from database. Separation of concerns.

## Data Flow

```
1. Event Created (Simulation or Real Input)
   ↓
2. Event Stored in PostgreSQL (flow_events table)
   ↓
3. Analytical Engines Read Events
   ↓
4. Engines Compute Metrics
   ↓
5. Results Stored in metrics_cache (optional, for performance)
   ↓
6. UI Reads via API
   ↓
7. User Sees Insights
```

## Event-Driven Philosophy

### Why Events, Not States?

**Traditional (Bad):**
```python
patient.status = "in_ICU"
# When did they arrive? Unknown.
# How long have they been there? Unknown.
# What happened before? Lost.
```

**MEDVAULT (Good):**
```python
Event(event_type=ARRIVAL, timestamp=T1, department_id=ER)
Event(event_type=TRANSFER, timestamp=T2, department_id=ICU)
Event(event_type=TRANSFER, timestamp=T3, department_id=WARD)
# Complete history. All questions answerable.
```

### Event Types

- `ARRIVAL` - Patient enters system
- `DEPARTURE` - Patient leaves system
- `TRANSFER` - Patient moves between departments
- `RESOURCE_REQUEST` - Patient requests resource
- `RESOURCE_RELEASE` - Patient releases resource
- `WAIT_START` - Patient starts waiting
- `WAIT_END` - Patient stops waiting

## Simulation Architecture

### Why SimPy?

Healthcare systems are:
- Queues (patients waiting)
- Shared resources (beds, equipment)
- Stochastic processes (arrival times, service times)

SimPy models these naturally.

### Simulation Flow

```
1. Create SimPy Environment
2. Create SimPy Resources (from database resources)
3. Patient Arrival Process (Poisson)
4. For each patient:
   a. Determine path through departments
   b. Request resources
   c. Wait for availability
   d. Use resource
   e. Release resource
   f. Move to next department
5. Log all events to database
```

## Analytical Algorithms

### Flow Analysis Algorithm

```python
1. Load events for hospital
2. Group by patient
3. Build directed graph:
   - Nodes = Departments
   - Edges = Patient movements
   - Edge weight = Average delay
4. Find critical path (longest path)
5. Calculate bottlenecks (betweenness centrality)
6. Compute efficiency (graph density, path lengths)
```

### Bottleneck Detection Algorithm

```python
1. Load events
2. Group by patient
3. For each patient:
   - Calculate delay = next_event_time - current_event_time
4. Group delays by department
5. Calculate statistics:
   - Mean, max, percentiles
6. Sort by average delay
```

### Capacity Analysis Algorithm

```python
1. Load events for resource
2. Track concurrent usage:
   - RESOURCE_REQUEST → count++
   - RESOURCE_RELEASE → count--
3. Find peak concurrent usage
4. Calculate utilization = peak / capacity
5. Flag if utilization > 1.0
```

## Database Schema Rationale

### `flow_events` (Most Important Table)

**Why it exists:** This is the ground truth. Everything else is derived.

**Indexes:**
- `timestamp` - Time-based queries
- `hospital_id` - Hospital filtering
- `department_id` - Department analysis
- `patient_id` - Patient journey reconstruction
- `event_type` - Event type filtering

### `metrics_cache`

**Why it exists:** Avoid recomputation for dashboards.

**Trade-off:** Stale data vs. performance. Use TTL or invalidation strategy.

## Scalability Considerations

### Current Design
- Suitable for single hospital or small hospital network
- In-memory computation (Pandas, NetworkX)
- Synchronous API

### Future Scalability Options
- **Event Streaming:** Kafka/RabbitMQ for high-volume events
- **Distributed Computing:** Spark/Dask for large-scale analytics
- **Caching:** Redis for metrics_cache
- **Async Processing:** Celery for long-running simulations
- **Time-Series DB:** InfluxDB for event storage at scale

## Testing Strategy

### Unit Tests
- Engine logic (pure functions)
- Domain models (Pydantic validation)

### Integration Tests
- API endpoints
- Database operations
- Simulation runs

### End-to-End Tests
- Full simulation → analysis → UI flow

## Security Considerations

### Current (Development)
- No authentication
- CORS: allow all origins
- Direct database access

### Production Requirements
- API authentication (JWT/OAuth)
- Role-based access control
- Database connection pooling
- Input validation (Pydantic)
- Rate limiting
- Audit logging

## Performance Optimization

### Current Optimizations
- Database indexes on `flow_events`
- Metrics caching
- Efficient Pandas operations

### Future Optimizations
- Materialized views for common queries
- Pre-computed metrics (scheduled jobs)
- Graph caching (NetworkX)
- Query result pagination

## Monitoring & Observability

### Metrics to Track
- Event ingestion rate
- Engine computation time
- API response times
- Database query performance
- Simulation duration

### Logging Strategy
- Structured logging (JSON)
- Event-level logging
- Error tracking
- Performance metrics

## Extension Points

### Adding New Engines
1. Create engine class in `engines/`
2. Implement analysis logic
3. Add endpoint in `api/endpoints.py`
4. Add UI page if needed

### Adding New Event Types
1. Add to `EventType` enum in `domain/schemas.py`
2. Update simulation to generate events
3. Update engines to handle new events

### Adding New Metrics
1. Add computation logic to engine
2. Store in `metrics_cache` if needed
3. Expose via API endpoint
4. Visualize in UI
