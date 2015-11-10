'use strict';

/******************************************************************************
 * 
 * a.js
 * 
 *****************************************************************************/

var ipc = require('ipc');

var Connection = require('./bus.js').Connection;

var connection = new Connection(ipc, {
	name: 'a-first-connection',
	app: 'a-app'
});

var somethingHandler = function somethingHandler(arg) {
	console.log('something BACK TO MEEE', arg);
};

// iab.subscrib(uuid, name, topic, good, bad,)

connection.on('something', somethingHandler);
connection.on('someChan', function (arg) {
	console.log('GOTCHA!!', arg);
});

var connection2 = new Connection(ipc, {
	name: 'a-second-connection',
	app: 'a-app'
});

// connection2.on('something', (arg)=>{
// 	console.log('anodda wan', arg);
// });

// console.log('connections please...',connection.listConnections(),
// 	connection.listConnections()[0].id, 'and there it was');

var remId = connection.listConnections()[0].id;

connection.bind(remId, 'someChan').then(function (sendFn) {
	console.log('AND THENNNNN');
	sendFn('yahoooo');
});

//boundSend('hey buddy this is what im sending');

var i = 0;
var closeConn = connection.connect(remId, 'someChan', function (data) {
	console.log('this was the data', data.data);
	if (i === 1) {
		closeConn();
	}
	i++;
});

console.log('list of connections ', connection.listConnections());

//boundSend('2');
// boundSend('3');

// connection.emit('something', 234234, 'and this as well');

// setTimeout(()=>{
// 	connection.removeListener('something', somethingHandler);
// }, 3000);

// setTimeout(()=>{
// 	connection.emit('something', 234234);
// }, 1000);

// var Bus = require('./bus.js').Bus,
// 	bus = new Bus(),
// 	connection = new bus.Connection();

// connection.on('first', theMsg =>{
// 	console.log(theMsg);
// });

// connection.emit('second', 'BAM');