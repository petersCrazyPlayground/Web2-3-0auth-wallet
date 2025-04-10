import { ethers } from 'ethers';
import { AssetManager } from '../asset/AssetManager';

export interface SkaleConfig {
    chainId: number;
    endpoint: string;
    gasPrice: bigint;
    maxBatchSize: number;
}

export interface OptimizedTransfer {
    from: string;
    to: string;
    amount: string;
    tokenAddress: string;
    estimatedGas: bigint;
    priority: number;
}

export class SkaleOptimizer {
    private assetManager: AssetManager;
    private config: SkaleConfig;
    private pendingTransfers: OptimizedTransfer[];
    private readonly MAX_BATCH_SIZE: number = 50;

    constructor(assetManager: AssetManager, config: SkaleConfig) {
        this.assetManager = assetManager;
        this.config = {
            ...config,
            maxBatchSize: config.maxBatchSize || this.MAX_BATCH_SIZE
        };
        this.pendingTransfers = [];
    }

    async optimizeTransfer(
        from: string,
        to: string,
        amount: string,
        tokenAddress: string
    ): Promise<OptimizedTransfer> {
        try {
            // Estimate gas for the transfer
            const gasEstimate = await this.assetManager.estimateGas(to, amount, tokenAddress);
            
            // Calculate priority based on amount and gas cost
            const priority = this.calculatePriority(amount, gasEstimate.totalCost);

            const optimizedTransfer: OptimizedTransfer = {
                from,
                to,
                amount,
                tokenAddress,
                estimatedGas: gasEstimate.gasLimit,
                priority
            };

            this.pendingTransfers.push(optimizedTransfer);
            return optimizedTransfer;
        } catch (error) {
            throw new Error(`Failed to optimize transfer: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private calculatePriority(amount: string, gasCost: bigint): number {
        // Higher amount and lower gas cost = higher priority
        const amountBigInt = BigInt(amount);
        const priority = Number(amountBigInt / (gasCost || BigInt(1)));
        return priority;
    }

    async batchOptimizeTransfers(transfers: OptimizedTransfer[]): Promise<OptimizedTransfer[]> {
        try {
            // Sort transfers by priority
            const sortedTransfers = [...transfers].sort((a, b) => b.priority - a.priority);

            // Group transfers by token address
            const transfersByToken = new Map<string, OptimizedTransfer[]>();
            sortedTransfers.forEach(transfer => {
                if (!transfersByToken.has(transfer.tokenAddress)) {
                    transfersByToken.set(transfer.tokenAddress, []);
                }
                transfersByToken.get(transfer.tokenAddress)!.push(transfer);
            });

            // Process transfers in batches
            const results: OptimizedTransfer[] = [];
            for (const [tokenAddress, tokenTransfers] of transfersByToken) {
                const batches = this.createBatches(tokenTransfers);
                for (const batch of batches) {
                    const batchResults = await this.processBatch(batch);
                    results.push(...batchResults);
                }
            }

            return results;
        } catch (error) {
            throw new Error(`Failed to batch optimize transfers: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private createBatches(transfers: OptimizedTransfer[]): OptimizedTransfer[][] {
        const batches: OptimizedTransfer[][] = [];
        for (let i = 0; i < transfers.length; i += this.config.maxBatchSize) {
            batches.push(transfers.slice(i, i + this.config.maxBatchSize));
        }
        return batches;
    }

    private async processBatch(batch: OptimizedTransfer[]): Promise<OptimizedTransfer[]> {
        try {
            // Convert to AssetManager batch format
            const assetManagerBatch = batch.map(transfer => ({
                to: transfer.to,
                amount: transfer.amount,
                tokenAddress: transfer.tokenAddress
            }));

            // Execute batch transfer
            await this.assetManager.batchTransfer(assetManagerBatch);
            return batch;
        } catch (error) {
            throw new Error(`Failed to process batch: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async getPendingTransfers(): Promise<OptimizedTransfer[]> {
        return [...this.pendingTransfers];
    }

    async clearPendingTransfers(): Promise<void> {
        this.pendingTransfers = [];
    }

    async getTransferStats(): Promise<{
        totalTransfers: number;
        totalAmount: string;
        averageGas: bigint;
    }> {
        if (this.pendingTransfers.length === 0) {
            return {
                totalTransfers: 0,
                totalAmount: '0',
                averageGas: BigInt(0)
            };
        }

        const totalAmount = this.pendingTransfers.reduce(
            (sum, transfer) => sum + BigInt(transfer.amount),
            BigInt(0)
        );

        const totalGas = this.pendingTransfers.reduce(
            (sum, transfer) => sum + transfer.estimatedGas,
            BigInt(0)
        );

        return {
            totalTransfers: this.pendingTransfers.length,
            totalAmount: totalAmount.toString(),
            averageGas: totalGas / BigInt(this.pendingTransfers.length)
        };
    }
} 