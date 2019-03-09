import React, { Component } from 'react';
import { DropdownButton, Dropdown } from 'react-bootstrap';
import Pods from './modules/Pods';
import Resources from './modules/Resources';
import './App.css';

const dataServer = 'http://analysis-api.wdias.com'

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      namespace: 'kube-system',
      route: '/resources' // '/pods', '/resources'
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
  render() {
    return (
      <div className="App">
        <div className="Menu">
          <DropdownButton id="dropdown-view" title={this.state.route} size="lg">
            <Dropdown.Item onClick={() => this.onRouteChange('/pods')}>/pods</Dropdown.Item>
            <Dropdown.Item onClick={() => this.onRouteChange('/resources')}>/resources</Dropdown.Item>
          </DropdownButton>
          <Dropdown options={['/pods', '/resources']} onChange={(val) => this.onRouteChange(val)} value={'/pods'} placeholder="Select an option" />
          <DropdownButton id="dropdown-namespace" title={this.state.namespace} size="lg">
            <Dropdown.Item onClick={() => this.onNamespaceChange('default')}>Default</Dropdown.Item>
            <Dropdown.Item onClick={() => this.onNamespaceChange('kube-system')}>Kube-System</Dropdown.Item>
            <Dropdown.Item onClick={() => this.onNamespaceChange('all')}>All</Dropdown.Item>
          </DropdownButton>
          <Dropdown options={['default', 'kube-system', 'all']} onChange={(val) => this.onNamespaceChange(val)} value={'default'} placeholder="Select an option" />
        </div>
        <header className="App-header">
          {this.state.route === '/pods' && <Pods namespace={this.state.namespace} dataServer={dataServer} />}
          {this.state.route === '/resources' && <Resources namespace={this.state.namespace} dataServer={dataServer} />}
        </header>
      </div>
    );
  }
}

export default App;
