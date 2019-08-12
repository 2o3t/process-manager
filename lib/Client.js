'use strict';

const { fork } = require('child_process');
const createQueuedSender = require('./utils/createQueuedSender');
const Delayer = require('./utils/Delayer');
const { UnkownTypeError } = require('./utils/Error');
const ChannelClient = require('./channel/ChannelClient');

// export interface IIPCOptions {

// 	/**
// 	 * A descriptive name for the server this connection is to. Used in logging.
// 	 */
// 	serverName: string;

// 	/**
// 	 * Time in millies before killing the ipc process. The next request after killing will start it again.
// 	 */
// 	timeout?: number;

// 	/**
// 	 * Arguments to the module to execute.
// 	 */
// 	args?: string[];

// 	/**
// 	 * Environment key-value pairs to be passed to the process that gets spawned for the ipc.
// 	 */
// 	env?: any;

// 	/**
// 	 * Allows to assign a debug port for debugging the application executed.
// 	 */
// 	debug?: number;

// 	/**
// 	 * Allows to assign a debug port for debugging the application and breaking it on the first line.
// 	 */
// 	debugBrk?: number;

// 	/**
// 	 * See https://github.com/Microsoft/vscode/issues/27665
// 	 * Allows to pass in fresh execArgv to the forked process such that it doesn't inherit them from `process.execArgv`.
// 	 * e.g. Launching the extension host process with `--inspect-brk=xxx` and then forking a process from the extension host
// 	 * results in the forked process inheriting `--inspect-brk=xxx`.
// 	 */
// 	freshExecArgv?: boolean;

// 	/**
// 	 * Enables our createQueuedSender helper for this Client. Uses a queue when the internal Node.js queue is
// 	 * full of messages - see notes on that method.
// 	 */
// 	useQueue?: boolean;
// }

class Client {
    /**
     *Creates an instance of Client.
     * @param {String} modulePath path
     * @param {IIPCOptions} [options={}] option
     * @memberof Client
     */
    constructor(modulePath, options = {}) {
        this.modulePath = modulePath;
        const timeout = options && options.timeout ? options.timeout : 60 * 1000;
        this.disposeDelayer = new Delayer(timeout);
        this.channels = new Map();
        this.child = null;
        this._client = null;
    }

    /**
     * 根据通道名称获取通道
     * @param {String} channelName name
     */
    getChannel(channelName) {
        let channel = this.channels.get(channelName);

        if (!channel) {
            channel = this._getClientChannel(channelName);
            this.channels.set(channelName, channel);
        }

        return channel;
    }

    get client() {
        if (!this._client) {
            const args = this.options && this.options.args ? this.options.args : [];
            const forkOpts = Object.create(null);

            forkOpts.env = Object.assign(JSON.parse(JSON.stringify(process.env)), { PARENT_PID: String(process.pid) });

            if (this.options && this.options.env) {
                forkOpts.env = Object.assign(forkOpts.env, this.options.env);
            }

            if (this.options && this.options.freshExecArgv) {
                forkOpts.execArgv = [];
            }

            if (this.options && typeof this.options.debug === 'number') {
                forkOpts.execArgv = [ '--nolazy', '--inspect=' + this.options.debug ];
            }

            if (this.options && typeof this.options.debugBrk === 'number') {
                forkOpts.execArgv = [ '--nolazy', '--inspect-brk=' + this.options.debugBrk ];
            }

            this.child = fork(this.modulePath, args, forkOpts);

            const sender = this.options && this.options.useQueue ? createQueuedSender(this.child) : this.child;
            const send = message => this.child && this.child.connected && sender.send(message);
            const on = this.child && this.child.connected && this.child.on.bind(this.child);
            const protocol = { send, on };
            this._client = new ChannelClient(protocol, {
                onZero: () => {
                    if (this.disposeDelayer) {
                        this.disposeDelayer.trigger(() => this._disposeClient());
                    }
                },
            });

            const onExit = () => this._disposeClient();
            process.once('exit', onExit); // 暂不支持 background 运行

            this.child.on('error', err => console.warn('IPC "' + this.options.serverName + '" errored with ' + err));

            this.child.on('exit', (code, signal) => {
                process.removeListener('exit', onExit);

                if (code !== 0 && signal !== 'SIGTERM') {
                    console.warn('IPC "' + this.options.serverName + '" crashed with exit code ' + code + ' and signal ' + signal);
                }

                if (this.disposeDelayer) {
                    this.disposeDelayer.cancel();
                }
                this._disposeClient();
            });
        }
        return this._client;
    }

    _getClientChannel(name) {
        const that = this;

        return {
            call(command, arg) {
                if (!that.disposeDelayer) {
                    return Promise.reject(new UnkownTypeError());
                }
                that.disposeDelayer.cancel();
                return that.client.getChannel(name).call(command, arg);
            },
            listen(event, arg) {
                if (!that.disposeDelayer) {
                    return function() {
                        return { dispose() {} };
                    };
                }

                that.disposeDelayer.cancel();
                return that.client.getChannel(name).listen(event, arg);
            },
        };
    }

    _disposeClient() {
        if (this._client) {
            if (this.child) {
                this.child.kill();
                this.child = null;
            }
            this._client.dispose();
            this._client = null;
            this.channels.clear();
        }
    }

    dispose() {
        if (this.disposeDelayer) {
            this.disposeDelayer.cancel();
            this.disposeDelayer = null; // StrictNullOverride: nulling out ok in dispose
        }
        this._disposeClient();
    }
}

module.exports = Client;
