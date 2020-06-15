import React from "react";
import PieChart, { LabelProps } from "react-minimal-pie-chart";
import { css } from "emotion";

export interface ITaskTag {
  tag: string;
  count: number;
  color: string;
}

interface IChartProps {
  tags: ITaskTag[];
}

function Chart(props: IChartProps) {
  const data = props.tags.map((t) => ({
    title: t.tag,
    value: t.count,
    color: t.color,
  }));
  return (
    <>
      <PieChart
        className={css`
          padding: 32px;
          max-width: 340px;
        `}
        style={{
          fontSize: "4px",
        }}
        data={data}
        lineWidth={60}
        startAngle={90}
        // radius={12}
        label={(labelProps) => {
          const { data, dataIndex } = labelProps;
          const item = data[dataIndex];
          return (
            <text dominantBaseline="central">
              <tspan {...labelProps}>{item.title}</tspan>
              <tspan {...labelProps} y={labelProps.y + 5}>
                ({Math.round(item.percentage)}%) ({item.value})
              </tspan>
            </text>
          );
        }}
        labelPosition={70}
        labelStyle={{
          fill: "#4c3642",
          opacity: 0.75,
          pointerEvents: "none",
        }}
      />
    </>
  );
}

export default Chart;
