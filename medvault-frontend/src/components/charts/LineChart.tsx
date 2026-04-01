"use client";

import ReactECharts from "echarts-for-react";

interface LineChartProps {
  title: string;
  xData: string[];
  yData: number[];
}

export function LineChart({ title, xData, yData }: LineChartProps) {
  const option = {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "axis",
    },
    grid: {
      left: "3%",
      right: "4%",
      bottom: "3%",
      containLabel: true,
    },
    xAxis: {
      type: "category",
      data: xData,
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
        data: yData,
        type: "line",
        smooth: true,
        lineStyle: {
          color: "#06B6D4",
          width: 3,
        },
        areaStyle: {
          color: "rgba(6,182,212,0.15)",
        },
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
