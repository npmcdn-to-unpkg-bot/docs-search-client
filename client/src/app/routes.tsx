import * as React from 'react';
import { IndexRoute, Route } from 'react-router';
import { App, Home, About, Counter, Stars, DocPage} from './containers';
const {browserHistory } = require('react-router');
import { ReactRouterReduxHistory, syncHistoryWithStore } from 'react-router-redux';
import { configureStore } from './redux/store';
import {IReduxState } from './redux/reducers/model';

const store: Redux.Store<IReduxState> = configureStore(
  browserHistory,
  window.__INITIAL_STATE__
);
const history: ReactRouterReduxHistory = syncHistoryWithStore(browserHistory, store);

const routeConfig = (
  <Route path="/" component={App}>
    <IndexRoute component={Home} />
    <Route path="about" component={About} />
    <Route path="counter" component={Counter} />
    <Route path="stars" component={Stars} />
    <Route path="docs/*" component={DocPage} />
  </Route>
);

export {store, history, routeConfig}
