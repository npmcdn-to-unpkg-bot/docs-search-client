import app  from '../config';
import { createStore, applyMiddleware, compose } from 'redux';
import { routerMiddleware } from 'react-router-redux';
import thunk from 'redux-thunk';
import rootReducer from './reducers/';
import { IReduxState } from './reducers/model';
// const createLogger = require('redux-logger');
import {startInit } from './reducers/init';

export function configureStore(history, initialState?: any): Redux.Store<IReduxState> {

  let middlewares: any[] = [
    routerMiddleware(history),
    thunk,
  ];

  /** Add Only Dev. Middlewares */
  // if (app.htmlConfig.env !== 'production' && process.env.BROWSER) {
  //   const logger = createLogger();
  //   middlewares.push(logger);
  // }

  const finalCreateStore = compose(
    applyMiddleware(...middlewares),
    app.htmlConfig.env === 'development' &&
      typeof window === 'object' &&
      typeof window.devToolsExtension !== 'undefined'
      ? window.devToolsExtension() : f => f
  )(createStore);

  const store: Redux.Store<IReduxState> = finalCreateStore(rootReducer, initialState);

  if (app.htmlConfig.env === 'development' && (module as any).hot) {
    (module as any).hot.accept('./reducers', () => {
      store.replaceReducer((require('./reducers')));
    });
  }
  startInit()(store.dispatch);
  return store;
}
