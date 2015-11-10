/******************************************************************************
 * 
 * bus.js
 *
 * Some guarantees everything inbound will have the shape: 
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
        LIST_CONNECTIONS: '/list-connections',

        pub: (chan) => {
        	return `${pcolNS.PUB}/${chan}`;
        },
        sub: () => {},
        send: () => {},
        connect: () => {}

    } //end pcolNS


class Connection extends EventEmitter {
	constructor (ipc, connInfo = {
		name: '',
		app: ''
	}){
		super();
		this.ipc = ipc;
		this.id = uuid.v4();
		this.name = name;

		ipc.sendSync(pcolNS.REGISTER, {
			id: this.id,
			data: {
				meta: _.extend(connInfo, {
					id: this.id,
					version: process.versions.electron
				})
			}
		});
	} 

	on(chan, cb) {
		ipc.sendSync(pcolNS.SUB, {
			id: this.id,
			data: chan
		});

		ipc.on(this.id + '/' + chan, cb);
	}

	emit(chan, ...data) {
		let action = pcolNS.PUB;

		ipc.sendSync(action, {
			id: this.id,
			data: {
				chan,
				data
			}
		});
	}

	// "server" side 
	bind(id, chan) {

	    return new Promise((resolve, reject) => {

	        // has to go before the request no to miss the msg back
	        ipc.once(`/resolve/${id}/${chan}`, token => {

	            // TODO perhaps this needs to be an obj that has both a send 
	            // and a close?? 
	            resolve((...data) => {
	                ipc.sendSync(pcolNS.SEND, {
	                    id: this.id,
	                    data: {
	                        chan,
	                        token,
	                        data
	                    }
	                });
	            })
	        });

	        // register the binding 
	        ipc.sendSync(pcolNS.BIND, {
	            id: this.id,
	            data: {
	                id,
	                chan
	            }
	        });
	    });
	}

	// "client side"
	connect(bindToId, chan, cb) {

		console.log('closing1');

		let chanString = `${this.id}/${chan}`,
			token = uuid.v4();



		//register locally, listen before you ask!! 
		ipc.on(token, cb);

		console.log('closing2',token);

		// this token becomes the "address" of this pair
		ipc.send(pcolNS.CONNECT, {
			id: this.id,
			data: {
				bindToId,
				chan,
				token
			}
		});

		

		// return the close function 
		console.log('closing3');
		return ()=>{
			ipc.removeListener(token, cb);
		}
	} 

	removeListener(chan, callback) {
		ipc.sendSync(pcolNS.UNSUB, {
			id: this.id,
			data: {
				chan
			}
		});

		ipc.removeListener(chan, callback);
	}

	listConnections(){
		return ipc.sendSync(pcolNS.LIST_CONNECTIONS);
	}
}// end Connection class




class Server extends EventEmitter {

    constructor(ipc) {
    	super();

    	//a store of meta info (used for resolving names?)
    	this.connectionList = [];
        
        /**********************************************************************
        connection to connection 

        TODO: add lifecycle (close and...) to the bind / connect case. 
        **********************************************************************/

        // publish to a particular conn/topic combination
        ipc.on(pcolNS.BIND, (evnt, arg) => {

        	// this is the ID of the binding app 
        	// WHAT IF THERE ARE 2 BINDS TO DIFF CONNS?? need both ids here 
        	let resConnect = `/resolve/${arg.data.id}/${arg.data.chan}/connect`,
        		resBind = `/resolve/${arg.data.id}/${arg.data.chan}/bind`,
        		token;

        	this.once(resBind, resolvedToken =>{
        		token = resolvedToken;

        		//send the token to the renderer 
        		evnt.sender.send(`/resolve/${arg.data.id}/${arg.data.chan}` ,token);
        		this.emit(resConnect, null); // clear any pending 

        	});

        	//order is important here, need to be listening first... 
        	this.emit(resConnect, null);

            evnt.returnValue = true;
        });

        ipc.on(pcolNS.SEND, (evnt, arg)=>{
        	evnt.returnValue = true;

        	this.emit(arg.data.token, arg);

        });

        // subscribe to a particular conn/topic combination 
        ipc.on(pcolNS.CONNECT, (evnt, arg) => {
        	let bindToId = arg.data.bindToId,
        		chan = arg.data.chan,
				token = arg.data.token, // uuid.v4(),
				id = arg.id,
        		resBind = `/resolve/${bindToId}/${chan}/bind`,
        		resConnect = `/resolve/${bindToId}/${chan}/connect`;
        	
        	this.on(token, (function() {

        	    return function(data, reqId) {
        	    	console.log('send it out', data);
        	        if (reqId) {
        	            return id;
        	        } else {
        	            evnt.sender.send(token, data);
        	        }
        	    }
        	}()));

        	this.once(resConnect, resolvedToken =>{
        		this.emit(resBind,token);
        	});
        	this.emit(resBind,token);
        	
            evnt.returnValue = true;
        });


        /**********************************************************************
        general pub-sub 
        **********************************************************************/
        ipc.on(pcolNS.UNSUB, (evnt, arg) => {
            evnt.returnValue = true;

            let listener = this.listeners(pcolNS.pub(arg.data.chan)).filter(listener => {

            	// Calling the listener with 2 arguments will return the 
            	// stamped id, we can filter on this. 
            	return listener(null,1) === arg.id
            });
            
            // Should this handle an array???
            if (listener[0]) {
            	this.removeListener(pcolNS.pub(arg.data.chan), listener[0]);
            }
        });

        
        ipc.on(pcolNS.SUB, (evnt, arg)=>{
        	evnt.returnValue = true;
        	let id = arg.id,
        		senderId = evnt.sender.getId();
        	
        	//subscribe locally 
        	this.on(pcolNS.pub(arg.data), (function() {

        	    return function(data, reqId) {

        	        if (reqId) {
        	            return id;
        	        } else {
        	            evnt.sender.send(id + '/' + arg.data, data);
        	        }
        	    }
        	}()));
        });


        ipc.on(pcolNS.PUB, (evnt, arg)=>{
        	evnt.returnValue = true;

        	//emit it locally 
        	this.emit(pcolNS.pub(arg.data.chan), arg);
        });


        /**********************************************************************
        util functions
        **********************************************************************/
        ipc.on(pcolNS.REGISTER, (evnt, arg) => {
            this.connectionList.push(arg.data.meta);
            evnt.returnValue = true;
        });

        ipc.on(pcolNS.LIST_CONNECTIONS,(evnt, arg)=>{
        	evnt.returnValue = this.connectionList;
        });

    }//end constructor 
} // end Server class 



module.exports.Server = Server; 
module.exports.Connection = Connection; 

