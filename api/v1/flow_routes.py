"""
Flow-specific endpoints for MEDVAULT API v1.

Endpoints:
  GET /flow/critical-path/{hospital_id}     — full flow analysis (graph + critical path)
  GET /flow/graph/{hospital_id}             — raw graph nodes and edges only
  GET /flow/bottleneck-nodes/{hospital_id}  — departments with highest betweenness centrality
  GET /flow/efficiency/{hospital_id}        — efficiency score with explanation
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from api.v1.auth import get_current_user
from database.base import get_db
from domain.schemas import FlowAnalysis, User
from engines.flow_engine import FlowEngine
from services.analytics_service import AnalyticsService

router = APIRouter(prefix="/flow", tags=["flow"])


def _svc(db: Session = Depends(get_db)) -> AnalyticsService:
    return AnalyticsService(db)


def _engine(db: Session = Depends(get_db)) -> FlowEngine:
    return FlowEngine(db)


# ─────────────────────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@router.get(
    "/critical-path/{hospital_id}",
    response_model=FlowAnalysis,
    summary="Full flow graph analysis with critical path",
    description=(
        "Builds a directed graph of patient department transitions and computes "
        "the critical path (longest weighted path), efficiency score, "
        "betweenness-centrality bottleneck nodes, and full graph metadata. "
        "This is the primary flow intelligence endpoint."
    ),
)
def get_critical_path(
    hospital_id: int,
    start_time: Optional[datetime] = Query(None),
    end_time: Optional[datetime] = Query(None),
    svc: AnalyticsService = Depends(_svc),
    current_user: User = Depends(get_current_user),
) -> FlowAnalysis:
    try:
        return svc.analyze_flow(hospital_id, start_time, end_time)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Flow analysis failed: {str(e)}",
        )


@router.get(
    "/graph/{hospital_id}",
    response_model=Dict[str, Any],
    summary="Raw flow graph (nodes and edges)",
    description=(
        "Returns the raw directed graph as nodes and edges without computing "
        "the critical path or efficiency score. Lightweight — useful for "
        "rendering the flow diagram without the full analysis overhead."
    ),
)
def get_graph(
    hospital_id: int,
    start_time: Optional[datetime] = Query(None),
    end_time: Optional[datetime] = Query(None),
    engine: FlowEngine = Depends(_engine),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    try:
        graph = engine.build_flow_graph(hospital_id, start_time, end_time)

        nodes = [
            {"id": int(n), "name": d.get("name", str(n))}
            for n, d in graph.nodes(data=True)
        ]
        edges = [
            {
                "source": int(u),
                "target": int(v),
                "avg_delay_seconds": round(d.get("weight", 0.0), 2),
                "transition_count": d.get("count", 0),
            }
            for u, v, d in graph.edges(data=True)
        ]

        return {
            "hospital_id": hospital_id,
            "node_count": len(nodes),
            "edge_count": len(edges),
            "nodes": nodes,
            "edges": edges,
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Graph construction failed: {str(e)}",
        )


@router.get(
    "/bottleneck-nodes/{hospital_id}",
    response_model=List[Dict[str, Any]],
    summary="Flow graph bottleneck nodes by betweenness centrality",
    description=(
        "Returns departments ranked by betweenness centrality — nodes that "
        "most frequently act as bridges in the patient flow graph. "
        "High centrality means disruption here cascades across the system."
    ),
)
def get_bottleneck_nodes(
    hospital_id: int,
    start_time: Optional[datetime] = Query(None),
    end_time: Optional[datetime] = Query(None),
    engine: FlowEngine = Depends(_engine),
    current_user: User = Depends(get_current_user),
) -> List[Dict[str, Any]]:
    try:
        graph = engine.build_flow_graph(hospital_id, start_time, end_time)

        if graph.number_of_nodes() == 0:
            return []

        import networkx as nx
        centrality = nx.betweenness_centrality(graph, weight="weight")

        ranked = sorted(centrality.items(), key=lambda x: x[1], reverse=True)

        result = []
        for node_id, score in ranked:
            node_data = graph.nodes.get(node_id, {})
            result.append(
                {
                    "department_id": int(node_id),
                    "department_name": node_data.get("name", str(node_id)),
                    "centrality_score": round(score, 4),
                    "in_degree": graph.in_degree(node_id),
                    "out_degree": graph.out_degree(node_id),
                }
            )

        return result

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Bottleneck node analysis failed: {str(e)}",
        )


@router.get(
    "/efficiency/{hospital_id}",
    response_model=Dict[str, Any],
    summary="Flow efficiency score with interpretation",
    description=(
        "Returns the efficiency score (0–1) with a plain-English interpretation. "
        "Derived from average graph degree normalised against 3.5 edges/node. "
        "Penalised if the graph is not strongly connected."
    ),
)
def get_efficiency(
    hospital_id: int,
    start_time: Optional[datetime] = Query(None),
    end_time: Optional[datetime] = Query(None),
    engine: FlowEngine = Depends(_engine),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    try:
        graph = engine.build_flow_graph(hospital_id, start_time, end_time)
        score = engine.calculate_efficiency_score(graph)

        if score >= 0.75:
            interpretation = "High — patient pathways are well-connected and consistent."
        elif score >= 0.5:
            interpretation = "Moderate — some fragmentation in patient routing exists."
        elif score >= 0.3:
            interpretation = "Low — significant routing inefficiency detected."
        else:
            interpretation = "Very low — patient flow is severely fragmented or sparse."

        return {
            "hospital_id": hospital_id,
            "efficiency_score": score,
            "interpretation": interpretation,
            "node_count": graph.number_of_nodes(),
            "edge_count": graph.number_of_edges(),
            "is_strongly_connected": (
                __import__("networkx").is_strongly_connected(graph)
                if graph.number_of_nodes() > 0
                else False
            ),
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Efficiency calculation failed: {str(e)}",
        )