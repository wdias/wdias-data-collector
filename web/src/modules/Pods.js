import React, { Component } from 'react';
import PropTypes from 'prop-types';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Button } from 'react-bootstrap';

const Colors = ['#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#911eb4', '#46f0f0', '#f032e6', '#bcf60c', '#fabebe', '#008080', '#e6beff', '#9a6324', '#fffac8', '#800000', '#aaffc3', '#808000', '#ffd8b1', '#000075', '#808080', '#ffffff', '#000000'];

class Pods extends Component {
  constructor(props) {
    super(props);
    this.state = {
      chartData: [],
      helmCharts: [],
      view: '/all' // '/all', '/per-pod'
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
    const res = await axios.get(`${this.props.dataServer}/metrics${namespace === 'all' ? '' : '/namespace/' + namespace}`);
    if (res.status === 200) {
      const d = res.data;
      if (!d) {
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
  render() {
    return (
      <div>
        {this.state.view === '/all' && <div>
          <h5>Pods Per HelmChart</h5>
          <Button variant="outline-primary" onClick={() => this.loadData()}>Refresh</Button>
          <LineChart width={1000} height={200} data={this.state.chartData} syncId="anyId" margin={{ top: 10, right: 30, left: 0, bottom: 0, 'text-align': 'center' }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" padding={{ left: 30, right: 30 }} />
            <YAxis />
            <Tooltip />
            {this.state.helmCharts.map((chartName, i) => <Line type='monotone' dataKey={chartName} stroke={Colors[i%Colors.length]} fill={Colors[i%Colors.length]} name={chartName} key={chartName} />)}
          </LineChart>
        </div>}
        {this.state.view === '/per-pod' && this.state.helmCharts.map((chartName, i) => {
          return (
            <div key={`helmChart-${chartName}`}>
              <h5>{chartName}</h5>
              <LineChart width={1000} height={200} data={this.state.chartData} syncId="anyId" margin={{ top: 10, right: 30, left: 0, bottom: 0, 'text-align': 'center' }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" padding={{ left: 30, right: 30 }} />
                <YAxis />
                <Tooltip />
                <Line type='monotone' dataKey={chartName} stroke={Colors[i%Colors.length]} fill={Colors[i%Colors.length]} />
              </LineChart>
            </div>
          );
        })}
      </div>
    );
  }
}

Pods.propTypes = {
  namespace: PropTypes.string,
  dataServer: PropTypes.string
}

Pods.defaultProps = {
  namespace: 'dafault'
}

export default Pods;