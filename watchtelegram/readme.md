要使用 Telethon 监听非管理员群组的消息，可以遵循以下步骤：

安装 Telethon：如果你还没有安装 Telethon，可以通过 pip 安装它：

pip install telethon
获取 API 凭证：为了使用 Telethon，你需要从 my.telegram.org 获取你的 api_id 和 api_hash。

创建 TelegramClient 实例：使用你的 api_id 和 api_hash 创建一个 TelegramClient 实例。

编写事件监听器：创建一个异步函数作为事件监听器，该函数将在收到新消息时被调用。

添加事件处理器：使用 client.add_event_handler 方法将你的监听器函数与 events.NewMessage 事件关联。

启动客户端：使用 client.run_until_disconnected() 方法启动事件监听循环