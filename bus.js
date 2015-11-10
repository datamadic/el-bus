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
        LIST_CONNECTIONS: '/list-connections'
    } //end pcolNS


// rough route builder 
var pcolBuild = {
    pub: (chan) => {
        return `${pcolNS.PUB}/${chan}`;
    },
    sub: () => {},
    chanAddress: (id, chan) => {
    	return id + '/' + chan;
    },
    connect: (id, chan) => {
    	return `${pcolNS.RESOLVE}/${id}/${chan}/connect`;
    },
    bind: (id, chan) => {
    	return `${pcolNS.RESOLVE}/${id}/${chan}/bind`;
    },
    resToken: (id, chan)=> {
    	return `${pcolNS.RESOLVE}/${id}/${chan}`
    }
}



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
		let chanAddress = pcolBuild.chanAddress(this.id, chan);

		ipc.sendSync(pcolNS.SUB, {
			id: this.id,
			data: chan
		});

		ipc.on(chanAddress, cb);
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
	    	let resToken = pcolBuild.resToken(id, chan);

	        // has to go before the request not to miss the msg back
	        ipc.once(resToken, token => {

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
		let token = uuid.v4();

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
		// TODO need to close the remote 
		return ()=>{
			ipc.removeListener(token, cb);
		}
	} 

	removeListener(chan, callback) {
		ipc.removeListener(chan, callback);

		ipc.sendSync(pcolNS.UNSUB, {
			id: this.id,
			data: {
				chan
			}
		});
	}

	// the return value is the list (set sync from browser process)
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
        	// TODO might need both ids here in the hash
        	let id = arg.data.id,
        		chan = arg.data.chan,
        		resConnect = pcolBuild.connect(id, chan),
        		resBind = pcolBuild.bind(id, chan), 
        		resToken = pcolBuild.resToken(id, chan);

        	// order is important here, need to be listening first... 
        	this.once(resBind, resolvedToken =>{

        		//send the token to the renderer process then clear pending
        		evnt.sender.send(resToken, resolvedToken);
        		this.emit(resConnect, null);
        	});
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
				id = arg.id;

			// TODO might need both ids here in the hash
        	let resBind = pcolBuild.bind(bindToId, chan),
        		resConnect = pcolBuild.connect(bindToId, chan),
        		callback = (data)=>{
        			evnt.sender.send(token, data);
        		};
        	
        	// TODO this should be packed with its id and unsubscribe 
        	this.on(token, callback);
        	this.once(resConnect, resolvedToken =>{
        		this.emit(resBind,token);
        	});
        	this.emit(resBind,token);
        });


        /**********************************************************************
        general pub-sub 
        **********************************************************************/
        ipc.on(pcolNS.UNSUB, (evnt, arg) => {
        	let eventName = pcolBuild.pub(arg.data.chan);

            evnt.returnValue = true;

            let listeners = this.listeners(eventName).filter(listener => {
            	return listener.id === arg.id;
            });
            
            listeners.forEach(listener=>{
            	listener.unsubscribe();
            });
        });

        
        ipc.on(pcolNS.SUB, (evnt, arg)=>{
        	evnt.returnValue = true;
        	let id = arg.id,
        		senderId = evnt.sender.getId(),
        		address = pcolBuild.chanAddress(id, arg.data),
        		pubEvent = pcolBuild.pub(arg.data),
        		callback = (data) => {
        			evnt.sender.send(address, data);
        		};

        	callback.id = id;
        	callback.unsubscribe = () => {
        		this.removeListener(pubEvent, callback)
        	};

        	//subscribe locally 
        	this.on(pubEvent, callback);
        });

        ipc.on(pcolNS.PUB, (evnt, arg)=>{
        	let eventName = pcolBuild.pub(arg.data.chan);

        	evnt.returnValue = true;

        	//emit it locally 
        	this.emit(eventName, arg);
        });


        /**********************************************************************
        util functions
        **********************************************************************/
        ipc.on(pcolNS.REGISTER, (evnt, arg) => {
        	// TODO this never gets cleaned.... do clean it
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

