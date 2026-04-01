"use client";

import ReactECharts from "echarts-for-react";

interface BarChartProps {
  title: string;
  labels: string[];
  values: number[];
}

export function BarChart({ title, labels, values }: BarChartProps) {
  const option = {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "axis",
    },
    xAxis: {
      type: "category",
      data: labels,
      axisLine: { lineStyle: { color: "#334155" } },
      axisLabel: { color: "#94A3B8" },
    },
    yAxis: {
      type: "value",
      axisLine: { lineStyle: { color: "#334155" } },
      splitLine: { lineStyle: { color: "#1E293B" } },
      axisLabel: { color: "#94A3B8" },
    },
    series: [
      {
        data: values,
        type: "bar",
        itemStyle: {
          color: "#0EA5E9",
        },
        borderRadius: [4, 4, 0, 0],
      },
    ],
  };

  return (
    <div>
      <h3 className="text-sm text-slate-400 mb-4">{title}</h3>
      <ReactECharts option={option} style={{ height: 300 }} />
    </div>
  );
}
