import 'dotenv/config';

import { coloredInfo, coloredError, coloredWarn, coloredDebug } from "./utils/logger";
import SolanaConnector from './connectors/solanaConnector';
import JupiterConnector from './connectors/jupiterConnector';
import sleep from './utils/sleepTimout';
import DatabaseConnector from './connectors/sqlite3Connector';
import calculateProfit from './utils/calculateProfit';
import { extractSymbols } from './utils/extractTokenSymbols';
import { Wallet } from '@project-serum/anchor';
import { SnipeListCache } from './cache';
import { PublicKey } from '@solana/web3.js';
const AMOUNT_OF_TOKENS_TO_SWAP = (Number(process.env.AMOUNT_OF_TOKENS_TO_SWAP) / 100) || 1;
const EXPECTED_PERCENTAGE_PROFIT = (Number(process.env.EXPECTED_PERCENTAGE_PROFIT) / 100) || 0.5;
interface TokenInfo {
    tokenAddress: string; // Assuming mintAddress is of type string
    tokenBalance: number; // Assuming tokenBalance is of type number
    decimals: number | null;
    tokenSymbol: string;
}
interface tokenStatus {
    rug_ratio: number | null;
    renounced_mint: number | null;
    burn_status: string;
    liquidity: number | null;
}
interface ResponseInterface {
    tokensAddresses: TokenInfo[];
    tokenIds: string;
    tokenSymbols: string;
}

const checkAndProcessSymbol = async (symbol: string, sellingPrice: any, tokenData: any[], response: ResponseInterface, db: DatabaseConnector, jupiter: JupiterConnector, solana: SolanaConnector, wallet: Wallet | undefined) => {
    // Check if the symbol exists in sellingPrice!.data
    if (symbol in sellingPrice!.data) {
        // Save the data for that symbol
        tokenData.push(sellingPrice!.data[symbol]);
        coloredDebug(`Current Market Price for ${symbol} is ${sellingPrice!.data[symbol].price} ${sellingPrice!.data[symbol].vsTokenSymbol}`);
        coloredDebug("Fetching Pending Order Limits");
        await jupiter.getOpenOrder(wallet!).then(async (openOrderTokenAddresses) => {
            coloredDebug(`openOrderTokenAddresses:${JSON.stringify(openOrderTokenAddresses)}`);
            await processOpenOrders(symbol, openOrderTokenAddresses, response, sellingPrice, db, jupiter, solana, wallet);
        });
    }
}

const processOpenOrders = async (symbol: string, openOrderTokenAddresses: string[] | undefined, response: ResponseInterface, sellingPrice: any, db: DatabaseConnector, jupiter: JupiterConnector, solana: SolanaConnector, wallet: Wallet | undefined) => {
    const responseToken = response.tokensAddresses.find((token: { tokenSymbol: string; }) => token.tokenSymbol === symbol);
    if (responseToken) {
        if (openOrderTokenAddresses !== undefined && openOrderTokenAddresses.length < 1 || openOrderTokenAddresses !== undefined && !openOrderTokenAddresses.includes(sellingPrice!.data[symbol].id)) {
            const outputToken = await solana.getTokenMetaData(sellingPrice!.data[symbol].id);
            await db.storeNewData(
                "tradedTokens",
                sellingPrice!.data[symbol].mintSymbol,
                responseToken.tokenBalance,
                sellingPrice!.data[symbol].price,
                sellingPrice!.data[symbol].price + (sellingPrice!.data[symbol].price * EXPECTED_PERCENTAGE_PROFIT)
            ).then(async () => {
                coloredInfo("Data saved into the database. Use an sqlite viewer to view the data table.\n\n\n");
                await sleep(2500);
                await calculateProfit(sellingPrice!.data[symbol].price, responseToken.tokenBalance).then(async (profit) => {
                    // Create order logic with proper price adjustments based on outputToken.decimals

                    if (outputToken !== null) await jupiter.createOrderLimit(responseToken.tokenBalance * (10 ** responseToken.decimals!), (responseToken.tokenBalance * profit.expectedTradingMarketPrice) * (10 ** outputToken.decimals!), wallet!, sellingPrice!.data[symbol].id, sellingPrice!.data[symbol].vsToken);
                    await sleep(2500);
                });
            });
        }
    }
}
const checkTokenInfo = async (tokenAddress: PublicKey): Promise<any> => {
    const address = tokenAddress.toString();
    const url = `https://gmgn.ai/defi/quotation/v1/tokens/sol/${address}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            coloredDebug(`Error fetching rug ratio: ${response.status}`);
            return {}
        }
        const data = await response.json();
        coloredDebug(`gmgn.ai: ${JSON.stringify(data.data)}`);
        return data.data.token;
    } catch (e: any) {
        coloredDebug(`Failed to fetch rug ratio: ${e.message}`);
        return {}
    }
}
const buySnipe = async () => {
    const solana = new SolanaConnector();
    const wallet = await solana.getWallet()
    const connection = await solana.getSolanaConnection();
    const jupiter = new JupiterConnector(wallet!, connection!);

    const snipeListCache = new SnipeListCache();
    snipeListCache.init();
    snipeListCache.on('newAddressesDetected', async (updatedList: Set<string>) => {
        console.log('Snipe list updated:', updatedList);
        // 获取当前余额
        await solana.getBalance().then(async (balance: number | undefined) => {
            let totalUSDTForPurchase = 0
            if (balance) {
                totalUSDTForPurchase = balance * 0.5;
            }
            coloredDebug(`Your Balance: ${balance} SOL`)
            coloredWarn("-----------------------------------------------------------\n\n")
            // 为每个新代币创建订单的异步函数
            const createOrdersForTokens = async (tokens: string[]) => {
                for (const mintAddress of tokens) {
                    try {
                        const isTokenAddress = await solana.isTokenAddress(mintAddress);
                        if (isTokenAddress) {
                            // const token = await checkTokenInfo(new PublicKey(mintAddress));
                            // if (!token?.rug_ratio&&token?.renounced_mint === 1&& token?.top_10_holder_rate <0.3 && token?.burn_status != "none" && token?.pool_info?.liquidity >= 20000) {
                            //     coloredInfo(`rug_ratio ${token?.rug_ratio}`);
                            // await jupiter.createOrderLimit(
                            //     totalUSDTForPurchase / tokens.length, // 分配给每个代币的SOL数量
                            //     0,
                            //     wallet!,
                            //     'So11111111111111111111111111111111111111112',
                            //     mintAddress
                            // );
                            await jupiter.getTokenSellingPrices(mintAddress).then(async (buyingingPrice) => {
                                const amountToSellToken = 5*1000000 
                                const tokenData = buyingingPrice?.data[mintAddress];
                                const price = parseFloat(JSON.stringify(tokenData?.price)); // 将字符串转换为
                                // 您期望通过卖出SOL获得的目标代币的数量
                                // 这个值需要根据当前市场价格和您愿意接受的价格来确定
                                const amountToExpectToken = amountToSellToken/price;
                                // 卖出代币地址（SOL的Mint地址）
                                const sellTokenAddress = new PublicKey('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB');

                                // 购买代币的Mint地址（您想要购买的代币的地址）
                                const buyTokenAddress = new PublicKey(mintAddress);
                                coloredInfo(`amountToSellToken-----:${amountToSellToken}`)
                                coloredInfo(`amountToExpectToken-----:${amountToExpectToken}`)
                                coloredInfo(`sellTokenAddress-----:${sellTokenAddress.toString()}`)
                                coloredInfo(`buyTokenAddress-----:${buyTokenAddress.toString()}`)
                                // 创建限价单
                                await jupiter.createOrderLimit(
                                    amountToSellToken, // 卖出的USDT数量
                                    amountToExpectToken, // 期望获得的目标代币数量
                                    wallet!, // 钱包对象
                                    sellTokenAddress.toString(), // 卖出代币地址（USDT）
                                    buyTokenAddress.toString() // 购买代币地址
                                );
                                coloredInfo(`Order created for ${totalUSDTForPurchase / tokens.length} SOL worth of ${mintAddress}`);

                            });
                            // }
                        }
                    } catch (error: any) {
                        coloredError(`Failed to create order for ${mintAddress}: ${error.message}`);
                    }
                    // 避免过快地执行操作，可以在这里添加适当的延迟
                }
            };
            coloredInfo(`Order created for ${updatedList} `);

            // 执行订单创建逻辑
            await createOrdersForTokens(Array.from(updatedList));
        });
    });
}
const main = async () => {
    try {
        coloredInfo("PROFITER BOT INITIALIZING");
        coloredDebug("Please ensure you have set the environment variables for this instance!!!")

        const solana = new SolanaConnector();
        const wallet = await solana.getWallet()
        const connection = await solana.getSolanaConnection();
        const jupiter = new JupiterConnector(wallet!, connection!);
        const db = new DatabaseConnector();
        await solana.getUserTokens().then(async (response) => {
            if (response !== undefined) {
                coloredWarn("------------------------------------------------------\n\n")
                coloredDebug(`Fetching current market price for tokens`,)
                const tkSymbols: string[] = await extractSymbols(response)

                await jupiter.getTokenSellingPrices(response.tokenSymbols).then(async (sellingPrice) => {
                    // Initialize an object to store token data
                    const tokenData: any[] = [];

                    // Iterate over each token symbol
                    for (const symbol of tkSymbols) {
                        await checkAndProcessSymbol(symbol, sellingPrice, tokenData, response, db, jupiter, solana, wallet)
                    }
                });
                coloredInfo("Rerunning in 5 Seconds time.\n\n\n")
                await sleep(2500);
            } else {
                coloredWarn("There was an error getting the user tokens.\n\n\n")
                coloredWarn("-----------------------------------------------------------\n\n\n")
                await sleep(9000).then(async () => {
                    await main();
                })
            }
        })
        // await solana.getTokenMetaData();
    } catch (error: any) {
        coloredError(`${error.message} \n\n\n`)
        await sleep(9000).then(async () => {
            await main();
        })
    } finally {
        await sleep(9000).then(async () => {
            await main()
        })
    }
}

export default { main, buySnipe };

























// const promise = tkSymbols.map(async (symbol) => {
//     // Check if the symbol exists in the responseData.data object
//     if (symbol in sellingPrice!.data) {
//         // If it exists, save the data for that symbol
//         tokenData.push(sellingPrice!.data[symbol]);
//         coloredDebug(`Current Market Price for ${symbol} is ${sellingPrice!.data[symbol].price} ${sellingPrice!.data[symbol].vsTokenSymbol}`)
//     }
//     coloredDebug("Fetching Pending Order Limits");
//     const openOrderTokenAddresses = await jupiter.getOpenOrder(wallet!);
//     await sleep(2500);

//     // console.log("Order Limits", openOrderTokenAddresses)

//     const subPromise = response.tokensAddresses.map(async (token) => {
//         if (symbol === token.tokenSymbol) {
//             if (openOrderTokenAddresses !== undefined && openOrderTokenAddresses.length < 1 || openOrderTokenAddresses !== undefined && !openOrderTokenAddresses.includes(sellingPrice!.data[symbol].id)) {
//                 const outputToken = await solana.getTokenMetaData(sellingPrice!.data[symbol].id);
//                 await db.storeNewData(
//                     "tradedTokens",
//                     sellingPrice!.data[symbol].mintSymbol,
//                     token.tokenBalance,
//                     sellingPrice!.data[symbol].price,
//                     sellingPrice!.data[symbol].price + (sellingPrice!.data[symbol].price * EXPECTED_PERCENTAGE_PROFIT)
//                 ).then(async () => {
//                     coloredInfo("Data saved into the database. Use an sqlite viewer to view the data table.")
//                     await calculateProfit(sellingPrice!.data[symbol].price, token.tokenBalance).then(async (ProfitInterface) => {
//                         await sleep(2500);
//                         // await jupiter.createOrderLimit(token.tokenBalance * Math.pow(10,token.decimals!), ProfitInterface.finalValue * Math.pow(10,outputToken.decimals!), wallet!, sellingPrice!.data[symbol].id, sellingPrice!.data[symbol].vsToken)
//                         await jupiter.createOrderLimit(sellingPrice!.data[symbol].price * Math.pow(10, outputToken.decimals!), ProfitInterface.expectedTradingMarketPrice * Math.pow(10, outputToken.decimals!), wallet!, sellingPrice!.data[symbol].id, sellingPrice!.data[symbol].vsToken)
//                         await sleep(2500);
//                     });
//                     // await jupiter.createOrderLimit(1000000, 1000000, wallet!, "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB")
//                 })
//             }
//         }
//     })

//     await Promise.all(subPromise);

// })
// await Promise.all(promise)
