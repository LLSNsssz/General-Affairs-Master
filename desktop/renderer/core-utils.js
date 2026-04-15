"use strict";
function createEmpty(message) {
    const node = document.createElement("div");
    node.className = "empty-note";
    node.textContent = message;
    return node;
}
function normalizeUrl(rawUrl) {
    const value = String(rawUrl || "").trim();
    if (!value) {
        return "";
    }
    try {
        return new URL(value).toString();
    }
    catch {
        try {
            return new URL(`https://${value}`).toString();
        }
        catch {
            return "";
        }
    }
}
function simplifyHost(url) {
    try {
        return new URL(url).hostname.replace(/^www\./, "");
    }
    catch {
        return url;
    }
}
function urlsShareHost(leftUrl, rightUrl) {
    if (!leftUrl || !rightUrl) {
        return false;
    }
    try {
        const left = new URL(leftUrl);
        const right = new URL(rightUrl);
        return left.hostname === right.hostname || left.hostname.endsWith(`.${right.hostname}`) || right.hostname.endsWith(`.${left.hostname}`);
    }
    catch {
        return false;
    }
}
function loadJson(key, fallbackValue) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallbackValue;
    }
    catch {
        return fallbackValue;
    }
}
function persistJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}
function persistScalar(key, value) {
    localStorage.setItem(key, value);
}
function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
