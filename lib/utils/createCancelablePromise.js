'use strict';

const { CanceledError } = require('./Error');

const createCancelablePromise = promise => {
    let _hasCanceled = false;
    let _finallyListener = null;
    const wrappedPromise = new Promise((resolve, reject) => {
        promise.then(val => {
            _hasCanceled ? reject(new CanceledError()) : resolve(val);

            typeof _finallyListener === 'function' && _finallyListener();
        }).catch(error => {
            _hasCanceled ? reject(new CanceledError()) : reject(error);

            typeof _finallyListener === 'function' && _finallyListener();
        });
    });
    wrappedPromise.cancel = () => {
        _hasCanceled = true;
        return _hasCanceled;
    };
    wrappedPromise.finally = listener => {
        _finallyListener = listener;
        return wrappedPromise;
    };
    return wrappedPromise;
};

module.exports = createCancelablePromise;
