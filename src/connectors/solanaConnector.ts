import 'dotenv/config';
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
// import { TOKEN_PROGRAM_ID } from '@project-serum/anchor/dist/cjs/utils/token';
import { coloredInfo, coloredError, coloredWarn, coloredDebug } from "../../src/utils/logger";
import { Wallet } from '@project-serum/anchor';
import base58 from 'bs58';
import { Client, UtlConfig, Token } from '@solflare-wallet/utl-sdk';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
const HTTP = process.env.RPC_ENDPOINT;
const WS = process.env.RPC_WS_ENDPOINT;

interface TokenInfo {
    tokenAddress: string; // Assuming mintAddress is of type string
    tokenBalance: number; // Assuming tokenBalance is of type number
    decimals: number | null;
    tokenSymbol: string;
}

interface TokenAccount {
    isNative: false,
    mint: string,
    owner: string,
    state: 'initialized',
    tokenAmount: {
        amount: string,
        decimals: number,
        uiAmount: number,
        uiAmountString: string
    }
};


/**
 * Represents a connector to the Solana blockchain.
 * This class provides methods to interact with the Solana blockchain,
 * such as retrieving wallet balance and fetching tokens present in a wallet.
 */
class SolanaConnector {
    publicKey: PublicKey | undefined; // The public key associated with the wallet.
    solanaConnection: Connection | undefined; // The connection to the Solana blockchain.
    filters: any[] | undefined; // Filters for querying accounts.
    wallet: Wallet | undefined;
    config: any;
    utl: any;

    /**
     * Creates a new instance of the SolanaConnector class.
     */
    constructor() {
        if (process.env.RPC_ENDPOINT === undefined) {
            coloredError("You must have an RPC endpoint. Please visit https://auth.quicknode.com/ to create an account if you do not have any and generate a new endpoint")
        } else if (process.env.WALLET_PUBLIC_KEY === undefined) {
            coloredError("You must provide your wallet PUBLIC ADDRESS/WALLET ADDRESS")
        } else {
            const publicKey = process.env.WALLET_PUBLIC_KEY;
            this.publicKey = new PublicKey(publicKey!);
            this.solanaConnection = new Connection(HTTP!, { wsEndpoint: WS });
            this.filters = [
                {
                    dataSize: 165, // Size of account (bytes).
                },
                {
                    memcmp: {
                        offset: 32, // Location of our query in the account (bytes).
                        bytes: this.publicKey.toString(), // Our search criteria, a base58 encoded string.
                    }
                }
            ];
        }

    }

    getSolanaConnection = async (): Promise<Connection | undefined> => {
        return this.solanaConnection
    }

    getTokenMetaData = async (tokenAddress: string = "So11111111111111111111111111111111111111112"): Promise<Token | null> => {
        this.config = new UtlConfig({
            /**
             * 101 - mainnet, 102 - testnet, 103 - devnet
             */
            chainId: 101,
            /**
             * number of milliseconds to wait until falling back to CDN
             */
            timeout: 2000,
            /**
             * Solana web3 Connection
             */
            connection: this.solanaConnection,
            /**
             * Backend API url which is used to query tokens
             */
            apiUrl: "https://token-list-api.solana.cloud",
            /**
             * CDN hosted static token list json which is used in case backend is down
             */
            cdnUrl: "https://cdn.jsdelivr.net/gh/solflare-wallet/token-list/solana-tokenlist.json"
        });

        this.utl = new Client(this.config);
        const utlTokenData: Token = await this.utl.fetchMint(new PublicKey(tokenAddress))

        if (utlTokenData !== null) {
            coloredInfo(`UTL Token Metadata: ${JSON.stringify(utlTokenData)}`, 'solana')
            return utlTokenData;
        } else {
            return null;
        }
    }

    getWallet = async (): Promise<Wallet | undefined> => {
        if (process.env.WALLET_PRIVATE_KEY === undefined) {
            coloredError("Please add your wallet's private key into the `.env` file under the variable WALLET_PRIVATE_KEY={your private key}")
            return undefined;
        }
        const privateKey = process.env.WALLET_PRIVATE_KEY;
        this.wallet = new Wallet(Keypair.fromSecretKey(base58.decode(privateKey!)));

        return this.wallet;
    }

    /**
     * Retrieves the current balance of the wallet.
     * @returns {Promise<number>} The current wallet balance.
     * @example
     * const connector = new SolanaConnector("yourPublicKey");
     * const balance = await connector.getBalance();
     * console.log(balance); // Output: <walletBalance>
     */
    getBalance = async (): Promise<number | undefined> => {
        coloredInfo("Retrieving current wallet balance", 'solana')
        if (this.publicKey) {
            const balance = await this.solanaConnection?.getBalance(this.publicKey)
            if (balance !== undefined) return balance / LAMPORTS_PER_SOL;
            return undefined;
        } else {
            return undefined;
        }
    }

    /**
     * Retrieves the tokens present in the wallet.
     * @returns {Promise<{ tokensAddresses: TokenInfo[], tokenIds: string }>} An object containing the list of tokens and their addresses.
     * @example
     * const connector = new SolanaConnector("yourPublicKey");
     * const { tokensAddresses, tokenIds } = await connector.getUserTokens();
     * console.log(tokensAddresses); // Output: [{ tokenAddress: 'address1', tokenBalance: 100 }, { tokenAddress: 'address2', tokenBalance: 200 }, ...]
     * console.log(tokenIds); // Output: "address1, address2, ..."
     */
    getUserTokens = async (): Promise<{ tokensAddresses: TokenInfo[]; tokenIds: string; tokenSymbols: string } | undefined> => {
        coloredInfo("Fetching tokens existing in your wallet", 'solana');

        try {
            if (this.publicKey) {
                const accounts = await this.solanaConnection?.getParsedTokenAccountsByOwner(this.publicKey, { programId: TOKEN_PROGRAM_ID });

                if (!accounts) {
                    coloredError("There is an error with your wallet credentials and other relative issues");
                    return undefined;
                }

                coloredWarn("Extracting token data like (contractAddress and tokenBalance)", 'solana');

                const tokensAddresses = await this.getWalletTokens(accounts, []);  // Pass an empty array

                if (tokensAddresses.length < 1) {
                    coloredDebug("You do not have any token in your wallet");
                    return undefined;
                }

                coloredInfo(`Token Addresses: ${JSON.stringify(tokensAddresses)}`);
                const tokenIds = tokensAddresses.map(token => token.tokenAddress).join(',');
                const tokenSymbols = tokensAddresses.map(token => token.tokenSymbol).join(",");
                coloredInfo(`Token ID/Addresses: ${tokenIds}`, "solana");

                return { tokensAddresses, tokenIds, tokenSymbols };
            }
        } catch (error) {
            console.error('Error retrieving user tokens:', error);
            return undefined;
        }
    }


    getWalletTokens = async (accounts: any, tokensAddresses: TokenInfo[]) => {
        coloredWarn(JSON.stringify(accounts));
        for (const response of accounts.value) {
            const parsedAccountInfo = response.account.data;
            // Extracting token details for a specific account
            const tokenId: string = response.pubkey.toString();
            const walletToken: TokenAccount = JSON.parse(JSON.stringify(parsedAccountInfo["parsed"]["info"]));

            const mintAddress = walletToken.mint;
            const tokenBalance = walletToken.tokenAmount.uiAmount;

            if (mintAddress !== null && mintAddress !== undefined) {
                const tokenMeta = await this.getTokenMetaData(mintAddress);
                if (tokenMeta !== null) {
                    coloredWarn("---------------------------------------------------------");
                    coloredWarn(`Found ${tokenMeta.name} in your wallet with BAL: ${tokenBalance} ${tokenMeta.name}`, "solana");
                    if (tokenBalance > 0.0000000) {
                        tokensAddresses.push({
                            tokenAddress: mintAddress,
                            tokenBalance: tokenBalance,
                            decimals: tokenMeta.decimals,
                            tokenSymbol: tokenMeta.symbol
                        });
                    }
                }
            }
        }

        // Return after the loop completes
        return tokensAddresses;
    }


    isTokenAddress = async (address: string) => {
        try {
            const publicKey = new PublicKey(address);
            const accountInfo = await this.solanaConnection?.getAccountInfo(publicKey);
            // 检查账户的程序ID是否为代币程序ID
            if (accountInfo?.owner.equals(TOKEN_PROGRAM_ID)) {
                return true;
            }
        } catch (error) {
            console.error('Failed to check if address is a token address:', error);
        }
        return false;
    }
}

export default SolanaConnector;