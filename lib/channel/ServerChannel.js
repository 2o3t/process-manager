'use strict';

const Emitter = require('../utils/Emitter');

class ServerChannel {

    constructor(service) {
        this.service = service;
        this.emitters = new Set();
    }

    call(command, arg) {
        if (this.service && this.service[command] && typeof this.service[command] === 'function') {
            return this.service[command](arg);
        }
        return Promise.reject(new Error(`[ ${command} ] not implemented`));

    }

    listen(event, arg) {
        if (this.service && this.service[event] && typeof this.service[event] === 'function') {
            const emitter = new Emitter({ name: event });
            this.emitters.add(emitter);
            setTimeout(() => { // 防止同步调用
                this.service[event](emitter.emit.bind(emitter));
            });
            return emitter.event;
        }
        throw new Error(`[ ${command} ] not implemented`);

    }

    dispose() {
        if (this.service) {
            this.service = null;
        }
		this.emitters.forEach(d => d.dispose());
        this.emitters.clear();
    }
}

module.exports = ServerChannel;
