import React from "react";
import Header from "./Header";
import InitialHeader from './InitialHeader';
import { action } from "@storybook/addon-actions";
import { BrowserRouter as Router, Switch, Route } from "react-router-dom";

export default {
  title: "Header"
};

export const header = () => <Router><Header /></Router>;
export const initialHeader = () => <Router><InitialHeader handleLogout={action('logout')} /></Router>;