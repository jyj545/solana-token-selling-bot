import re

# 定义正则表达式模式，用于匹配 Solana 地址
address_pattern = r'\b[A-Za-z0-9]{44}\b'

# 读取文本文件并提取 Solana 地址的函数
def extract_solana_addresses(file_path):
    # 读取文件内容
    with open(file_path, 'r', encoding='utf-8') as file:
        content = file.read()

    # 使用正则表达式查找所有匹配的地址
    matches = re.findall(address_pattern, content)

    return matches

# 文件路径（根据实际情况修改为你的文件路径）
file_path = 'log.txt'

# 调用函数并打印结果
solana_addresses = extract_solana_addresses(file_path)
for address in solana_addresses:
    print(address)