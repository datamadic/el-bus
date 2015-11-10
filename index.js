


// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
var win_a = null;
var win_b = null;

var app = require('app'); // Module to control application life.
var BrowserWindow = require('browser-window'); // Module to create native browser window.
var ipc = require('ipc');

var OFServer = require('./bus.js').Server;
var ofServer = new OFServer(ipc);




ipc.on('woah', function() {

});


// Quit when all windows are closed.
app.on('window-all-closed', function() {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform != 'darwin') {
        app.quit();
    }
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.on('ready', function() {

    // Create the browser window.
    win_a = new BrowserWindow({
        width: 800,
        height: 600
    });

    // and load the index.html of the app.
    win_a.loadUrl('file://' + __dirname + '/a.html');

        win_a.webContents.on('did-finish-load', function() {
        win_a.webContents.send('heythere', 'whoooooooh!');
    });
    // Open the DevTools.
    win_a.openDevTools();


    // win_b = new BrowserWindow({
    //     width: 800,
    //     height: 600
    // });
    // win_b.loadUrl('file://' + __dirname + '/b.html');
    // win_b.openDevTools();





    // anotherWindow = new BrowserWindow({width: 800, height: 600});
    // anotherWindow.loadUrl('file://' + __dirname + '/i2.html');
    // anotherWindow.openDevTools();
});
