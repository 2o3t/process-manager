'use strict';

const PM = require('../');
const client = new PM.Client(__dirname + '/sub-processes.js');
const channel = client.getChannel('abc');
channel.call('ccd', 789).then(data => {
    console.log('data', data);
});
setInterval(() => {
    channel.call('ccd', 'info').then(data => {
        console.log('info: ', data);
    });
}, 2000);
channel.listen('ccc')(aa => {
    console.log('listen..', aa);
});

const http = require('http');
http.createServer(function(request, response) {
    response.writeHead(200, { 'Content-Type': 'text/plain' });
    response.end('Hello World\n');
}).listen(8888);
