"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const package_json_1 = __importDefault(require("./package.json"));
const stickyDesktopApi = {
    platform: process.platform,
    appVersion: package_json_1.default.version,
    minimizeWindow() {
        electron_1.ipcRenderer.send("window:minimize");
    },
    toggleMaximizeWindow() {
        electron_1.ipcRenderer.send("window:toggle-maximize");
    },
    closeWindow() {
        electron_1.ipcRenderer.send("window:close");
    },
    async toggleCollapsedWindow() {
        return electron_1.ipcRenderer.invoke("window:toggle-collapsed");
    },
    async toggleAlwaysOnTopWindow() {
        return electron_1.ipcRenderer.invoke("window:toggle-always-on-top");
    },
    async getWindowState() {
        return electron_1.ipcRenderer.invoke("window:get-state");
    },
    async getWindowBounds() {
        return electron_1.ipcRenderer.invoke("window:get-bounds");
    },
    setWindowPosition(x, y) {
        electron_1.ipcRenderer.send("window:set-position", { x, y });
    },
    async snapWindowPosition(x, y) {
        return electron_1.ipcRenderer.invoke("window:snap-position", { x, y });
    },
    setReaderBounds(bounds) {
        electron_1.ipcRenderer.send("reader:set-bounds", bounds);
    },
    setReaderVisible(visible) {
        electron_1.ipcRenderer.send("reader:set-visible", Boolean(visible));
    },
    navigateReader(url) {
        electron_1.ipcRenderer.send("reader:navigate", url);
    },
    reloadReader() {
        electron_1.ipcRenderer.send("reader:reload");
    },
    goBackReader() {
        electron_1.ipcRenderer.send("reader:go-back");
    },
    goForwardReader() {
        electron_1.ipcRenderer.send("reader:go-forward");
    },
    async insertReaderCSS(css) {
        return electron_1.ipcRenderer.invoke("reader:insert-css", css);
    },
    async removeReaderCSS(key) {
        await electron_1.ipcRenderer.invoke("reader:remove-inserted-css", key);
    },
    async executeReaderJavaScript(code, userGesture) {
        return electron_1.ipcRenderer.invoke("reader:execute-javascript", code, Boolean(userGesture));
    },
    onWindowState(listener) {
        const handler = (_event, value) => listener(value);
        electron_1.ipcRenderer.on("window:state", handler);
        return () => electron_1.ipcRenderer.removeListener("window:state", handler);
    },
    onShortcutCommand(listener) {
        const handler = (_event, value) => listener(value);
        electron_1.ipcRenderer.on("shortcut:command", handler);
        return () => electron_1.ipcRenderer.removeListener("shortcut:command", handler);
    },
    onReaderEvent(listener) {
        const handler = (_event, value) => listener(value);
        electron_1.ipcRenderer.on("reader:event", handler);
        return () => electron_1.ipcRenderer.removeListener("reader:event", handler);
    }
};
electron_1.contextBridge.exposeInMainWorld("stickyDesktop", stickyDesktopApi);
