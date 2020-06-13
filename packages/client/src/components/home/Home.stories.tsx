import React from "react";
import Home from "./Home";
import { BrowserRouter as Router, Switch, Route } from "react-router-dom";

export default {
  title: "Home"
};

export const home = () => <Router><Home /></Router>;