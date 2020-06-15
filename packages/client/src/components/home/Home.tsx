import React from "react";
import InitialHeader from "../header/InitialHeader";
import Chart from "../chart/Chart";
import TaskList from "../TaskList";

function Home() {
  return (
    <div>
      <InitialHeader handleLogout={() => true} />
      <Chart />
      <TaskList />
    </div>
  );
}

export default Home;
