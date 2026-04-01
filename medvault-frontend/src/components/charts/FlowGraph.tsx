"use client";

import ReactECharts from "echarts-for-react";

interface Node {
  id: number;
  name: string;
}

interface Edge {
  source: number;
  target: number;
  weight: number;
  count: number;
}

interface FlowGraphProps {
  nodes: Node[];
  edges: Edge[];
}

export function FlowGraph({ nodes, edges }: FlowGraphProps) {
  const option = {
    backgroundColor: "transparent",
    tooltip: {
      formatter: (params: any) => {
        if (params.dataType === "edge") {
          return `
            <strong>Transition</strong><br/>
            From: ${params.data.source}<br/>
            To: ${params.data.target}<br/>
            Avg Delay: ${params.data.weight}s<br/>
            Count: ${params.data.count}
          `;
        }
        return `<strong>${params.data.name}</strong>`;
      },
    },
    series: [
      {
        type: "graph",
        layout: "force",
        roam: true,
        draggable: true,
        label: {
          show: true,
          color: "#E2E8F0",
        },
        lineStyle: {
          color: "#475569",
          width: 2,
          curveness: 0.2,
        },
        emphasis: {
          focus: "adjacency",
        },
        force: {
          repulsion: 300,
          edgeLength: 150,
        },
        data: nodes.map((n) => ({
          id: n.id,
          name: n.name,
          value: n.id,
          symbolSize: 50,
          itemStyle: {
            color: "#0EA5E9",
          },
        })),
        links: edges.map((e) => ({
          source: e.source,
          target: e.target,
          weight: e.weight,
          count: e.count,
        })),
      },
    ],
  };

  return (
    <ReactECharts option={option} style={{ height: 500 }} />
  );
}