import React, { Component } from "react";
import PieChart from "react-minimal-pie-chart";
import { css } from "emotion";

export default class Chart extends Component {
  render() {
    return (
      <div>
        <PieChart
          className={css`
            padding: 32px;
            max-width: 340px;
          `}
          data={[
            { title: "One", value: 10, color: "#E38627" },
            { title: "Two", value: 15, color: "#C13C37" },
            { title: "Three", value: 20, color: "#6A2135" }
          ]}
        />
      </div>
    );
  }
}
