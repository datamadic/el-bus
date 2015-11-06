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
    _classCallCheck(this, Connection);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(Connection).call(this));

    _this.ipc = ipc;
    _this.id = uuid.v4();

    ipc.sendSync('/register', {
      id: _this.id,
      data: null
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

      ipc.on(chan, function (evnt, arg) {
        cb(evnt, arg);
      });
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
  }]);

  return Connection;
})(EventEmitter);

// class MessagePayload {
// 	constructor(){
// 		this.
// 	}
// }

// class Bus {
// 	Connection (ipc){
// 		return
// 	}

// 	this.types =  {
// 		MULTI: 'multi'
// 	}
// }

var Server = (function (_EventEmitter2) {
  _inherits(Server, _EventEmitter2);

  function Server(ipc) {
    _classCallCheck(this, Server);

    var _this2 = _possibleConstructorReturn(this, Object.getPrototypeOf(Server).call(this));

    ipc.on('/register', function (evnt, arg) {
      console.log('register', arg);
      evnt.returnValue = true;
    });

    ipc.on('/sub', function (evnt, arg) {
      console.log('subscribe', arg);
      evnt.returnValue = true;

      /*
      @todo this will send to a window multiple times if there are 
      multiple 'connections' duplicating on the remote end. this needs to
      be one per sender
       */
      _this2.on('/pub/' + arg.data, function FUZZZZ(data) {
        console.log('send it!!', data);
        evnt.sender.send(arg.data, data);
      });
    });

    ipc.on('/pub', function (evnt, arg) {
      console.log('publish', arg);
      evnt.returnValue = true;

      console.log('emitting', '/pub/' + arg.data.chan, arg.data.data);
      _this2.emit('/pub/' + arg.data.chan, arg.data.data);
    });
    return _this2;
  }

  return Server;
})(EventEmitter);

//module.exports.Bus = Bus;

module.exports.Server = Server;
module.exports.Connection = Connection;