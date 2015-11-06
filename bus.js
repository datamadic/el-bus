/******************************************************************************
 * 
 * bus.js
 * 
 *****************************************************************************/

var uuid = require('node-uuid'),
	EventEmitter = require('events');

class Connection extends EventEmitter {
	constructor (ipc){
		super();
		this.ipc = ipc;
		this.id = uuid.v4();

		ipc.sendSync('/register', {
			id: this.id,
			data: null
		});

	} 

	on(chan, cb){
		ipc.sendSync('/sub', {
			id: this.id,
			data: chan
		});

		ipc.on(chan, (evnt, arg)=>{
			cb(evnt, arg);
		});
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
}

// class MessagePayload {
// 	constructor(){
// 		this.
// 	}
// }



// class Bus {
// 	Connection (ipc){
// 		return 
// 	}

// 	this.types =  {
// 		MULTI: 'multi'
// 	}
// }


class Server extends EventEmitter {

    constructor(ipc) {
    	super();
        
        ipc.on('/register', (evnt, arg) => {
            console.log('register', arg);
            evnt.returnValue = true;
        });

        ipc.on('/sub', (evnt, arg)=>{
        	console.log('subscribe',arg);
        	evnt.returnValue = true;
        	
        	/*
        	@todo this will send to a window multiple times if there are 
        	multiple 'connections' duplicating on the remote end. this needs to
        	be one per sender
        	 */
        	this.on('/pub/' + arg.data, function FUZZZZ(data){
        		console.log('send it!!', data);
        		evnt.sender.send(arg.data, data);
        	});
        });

        ipc.on('/pub', (evnt, arg)=>{
        	console.log('publish', arg);
        	evnt.returnValue = true;

        	console.log('emitting', '/pub/'+arg.data.chan, arg.data.data);
        	this.emit('/pub/'+arg.data.chan, arg.data.data);
        });
    }

}


//module.exports.Bus = Bus;
module.exports.Server = Server; 
module.exports.Connection = Connection; 

