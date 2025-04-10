import { ethers } from 'ethers';

export interface TransactionRecord {
    hash: string;
    from: string;
    to: string;
    value: string;
    gasUsed: string;
    gasPrice: string;
    timestamp: number;
    status: 'success' | 'failed' | 'pending';
    chainId: string;
    nonce: number;
    blockNumber?: number;
    blockHash?: string;
    input?: string;
    receipt?: TransactionReceipt;
    error?: string;
}

export interface TransactionReceipt {
    blockHash: string;
    blockNumber: number;
    contractAddress: string | null;
    cumulativeGasUsed: string;
    effectiveGasPrice: string;
    from: string;
    gasUsed: string;
    logs: Array<Log>;
    logsBloom: string;
    status: number;
    to: string;
    transactionHash: string;
    transactionIndex: number;
    type: number;
}

export interface Log {
    address: string;
    topics: string[];
    data: string;
    blockNumber: number;
    transactionHash: string;
    transactionIndex: number;
    blockHash: string;
    logIndex: number;
    removed: boolean;
}

export interface TransactionStats {
    totalTransactions: number;
    successfulTransactions: number;
    failedTransactions: number;
    pendingTransactions: number;
    totalVolume: string;
    averageGasUsed: string;
    averageGasPrice: string;
    lastUpdated: number;
}

export class TransactionHistoryManager {
    private storage: Map<string, Map<string, Map<string, TransactionRecord>>>; // chainId -> (address -> (txHash -> record))
    private provider: ethers.Provider;
    private stats: Map<string, Map<string, TransactionStats>>; // chainId -> (address -> stats)
    private lastStatsUpdate: Map<string, Map<string, number>>; // chainId -> (address -> timestamp)
    private updateInterval: number;

    constructor(provider: ethers.Provider, updateInterval: number = 300000) { // 5 minutes default
        this.storage = new Map();
        this.provider = provider;
        this.stats = new Map();
        this.lastStatsUpdate = new Map();
        this.updateInterval = updateInterval;
    }

    // Transaction recording
    async recordTransaction(chainId: string, tx: TransactionRecord): Promise<void> {
        if (!this.storage.has(chainId)) {
            this.storage.set(chainId, new Map());
        }
        
        const chainStorage = this.storage.get(chainId)!;
        if (!chainStorage.has(tx.from)) {
            chainStorage.set(tx.from, new Map());
        }

        const addressStorage = chainStorage.get(tx.from)!;
        addressStorage.set(tx.hash, tx);

        // Update stats if needed
        await this.updateStatsIfNeeded(chainId, tx.from);
    }

    async getTransactionHistory(
        chainId: string,
        address: string,
        options: {
            startBlock?: number;
            endBlock?: number;
            status?: 'success' | 'failed' | 'pending';
            limit?: number;
            offset?: number;
        } = {}
    ): Promise<TransactionRecord[]> {
        const chainStorage = this.storage.get(chainId);
        if (!chainStorage) {
            return [];
        }

        const addressStorage = chainStorage.get(address);
        if (!addressStorage) {
            return [];
        }

        let transactions = Array.from(addressStorage.values());

        // Apply filters
        if (options.startBlock !== undefined) {
            transactions = transactions.filter(tx => 
                tx.blockNumber !== undefined && tx.blockNumber >= options.startBlock!
            );
        }

        if (options.endBlock !== undefined) {
            transactions = transactions.filter(tx => 
                tx.blockNumber !== undefined && tx.blockNumber <= options.endBlock!
            );
        }

        if (options.status) {
            transactions = transactions.filter(tx => tx.status === options.status);
        }

        // Sort by timestamp (newest first)
        transactions.sort((a, b) => b.timestamp - a.timestamp);

        // Apply pagination
        if (options.offset !== undefined || options.limit !== undefined) {
            const start = options.offset || 0;
            const end = options.limit ? start + options.limit : undefined;
            transactions = transactions.slice(start, end);
        }

        return transactions;
    }

    // Receipt management
    async storeReceipt(chainId: string, txHash: string, receipt: TransactionReceipt): Promise<void> {
        const chainStorage = this.storage.get(chainId);
        if (!chainStorage) {
            return;
        }

        for (const addressStorage of chainStorage.values()) {
            const tx = addressStorage.get(txHash);
            if (tx) {
                tx.receipt = receipt;
                tx.status = receipt.status === 1 ? 'success' : 'failed';
                tx.blockNumber = receipt.blockNumber;
                tx.blockHash = receipt.blockHash;
                addressStorage.set(txHash, tx);
                break;
            }
        }
    }

    async getReceipt(chainId: string, txHash: string): Promise<TransactionReceipt | null> {
        const chainStorage = this.storage.get(chainId);
        if (!chainStorage) {
            return null;
        }

        for (const addressStorage of chainStorage.values()) {
            const tx = addressStorage.get(txHash);
            if (tx?.receipt) {
                return tx.receipt;
            }
        }

        return null;
    }

    // Analytics
    private async updateStatsIfNeeded(chainId: string, address: string): Promise<void> {
        const lastUpdate = this.lastStatsUpdate.get(chainId)?.get(address) || 0;
        if (Date.now() - lastUpdate < this.updateInterval) {
            return;
        }
        await this.updateStats(chainId, address);
    }

    private async updateStats(chainId: string, address: string): Promise<void> {
        const transactions = await this.getTransactionHistory(chainId, address);
        
        const stats: TransactionStats = {
            totalTransactions: transactions.length,
            successfulTransactions: transactions.filter(tx => tx.status === 'success').length,
            failedTransactions: transactions.filter(tx => tx.status === 'failed').length,
            pendingTransactions: transactions.filter(tx => tx.status === 'pending').length,
            totalVolume: this.calculateTotalVolume(transactions),
            averageGasUsed: this.calculateAverageGasUsed(transactions),
            averageGasPrice: this.calculateAverageGasPrice(transactions),
            lastUpdated: Date.now()
        };

        if (!this.stats.has(chainId)) {
            this.stats.set(chainId, new Map());
        }
        this.stats.get(chainId)!.set(address, stats);

        if (!this.lastStatsUpdate.has(chainId)) {
            this.lastStatsUpdate.set(chainId, new Map());
        }
        this.lastStatsUpdate.get(chainId)!.set(address, Date.now());
    }

    async getStats(chainId: string, address: string): Promise<TransactionStats | null> {
        await this.updateStatsIfNeeded(chainId, address);
        return this.stats.get(chainId)?.get(address) || null;
    }

    // Helper methods
    private calculateTotalVolume(transactions: TransactionRecord[]): string {
        return transactions
            .filter(tx => tx.status === 'success')
            .reduce((sum, tx) => sum + BigInt(tx.value), BigInt(0))
            .toString();
    }

    private calculateAverageGasUsed(transactions: TransactionRecord[]): string {
        const successfulTx = transactions.filter(tx => tx.status === 'success');
        if (successfulTx.length === 0) {
            return '0';
        }

        const totalGasUsed = successfulTx.reduce(
            (sum, tx) => sum + BigInt(tx.gasUsed),
            BigInt(0)
        );

        return (totalGasUsed / BigInt(successfulTx.length)).toString();
    }

    private calculateAverageGasPrice(transactions: TransactionRecord[]): string {
        const successfulTx = transactions.filter(tx => tx.status === 'success');
        if (successfulTx.length === 0) {
            return '0';
        }

        const totalGasPrice = successfulTx.reduce(
            (sum, tx) => sum + BigInt(tx.gasPrice),
            BigInt(0)
        );

        return (totalGasPrice / BigInt(successfulTx.length)).toString();
    }

    // Cleanup
    async cleanupOldTransactions(
        maxAge: number = 30 * 24 * 60 * 60 * 1000 // 30 days default
    ): Promise<void> {
        const now = Date.now();

        for (const [chainId, chainStorage] of this.storage) {
            for (const [address, addressStorage] of chainStorage) {
                for (const [hash, tx] of addressStorage) {
                    if (now - tx.timestamp > maxAge) {
                        addressStorage.delete(hash);
                    }
                }

                // Remove empty address storages
                if (addressStorage.size === 0) {
                    chainStorage.delete(address);
                }
            }

            // Remove empty chain storages
            if (chainStorage.size === 0) {
                this.storage.delete(chainId);
                this.stats.delete(chainId);
                this.lastStatsUpdate.delete(chainId);
            }
        }
    }
} 