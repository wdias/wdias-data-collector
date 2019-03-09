import React, { Component } from 'react';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { DropdownButton, Dropdown, Button } from 'react-bootstrap';
import './App.css';

const dataServer = 'http://analysis-api.wdias.com'

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      chartData: [],
      helmCharts: [],
      namespace: 'default',
    };
  }
  componentDidMount() {
    console.log('did mount:', this.state.namespace)
    this.loadData();
    setInterval(() => {
      this.loadData();
    }, 30 * 1000);
  }
  async loadCharts(namespace) {
    const res = await axios.get(`${dataServer}/metrics/${namespace === 'all' ? '' : `namespace/${namespace}/`}helmCharts`);
    if(res.status === 200) {
      if (!res.data) {
        return
      }
      this.setState({ helmCharts: res.data });
    }
  }
  async loadData() {
    const namespace = this.state.namespace;
    await this.loadCharts(namespace);
    const res = await axios.get(`${dataServer}/metrics${namespace === 'all' ? '' : '/namespace/'+namespace}`);
    if(res.status === 200) {
      const d = res.data;
      if(!d) {
        return
      }
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
  async onNamespaceChange(namespace) {
    this.setState({
      ...this.state,
      namespace,
    }, () => {this.loadData()});
  }
  render() {
    return (
      <div className="App">
        <div className="Menu">
          <Button variant="outline-primary" onClick={() => this.loadData()}>Refresh</Button>
          <DropdownButton id="dropdown-basic-button" title={this.state.namespace} size="lg">
            <Dropdown.Item onClick={() => this.onNamespaceChange('default')}>Default</Dropdown.Item>
            <Dropdown.Item onClick={() => this.onNamespaceChange('kube-system')}>Kube-System</Dropdown.Item>
            <Dropdown.Item onClick={() => this.onNamespaceChange('all')}>All</Dropdown.Item>
          </DropdownButton>
          <Dropdown options={['default', 'kube-system', 'all']} onChange={(val) => this.onNamespaceChange(val)} value={'default'} placeholder="Select an option" />
        </div>
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
