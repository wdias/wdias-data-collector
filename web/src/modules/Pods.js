import React, { Component } from 'react';
import PropTypes from 'prop-types';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Button } from 'react-bootstrap';
import Datetime from 'react-datetime';
import moment from 'moment';
import PodGroups from './PodGroups.json'

const Colors = ['#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#911eb4', '#46f0f0', '#f032e6', '#bcf60c', '#fabebe', '#008080', '#e6beff', '#9a6324', '#fffac8', '#800000', '#aaffc3', '#808000', '#ffd8b1', '#000075', '#808080', '#ffffff', '#000000'];

class Pods extends Component {
  constructor(props) {
    super(props);
    this.state = {
      chartData: [],
      helmCharts: [],
      timeoutRef: undefined,
      start: null,
      end: null,
    };
  }
  componentDidMount() {
    console.log('did mount:', this.props.namespace)
    this.loadData();
    const timeoutRef = setInterval(() => {
      this.loadData();
    }, 30 * 1000);
    this.setState({...this.state, timeoutRef});
  }
  componentDidUpdate(prevProps) {
    if (this.props.namespace !== prevProps.namespace) {
      this.loadData();
    }
  }
  componentWillUnmount() {
    console.log('will unmount:', this.props.namespace);
    if (this.state.timeoutRef) {
      clearInterval(this.state.timeoutRef);
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
    const {start, end} = this.state;
    const query_string = [['start', start], ['end', end]].filter(k => k && k[1]).map(d => `${d[0]}=${d[1].format('YYYY-MM-DDTHH:mm[:00Z]')}`).join('&');
    const res = await axios.get(`${this.props.dataServer}/metrics${namespace === 'all' ? '' : '/namespace/' + namespace}?${query_string}`);
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
  onChangeDateTime(type, value) {
    let {start, end} = this.state;
    if (type === 'start' && start) {
      start = value;
      end = (end !== null && start > end) ? start.clone().add(30, 'minute') : end;
    }
    if (type === 'end' && end) {
      end = value;
      start = (start !== null && start > end) ? end.clone().subtract(30, 'minute') : start;
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
      this.setState({...this.state, end: start === null ? new moment(): (new moment() < start.clone().add(30, 'minute') ? new moment() : start.clone().add(30, 'minute'))});
    }
  }
  render() {
    const PodList = Object.values(PodGroups).reduce((prev, curr) => prev.concat(curr), []);
    const Groups = {...PodGroups, 'other': this.state.helmCharts.filter(k => !PodList.includes(k))};
    return (
      <div>
        <div className="Menu">
          <Button variant="outline-primary" onClick={() => this.loadData()}>Refresh</Button>
          <div>Starts :</div>
          <Datetime 
            value={this.state.start}
            onBlur={(d) => this.onChangeDateTime('start', d)}
            onChange={(d) => this.onChangeDateTime('start', d)}
            onFocus={() => this.onFocusDatetime('start')}
            strictParsing={false}
            />
          <div>Ends :</div>
          <Datetime
            value={this.state.end} 
            onBlur={(d) => this.onChangeDateTime('end', d)}
            onChange={(d) => this.onChangeDateTime('end', d)}
            onFocus={() => this.onFocusDatetime('end')}
          />
        </div>
        {this.props.view === 'all' && <div>
          <h5>Pods Per HelmChart</h5>
          <LineChart width={1000} height={200} data={this.state.chartData} syncId="anyId" margin={{ top: 10, right: 30, left: 0, bottom: 0, 'text-align': 'center' }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" padding={{ left: 30, right: 30 }} />
            <YAxis />
            <Tooltip />
            <Legend />
            {this.state.helmCharts.map((chartName, i) => <Line type='monotone' dataKey={chartName} stroke={Colors[i%Colors.length]} fill={Colors[i%Colors.length]} name={chartName} key={chartName} />)}
          </LineChart>
        </div>}
        {this.props.view === 'per-pod' && Object.keys(Groups).map((groupName, j) => {
          if (!Groups[groupName].find(k => this.state.helmCharts.includes(k))) {
            return
          }
          return (
            <div key={`chartGroup-${groupName}`}>
              <hr/>
              <h3>{groupName.toUpperCase()}</h3>
              {Groups[groupName].filter(k => this.state.helmCharts.includes(k)).map((chartName, i) => {
                return (
                  <div key={`helmChart-${chartName}`}>
                    <h5>{chartName}</h5>
                    <LineChart width={1000} height={200} data={this.state.chartData} syncId="anyId" margin={{ top: 10, right: 30, left: 0, bottom: 0, 'text-align': 'center' }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" padding={{ left: 30, right: 30 }} />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type='monotone' dataKey={chartName} stroke={Colors[i%Colors.length]} fill={Colors[i%Colors.length]} />
                    </LineChart>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  }
}

Pods.propTypes = {
  namespace: PropTypes.string,
  view: PropTypes.string,
  dataServer: PropTypes.string
}

Pods.defaultProps = {
  namespace: 'dafault',
  view: 'all'
}

export default Pods;