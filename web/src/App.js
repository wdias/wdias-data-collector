import React, { Component } from 'react';
import axios from 'axios';
import './App.css';

const dataServer = 'http://analysis.wdias.com'

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      chartData: [],
    };
  }
  async loadData() {
    const res = await axios.get(`${dataServer}/metrics`);
    if(res.status === 200) {
      const d = res.data;
      console.log(d, d.length);
      const chartData = d.map(helmChart => {
        let col = {
          name: helmChart.timestamp,
        };
        console.log('len: ', helmChart.podsPerHelmChart.length)
        for (const pod of helmChart.podsPerHelmChart) {
          console.log(pod)
          col[pod.helmChart] = pod.noPods;
        }
        return col;
      });
      console.log(this.state.data)
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
        <div>
          <p>{JSON.stringify(this.state.chartData)}</p>
        </div>
      </div>
    );
  }
}

export default App;
