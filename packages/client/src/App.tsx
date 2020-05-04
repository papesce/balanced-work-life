import React from 'react';
import TaskList from './components/TaskList';
import Chart from './components/Chart';

import './App.css';

const App: React.FC = () => {
  return (
    <div className="App">
      <header className="App-header">
        <Chart></Chart>
        <TaskList></TaskList>
      </header>
    </div>
  );
}

export default App;
