"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.newPublicId = newPublicId;
const nanoid_1 = require("nanoid");
const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_';
const generate = (0, nanoid_1.customAlphabet)(alphabet, 10);
function newPublicId() {
    return generate();
}
