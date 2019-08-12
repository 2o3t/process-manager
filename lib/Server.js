'use strict';

const ChannelServer = require('./channel/ChannelServer');
const ServerChannel = require('./channel/ServerChannel');

class Server extends ChannelServer {
    constructor(options) {
        super(process, options);
        process.once('disconnect', () => this.dispose());
    }

    get info() {
        const pid = process.pid;
        const ppid = process.ppid;
        const memoryUsage = process.memoryUsage();
        return { pid, ppid, memoryUsage };
    }
}

Server.Channel = ServerChannel;
module.exports = Server;
