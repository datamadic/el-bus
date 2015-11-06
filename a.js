/******************************************************************************
 * 
 * a.js
 * 
 *****************************************************************************/

var ipc = require('ipc');

var Connection = require('./bus.js').Connection;

var connection = new Connection(ipc);

var somethingHandler = (arg)=>{
	console.log('something BACK TO MEEE', arg);
};

connection.on('something', somethingHandler);


var connection2 = new Connection(ipc);

connection2.on('something', (arg)=>{
	console.log('anodda wan', arg);
});


console.log('connections please...',connection.listConnections());


connection.emit('something', 234234);

setTimeout(()=>{
	connection.removeListener('something', somethingHandler);
}, 300);

setTimeout(()=>{
	connection.emit('something', 234234);
}, 1000);


// var Bus = require('./bus.js').Bus,
// 	bus = new Bus(),
// 	connection = new bus.Connection();



// connection.on('first', theMsg =>{
// 	console.log(theMsg);
// });

// connection.emit('second', 'BAM');