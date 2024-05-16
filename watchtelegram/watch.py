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

async def main():
    async with client:
        try:
            me = await client.get_me()
            print(me.stringify())

            # 获取所有群组的 ID
            await get_group_ids()

            # 添加事件处理器
            client.add_event_handler(my_event_handler, events.NewMessage(incoming=True))

            # 运行直到断开连接
            await client.run_until_disconnected()
        except TimeoutError:
            print("连接超时，请检查代理设置")

async def my_event_handler(event):
    # # 检查消息是否来自群组
    if event.is_channel:
        # 打印消息内容
        print(event.message.text)
        matches = re.findall(address_pattern, event.message.text)

        for match in matches:
            print(match)

# 异步函数，使用 "async for" 迭代异步迭代器
async def get_group_ids():
    async for chat in client.iter_dialogs():
        if chat.is_channel:
            print(f"广播群组名称: {chat.name}, 广播群组ID: {chat.id}")
# 启动异步事件循环
asyncio.run(main())