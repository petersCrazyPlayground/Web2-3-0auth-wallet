import { ethers } from 'ethers';

export interface TokenInfo {
    name: string;
    symbol: string;
    decimals: number;
    totalSupply: string;
    verified: boolean;
}

export interface TransferEvent {
    from: string;
    to: string;
    value: string;
    tokenAddress: string;
    timestamp: number;
    transactionHash: string;
}

export interface GasEstimate {
    gasLimit: bigint;
    gasPrice: bigint;
    totalCost: bigint;
}

export interface BatchTransfer {
    to: string;
    amount: string;
    tokenAddress: string;
}

export class AssetManager {
    private provider: ethers.Provider;
    private signer: ethers.Signer;
    private address: string;
    private tokenCache: Map<string, TokenInfo>;
    private transferHistory: TransferEvent[];
    private tokenList: Set<string>;
    private readonly NATIVE_TOKEN = '0x0000000000000000000000000000000000000000';
    private readonly SKALE_CHAIN_ID: number;

    constructor(provider: ethers.Provider, signer: ethers.Signer, chainId: number) {
        this.provider = provider;
        this.signer = signer;
        this.address = '';
        this.tokenCache = new Map();
        this.transferHistory = [];
        this.tokenList = new Set();
        this.SKALE_CHAIN_ID = chainId;
    }

    async init(): Promise<void> {
        try {
            this.address = await this.signer.getAddress();
            await this.setupEventListeners();
        } catch (error) {
            throw new Error(`Failed to initialize AssetManager: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async setupEventListeners(): Promise<void> {
        const transferInterface = new ethers.Interface([
            'event Transfer(address indexed from, address indexed to, uint256 value)'
        ]);

        this.provider.on('block', async (blockNumber) => {
            const block = await this.provider.getBlock(blockNumber, true);
            if (!block) return;

            for (const tx of block.transactions) {
                if (typeof tx === 'string') continue;
                
                const txResponse = await this.provider.getTransaction(tx);
                if (!txResponse) continue;
                
                const receipt = await this.provider.getTransactionReceipt(txResponse.hash);
                if (!receipt) continue;

                for (const log of receipt.logs) {
                    try {
                        const parsedLog = transferInterface.parseLog(log);
                        if (parsedLog && parsedLog.name === 'Transfer') {
                            const event: TransferEvent = {
                                from: parsedLog.args[0],
                                to: parsedLog.args[1],
                                value: parsedLog.args[2].toString(),
                                tokenAddress: log.address,
                                timestamp: block.timestamp,
                                transactionHash: txResponse.hash
                            };
                            this.transferHistory.push(event);
                        }
                    } catch (e) {
                        // Skip logs that can't be parsed
                        continue;
                    }
                }
            }
        });
    }

    async getNativeBalance(): Promise<string> {
        try {
            const balance = await this.provider.getBalance(this.address);
            return balance.toString();
        } catch (error) {
            throw new Error(`Failed to get native balance: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async transferNative(to: string, amount: string): Promise<ethers.TransactionResponse> {
        try {
            const tx = await this.signer.sendTransaction({
                to,
                value: amount
            });
            return tx;
        } catch (error) {
            throw new Error(`Failed to transfer native token: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async batchTransfer(transfers: BatchTransfer[]): Promise<ethers.TransactionResponse[]> {
        try {
            const results: ethers.TransactionResponse[] = [];
            
            // Group transfers by token address for optimization
            const transfersByToken = new Map<string, BatchTransfer[]>();
            transfers.forEach(transfer => {
                if (!transfersByToken.has(transfer.tokenAddress)) {
                    transfersByToken.set(transfer.tokenAddress, []);
                }
                transfersByToken.get(transfer.tokenAddress)!.push(transfer);
            });

            // Process each token's transfers
            for (const [tokenAddress, tokenTransfers] of transfersByToken) {
                if (tokenAddress === this.NATIVE_TOKEN) {
                    // Handle native token transfers
                    for (const transfer of tokenTransfers) {
                        const tx = await this.transferNative(transfer.to, transfer.amount);
                        results.push(tx);
                    }
                } else {
                    // Handle ERC20 token transfers
                    const tokenContract = new ethers.Contract(
                        tokenAddress,
                        ['function transfer(address,uint256) returns (bool)'],
                        this.signer
                    );

                    for (const transfer of tokenTransfers) {
                        const tx = await tokenContract.transfer(transfer.to, transfer.amount);
                        results.push(tx);
                    }
                }
            }

            return results;
        } catch (error) {
            throw new Error(`Failed to execute batch transfer: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async getBalances(tokenAddresses: string[]): Promise<Map<string, string>> {
        try {
            const balances = new Map<string, string>();
            const promises = tokenAddresses.map(async (address) => {
                const balance = address === this.NATIVE_TOKEN 
                    ? await this.getNativeBalance()
                    : await this.getBalance(address);
                balances.set(address, balance);
            });
            await Promise.all(promises);
            return balances;
        } catch (error) {
            throw new Error(`Failed to get balances: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async estimateGas(
        to: string,
        amount: string,
        tokenAddress: string
    ): Promise<GasEstimate> {
        try {
            let gasLimit: bigint;
            if (tokenAddress === this.NATIVE_TOKEN) {
                const tx = {
                    to,
                    value: amount
                };
                gasLimit = await this.provider.estimateGas(tx);
            } else {
                const tokenContract = new ethers.Contract(
                    tokenAddress,
                    ['function transfer(address,uint256) returns (bool)'],
                    this.signer
                );
                gasLimit = await tokenContract.transfer.estimateGas(to, amount);
            }

            const gasPrice = await this.provider.getFeeData();
            
            return {
                gasLimit,
                gasPrice: gasPrice.gasPrice || BigInt(0),
                totalCost: gasLimit * (gasPrice.gasPrice || BigInt(0))
            };
        } catch (error) {
            throw new Error(`Failed to estimate gas: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async addToTokenList(tokenAddress: string): Promise<void> {
        try {
            await this.getTokenInfo(tokenAddress); // Verify token exists
            this.tokenList.add(tokenAddress);
        } catch (error) {
            throw new Error(`Failed to add token to list: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async removeFromTokenList(tokenAddress: string): Promise<void> {
        this.tokenList.delete(tokenAddress);
    }

    getTokenList(): string[] {
        return Array.from(this.tokenList);
    }

    getTransferHistory(
        fromBlock?: number,
        toBlock?: number
    ): TransferEvent[] {
        return this.transferHistory.filter(event => {
            if (fromBlock && event.timestamp < fromBlock) return false;
            if (toBlock && event.timestamp > toBlock) return false;
            return true;
        });
    }

    async getBalance(tokenAddress: string): Promise<string> {
        try {
            const tokenContract = new ethers.Contract(
                tokenAddress,
                ['function balanceOf(address) view returns (uint256)'],
                this.provider
            );
            const balance = await tokenContract.balanceOf(this.address);
            return balance.toString();
        } catch (error) {
            throw new Error(`Failed to get balance: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async getTokenInfo(tokenAddress: string): Promise<TokenInfo> {
        try {
            // Check cache first
            if (this.tokenCache.has(tokenAddress)) {
                return this.tokenCache.get(tokenAddress)!;
            }

            const tokenContract = new ethers.Contract(
                tokenAddress,
                [
                    'function name() view returns (string)',
                    'function symbol() view returns (string)',
                    'function decimals() view returns (uint8)',
                    'function totalSupply() view returns (uint256)'
                ],
                this.provider
            );

            const [name, symbol, decimals, totalSupply] = await Promise.all([
                tokenContract.name(),
                tokenContract.symbol(),
                tokenContract.decimals(),
                tokenContract.totalSupply()
            ]);

            const tokenInfo: TokenInfo = {
                name,
                symbol,
                decimals,
                totalSupply: totalSupply.toString(),
                verified: false
            };

            // Cache the result
            this.tokenCache.set(tokenAddress, tokenInfo);
            return tokenInfo;
        } catch (error) {
            throw new Error(`Failed to get token info: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async createTransfer(
        to: string,
        amount: string,
        tokenAddress: string
    ): Promise<ethers.Transaction> {
        try {
            const tokenContract = new ethers.Contract(
                tokenAddress,
                ['function transfer(address,uint256) returns (bool)'],
                this.signer
            );
            return await tokenContract.transfer(to, amount);
        } catch (error) {
            throw new Error(`Failed to create transfer: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async approve(
        spender: string,
        amount: string,
        tokenAddress: string
    ): Promise<ethers.Transaction> {
        try {
            const tokenContract = new ethers.Contract(
                tokenAddress,
                ['function approve(address,uint256) returns (bool)'],
                this.signer
            );
            return await tokenContract.approve(spender, amount);
        } catch (error) {
            throw new Error(`Failed to approve: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async getAllowance(
        owner: string,
        spender: string,
        tokenAddress: string
    ): Promise<string> {
        try {
            const tokenContract = new ethers.Contract(
                tokenAddress,
                ['function allowance(address,address) view returns (uint256)'],
                this.provider
            );
            const allowance = await tokenContract.allowance(owner, spender);
            return allowance.toString();
        } catch (error) {
            throw new Error(`Failed to get allowance: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async increaseAllowance(
        spender: string,
        addedValue: string,
        tokenAddress: string
    ): Promise<ethers.Transaction> {
        try {
            const tokenContract = new ethers.Contract(
                tokenAddress,
                ['function increaseAllowance(address,uint256) returns (bool)'],
                this.signer
            );
            return await tokenContract.increaseAllowance(spender, addedValue);
        } catch (error) {
            throw new Error(`Failed to increase allowance: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async decreaseAllowance(
        spender: string,
        subtractedValue: string,
        tokenAddress: string
    ): Promise<ethers.Transaction> {
        try {
            const tokenContract = new ethers.Contract(
                tokenAddress,
                ['function decreaseAllowance(address,uint256) returns (bool)'],
                this.signer
            );
            return await tokenContract.decreaseAllowance(spender, subtractedValue);
        } catch (error) {
            throw new Error(`Failed to decrease allowance: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    clearTokenCache(): void {
        this.tokenCache.clear();
    }

    clearTransferHistory(): void {
        this.transferHistory = [];
    }
} 