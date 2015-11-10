/******************************************************************************
 * 
 * a.js
 * 
 *****************************************************************************/

var ipc = require('ipc');

var Connection = require('./bus.js').Connection;

//register some meta info
var connection = new Connection(ipc, {
	name: 'a-first-connection',
	app: 'a-app'
});

var somethingHandler = (arg)=>{
	console.log('something BACK TO MEEE', arg);
};



/*
	general case
 */
//connection.on('something', somethingHandler);

// connection.emit('someChan', 234234, 'NEVER 1');

// connection.on('someChan', somethingHandler);

connection.on('someChan', arg=>{
	console.log('GOTCHA!!', arg);
});


connection.emit('someChan', 234234, 'and this as well');
// connection.removeListener('someChan', somethingHandler);
// connection.emit('someChan', 'NEVER');




/*
	conn to conn
 */
var remId = connection.listConnections()[0].id;
console.log(connection.listConnections());

connection.bind(remId,'someChan').then(sendFn =>{
	sendFn('yahoooo');
	sendFn('2');
	sendFn('3');
	sendFn('4');
});

var closeConn = connection.connect(remId, 'someChan', msg=>{
	console.log('this was the data', msg.data.data[0]);
});












// var connection2 = new Connection(ipc, {
// 	name: 'a-second-connection',
// 	app: 'a-app'
// });

// connection2.on('something', (arg)=>{
// 	console.log('anodda wan', arg);
// });


// console.log('connections please...',connection.listConnections(), 
// 	connection.listConnections()[0].id, 'and there it was');


//var i = 0;
//	// if (i === 1) {
	// 	closeConn();
	// }
	// i++;


//console.log('list of connections ', connection.listConnections());

//connection.emit('someChan', 234234, 'and this as well');

// setTimeout(()=>{
// 	connection.removeListener('something', somethingHandler);
// }, 300);

// setTimeout(()=>{
// 	connection.emit('something', 'never should you ever see this');
// }, 1000);

// iab.subscrib(uuid, name, topic, good, bad,)