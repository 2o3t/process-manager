'use strict';

// console.log(process.debugPort);
// console.log(process.arch);
// // console.log(process.channel);

// console.log(process.env);
// console.log(process.memoryUsage());
// console.log(`This process is pid ${process.pid}`);
// console.log(`The parent process is pid ${process.ppid}`);

// console.log(process.title);

const PM = require('../');
const server = new PM.Server();
const channel = new PM.ServerChannel({
    info(arg) {
        console.log('arg: ', arg);
        return Promise.resolve(server.info);
    },
    ccc(emit) {
        emit('100w');
        emit('101w');
        // server.dispose();
        emit('102w');
        emit('103w');
        emit('104w');
    },
});
console.log('server ok');
server.registerChannel('channelName', channel);
