'use strict';

const EventEmitter = require('events').EventEmitter;

const DEFAULT_OPTIONS = {
    name: 'EVENT_NAME',
    onFirstListenerAdd: () => {},
    onFirstListenerDidAdd: () => {},
    onListenerDidAdd: () => {},
    onLastListenerRemove: () => {},
    onDisposed: () => {},
};

function isFunction(func) {
    return typeof func === 'function';
}

class Emitter {

    constructor(options = {}) {
        this.options = Object.assign({}, DEFAULT_OPTIONS, options);
        this.activeListeners = [];
        this.isDisposed = false;
        this.name = this.options.name;
    }

    get emitter() {
        if (!this._emitter) {
            this._emitter = new EventEmitter();
        }
        return this._emitter;
    }

    get event() {
        if (!this._event) {
            this._event = this.on.bind(this);
        }
        return this._event;
    }

    emit(data) {
        if (this.isDisposed) return;
        return this.emitter.emit(this.name, data);
    }

    on(listener) {
        if (this.isDisposed) return;
        const _activeListeners = this.activeListeners;
        const _options = this.options;
        const firstListener = _activeListeners.length < 1;
        if (firstListener && _options && isFunction(_options.onFirstListenerAdd)) {
            _options.onFirstListenerAdd(this);
        }
        _activeListeners.push(listener);
        if (firstListener && _options && isFunction(_options.onFirstListenerDidAdd)) {
            _options.onFirstListenerDidAdd(this);
        }
        if (_options && isFunction(_options.onListenerDidAdd)) {
            _options.onListenerDidAdd(this, listener);
        }
        this.emitter.addListener(this.name, listener);

        const result = {
            dispose: () => {
                this.off(listener);
            },
        };

        return result;
    }

    off(listener) {
        if (this.isDisposed) return;
        const _activeListeners = this.activeListeners;
        const _options = this.options;
        const index = _activeListeners.indexOf(listener);
        if (index > -1) {
            _activeListeners.splice(index, 1);
        }
        const lastListener = _activeListeners.length < 1;
        if (lastListener && _options && isFunction(_options.onLastListenerRemove)) {
            _options.onLastListenerRemove(this);
        }
        return this.emitter.removeListener(this.name, listener);
    }

    dispose() {
        if (this.isDisposed) return;
        this.emitter.removeAllListeners();
        this.activeListeners = [];
        this.isDisposed = true;
        this._emitter = null;
        if (this.options && isFunction(this.options.onDisposed)) {
            this.options.onDisposed(this);
        }
    }
}

module.exports = Emitter;
