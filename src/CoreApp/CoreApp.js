import express from 'express';
import path from 'path';
import _ from 'lodash';

import ExpressApp from 'lego-starter-kit/ExpressApp';

import createWs from './ws';
import getMongoose from './getMongoose';
import getDocsTemplate from './getDocsTemplate';
import staticFileMiddleware from 'connect-static-file';

export default class CoreApp extends ExpressApp {
  init() {
    super.init(...arguments);
    this.log.trace('CoreApp init');
    this.db = this.getDatabase();
    this.requests = this.getRequests();
    this.log.debug('requests', Object.keys(this.requests));
    this.responses = this.getResponses();
    this.log.debug('responses', Object.keys(this.responses));
    this.errors = this.getErrors();
    this.log.debug('errors', Object.keys(this.errors));
    this.middlewares = this.getMiddlewares();
    this.log.debug('middlewares', Object.keys(this.middlewares));
    this.models = this.getModels();
    this.log.debug('models', Object.keys(this.models));
    this.resourses = this.getResourses();
    this.log.debug('resourses', Object.keys(this.resourses));
    this.helpers = this.getHelpers();
    this.log.debug('helpers', Object.keys(this.helpers));
    this.statics = this.getResolvedStatics();
    this.log.debug('statics', this.statics);

    this.config.ws && this.initWs();
  }
  getMiddlewares() {
    return require('./middlewares').default(this); // eslint-disable-line
  }
  getModels() {
    return require('./models').default(this); // eslint-disable-line
  }
  getDatabase() {
    return this.config.db && getMongoose(this, this.config.db);
  }
  getErrors() {
    return require('./getErrors').default(this); // eslint-disable-line
  }
  getResourses() {
    return require('./resourses').default(this); // eslint-disable-line
  }
  getRequests() {
    return require('./requests').default(this); // eslint-disable-line
  }
  getResponses() {
    return require('./responses').default(this); // eslint-disable-line
  }
  getHelpers() {
    return require('./helpers').default(this); // eslint-disable-line
  }
  getStatics() {
    const buildRoot = `${__dirname}/public`;
    const root = __DEV__ ? `${__dirname}/../src/public` : buildRoot;
    return {
      '/': root,
      '/favicon.ico': buildRoot + require('file!../public/favicon.ico'), // eslint-disable-line
    };
  }
  getResolvedStatics() {
    return _.mapValues(this.getStatics() || {}, p => path.resolve(p));
  }
  useStatics() {
    _.forEach(this.statics, (path, url) => {
      this.app.use(url, express.static(path));
      this.app.use(url, staticFileMiddleware(path));
    });
  }

  useStaticPublic(publicPath, urlPath = null) {
    this.log.trace('DEPRECATED');
  }

  getUsingMiddlewares() {
    return [
      this.middlewares.extendReqRes,
      this.middlewares.reqLog,
      this.middlewares.accessLogger,
      this.middlewares.reqParser,
      this.middlewares.reqData,
      this.middlewares.parseToken,
      this.middlewares.parseUser,
    ];
  }

  acl() {
    return (req, res, next) => {
      next();
    };
  }

  getDocsRouter(getDocs, params) {
    const api = this.asyncRouter();
    const docsParams = Object.assign({}, params, {
      docs: `${params.path || '/api'}/docs`,
      docsJson: `${params.path || '/api'}/docs/json`,
    });
    api.all('/', (req, res) => res.json(docsParams));
    api.all('/docs', (req, res) => res.send(getDocsTemplate(this, docsParams)));
    api.all('/docs/json', (req, res) => res.json(getDocs(this, docsParams)));
    return api;
  }

  initWs() {
    this.ws = createWs(this);
    this.ws.wrapExpress(this.app);
  }

  async runWs() {
    if (!this.config.ws) return;
    this.ws.serveClient(false);
    this.ws.attach(this.httpServer);
    const transports = this.config.ws.transports || ['websocket'];
    this.ws.set('transports', transports);
  }

  useMiddlewares() {
    this.log.trace('CoreApp.useMiddlewares');
    const middlewares = _.flattenDeep(this.getUsingMiddlewares());
    middlewares.forEach((middleware) => {
      middleware && typeof middleware === 'function' && this.app.use(middleware);
    });
  }
  useDefaultRoute() {
    this.log.trace('CoreApp.useDefaultRoute');
    // console.log('useDefaultRoute');
    this.app.use((req, res, next) => {
      const err = this.errors.e404('Route not found');
      next(err);
    });
  }
  afterUseMiddlewares() {
    this.log.debug('CoreApp.afterUseMiddlewares DEPRECATED');
  }
  useCatchErrors() {
    this.middlewares.catchError && this.app.use(this.middlewares.catchError);
  }


  async runDb() {
    if (!this.db) return;
    this.log.trace('CoreApp.runDb');
    try {
      await this.db.run();
      return true;
    } catch (err) {
      this.log.fatal(err);
      throw err;
    }
  }


  async run(...args) {
    await super.run(...args);
    this.log.trace('CoreApp.run');
    this.config.db && this.db && await this.runDb();
    this.config.ws && await this.runWs();
  }

}
