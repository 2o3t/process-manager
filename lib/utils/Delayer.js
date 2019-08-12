'use strict';

const { CanceledError } = require('./Error');

class Delayer {

    constructor(defaultDelay) {
        this.defaultDelay = defaultDelay;
        this.timeout = null;
        this.completionPromise = null;
        this.doResolve = null;
        this.task = null;
    }

    /**
     * @param {Promise} task Promise
     * @param {number} [delay=this.defaultDelay] 延迟时间
     * @memberof Delayer
     * @return {Promise} Promise
     */
    trigger(task, delay = this.defaultDelay) {
        this.task = task;
        this._cancelTimeout();

        if (!this.completionPromise) {
            this.completionPromise = new Promise((c, e) => {
                this.doResolve = c;
                this.doReject = e;
            }).then(() => {
                this.completionPromise = null;
                this.doResolve = null;
                const task = this.task;
                this.task = null;

                if (task) {
                    return task();
                }
                return Promise.reject(new Error('task is null'));
            });
        }

        this.timeout = setTimeout(() => {
            this.timeout = null;
            this.doResolve && this.doResolve(null);
        }, delay);

        return this.completionPromise;
    }

    isTriggered() {
        return this.timeout !== null;
    }

    cancel() {
        this._cancelTimeout();

        if (this.completionPromise) {
            this.doReject(new CanceledError());
            this.completionPromise = null;
        }
    }

    _cancelTimeout() {
        if (this.timeout !== null) {
            clearTimeout(this.timeout);
            this.timeout = null;
        }
    }

    dispose() {
        this._cancelTimeout();
    }
}

module.exports = Delayer;
