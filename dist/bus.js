'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/******************************************************************************
 * 
 * bus.js
 * 
 *****************************************************************************/

var uuid = require('node-uuid'),
    EventEmitter = require('events');

var Connection = (function (_EventEmitter) {
  _inherits(Connection, _EventEmitter);

  function Connection(ipc) {
    var name = arguments.length <= 1 || arguments[1] === undefined ? '' : arguments[1];

    _classCallCheck(this, Connection);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(Connection).call(this));

    _this.ipc = ipc;
    _this.id = uuid.v4();
    _this.name = name;

    ipc.sendSync('/register', {
      id: _this.id,
      data: {
        meta: {
          name: _this.name,
          id: _this.id,
          version: process.versions.electron
        }
      }
    });
    return _this;
  }

  _createClass(Connection, [{
    key: 'on',
    value: function on(chan, cb) {
      ipc.sendSync('/sub', {
        id: this.id,
        data: chan
      });

      ipc.on(this.id + '/' + chan, cb);
    }
  }, {
    key: 'emit',
    value: function emit(chan, data) {
      ipc.sendSync('/pub', {
        id: this.id,
        data: {
          chan: chan,
          data: data
        }
      });
    }
  }, {
    key: 'removeListener',
    value: function removeListener(chan, callback) {
      ipc.sendSync('/unsub', {
        id: this.id,
        data: {
          chan: chan
        }
      });

      ipc.removeListener(chan, callback);
    }
  }, {
    key: 'listConnections',
    value: function listConnections() {
      return ipc.sendSync('/list-connections');
    }
  }]);

  return Connection;
})(EventEmitter);

var Server = (function (_EventEmitter2) {
  _inherits(Server, _EventEmitter2);

  function Server(ipc) {
    _classCallCheck(this, Server);

    //a store of meta info (used for resolving names?)

    var _this2 = _possibleConstructorReturn(this, Object.getPrototypeOf(Server).call(this));

    _this2.connectionList = [];

    ipc.on('/register', function (evnt, arg) {
      console.log('register', arg);
      _this2.connectionList.push(arg.data.meta);
      console.log(_this2.connectionList);
      evnt.returnValue = true;
    });

    ipc.on('/unsub', function (evnt, arg) {
      //console.log('unregister', arg, evnt.sender.getId(), '/pub/'+arg.data.chan);
      evnt.returnValue = true;

      var listener = _this2.listeners('/pub/' + arg.data.chan).filter(function (listener) {
        return listener(null, 1) === arg.id;
      });

      var a = _this2.listeners('/pub/' + arg.data.chan).map(function (listener) {
        return listener(null, 1);
      });

      //console.log('\n',this.listeners('/pub/'+arg.data.chan),'\n', 'and the ids', a ,'\n and the id', arg.id);
      //
      console.log('before...', a);

      if (listener[0]) {
        _this2.removeListener('/pub/' + arg.data.chan, listener[0]);
      }
      a = _this2.listeners('/pub/' + arg.data.chan).map(function (listener) {
        return listener(null, 1);
      });
      console.log('and after...', a);
    });

    ipc.on('/list-connections', function (evnt, arg) {
      evnt.returnValue = _this2.connectionList;
    });

    ipc.on('/sub', function (evnt, arg) {
      console.log('subscribed from', evnt.sender.getId(), arg.id);
      evnt.returnValue = true;
      var id = arg.id,
          senderId = evnt.sender.getId();

      //subscribe locally
      _this2.on('/pub/' + arg.data, (function () {
        return function (data, reqId) {
          if (reqId) {
            return id; //[id, senderId];
          } else {
              evnt.sender.send(id + '/' + arg.data, data);
            }
        };
      })());
    });

    ipc.on('/pub', function (evnt, arg) {
      evnt.returnValue = true;

      //emit it locally
      _this2.emit('/pub/' + arg.data.chan, arg.data.data);
    });
    return _this2;
  }

  return Server;
})(EventEmitter);

//module.exports.Bus = Bus;

module.exports.Server = Server;
module.exports.Connection = Connection;