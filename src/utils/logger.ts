import fs from 'fs';
import path from 'path';
enum LogType {
    INFO = 'INFO',
    WARN = 'WARN',
    ERROR = 'ERROR',
    DEBUG = 'DEBUG'
}

const colorizeLog = (message: string, type: LogType): string => {
    let color: string;
    switch (type) {
        case LogType.INFO:
            color = '\x1b[36m'; // Cyan
            break;
        case LogType.WARN:
            color = '\x1b[33m'; // Yellow
            break;
        case LogType.ERROR:
            color = '\x1b[31m'; // Red
            break;
        case LogType.DEBUG:
            color = '\u001B[1m'; // Bold
            break;
        default:
            color = '\x1b[0m'; // Reset
    }
    return `${color}${message}\x1b[0m`; // Reset color after message
}


// 日志文件的默认存储路径
const logFilePath = path.join(__dirname, '../../logs/bot.log');

// 写入日志文件的辅助函数
const writeToLog = (message: string) => {
    fs.appendFileSync(logFilePath, `${new Date().toISOString()} - ${message}\n`, 'utf-8');
};

// 修改彩色日志函数以同时写入控制台和日志文件
const coloredLog = (message: string, type: LogType, sender: string = 'bot') => {
    const coloredMessage = colorizeLog(`[${sender.toUpperCase()}]::: ${message}`, type);
    switch (type) {
        case LogType.INFO:
            console.info(coloredMessage);
            break;
        case LogType.WARN:
            console.warn(coloredMessage);
            break;
        case LogType.ERROR:
            console.error(coloredMessage);
            break;
        case LogType.DEBUG:
            console.log(coloredMessage);
            break;
        default:
            console.log(coloredMessage); // 默认使用 log
    }
    writeToLog(coloredMessage); // 同时写入日志文件
};

// 更新彩色日志函数的导出
export const coloredInfo = (message: string, sender: string = 'bot') => coloredLog(message, LogType.INFO, sender);
export const coloredWarn = (message: string, sender: string = 'bot') => coloredLog(message, LogType.WARN, sender);
export const coloredError = (message: string, sender: string = 'bot') => coloredLog(message, LogType.ERROR, sender);
export const coloredDebug = (message: string, sender: string = 'bot') => coloredLog(message, LogType.DEBUG, sender);