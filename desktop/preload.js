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
    onWindowState(listener) {
        const handler = (_event, value) => listener(value);
        electron_1.ipcRenderer.on("window:state", handler);
        return () => electron_1.ipcRenderer.removeListener("window:state", handler);
    },
    onShortcutCommand(listener) {
        const handler = (_event, value) => listener(value);
        electron_1.ipcRenderer.on("shortcut:command", handler);
        return () => electron_1.ipcRenderer.removeListener("shortcut:command", handler);
    }
};
electron_1.contextBridge.exposeInMainWorld("stickyDesktop", stickyDesktopApi);
