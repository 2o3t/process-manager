'use strict';

const ResponseType = {
    Initialize: 200,
    PromiseSuccess: 201,
    PromiseError: 202,
    PromiseErrorObj: 203,
    EventFire: 204,
};

const RequestType = {
    Promise: 100,
    PromiseCancel: 101,
    EventListen: 102,
    EventDispose: 103,
};

const State = {
    Uninitialized: 0,
    Idle: 1,
};

module.exports = {
    ResponseType, RequestType, State,
};
