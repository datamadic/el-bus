'use strict';

/******************************************************************************
 * 
 * b.js
 * 
 *****************************************************************************/

var ipc = require('ipc');

var Connection = require('./bus.js').Connection;

var connection = new Connection(ipc);

connection.on('something', function (arg) {
  console.log('something BACK TO MEEE', arg);
});

connection.emit('something', 'this is something else');

console.log('connections please...', connection.listConnections());