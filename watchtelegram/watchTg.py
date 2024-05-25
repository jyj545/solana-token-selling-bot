from telethon import TelegramClient, events
import asyncio
from telethon.errors import TimeoutError
import re

address_pattern = r'\b[A-Za-z0-9]{44}\b'
from telethon import TelegramClient, events

api_id = '23052045'  # 替换为您的 API ID
api_hash = '057f373d7bf1e2579290b722b2482313'  # 替换为您的 API Hash
proxy_ip = '127.0.0.1'
proxy_port = 10809

client = TelegramClient(
    'session_name', api_id, api_hash,
    proxy=('socks5', proxy_ip, proxy_port)
)


# 已知的 Solana 地址列表
known_addresses = set()

# 将新地址追加到这个文件
output_file_path = '../new_solana_addresses.txt'

# 异步函数，用于从文件中读取所有已知的 Solana 地址
async def load_known_addresses():
    global known_addresses
    try:
        with open('known_addresses.txt', 'r', encoding='utf-8') as file:
            known_addresses = set([line.strip() for line in file.readlines()])
    except FileNotFoundError:
        print("未找到已知地址文件，创建一个空的地址集合。")

# 异步函数，用于将新发现的 Solana 地址写入文件
async def write_new_address(new_address):
    global known_addresses
    known_addresses.add(new_address)
    with open(output_file_path, 'a', encoding='utf-8') as file:
        file.write(new_address + '\n')

# 事件处理器，处理新消息事件
@client.on(events.NewMessage(incoming=True))
async def my_event_handler(event):
    if event.is_channel:
        # 打印消息内容
        print(event.message.text)
        # 使用正则表达式查找所有匹配的 Solana 地址
        matches = re.findall(address_pattern, event.message.text)
        for match in matches:
            # 打印匹配到的地址
            print(f"Found Solana address: {match}")
            # 如果地址不在已知列表中，则异步写入文件
            if match not in known_addresses:
                await write_new_address(match)

# 异步主函数
async def main():
    async with client:
        try:
            # 加载已知地址
            await load_known_addresses()
            # 运行直到断开连接
            await client.run_until_disconnected()
        except Exception as e:
            print(f"发生了错误: {e}")

# 启动异步事件循环
if __name__ == '__main__':
    loop = asyncio.get_event_loop()
    loop.run_until_complete(main())
    loop.close()