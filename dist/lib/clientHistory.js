"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHistory = getHistory;
exports.addHistory = addHistory;
const KEY = 'crawl-lens:history';
const MAX = 20;
function getHistory() {
    if (typeof window === 'undefined')
        return [];
    try {
        return JSON.parse(localStorage.getItem(KEY) ?? '[]');
    }
    catch {
        return [];
    }
}
function addHistory(item) {
    if (typeof window === 'undefined')
        return;
    const cur = getHistory().filter((i) => i.publicId !== item.publicId);
    const next = [item, ...cur].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
}
