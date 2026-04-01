"""
Flow Engine - Models hospital workflow as directed graph using NetworkX.
DEMO-SAFE | API-SAFE | NO NaN | NO DUPLICATES
"""

import math
import networkx as nx
import pandas as pd

from typing import List, Dict, Optional
from datetime import datetime
from sqlalchemy.orm import Session

from database.models import FlowEvent, Department
from domain.schemas import FlowAnalysis


class FlowEngine:
    def __init__(self, db: Session):
        self.db = db

    # ---------------------------------------------------------
    # GRAPH BUILDING
    # ---------------------------------------------------------
    def build_flow_graph(
        self,
        hospital_id: int,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
    ) -> nx.DiGraph:

        query = self.db.query(FlowEvent).filter(
            FlowEvent.hospital_id == hospital_id
        )

        if start_time:
            query = query.filter(FlowEvent.timestamp >= start_time)
        if end_time:
            query = query.filter(FlowEvent.timestamp <= end_time)

        events = query.order_by(FlowEvent.timestamp).all()
        if not events:
            return nx.DiGraph()

        df = pd.DataFrame(
            {
                "timestamp": e.timestamp,
                "department_id": e.department_id,
                "patient_id": e.patient_id,
            }
            for e in events
        )

        G = nx.DiGraph()

        for _, patient_events in df.groupby("patient_id"):
            patient_events = patient_events.sort_values("timestamp")

            prev_dept = None
            prev_time = None

            for row in patient_events.itertuples():
                dept_id = row.department_id
                ts = row.timestamp

                if dept_id is None:
                    continue

                if not G.has_node(dept_id):
                    dept = (
                        self.db.query(Department)
                        .filter(Department.id == dept_id)
                        .first()
                    )
                    G.add_node(dept_id, name=dept.name if dept else f"Dept_{dept_id}")

                if prev_dept is not None and prev_dept != dept_id:
                    delay = (ts - prev_time).total_seconds()

                    if (
                        delay <= 0
                        or not isinstance(delay, (int, float))
                        or math.isnan(delay)
                        or math.isinf(delay)
                    ):
                        continue

                    if G.has_edge(prev_dept, dept_id):
                        d = G[prev_dept][dept_id]
                        count = d["count"]
                        d["weight"] = (d["weight"] * count + delay) / (count + 1)
                        d["count"] = count + 1
                    else:
                        G.add_edge(prev_dept, dept_id, weight=delay, count=1)

                prev_dept = dept_id
                prev_time = ts

        return G

    # ---------------------------------------------------------
    # CRITICAL PATH
    # ---------------------------------------------------------
    def find_critical_path(self, graph: nx.DiGraph) -> List[int]:
        if graph.number_of_nodes() == 0:
            return []

        # Remove invalid edges
        for u, v, d in list(graph.edges(data=True)):
            w = d.get("weight")
            if not isinstance(w, (int, float)) or math.isnan(w) or math.isinf(w):
                graph.remove_edge(u, v)

        if graph.number_of_edges() == 0:
            return list(graph.nodes())

        try:
            if nx.is_directed_acyclic_graph(graph):
                path = nx.dag_longest_path(graph, weight="weight")
            else:
                start = max(graph.nodes(), key=lambda n: graph.in_degree(n))
                path = [start]
                current = start

                while graph.out_degree(current) > 0:
                    nxt = max(
                        graph.successors(current),
                        key=lambda n: graph[current][n].get("weight", 0),
                    )
                    if nxt in path:
                        break
                    path.append(nxt)
                    current = nxt

            # --- SANITIZE ---
            return [
                int(n)
                for n in path
                if isinstance(n, (int, float)) and not math.isnan(n)
            ]

        except Exception:
            return [
                int(n)
                for n in graph.nodes()
                if isinstance(n, (int, float)) and not math.isnan(n)
            ]

    # ---------------------------------------------------------
    # BOTTLENECKS
    # ---------------------------------------------------------
    def identify_bottlenecks(self, graph: nx.DiGraph) -> List[int]:
        if graph.number_of_nodes() == 0:
            return []

        try:
            centrality = nx.betweenness_centrality(graph, weight="weight")
            ordered = sorted(centrality, key=centrality.get, reverse=True)

            # --- SANITIZE ---
            return [
                int(n)
                for n in ordered[:5]
                if isinstance(n, (int, float)) and not math.isnan(n)
            ]

        except Exception:
            return [
                int(n)
                for n in list(graph.nodes())[:3]
                if isinstance(n, (int, float)) and not math.isnan(n)
            ]

    # ---------------------------------------------------------
    # EFFICIENCY
    # ---------------------------------------------------------
    def calculate_efficiency_score(self, graph: nx.DiGraph) -> float:
        nodes = graph.number_of_nodes()
        edges = graph.number_of_edges()

        if nodes == 0:
            return 0.1
        if edges == 0:
            return 0.2

        avg_degree = edges / nodes
        normalized = min(avg_degree / 3.5, 1.0)

        penalty = 0.15 if not nx.is_strongly_connected(graph) else 0.0
        efficiency = normalized * (1 - penalty)

        return round(max(0.25, min(0.9, efficiency)), 3)

    # ---------------------------------------------------------
    # HELPERS
    # ---------------------------------------------------------
    def _calculate_path_confidence(self, graph: nx.DiGraph, path: List[int]) -> float:
        if len(path) < 2:
            return 0.0

        total = sum(
            d.get("weight", 0.0) for _, _, d in graph.edges(data=True)
        )

        if total <= 0:
            return 0.0

        path_weight = 0.0
        for i in range(len(path) - 1):
            if graph.has_edge(path[i], path[i + 1]):
                path_weight += graph[path[i]][path[i + 1]]["weight"]

        return round(min(1.0, path_weight / total), 3)

    def _build_graph_metadata(self, graph: nx.DiGraph) -> Dict:
        return {
            "nodes": [
                {"id": int(n), "name": d.get("name", str(n))}
                for n, d in graph.nodes(data=True)
                if isinstance(n, (int, float)) and not math.isnan(n)
            ],
            "edges": [
                {
                    "source": int(u),
                    "target": int(v),
                    "weight": round(d.get("weight", 0.0), 2),
                    "count": d.get("count", 0),
                }
                for u, v, d in graph.edges(data=True)
                if isinstance(u, (int, float))
                and isinstance(v, (int, float))
                and not math.isnan(u)
                and not math.isnan(v)
            ],
        }

    # ---------------------------------------------------------
    # MAIN ENTRY (API SAFE)
    # ---------------------------------------------------------
    def analyze_flow(
        self,
        hospital_id: int,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
    ) -> FlowAnalysis:

        graph = self.build_flow_graph(hospital_id, start_time, end_time)

        if graph.number_of_nodes() == 0:
            return FlowAnalysis(
                hospital_id=hospital_id,
                critical_path=[],
                total_flow_time=0.0,
                bottleneck_departments=[],
                efficiency_score=0.1,
                path_confidence=0.0,
                graph_metadata={"nodes": [], "edges": []},
            )

        critical_path = self.find_critical_path(graph)
        bottlenecks = self.identify_bottlenecks(graph)
        efficiency = self.calculate_efficiency_score(graph)

        total_flow_time = 0.0
        for i in range(len(critical_path) - 1):
            if graph.has_edge(critical_path[i], critical_path[i + 1]):
                total_flow_time += graph[critical_path[i]][critical_path[i + 1]]["weight"]

        return FlowAnalysis(
            hospital_id=hospital_id,
            critical_path=critical_path,
            total_flow_time=round(total_flow_time, 2),
            bottleneck_departments=bottlenecks,
            efficiency_score=efficiency,
            path_confidence=self._calculate_path_confidence(graph, critical_path),
            graph_metadata=self._build_graph_metadata(graph),
        )
