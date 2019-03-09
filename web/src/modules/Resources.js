import React, { Component } from 'react';
import PropTypes from 'prop-types';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Button, DropdownButton, Dropdown } from 'react-bootstrap';

const Colors = ['#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#911eb4', '#46f0f0', '#f032e6', '#bcf60c', '#fabebe', '#008080', '#e6beff', '#9a6324', '#fffac8', '#800000', '#aaffc3', '#808000', '#ffd8b1', '#000075', '#808080', '#ffffff', '#000000'];

class Resources extends Component {
  constructor(props) {
    super(props);
    this.state = {
      chartData: [],
      helmCharts: [],
      view: 'all' // 'all', 'per-pod'
    };
  }
  componentDidMount() {
    console.log('did mount:', this.props.namespace)
    this.loadData();
    setInterval(() => {
      this.loadData();
    }, 30 * 1000);
  }
  componentDidUpdate(prevProps) {
    if (this.props.namespace !== prevProps.namespace) {
      this.loadData();
    }
  }
  async loadCharts(namespace) {
    const res = await axios.get(`${this.props.dataServer}/metrics/${namespace === 'all' ? '' : `namespace/${namespace}/`}helmCharts`);
    if (res.status === 200) {
      if (!res.data) {
        return
      }
      this.setState({ helmCharts: res.data });
    }
  }
  async loadData() {
    const namespace = this.props.namespace;
    await this.loadCharts(namespace);
    const res = await axios.get(`${this.props.dataServer}/metrics/${namespace === 'all' ? '' : `namespace/${namespace}/`}resources`);
    if (res.status === 200) {
      const d = res.data;
      if (!d) {
        return
      }
      console.log(d);
      const chartData = d.map(helmChart => {
        let col = {
          timestamp: helmChart.timestamp,
          name: helmChart.timestamp.split('T')[1].replace(':00Z', ''),
        };
        for (const pod of helmChart.resourcesPerPodPerHelmChart) {
          col[`cpu-${pod.helmChart}`] = pod.resourcesPerPod.reduce((p, c) => {
            return p + c.cpu.length > 1 ? parseInt(c.cpu.slice(0, -1)) : 0
          }, 0);
          col[`memory-${pod.helmChart}`] = pod.resourcesPerPod.reduce((p, c) => {
            return p + parseInt(c.memory.slice(0, -2))
          }, 0);
        }
        return col;
      });
      console.log("final:", chartData)
      this.setState({ chartData: chartData });
    }
  }
  onViewChange(view) {
    this.setState({
      ...this.state,
      view,
    });
  }
  render() {
    return (
      <div>
        <DropdownButton id="dropdown-view" title={this.state.view} size="lg">
          <Dropdown.Item onClick={() => this.onViewChange('all')}>all</Dropdown.Item>
          <Dropdown.Item onClick={() => this.onViewChange('per-pod')}>per-pod</Dropdown.Item>
        </DropdownButton>
        {this.state.view === 'all' && <div>
          <h5>CPU usage Per HelmChart</h5>
          <Button variant="outline-primary" onClick={() => this.loadData()}>Refresh</Button>
          <LineChart width={1000} height={200} data={this.state.chartData} syncId="anyId" margin={{ top: 10, right: 30, left: 0, bottom: 0, 'text-align': 'center' }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" padding={{ left: 30, right: 30 }} />
            <YAxis />
            <Tooltip />
            {this.state.helmCharts.map((chartName, i) => <Line type='monotone' dataKey={`cpu-${chartName}`} stroke={Colors[i % Colors.length]} fill={Colors[i % Colors.length]} name={chartName} key={chartName} />)}
          </LineChart>
          <h5>Memory usage Per HelmChart</h5>
          <LineChart width={1000} height={200} data={this.state.chartData} syncId="anyId" margin={{ top: 10, right: 30, left: 0, bottom: 0, 'text-align': 'center' }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" padding={{ left: 30, right: 30 }} />
            <YAxis />
            <Tooltip />
            {this.state.helmCharts.map((chartName, i) => <Line type='monotone' dataKey={`memory-${chartName}`} stroke={Colors[i % Colors.length]} fill={Colors[i % Colors.length]} name={chartName} key={chartName} />)}
          </LineChart>
        </div>}
        {this.state.view === 'per-pod' && this.state.helmCharts.map((chartName, i) => {
          return (
            <div key={`helmChart-${chartName}`}>
              <h5>{chartName}</h5>
              <LineChart width={1000} height={200} data={this.state.chartData} syncId="anyId" margin={{ top: 10, right: 30, left: 0, bottom: 0, 'text-align': 'center' }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" padding={{ left: 30, right: 30 }} />
                <YAxis />
                <Tooltip />
                <Line type='monotone' dataKey={chartName} stroke={Colors[i % Colors.length]} fill={Colors[i % Colors.length]} />
              </LineChart>
            </div>
          );
        })}
      </div>
    );
  }
}

Resources.propTypes = {
  namespace: PropTypes.string,
  dataServer: PropTypes.string
}

Resources.defaultProps = {
  namespace: 'dafault'
}

export default Resources;