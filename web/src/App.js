import React, { Component } from 'react';
import { DropdownButton, Dropdown } from 'react-bootstrap';
import Pods from './modules/Pods';
import Resources from './modules/Resources';
import './css/App.css';
import './css/react-datetime.css';

const dataServer = 'http://analysis-api.wdias.com'

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      route: '/resources', // '/pods', '/resources'
      namespace: 'default',
      view: 'all', // '/all', '/per-pod'
    };
  }
  componentDidMount() {
  }
  onNamespaceChange(namespace) {
    this.setState({
      ...this.state,
      namespace,
    });
  }
  onRouteChange(route) {
    this.setState({
      ...this.state,
      route,
    });
  }
  onViewChange(view) {
    this.setState({
      ...this.state,
      view,
    });
  }
  render() {
    return (
      <div className="App">
        <div className="Menu">
          <DropdownButton id="dropdown-view" title={this.state.route} size="lg">
            <Dropdown.Item onClick={() => this.onRouteChange('/pods')}>/pods</Dropdown.Item>
            <Dropdown.Item onClick={() => this.onRouteChange('/resources')}>/resources</Dropdown.Item>
          </DropdownButton>
          {/* <Dropdown options={['/pods', '/resources']} onChange={(val) => this.onRouteChange(val)} value={'/pods'} placeholder="Select an option" /> */}
          <DropdownButton id="dropdown-namespace" title={this.state.namespace} size="lg">
            <Dropdown.Item onClick={() => this.onNamespaceChange('default')}>Default</Dropdown.Item>
            <Dropdown.Item onClick={() => this.onNamespaceChange('kube-system')}>Kube-System</Dropdown.Item>
            <Dropdown.Item onClick={() => this.onNamespaceChange('all')}>All</Dropdown.Item>
          </DropdownButton>
          {/* <Dropdown options={['default', 'kube-system', 'all']} onChange={(val) => this.onNamespaceChange(val)} value={'default'} placeholder="Select an option" /> */}
          <DropdownButton id="dropdown-view" title={this.state.view} size="lg">
            <Dropdown.Item onClick={() => this.onViewChange('all')}>all</Dropdown.Item>
            <Dropdown.Item onClick={() => this.onViewChange('per-pod')}>per-pod</Dropdown.Item>
          </DropdownButton>
        </div>
        <header className="App-header">
          {this.state.route === '/pods' && <Pods namespace={this.state.namespace} view={this.state.view} dataServer={dataServer} />}
          {this.state.route === '/resources' && <Resources namespace={this.state.namespace} view={this.state.view} dataServer={dataServer} />}
        </header>
      </div>
    );
  }
}

export default App;
