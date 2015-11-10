/******************************************************************************
 * 
 * bus.js
 * 
 *****************************************************************************/

var uuid = require('node-uuid'),
	EventEmitter = require('events'),
	_ = require('underscore');

var pcolNS = {
        /*
        	
        	
        	'/sub' --> on '/pub/' + arg.data
        	'/pub' --> emit '/pub/'+arg.data.chan

        	*connection to connection*
        	'/bind'
        	'/send' --> `/send/${arg.id}/${chan}`
        	'/connect' --> `/send/${bindToId}/${chan}`


        	`${this.id}/${chan}` //client side chan string 

        	'/unsub' --> '/pub/'+arg.data.chan

        	'/register'
        	'/list-connections'

         */
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

        sub: () => {

        },

        send: () => {

        },

        connect: () => {

        }

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
		// let pairAction = pair? '/direct': '',
		// 	action = '/pub' + pairAction;
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

	        // has to go before the request 
	        console.log("I WANT", `/resolve/${id}/${chan}`);
	        ipc.once(`/resolve/${id}/${chan}`, token => {
	            console.log('huzza', token);

	            // return the sending function 
	            resolve((...data) => {
	                ipc.sendSync(pcolNS.SEND, {
	                    id: this.id,
	                    data: {
	                        chan,
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
		let chanString = `${this.id}/${chan}`;

		ipc.sendSync(pcolNS.CONNECT, {
			id: this.id,
			data: {
				bindToId,
				chan
			}
		});

		//register locally
		ipc.on(chanString, cb);

		// return the close function 
		return ()=>{
			ipc.removeListener(chanString, cb);
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
         *********************************************************************/

        // publish to a particular conn/topic combination
        ipc.on(pcolNS.BIND, (evnt, arg) => {

        	let resConnect = `/resolve/${arg.data.id}/${arg.data.chan}/connect`,
        		resBind = `/resolve/${arg.data.id}/${arg.data.chan}/bind`,
        		token;

        	this.once(resBind, resolvedToken =>{
        		token = resolvedToken;

        		console.log('RES THIS!', `/resolve/${arg.data.id}/${arg.data.chan}`);
        		evnt.sender.send(`/resolve/${arg.data.id}/${arg.data.chan}` ,token);
        		this.emit(resConnect, null); // clear any pending 

        	});

        	//order is important here, need to be listening first... 
        	this.emit(resConnect, null);

        	// check if anyone is listening, return t/f
            evnt.returnValue = true;
        });

        ipc.on(pcolNS.SEND, (evnt, arg)=>{
        	evnt.returnValue = true;
        	let chan = arg.data.chan;
        	
        	this.emit(`/send/${arg.id}/${chan}`, arg.data);

        });

        // subscribe to a particular conn/topic combination 
        ipc.on(pcolNS.CONNECT, (evnt, arg) => {
        	//add the lister combo to the list
        	let bindToId = arg.data.bindToId,
        		chan = arg.data.chan;
        	
        	this.on(`/send/${bindToId}/${chan}`, (function() {

        	    return function(data, reqId) {
        	        if (reqId) {
        	            return id;
        	        } else {
        	            evnt.sender.send(`${arg.id}/${arg.data.chan}`, data);
        	        }
        	    }
        	}()));
        	
        	let token = uuid.v4(),
        		resBind = `/resolve/${bindToId}/${chan}/bind`,
        		resConnect = `/resolve/${bindToId}/${chan}/connect`;

        	this.once(resConnect, resolvedToken =>{
        		this.emit(resBind,token);
        	});
        	this.emit(resBind,token);
        	
            evnt.returnValue = true;
        });


        /**********************************************************************
        general pub-sub 
         *********************************************************************/
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

        	console.log(arg);

        	//emit it locally 
        	this.emit(pcolNS.pub(arg.data.chan), arg);
        });


        /**********************************************************************
        util functions
         *********************************************************************/
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

