'use strict';

class Protocol {

    constructor(context) {
        this._context = context;
    }

    onMessage(listener) {
        return this._context.on('message', listener);
    }

    send(arg) {
        return this._context.send(arg);
    }

    dispose() {
        this._context = null;
    }
}

module.exports = Protocol;
