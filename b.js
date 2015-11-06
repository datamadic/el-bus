/******************************************************************************
 * 
 * b.js
 * 
 *****************************************************************************/

var ipc = require('ipc');

var Connection = require('./bus.js').Connection;

var connection = new Connection(ipc);

connection.on('something', (arg)=>{
	console.log('something BACK TO MEEE', arg);
});

connection.emit('something', 234234);

console.log('connections please...',connection.listConnections());