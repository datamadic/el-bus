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

        pub: (chan) => {
        	return `${pcolNS.PUB}/${chan}`;
        },
        sub: () => {},
        send: () => {},
        connect: () => {}

    } //end pcolNS




/**
 * Lives in the render process - can be any number of these 
 */
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

	// "pusher"  side 
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

	// "receiver" side 
	connect(bindToId, chan, cb) {
		let chanString = `${this.id}/${chan}`,
			token = uuid.v4();

		//register locally, listen before you ask!! 
		ipc.on(token, cb);

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
		return ()=>{
			//need to close the remote 
			ipc.removeListener(token, cb);
		}
	} 

	removeListener(chan, callback) {
		console.log('remove it ', chan,callback.toString());
		ipc.removeListener(chan, callback);

		ipc.sendSync(pcolNS.UNSUB, {
			id: this.id,
			data: {
				chan
			}
		});
	}

	listConnections(){
		return ipc.sendSync(pcolNS.LIST_CONNECTIONS);
	}
}// end Connection class



/**
 * Lives in the browser process - singleton  
 */
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
        	// TODO need both ids here in the hash
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
				token = arg.data.token,
				id = arg.id,
				// TODO need both ids here in the hash
        		resBind = `/resolve/${bindToId}/${chan}/bind`,
        		resConnect = `/resolve/${bindToId}/${chan}/connect`,
        		callback = (data)=>{
        			evnt.sender.send(token, data);
        		};
        	
        	// TODO this should be packed with its id and unsubscribe 
        	// function 
        	this.on(token, callback);

        	this.once(resConnect, resolvedToken =>{
        		this.emit(resBind,token);
        	});
        	this.emit(resBind,token);
        	
            //evnt.returnValue = true; //this one is async 
        });


        /**********************************************************************
        general pub-sub 
        **********************************************************************/
        ipc.on(pcolNS.UNSUB, (evnt, arg) => {
            evnt.returnValue = true;

            let listeners = this.listeners(pcolNS.pub(arg.data.chan)).filter(listener => {
            	return listener.id === arg.id;
            });
            
            console.log('remove me', listeners, this.listeners(pcolNS.pub(arg.data.chan)));
            // Should this handle an array???
            listeners.forEach(listener=>{
            	listener.unsubscribe();
            });
            
            //if (listener[0]) {
            // 	this.removeListener(pcolNS.pub(arg.data.chan), listener[0]);
            // }
        });

        
        ipc.on(pcolNS.SUB, (evnt, arg)=>{
        	evnt.returnValue = true;
        	let id = arg.id,
        		senderId = evnt.sender.getId(),
        		callback = (data) => {
        			evnt.sender.send(id + '/' + arg.data, data);
        		};

        	callback.id = id;
        	callback.unsubscribe = () => {
        		this.removeListener(pcolNS.pub(arg.data), callback)
        	};

        	//subscribe locally 
        	this.on(pcolNS.pub(arg.data), callback);
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


        ipc.on(pcolNS.PUB, (evnt, arg)=>{
        	evnt.returnValue = true;

        	console.log('send it');
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

