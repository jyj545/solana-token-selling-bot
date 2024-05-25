import requests
import json
import asyncio
import aiohttp
import time
# 定义输出文件路径
output_file_path = '../gmgn-list.txt'
# 定义代理的IP地址和端口
proxy_ip = '127.0.0.1'
proxy_port = 10809
proxy_url = f'http://{proxy_ip}:{proxy_port}'

# 异步函数，用于异步获取数据
async def fetch_data_from_url(url, proxy):
    async with aiohttp.ClientSession() as session:
        try:
            async with session.get(url, proxy=proxy) as response:
                response.raise_for_status()  # 如果HTTP请求返回了失败的状态码，将抛出异常
                data = await response.json()
                return data
        except aiohttp.ClientError as e:
            print(f"请求失败: {e}")
            return None

# 异步函数，用于将新发现的Solana地址写入文件
async def write_new_address(new_address):
    try:
        with open(output_file_path, 'r', encoding='utf-8') as file:
            known_addresses = set(line.strip().split('/')[0] for line in file.readlines())
    except FileNotFoundError:
        known_addresses = set()

    if new_address.strip().split('/')[0] not in known_addresses:
        known_addresses.add(new_address)
        with open(output_file_path, 'a', encoding='utf-8') as file:
            file.write(new_address + '\n')


# 异步主函数
async def main():
    try:
        url = 'https://gmgn.ai/defi/quotation/v1/pairs/sol/new_pairs?limit=10&orderby=open_timestamp&direction=desc&filters[]=not_honeypot'
        data = await fetch_data_from_url(url, proxy_url)
        if data:
            for token in data['data']['pairs']:
                print(time.strftime('%Y-%m-%d %H:%M:%S', time.localtime()))
                print('name:%f',token['base_token_info']['name'])
                print('liquidity:%f',token['liquidity'])
                print('top_10_holder_rate:%f',token['base_token_info']['top_10_holder_rate'])
                print('burn_status:%f',token['base_token_info']['burn_status'])
                print('is_honeypot:%f',token['base_token_info']['is_honeypot'])
                print('renounced_mint:%f',token['base_token_info']['renounced_mint'])
                print('launchpad:%f',token['launchpad'])
                if token['base_token_info']['top_10_holder_rate'] is None:
                    # 如果top_10_holder_rate为None，可以选择跳过这个token或者赋予一个默认值
                    continue  # 跳过这个token
                if float(token['liquidity'])>1000 and float(token['base_token_info']['top_10_holder_rate'])<0.3 and token['base_token_info']['burn_status']=='burn' and token['base_token_info']['is_honeypot'] is None and token['base_token_info']['renounced_mint']==1:
                # if float(token['liquidity'])>1 and float(token['base_token_info']['top_10_holder_rate'])<0.9 and token['base_token_info']['burn_status']=='burn' and token['base_token_info']['is_honeypot'] is None and token['base_token_info']['renounced_mint']==1:
                        
                    url1='https://gmgn.ai/defi/quotation/v1/tokens/stats/sol/'+token['base_token_info']['address']
                    data1 = await fetch_data_from_url(url1, proxy_url)
                    if float(data1['data']['top_rat_trader_amount_percentage'])>0.2:
                        # 如果top_10_holder_rate为None，可以选择跳过这个token或者赋予一个默认值
                        continue  # 跳过这个token
                    url2='https://gmgn.ai/defi/quotation/v1/tokens/sol/'+token['base_token_info']['address']
                    data2 = await fetch_data_from_url(url2, proxy_url)
                    if data2['data']['token']['rug_ratio'] is not None:
                        # 如果top_10_holder_rate为None，可以选择跳过这个token或者赋予一个默认值
                        continue  # 跳过这个token
                    await write_new_address(token['base_token_info']['address']+'/'+time.strftime('%Y-%m-%d %H:%M:%S', time.localtime()))
    except Exception as e:
        print(e)
    

# 启动异步事件循环
if __name__ == '__main__':
    while True:
        asyncio.run(main())
        time.sleep(5)