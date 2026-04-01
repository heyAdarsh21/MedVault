"use client";

import ReactECharts from "echarts-for-react";

interface HeatmapProps {
  departments: string[];
  values: number[];
}

export function Heatmap({ departments, values }: HeatmapProps) {
  const data = departments.map((dept, index) => [
    0,
    index,
    values[index],
  ]);

  const option = {
    tooltip: {},
    xAxis: {
      type: "category",
      data: ["Risk"],
      axisLabel: { color: "#94A3B8" },
    },
    yAxis: {
      type: "category",
      data: departments,
      axisLabel: { color: "#94A3B8" },
    },
    visualMap: {
      min: 0,
      max: 100,
      calculable: true,
      orient: "horizontal",
      left: "center",
      bottom: "0%",
    },
    series: [
      {
        type: "heatmap",
        data,
        label: {
          show: false,
        },
      },
    ],
  };

  return (
    <ReactECharts option={option} style={{ height: 400 }} />
  );
}
