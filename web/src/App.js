import React, { Component } from 'react';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import './App.css';

const dataServer = 'http://analysis.wdias.com'

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      chartData: [],
      helmCharts: [],
    };
  }
  componentDidMount() {
    this.loadData();
    setInterval(() => {
      this.loadData();
    }, 30 * 1000);
  }
  async loadCharts() {
    const res = await axios.get(`${dataServer}/metrics/helmCharts`);
    if(res.status === 200) {
      this.setState({ helmCharts: res.data });
    }
  }
  async loadData() {
    await this.loadCharts();
    const res = await axios.get(`${dataServer}/metrics`);
    if(res.status === 200) {
      const d = res.data;
      const chartData = d.map(helmChart => {
        let col = {
          timestamp: helmChart.timestamp,
          name: helmChart.timestamp.split('T')[1].replace(':00Z', ''),
        };
        for (const pod of helmChart.podsPerHelmChart) {
          col[pod.helmChart] = pod.noPods;
        }
        return col;
      });
      console.log("final:", chartData)
      this.setState({ chartData: chartData });
    }
  }
  render() {
    return (
      <div className="App">
        {/* <header className="App-header">
          <img src={logo} className="App-logo" alt="logo" />
          <p>
            Edit <code>src/App.js</code> and save to reload.
          </p>
          <a
            className="App-link"
            href="https://reactjs.org"
            target="_blank"
            rel="noopener noreferrer"
          >
            Learn React
          </a>
        </header> */}
        <button onClick={() => this.loadData()}>Refresh</button>
        <header className="App-header">
          {this.state.helmCharts.map(chartName => {
            return (
              <div key={`helmChart-${chartName}`}>
                <h5>{chartName}</h5>
                <LineChart width={1000} height={200} data={this.state.chartData} syncId="anyId" margin={{top: 10, right: 30, left: 0, bottom: 0, 'text-align': 'center'}}>
                  <CartesianGrid strokeDasharray="3 3"/>
                  <XAxis dataKey="name" padding={{left: 30, right: 30}}/>
                  <YAxis/>
                  <Tooltip/>
                  <Line type='monotone' dataKey={chartName} stroke='#8884d8' fill='#8884d8' />
                </LineChart>
              </div>
            );
          })}
        </header>
      </div>
    );
  }
}

export default App;
