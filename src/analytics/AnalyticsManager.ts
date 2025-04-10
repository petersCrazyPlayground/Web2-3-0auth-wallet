import { ethers } from 'ethers';

export interface TransactionMetrics {
    gasUsed: bigint;
    gasPrice: string;
    timestamp: number;
    status: 'success' | 'failed' | 'pending';
    confirmationTime?: number;
    error?: string;
}

export interface ChainMetrics {
    averageGasPrice: string;
    totalTransactions: number;
    successRate: number;
    averageConfirmationTime: number;
    lastUpdated: number;
    failureReasons: Map<string, number>;
}

export interface NetworkStats {
    tps: number;
    pendingTransactions: number;
    blockTime: number;
    lastBlockNumber: number;
}

export class AnalyticsManager {
    private metrics: Map<string, Map<string, TransactionMetrics>>;  // chainId -> (txHash -> metrics)
    private chainMetrics: Map<string, ChainMetrics>;
    private networkStats: Map<string, NetworkStats>;
    private provider: ethers.Provider;
    private updateInterval: number;
    private lastUpdate: Map<string, number>;

    constructor(provider: ethers.Provider, updateInterval: number = 300000) { // 5 minutes default
        this.metrics = new Map();
        this.chainMetrics = new Map();
        this.networkStats = new Map();
        this.provider = provider;
        this.updateInterval = updateInterval;
        this.lastUpdate = new Map();
    }

    // Transaction tracking
    async recordTransaction(
        chainId: string,
        txHash: string,
        metrics: TransactionMetrics
    ): Promise<void> {
        if (!this.metrics.has(chainId)) {
            this.metrics.set(chainId, new Map());
        }
        
        const chainMetrics = this.metrics.get(chainId)!;
        chainMetrics.set(txHash, metrics);

        // Update chain metrics if needed
        await this.updateChainMetricsIfNeeded(chainId);
    }

    async getTransactionMetrics(chainId: string, txHash: string): Promise<TransactionMetrics | null> {
        const chainMetrics = this.metrics.get(chainId);
        if (!chainMetrics) {
            return null;
        }
        return chainMetrics.get(txHash) || null;
    }

    // Chain analytics
    private async updateChainMetricsIfNeeded(chainId: string): Promise<void> {
        const lastUpdate = this.lastUpdate.get(chainId) || 0;
        if (Date.now() - lastUpdate < this.updateInterval) {
            return;
        }
        await this.updateChainMetrics(chainId);
    }

    async updateChainMetrics(chainId: string): Promise<void> {
        const chainMetrics = this.metrics.get(chainId);
        if (!chainMetrics) {
            return;
        }

        const transactions = Array.from(chainMetrics.values());
        const successfulTx = transactions.filter(tx => tx.status === 'success');
        const totalGasPrice = transactions.reduce(
            (sum, tx) => sum + BigInt(tx.gasPrice),
            BigInt(0)
        );

        const metrics: ChainMetrics = {
            averageGasPrice: (totalGasPrice / BigInt(transactions.length)).toString(),
            totalTransactions: transactions.length,
            successRate: successfulTx.length / transactions.length,
            averageConfirmationTime: this.calculateAverageConfirmationTime(transactions),
            lastUpdated: Date.now(),
            failureReasons: this.aggregateFailureReasons(transactions)
        };

        this.chainMetrics.set(chainId, metrics);
        this.lastUpdate.set(chainId, Date.now());

        // Update network stats
        await this.updateNetworkStats(chainId);
    }

    async getChainMetrics(chainId: string): Promise<ChainMetrics | null> {
        await this.updateChainMetricsIfNeeded(chainId);
        return this.chainMetrics.get(chainId) || null;
    }

    // Network statistics
    private async updateNetworkStats(chainId: string): Promise<void> {
        try {
            const [
                blockNumber,
                block
            ] = await Promise.all([
                this.provider.getBlockNumber(),
                this.provider.getBlock('latest')
            ]);

            if (!block) {
                return;
            }

            const prevBlock = await this.provider.getBlock(blockNumber - 1);
            const blockTime = prevBlock ? block.timestamp - prevBlock.timestamp : 0;

            const stats: NetworkStats = {
                tps: block.transactions.length / blockTime,
                pendingTransactions: block.transactions.length, // Use current block's transaction count as an estimate
                blockTime,
                lastBlockNumber: blockNumber
            };

            this.networkStats.set(chainId, stats);
        } catch (error) {
            console.error(`Failed to update network stats for chain ${chainId}:`, error);
        }
    }

    async getNetworkStats(chainId: string): Promise<NetworkStats | null> {
        return this.networkStats.get(chainId) || null;
    }

    // Performance monitoring
    async getAverageGasPrice(chainId: string): Promise<string> {
        const metrics = await this.getChainMetrics(chainId);
        return metrics?.averageGasPrice || '0';
    }

    async getSuccessRate(chainId: string): Promise<number> {
        const metrics = await this.getChainMetrics(chainId);
        return metrics?.successRate || 0;
    }

    // Helper methods
    private calculateAverageConfirmationTime(transactions: TransactionMetrics[]): number {
        const confirmedTx = transactions.filter(tx => tx.confirmationTime !== undefined);
        if (confirmedTx.length === 0) {
            return 0;
        }

        const totalTime = confirmedTx.reduce(
            (sum, tx) => sum + (tx.confirmationTime || 0),
            0
        );
        return totalTime / confirmedTx.length;
    }

    private aggregateFailureReasons(transactions: TransactionMetrics[]): Map<string, number> {
        const reasons = new Map<string, number>();
        
        transactions
            .filter(tx => tx.status === 'failed' && tx.error)
            .forEach(tx => {
                const count = reasons.get(tx.error!) || 0;
                reasons.set(tx.error!, count + 1);
            });

        return reasons;
    }

    // Cleanup old data
    async cleanupOldData(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<void> { // 1 week default
        const now = Date.now();
        
        for (const [chainId, chainMetrics] of this.metrics) {
            for (const [txHash, metrics] of chainMetrics) {
                if (now - metrics.timestamp > maxAge) {
                    chainMetrics.delete(txHash);
                }
            }
            
            if (chainMetrics.size === 0) {
                this.metrics.delete(chainId);
                this.chainMetrics.delete(chainId);
                this.networkStats.delete(chainId);
                this.lastUpdate.delete(chainId);
            }
        }
    }
} 