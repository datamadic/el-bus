'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/******************************************************************************
 * 
 * bus.js
 *
 * Some guarantees 
 * 
 * everything inbound will have the shape: 
 * {
 * 	id,	// a string uuid that is unique to that connection 
 * 	data, // any type
 * }
 * 
 *****************************************************************************/

var uuid = require('node-uuid'),
    EventEmitter = require('events'),
    _ = require('underscore');

// rough NS so far...
var pcolNS = {
  SUB: '/sub',
  UNSUB: '/unsub',
  PUB: '/pub',
  BIND: '/bind',
  SEND: '/send',
  CONNECT: '/connect',
  REGISTER: '/register',
  RESOLVE: '/resolve',
  LIST_CONNECTIONS: '/list-connections',

  pub: function pub(chan) {
    return pcolNS.PUB + '/' + chan;
  },
  sub: function sub() {},
  send: function send() {},
  connect: function connect() {}

}; //end pcolNS

/**
 * Lives in the render process - can be any number of these 
 */

var Connection = (function (_EventEmitter) {
  _inherits(Connection, _EventEmitter);

  function Connection(ipc) {
    var connInfo = arguments.length <= 1 || arguments[1] === undefined ? {
      name: '',
      app: ''
    } : arguments[1];

    _classCallCheck(this, Connection);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(Connection).call(this));

    _this.ipc = ipc;
    _this.id = uuid.v4();
    _this.name = name;

    ipc.sendSync(pcolNS.REGISTER, {
      id: _this.id,
      data: {
        meta: _.extend(connInfo, {
          id: _this.id,
          version: process.versions.electron
        })
      }
    });
    return _this;
  }

  _createClass(Connection, [{
    key: 'on',
    value: function on(chan, cb) {
      ipc.sendSync(pcolNS.SUB, {
        id: this.id,
        data: chan
      });

      ipc.on(this.id + '/' + chan, cb);
    }
  }, {
    key: 'emit',
    value: function emit(chan) {
      for (var _len = arguments.length, data = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
        data[_key - 1] = arguments[_key];
      }

      var action = pcolNS.PUB;

      ipc.sendSync(action, {
        id: this.id,
        data: {
          chan: chan,
          data: data
        }
      });
    }

    // "pusher"  side

  }, {
    key: 'bind',
    value: function bind(id, chan) {
      var _this2 = this;

      return new Promise(function (resolve, reject) {

        // has to go before the request no to miss the msg back
        ipc.once('/resolve/' + id + '/' + chan, function (token) {

          // TODO perhaps this needs to be an obj that has both a send
          // and a close??
          resolve(function () {
            for (var _len2 = arguments.length, data = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
              data[_key2] = arguments[_key2];
            }

            ipc.sendSync(pcolNS.SEND, {
              id: _this2.id,
              data: {
                chan: chan,
                token: token,
                data: data
              }
            });
          });
        });

        // register the binding
        ipc.sendSync(pcolNS.BIND, {
          id: _this2.id,
          data: {
            id: id,
            chan: chan
          }
        });
      });
    }

    // "receiver" side

  }, {
    key: 'connect',
    value: function connect(bindToId, chan, cb) {
      var chanString = this.id + '/' + chan,
          token = uuid.v4();

      //register locally, listen before you ask!!
      ipc.on(token, cb);

      // this token becomes the "address" of this pair
      ipc.send(pcolNS.CONNECT, {
        id: this.id,
        data: {
          bindToId: bindToId,
          chan: chan,
          token: token
        }
      });

      // return the close function
      return function () {
        //need to close the remote
        ipc.removeListener(token, cb);
      };
    }
  }, {
    key: 'removeListener',
    value: function removeListener(chan, callback) {
      console.log('remove it ', chan, callback.toString());
      ipc.removeListener(chan, callback);

      ipc.sendSync(pcolNS.UNSUB, {
        id: this.id,
        data: {
          chan: chan
        }
      });
    }
  }, {
    key: 'listConnections',
    value: function listConnections() {
      return ipc.sendSync(pcolNS.LIST_CONNECTIONS);
    }
  }]);

  return Connection;
})(EventEmitter); // end Connection class

/**
 * Lives in the browser process - singleton  
 */

var Server = (function (_EventEmitter2) {
  _inherits(Server, _EventEmitter2);

  function Server(ipc) {
    _classCallCheck(this, Server);

    //a store of meta info (used for resolving names?)

    var _this3 = _possibleConstructorReturn(this, Object.getPrototypeOf(Server).call(this));

    _this3.connectionList = [];

    /**********************************************************************
    connection to connection 
     TODO: add lifecycle (close and...) to the bind / connect case. 
    **********************************************************************/

    // publish to a particular conn/topic combination
    ipc.on(pcolNS.BIND, function (evnt, arg) {

      // this is the ID of the binding app
      // TODO need both ids here in the hash
      var resConnect = '/resolve/' + arg.data.id + '/' + arg.data.chan + '/connect',
          resBind = '/resolve/' + arg.data.id + '/' + arg.data.chan + '/bind',
          token = undefined;

      _this3.once(resBind, function (resolvedToken) {
        token = resolvedToken;

        //send the token to the renderer
        evnt.sender.send('/resolve/' + arg.data.id + '/' + arg.data.chan, token);
        _this3.emit(resConnect, null); // clear any pending
      });

      //order is important here, need to be listening first...
      _this3.emit(resConnect, null);

      evnt.returnValue = true;
    });

    ipc.on(pcolNS.SEND, function (evnt, arg) {
      evnt.returnValue = true;

      _this3.emit(arg.data.token, arg);
    });

    // subscribe to a particular conn/topic combination
    ipc.on(pcolNS.CONNECT, function (evnt, arg) {
      var bindToId = arg.data.bindToId,
          chan = arg.data.chan,
          token = arg.data.token,
          id = arg.id,

      // TODO need both ids here in the hash
      resBind = '/resolve/' + bindToId + '/' + chan + '/bind',
          resConnect = '/resolve/' + bindToId + '/' + chan + '/connect',
          callback = function callback(data) {
        evnt.sender.send(token, data);
      };

      // TODO this should be packed with its id and unsubscribe
      // function
      _this3.on(token, callback);

      _this3.once(resConnect, function (resolvedToken) {
        _this3.emit(resBind, token);
      });
      _this3.emit(resBind, token);

      //evnt.returnValue = true; //this one is async
    });

    /**********************************************************************
    general pub-sub 
    **********************************************************************/
    ipc.on(pcolNS.UNSUB, function (evnt, arg) {
      evnt.returnValue = true;

      var listeners = _this3.listeners(pcolNS.pub(arg.data.chan)).filter(function (listener) {
        return listener.id === arg.id;
      });

      console.log('remove me', listeners, _this3.listeners(pcolNS.pub(arg.data.chan)));
      // Should this handle an array???
      listeners.forEach(function (listener) {
        listener.unsubscribe();
      });

      //if (listener[0]) {
      // 	this.removeListener(pcolNS.pub(arg.data.chan), listener[0]);
      // }
    });

    ipc.on(pcolNS.SUB, function (evnt, arg) {
      evnt.returnValue = true;
      var id = arg.id,
          senderId = evnt.sender.getId(),
          callback = function callback(data) {
        evnt.sender.send(id + '/' + arg.data, data);
      };

      callback.id = id;
      callback.unsubscribe = function () {
        _this3.removeListener(pcolNS.pub(arg.data), callback);
      };

      //subscribe locally
      _this3.on(pcolNS.pub(arg.data), callback);
    });

    /*
    (function() {
     		// TODO: this can be packed with its id and unsubscribe 
    		// function 
    	    return function(data, reqId) {
     	        if (reqId) {
    	            return id;
    	        } else {
    	            evnt.sender.send(id + '/' + arg.data, data);
    	        }
    	    }
    	}())
     */

    ipc.on(pcolNS.PUB, function (evnt, arg) {
      evnt.returnValue = true;

      console.log('send it');
      //emit it locally
      _this3.emit(pcolNS.pub(arg.data.chan), arg);
    });

    /**********************************************************************
    util functions
    **********************************************************************/
    ipc.on(pcolNS.REGISTER, function (evnt, arg) {
      _this3.connectionList.push(arg.data.meta);
      evnt.returnValue = true;
    });

    ipc.on(pcolNS.LIST_CONNECTIONS, function (evnt, arg) {
      evnt.returnValue = _this3.connectionList;
    });

    return _this3;
  } //end constructor

  return Server;
})(EventEmitter); // end Server class

module.exports.Server = Server;
module.exports.Connection = Connection;