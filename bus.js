/******************************************************************************
 * 
 * bus.js
 * 
 *****************************************************************************/

var uuid = require('node-uuid'),
	EventEmitter = require('events');

class Connection extends EventEmitter {
	constructor (ipc, name = ''){
		super();
		this.ipc = ipc;
		this.id = uuid.v4();
		this.name = name;

		ipc.sendSync('/register', {
			id: this.id,
			data: {
				meta: {
					name: this.name,
					id: this.id,
					version: process.versions.electron
				}
			}
		});
	} 

	on(chan, cb){
		ipc.sendSync('/sub', {
			id: this.id,
			data: chan
		});

		ipc.on(this.id + '/' + chan, cb);
	}

	emit(chan, data) {
		ipc.sendSync('/pub', {
			id: this.id,
			data: {
				chan,
				data
			}
		});
	}

	removeListener(chan, callback) {
		ipc.sendSync('/unsub', {
			id: this.id,
			data: {
				chan
			}
		});

		ipc.removeListener(chan, callback);
	}

	listConnections(){
		return ipc.sendSync('/list-connections');
	}
}


class Server extends EventEmitter {

    constructor(ipc) {
    	super();

    	//a store of meta info (used for resolving names?)
    	this.connectionList = [];
        
        ipc.on('/register', (evnt, arg) => {
            console.log('register', arg);
            this.connectionList.push(arg.data.meta);
            console.log(this.connectionList);
            evnt.returnValue = true;
        });

        ipc.on('/unsub', (evnt, arg) => {
            //console.log('unregister', arg, evnt.sender.getId(), '/pub/'+arg.data.chan);
            evnt.returnValue = true;

            let listener = this.listeners('/pub/'+arg.data.chan).filter(listener =>{
            	return listener(null,1) === arg.id
            });

            
            var a =  this.listeners('/pub/'+arg.data.chan).map((listener)=>{
            	return listener(null,1);
            });
             
            //console.log('\n',this.listeners('/pub/'+arg.data.chan),'\n', 'and the ids', a ,'\n and the id', arg.id);
            //
            console.log('before...',a);
            
            if (listener[0]) {
            	this.removeListener('/pub/'+arg.data.chan, listener[0]);
            }
            a =  this.listeners('/pub/'+arg.data.chan).map((listener)=>{
            	return listener(null,1);
            });
            console.log('and after...',a);

        });

        ipc.on('/list-connections',(evnt, arg)=>{
        	evnt.returnValue = this.connectionList;
        });

        ipc.on('/sub', (evnt, arg)=>{
        	console.log('subscribed from', evnt.sender.getId(), arg.id);
        	evnt.returnValue = true;
        	let id = arg.id,
        		senderId = evnt.sender.getId();
        	
        	//subscribe locally 
        	this.on('/pub/' + arg.data, (function() {
        	    return function(data, reqId) {
        	        if (reqId) {
        	            return id;//[id, senderId];
        	        } else {
        	            evnt.sender.send(id + '/' + arg.data, data);
        	        }
        	    }
        	}()));

        });

        ipc.on('/pub', (evnt, arg)=>{
        	evnt.returnValue = true;

        	//emit it locally 
        	this.emit('/pub/'+arg.data.chan, arg.data.data);
        });
    }

}


//module.exports.Bus = Bus;
module.exports.Server = Server; 
module.exports.Connection = Connection; 

