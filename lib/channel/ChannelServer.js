'use strict';

const BaseContext = require('./BaseContext');
const { ResponseType, RequestType, State } = require('../utils/Type');
const createCancelablePromise = require('../utils/createCancelablePromise');
const Emitter = require('../utils/Emitter');

const defaultOptions = {
    timeoutDelay: 1000,
};

class ChannelServer extends BaseContext {

    constructor(protocol, options = {}) {
        super(protocol);
        this.options = Object.assign({}, defaultOptions, options);

        this.channels = new Map();
        this.activeRequests = new Map();

        // Requests might come in for channels which are not yet registered.
        // They will timeout after `timeoutDelay`.
        this.pendingRequests = new Map();
        this.timeoutDelay = this.options.timeoutDelay;

        this._protocolListener = this.protocol.onMessage(msg => this._onRawMessage(msg));
        this._sendResponse({ type: ResponseType.Initialize });
    }

    registerChannel(channelName, channel) {
    	this.channels.set(channelName, channel);
    	this._flushPendingRequests(channelName);
    }

    _sendResponse(response) {
        switch (response.type) {
            case ResponseType.Initialize:
                return this._send([ response.type ]);

            case ResponseType.PromiseSuccess:
            case ResponseType.PromiseError:
            case ResponseType.EventFire:
            case ResponseType.PromiseErrorObj:
                return this._send([ response.type, response.id ], response.data);
            default:
        }
    }

    _onRawMessage(message) {
        const buffer = new Buffer(message, 'base64');
        const msg = JSON.parse(buffer.toString());
        const header = msg.header;
        const body = msg.body;
        const type = header[0];
        const id = header[1];
        const channelName = header[2];
        const name = header[3];

        switch (type) {
            case RequestType.Promise:
                return this._onPromise({ type, id, channelName, name, arg: body });
            case RequestType.EventListen:
                return this._onEventListen({ type, id, channelName, name, arg: body });
            case RequestType.PromiseCancel:
                return this._disposeActiveRequest({ type, id });
            case RequestType.EventDispose:
                return this._disposeActiveRequest({ type, id });
            default:
        }
    }

    _onPromise(request) {
        const channel = this.channels.get(request.channelName);

        if (!channel) {
            this._collectPendingRequest(request);
            return;
        }

        let promise;

        try {
            promise = channel.call(request.name, request.arg);
        } catch (err) {
            promise = Promise.reject(err);
        }

        if (!promise || typeof promise.then !== 'function') {
            promise = Promise.reject('must be return Promise!');
        }

        const id = request.id;

        let cancelablePromise = createCancelablePromise(promise);
        cancelablePromise.then(data => {
            cancelablePromise = null;
            this._sendResponse({ id, data, type: ResponseType.PromiseSuccess });
            this.activeRequests.delete(id);
        }).catch(err => {
            cancelablePromise = null;
            if (err instanceof Error) {
                this._sendResponse({
                    id, type: ResponseType.PromiseError,
                    data: {
                        message: err.message,
                        name: err.name,
                        stack: err.stack ? (err.stack.split ? err.stack.split('\n') : err.stack) : undefined,
                    },
                });
            } else {
                this._sendResponse({ id, data: err, type: ResponseType.PromiseErrorObj });
            }
            this.activeRequests.delete(id);
        });

        const cancel = () => {
            if (cancelablePromise) {
                cancelablePromise.cancel();
                cancelablePromise = null;
            }
        };

        const disposable = {
            dispose: () => {
                cancel();
            },
        };
        this.activeRequests.set(id, disposable);
    }

    _onEventListen(request) {
        const channel = this.channels.get(request.channelName);

        if (!channel) {
            this._collectPendingRequest(request);
            return;
        }

        const id = request.id;
        // const emitter = new Emitter({
        //     name: request.name,
        // });
        const event = channel.listen(request.name, request.arg);
        const disposable = event(data => {
            this._sendResponse({ id, data, type: ResponseType.EventFire });
        });

        this.activeRequests.set(id, disposable);
    }

    _disposeActiveRequest(request) {
        const disposable = this.activeRequests.get(request.id);

        if (disposable) {
            disposable.dispose();
            this.activeRequests.delete(request.id);
        }
    }

    _collectPendingRequest(request) {
		let pendingRequests = this.pendingRequests.get(request.channelName);

		if (!pendingRequests) {
			pendingRequests = [];
			this.pendingRequests.set(request.channelName, pendingRequests);
		}

		const timer = setTimeout(() => {
			console.error(`Unknown channel: ${request.channelName}`);

			if (request.type === RequestType.Promise) {
				this._sendResponse({
					id: request.id,
					data: { name: 'Unknown channel', message: `Channel name '${request.channelName}' timed out after ${this.timeoutDelay}ms`, stack: undefined },
					type: ResponseType.PromiseError
				});
			}
		}, this.timeoutDelay);

		pendingRequests.push({ request, timeoutTimer: timer });
	}

    _flushPendingRequests(channelName) {
		const requests = this.pendingRequests.get(channelName);

		if (requests) {
			for (const item of requests) {
				clearTimeout(item.timeoutTimer);

				switch (item.request.type) {
					case RequestType.Promise: this._onPromise(item.request); break;
					case RequestType.EventListen: this._onEventListen(item.request); break;
				}
			}

			this.pendingRequests.delete(channelName);
		}
	}

    dispose() {
        super.dispose();
		if (this._protocolListener) {
			this._protocolListener = null;
		}
		this.activeRequests.forEach(d => d.dispose());
		this.activeRequests.clear();
		this.channels.forEach(d => d.dispose());
        this.channels.clear();
        this.pendingRequests.clear();
	}
}

module.exports = ChannelServer;
