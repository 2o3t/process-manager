'use strict';

const BaseContext = require('./BaseContext');
const { ResponseType, RequestType, State } = require('../utils/Type');
const { CanceledError, UnkownTypeError } = require('../utils/Error');
const createCancelablePromise = require('../utils/createCancelablePromise');
const Emitter = require('../utils/Emitter');

// export interface IMessagePassingProtocol {
// 	send(message: string): void;
// 	on: Event<Buffer>;
// }

const defaultOptions = {
    onZero: () => {},
};

class ChannelClient extends BaseContext {

    constructor(protocol, options = {}) {
        super(protocol);
        this.options = Object.assign({}, defaultOptions, options);

        this.lastRequestId = 0;
        this.state = State.Uninitialized;
        this.activeRequests = new Set();
        this.handlers = new Map();

        this._protocolListener = this.protocol.onMessage(msg => this._onBuffer(msg));

        this._lifecycleEmitter = new Emitter({ name: 'ON_DID_INITIALIZE' });
        this._onDidInitialize = this._createDidInitializeEvent();
    }

    getChannel(channelName) {
        const that = this;

        return {
            call(command, arg) {
                return that._requestPromise(channelName, command, arg);
            },
            listen(event, arg) {
                return that._requestEvent(channelName, event, arg);
            },
        };
    }

    _createDidInitializeEvent() {
        const that = this;
        return {
            release(args) {
                that._lifecycleEmitter.emit(args);
            },
            wait() { // wait inited
                if (that.state === State.Idle) {
                    return Promise.resolve();
                }
                return new Promise(resolve => {
                    that._lifecycleEmitter.on(resolve);
                });
            },
        };
    }

    _requestPromise(channelName, name, arg) {
        const id = this.lastRequestId++;
        const type = RequestType.Promise;
        const request = { id, type, channelName, name, arg };

        let disposable = null;

        const result = new Promise((c, e) => {
            let uninitializedPromise = createCancelablePromise(this._onDidInitialize.wait());
            uninitializedPromise.then(() => {
                uninitializedPromise = null;

                const handler = response => {
                    const { data, type } = response;
                    switch (type) {
                        case ResponseType.PromiseSuccess:
                            this.handlers.delete(id);
                            c(data);
                            break;

                        case ResponseType.PromiseError:
                            this.handlers.delete(id);
                            e(new Error(data.message));
                            break;

                        case ResponseType.PromiseErrorObj:
                            this.handlers.delete(id);
                            e(data);
                            break;
                        default:
                            this.handlers.delete(id);
                            e(new UnkownTypeError());
                    }
                };

                this.handlers.set(id, handler);
                this._sendRequest(request);
            });

            const cancel = () => {
                if (uninitializedPromise) {
                    uninitializedPromise.cancel();
                    uninitializedPromise = null;
                } else {
                    this._sendRequest({ id, type: RequestType.PromiseCancel });
                }

                e(new CanceledError());
            };

            disposable = {
                dispose: () => {
                    cancel();
                },
            };
            this.activeRequests.add(disposable);
        });

        return createCancelablePromise(result).finally(() => {
            this.activeRequests.delete(disposable);

            if (this.activeRequests.size === 0) {
                this.options && this.options.onZero();
            }
        });
    }

    // 事件监听
    _requestEvent(channelName, name, arg) {
        const id = this.lastRequestId++;
        const type = RequestType.EventListen;
        const request = { id, type, channelName, name, arg };

        let uninitializedPromise = null;

        const emitter = new Emitter({
            onFirstListenerAdd: () => {
                // first
                uninitializedPromise = createCancelablePromise(this._onDidInitialize.wait());
                uninitializedPromise.then(() => {
                    uninitializedPromise = null;
                    this.activeRequests.add(emitter);
                    this._sendRequest(request);
                });
            },
            onLastListenerRemove: () => {
                if (uninitializedPromise) {
                    uninitializedPromise.cancel();
                    uninitializedPromise = null;
                } else {
                    this.activeRequests.delete(emitter);
                    this._sendRequest({ id, type: RequestType.EventDispose });
                }

                if (this.activeRequests.size === 0) {
                    this.options && this.options.onZero();
                }
            },
        });

        const handler = res => emitter.emit(res.data);
        this.handlers.set(id, handler);

        return emitter.event;
    }

    _sendRequest(request) {
        const header = [ request.type, request.id ];
        switch (request.type) {
            case RequestType.Promise:
            case RequestType.EventListen:
                return this._send([ ...header, request.channelName, request.name ], request.arg);

            case RequestType.PromiseCancel:
            case RequestType.EventDispose:
                return this._send(header);
            default:
        }
    }

    // 接受

    _onBuffer(message) {
        const buffer = new Buffer(message, 'base64');
        const msg = JSON.parse(buffer.toString());
        const header = msg.header;
        const body = msg.body;
        const type = header[0];
        const id = header[1];

        switch (type) {
            case ResponseType.Initialize:
                return this._onResponse({ type });

            case ResponseType.PromiseSuccess:
            case ResponseType.PromiseError:
            case ResponseType.EventFire:
            case ResponseType.PromiseErrorObj:
                return this._onResponse({ type, id, data: body });
            default:
        }
    }

    _onResponse(response) {
        if (response.type === ResponseType.Initialize) {
            this.state = State.Idle;
            this._onDidInitialize.release(response);
            return;
        }

        const handler = this.handlers.get(response.id);

        if (handler) {
            handler(response);
        }
    }

    dispose() {
        super.dispose();
        if (this._protocolListener) {
            this._protocolListener = null;
        }
        this.activeRequests.forEach(p => p.dispose());
        this.activeRequests.clear();
        this.handlers.clear();
    }
}

module.exports = ChannelClient;
