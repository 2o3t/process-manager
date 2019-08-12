'use strict';

class CanceledError extends Error {
    constructor(message = 'Canceled') {
        super(message);
        this.isCanceled = true;
    }
}

class UnkownTypeError extends Error {
    constructor(message = 'Unkown Type') {
        super(message);
    }
}

module.exports = {
    CanceledError,
    UnkownTypeError,
};
