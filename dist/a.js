'use strict';

/******************************************************************************
 * 
 * a.js
 * 
 *****************************************************************************/

var ipc = require('ipc');

var Connection = require('./bus.js').Connection;

var connection = new Connection(ipc);

connection.on('something', function (arg) {
  console.log('something BACK TO MEEE', arg);
});

var connection2 = new Connection(ipc);

connection2.on('something', function (arg) {
  console.log('anodda wan', arg);
});

connection.emit('something', 234234);

// var Bus = require('./bus.js').Bus,
// 	bus = new Bus(),
// 	connection = new bus.Connection();

// connection.on('first', theMsg =>{
// 	console.log(theMsg);
// });

// connection.emit('second', 'BAM');