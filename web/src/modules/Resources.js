import React, { Component } from 'react';
import PropTypes from 'prop-types';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Button, DropdownButton, Dropdown , Form, Row} from 'react-bootstrap';
import Datetime from 'react-datetime';
import moment from 'moment';

const Colors = ['#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#911eb4', '#46f0f0', '#f032e6', '#bcf60c', '#fabebe', '#008080', '#e6beff', '#9a6324', '#fffac8', '#800000', '#aaffc3', '#808000', '#ffd8b1', '#000075', '#808080', '#ffffff', '#000000'];

class Resources extends Component {
  constructor(props) {
    super(props);
    this.state = {
      chartData: [],
      helmCharts: [],
      view: 'all', // 'all', 'per-pod'
      start: null,
      end: null,
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
        if (!helmChart.resourcesPerPodPerHelmChart) {
          return;
        }
        let col = {
          timestamp: helmChart.timestamp,
          name: helmChart.timestamp.split('T')[1].replace(':00Z', ''),
        };
        for (const pod of helmChart.resourcesPerPodPerHelmChart) {
          col[`cpu-${pod.helmChart}`] = Math.ceil(pod.resourcesPerPod.reduce((p, c) => {
            return p + c.cpu.length > 1 ? parseInt(c.cpu.slice(0, -1)) : 0
          }, 0) / 1000000);
          col[`memory-${pod.helmChart}`] = pod.resourcesPerPod.reduce((p, c) => {
            return p + parseInt(c.memory.slice(0, -2)) / 1024
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
  onDatetimeChange(start, end) {
    if (start && end && start > end) {
      start = this.state.start === start ? end.clone().subtract(30, 'minute') : start;
      end = this.state.end === end ? start.clone().add(30, 'minute') : end;
    }
    console.log(start ? start.utc().format('YYYY-MM-DDTHH:mm:ss'): '', end ? end.utc().format('YYYY-MM-DDTHH:mm:ss'): '');
    this.setState({
      ...this.state,
      start,
      end,
    });
  }
  onFocusDatetime(type) {
    const {start, end} = this.state;
    console.log('on focus', type, start, end)
    if(type === 'start' && this.state.start === null) {
      this.setState({...this.state, start: (end === null ? new moment(): end.clone()).subtract(30, 'minute')});
    }
    if(type === 'end' && this.state.end === null) {
      this.setState({...this.state, end: start === null ? new moment(): start.clone().add(30, 'minute')});
    }
  }
  render() {
    return (
      <div>
        <div className="Menu">
          <DropdownButton id="dropdown-view" title={this.state.view} size="lg">
            <Dropdown.Item onClick={() => this.onViewChange('all')}>all</Dropdown.Item>
            <Dropdown.Item onClick={() => this.onViewChange('per-pod')}>per-pod</Dropdown.Item>
          </DropdownButton>
          <Button variant="outline-primary" onClick={() => this.loadData()}>Refresh</Button>
          <div>Starts :</div>
          <Datetime 
            value={this.state.start}
            onChange={(d) => this.onDatetimeChange(d, this.state.end)}
            onFocus={() => this.onFocusDatetime('start')}
            />
          <div>Ends :</div>
          <Datetime
            value={this.state.end} 
            onChange={(d) => this.onDatetimeChange(this.state.start, d)}
            onFocus={() => this.onFocusDatetime('end')}
          />
        </div>
        {this.state.view === 'all' && <div>
          <h5>CPU usage Per HelmChart</h5>
          <LineChart width={1000} height={200} data={this.state.chartData} syncId="anyId" margin={{ top: 10, right: 30, left: 0, bottom: 0, 'text-align': 'center' }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" padding={{ left: 30, right: 30 }} />
            <YAxis />
            <Tooltip />
            <Legend />
            {this.state.helmCharts.map((chartName, i) => <Line type='monotone' dataKey={`cpu-${chartName}`} stroke={Colors[i % Colors.length]} fill={Colors[i % Colors.length]} name={chartName} key={chartName} />)}
          </LineChart>
          <h5>Memory usage Per HelmChart</h5>
          <LineChart width={1000} height={200} data={this.state.chartData} syncId="anyId" margin={{ top: 10, right: 30, left: 0, bottom: 0, 'text-align': 'center' }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" padding={{ left: 30, right: 30 }} />
            <YAxis />
            <Tooltip />
            <Legend />
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
                <YAxis yAxisId="left" label="CPU" />
                <YAxis yAxisId="right" orientation="right" label="Memory" />
                <Tooltip />
                <Legend />
                <Line yAxisId="left" type='monotone' dataKey={`cpu-${chartName}`} stroke={Colors[i % Colors.length]} fill={Colors[i % Colors.length]} />
                <Line yAxisId="right" type='monotone' dataKey={`memory-${chartName}`} stroke={Colors[i + 1 % Colors.length]} fill={Colors[i % Colors.length]} />
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