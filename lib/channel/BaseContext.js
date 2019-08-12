'use strict';

const Protocol = require('./Protocol');

class BaseContext {

    constructor(protocol) {
        this.protocol = new Protocol(protocol);
    }

    _send(header, body = undefined) {
        const param = { header };
        if (body !== undefined) {
            param.body = body;
        }
        const writers = new Buffer(JSON.stringify(param));
        this._sendBuffer(writers.toString('base64'));
    }

    _sendBuffer(message) {
        try {
            this.protocol.send(message);
        } catch (err) {
            // noop
        }
    }

    dispose() {
        if (this.protocol) {
            this.protocol.dispose();
            this.protocol = null;
        }
    }
}

module.exports = BaseContext;
