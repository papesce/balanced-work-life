import React from "react";
import Chart, { ITaskTag } from "./Chart";

export default {
  title: "Chart",
};

const pallete: string[] = [
  "#88d4ca",
  "#cef3c4",
  "#344771",
  "#59709c",
  "#4c3642",
];
const sampleTag0: ITaskTag[] = [];
const sampleTag1: ITaskTag[] = [{ tag: "Sleep", count: 1, color: pallete[0] }];
const sampleTag2: (x: number, y:number) => ITaskTag[] = (x,y) => [
  { tag: "Work", count: x, color: pallete[0] },
  { tag: "Life", count: y, color: pallete[1] },
];

export const emptyChart = () => <Chart tags={sampleTag0} />;
export const singleChart = () => <Chart tags={sampleTag1} />;
export const doubleChart11 = () => <Chart tags={sampleTag2(1,1)} />;
export const doubleChart12 = () => <Chart tags={sampleTag2(1,2)} />;