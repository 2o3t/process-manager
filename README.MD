# @2o3t/process-manager

Process manager for Nodejs.

Ideas from https://github.com/Microsoft/vscode.

## Installation

```sh
npm install @2o3t/process-manager
```

or

```sh
yarn add @2o3t/process-manager
```

## Usage

**Client** (main process):

```js
const PM = require('@2o3t/process-manager');
const client = new PM.Client(__dirname + '/sub-processes.js');
const channel = client.getChannel('channelName');
channel.call('info', {
    // something
}).then(data => {
    console.log('data', data);
});
channel.listen('ccc')(aa => {
    console.log('listen..', aa);
});
```


**Server** (sub process):

```js
const PM = require('@2o3t/process-manager');
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
```

## Options

**`Client`** options in paramters

**modulePath**: file path of sub process

**options**: Object.

| key | type | desc |
|-----|-----|-----|
| **serverName** | string | A descriptive name for the server this connection is to. Used in logging. |
| **timeout**? | number | Time in millies before killing the ipc process. The next request after killing will start it again. |
| **args**? | string[] | Arguments to the module to execute. |
| **env**? | any | Environment key-value pairs to be passed to the process that gets spawned for the ipc. |
| **debug**? | number | Allows to assign a debug port for debugging the application executed. |
| **debugBrk**? | number | Allows to assign a debug port for debugging the application and breaking it on the first line. |
| **freshExecArgv**? | boolean | See https://github.com/Microsoft/vscode/issues/27665 <br> * Allows to pass in fresh execArgv to the forked process such that it doesn't inherit them from `process.execArgv`. <br> * e.g. Launching the extension host process with `--inspect-brk=xxx` and then forking a process from the extension host results in the forked process inheriting `--inspect-brk=xxx`. |
| **useQueue**? | boolean | Enables our createQueuedSender helper for this Client. Uses a queue when the internal Node.js queue is full of messages - see notes on that method. |



**`Server`** options in paramters

**options**: Object.

| key | type | desc |
|-----|-----|-----|
| **timeoutDelay**? | number | They will timeout after `timeoutDelay`. |


## License

MIT
