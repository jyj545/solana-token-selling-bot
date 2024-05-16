import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import { coloredInfo, coloredError, coloredWarn, coloredDebug } from "../utils/logger";
import sleep from '../utils/sleepTimout';

export class SnipeListCache extends EventEmitter {
  private snipeList: Set<string> = new Set<string>();

  private fileLocation = path.join(__dirname, '../../snipe-list.txt');

  constructor() {
    super(); // 调用父类构造函数，初始化事件发射器
    this.loadSnipeList();
  }

  public async init() {
    while (true) {
      this.loadSnipeList();
      await sleep(2500);
    }
  }

  public isInList(mint: string) {
    return this.snipeList.has(mint);
  }

  public getSnipeList() {
    return Array.from(this.snipeList);
  }
  private loadSnipeList() {
    coloredInfo(`Refreshing snipe list...`);

    // 读取文件并获取当前的代币地址列表
    const allLines = fs.readFileSync(this.fileLocation, 'utf-8')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    // 找出新的代币地址
    const newAddresses = allLines.filter(address => !this.snipeList.has(address));

    // 更新当前的snipeList
    this.snipeList = new Set<string>(allLines);

    // 如果有新的代币地址，发射事件通知
    if (newAddresses.length > 0) {
      coloredInfo(`New addresses added to snipe list: ${newAddresses.join(', ')}`);
      this.emit('newAddressesDetected', newAddresses);
    }

    // 如果snipeList的大小发生了变化，说明有新的地址被添加或旧的地址被移除
    if (this.snipeList.size !== allLines.length) {
      coloredWarn(`Some addresses in the snipe list are invalid and have been removed.`);
    }
  }
}