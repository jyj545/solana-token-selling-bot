import os
import time
from typing import List, NoReturn, Optional
import httpx
from twikit import Client, Tweet
import re

# 正则表达式模式
address_pattern = r'\b[A-Za-z0-9]{44}\b'

# 认证信息，请根据实际情况进行替换
AUTH_INFO_1 = "jyj545"
AUTH_INFO_2 = 'jyj545@vip.qq.com'
PASSWORD = "Jyj4531545"

class TwitterUser:
    def __init__(self, screen_name: str, user_id: int = None):
        self.screen_name = screen_name
        self.user_id = user_id
        self.latest_tweet = None

    def fetch_user_info(self, client: Client) -> None:
        """获取并更新用户的ID和最新消息"""
        try:
            user_info = client.get_user_by_screen_name(self.screen_name)
            self.user_id = user_info.id
            self.latest_tweet = client.get_user_tweets(self.user_id, 'Replies')[0]
        except IndexError:
            return None
        except httpx.ConnectTimeout as e:
            print(f"请求超时：{e}")

class TwitterListener:
    def __init__(self, screen_names: List[str]):
        self.users = [TwitterUser(screen_name) for screen_name in screen_names]
        self.client = Client('en-US', timeout=60)
        self.check_interval = 60*1.5  # 每1分钟检查一次
        self.known_addresses = set()
        self.output_file_path = '../tweet_addresses.txt'

    def load_or_login(self):
        """加载cookies或登录并保存cookies"""
        if os.path.exists('cookies.json'):
            print("Loading cookies...")
            self.client.load_cookies('cookies.json')
        else:
            print("Logging in and saving cookies...")
            self.client.login(
                auth_info_1=AUTH_INFO_1,
                auth_info_2=AUTH_INFO_2,
                password=PASSWORD
            )
            self.client.save_cookies('cookies.json')

    def load_known_addresses(self):
        try:
            with open('known_addresses.txt', 'r', encoding='utf-8') as file:
                self.known_addresses = set([line.strip() for line in file.readlines()])
        except FileNotFoundError:
            print("未找到已知地址文件，创建一个空的地址集合。")

    def write_new_address(self, new_address):
        self.known_addresses.add(new_address)
        with open(self.output_file_path, 'a', encoding='utf-8') as file:
            file.write(new_address + '\n')

    def callback(self, tweet: Tweet) -> None:
        print(f'New tweet posted: {tweet.text}')
        matches = re.findall(address_pattern, tweet.text)
        for match in matches:
            print(f"Found Solana address: {match}")
            if match not in self.known_addresses:
                self.write_new_address(match)

    def listen(self):
        self.load_or_login()
        for user in self.users:
            user.fetch_user_info(self.client)

        self.load_known_addresses()

        while True:
            time.sleep(self.check_interval)
            for user in self.users:
                new_tweet = self.get_latest_tweet(user.user_id)
                if new_tweet != user.latest_tweet:
                    self.callback(new_tweet)
                    user.latest_tweet = new_tweet

    def get_latest_tweet(self, user_id: int) -> Optional[Tweet]:
        try:
            tweets = self.client.get_user_tweets(user_id, 'Replies')
            return tweets[0] if tweets else None
        except IndexError:
            return None
        except httpx.ConnectTimeout as e:
            print(f"请求超时：{e}")

if __name__ == "__main__":
    screen_names = ['eth200000', 'Crypto_Shuiyi','PepeBoost888']
    listener = TwitterListener(screen_names)
    listener.listen()