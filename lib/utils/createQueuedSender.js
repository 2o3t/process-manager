'use strict';

let _isWindows = false;
if (typeof process === 'object') {
    _isWindows = (process.platform === 'win32');
}

const createQueuedSender = childProcess => {
    let msgQueue = [];
    let useQueue = false;

    const send = function(msg) {
        if (useQueue) {
            msgQueue.push(msg); // add to the queue if the process cannot handle more messages
            return;
        }

        const result = childProcess.send(msg, error => {
            if (error) {
                console.error(error); // unlikely to happen, best we can do is log this error
            }

            useQueue = false; // we are good again to send directly without queue

            // now send all the messages that we have in our queue and did not send yet
            if (msgQueue.length > 0) {
                const msgQueueCopy = msgQueue.slice(0);
                msgQueue = [];
                msgQueueCopy.forEach(entry => send(entry));
            }
        });

        if (!result || _isWindows /* workaround https://github.com/nodejs/node/issues/7657 */) {
            useQueue = true;
        }
    };

    return { send };
};

module.exports = createQueuedSender;
