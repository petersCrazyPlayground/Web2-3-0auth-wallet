import { ethers } from 'ethers';
import { SkaleOptimizer } from './SkaleOptimizer';
import { AssetManager } from '../asset/AssetManager';

export interface ChainConfig {
    chainId: number;
    endpoint: string;
    isSkale: boolean;
    gasPrice: bigint;
    bridgeAddress?: string;
    supportedTokens?: string[];
    minTransferAmount?: string;
    maxTransferAmount?: string;
    bridgeProtocols?: BridgeProtocol[];
}

export interface BridgeProtocol {
    name: string;
    address: string;
    supportedTokens: string[];
    feeStructure: FeeStructure;
    securityLevel: SecurityLevel;
    estimatedTime: number;
}

export interface FeeStructure {
    baseFee: bigint;
    percentageFee: number;
    minFee: bigint;
    maxFee: bigint;
}

export enum SecurityLevel {
    LOW = 1,
    MEDIUM = 2,
    HIGH = 3
}

export interface CrossChainTransfer {
    fromChain: number;
    toChain: number;
    from: string;
    to: string;
    amount: string;
    tokenAddress: string;
    estimatedGas: bigint;
    bridgeFee: bigint;
    priority: number;
    route: string;
    estimatedTime: number;
    protocol: BridgeProtocol;
    securityScore: number;
}

export interface BridgeRoute {
    fromChain: number;
    toChain: number;
    bridgeAddress: string;
    supportedTokens: string[];
    fee: bigint;
    estimatedTime: number;
    protocols: BridgeProtocol[];
}

export class CrossChainOptimizer {
    private skaleOptimizer: SkaleOptimizer;
    private assetManager: AssetManager;
    private chainConfigs: Map<number, ChainConfig>;
    private pendingTransfers: CrossChainTransfer[];
    private bridgeRoutes: Map<string, BridgeRoute>;
    private readonly MAX_BATCH_SIZE: number = 50;
    private readonly SECURITY_WEIGHT: number = 0.3;
    private readonly FEE_WEIGHT: number = 0.4;
    private readonly TIME_WEIGHT: number = 0.3;

    constructor(
        skaleOptimizer: SkaleOptimizer,
        assetManager: AssetManager,
        chainConfigs: ChainConfig[]
    ) {
        this.skaleOptimizer = skaleOptimizer;
        this.assetManager = assetManager;
        this.chainConfigs = new Map(chainConfigs.map(config => [config.chainId, config]));
        this.pendingTransfers = [];
        this.bridgeRoutes = new Map();
        this.initializeBridgeRoutes();
    }

    private initializeBridgeRoutes(): void {
        for (const [fromChainId, fromConfig] of this.chainConfigs) {
            for (const [toChainId, toConfig] of this.chainConfigs) {
                if (fromChainId === toChainId) continue;

                const routeKey = `${fromChainId}-${toChainId}`;
                const protocols = this.getAvailableProtocols(fromChainId, toChainId);
                
                this.bridgeRoutes.set(routeKey, {
                    fromChain: fromChainId,
                    toChain: toChainId,
                    bridgeAddress: fromConfig.bridgeAddress || '',
                    supportedTokens: fromConfig.supportedTokens || [],
                    fee: BigInt(0),
                    estimatedTime: this.calculateEstimatedTime(fromChainId, toChainId),
                    protocols
                });
            }
        }
    }

    private getAvailableProtocols(fromChain: number, toChain: number): BridgeProtocol[] {
        const fromConfig = this.chainConfigs.get(fromChain);
        const toConfig = this.chainConfigs.get(toChain);

        if (!fromConfig || !toConfig) return [];

        // If both chains are SKALE, use SKALE bridge protocol
        if (fromConfig.isSkale && toConfig.isSkale) {
            return [{
                name: 'SKALE Bridge',
                address: fromConfig.bridgeAddress || '',
                supportedTokens: fromConfig.supportedTokens || [],
                feeStructure: {
                    baseFee: BigInt(0),
                    percentageFee: 0,
                    minFee: BigInt(0),
                    maxFee: BigInt(0)
                },
                securityLevel: SecurityLevel.HIGH,
                estimatedTime: 0
            }];
        }

        // Return available protocols from config
        return fromConfig.bridgeProtocols || [];
    }

    private calculateSecurityScore(protocol: BridgeProtocol): number {
        // Higher security level = higher score
        return protocol.securityLevel / SecurityLevel.HIGH;
    }

    private calculateRouteScore(
        fee: bigint,
        time: number,
        security: number
    ): number {
        const normalizedFee = Number(fee) / Number(BigInt(1e18)); // Normalize to ETH
        const normalizedTime = time / 600; // Normalize to 10 minutes
        
        return (
            this.FEE_WEIGHT * (1 - normalizedFee) +
            this.TIME_WEIGHT * (1 - normalizedTime) +
            this.SECURITY_WEIGHT * security
        );
    }

    async optimizeCrossChainTransfer(
        fromChain: number,
        toChain: number,
        from: string,
        to: string,
        amount: string,
        tokenAddress: string,
        securityPreference: SecurityLevel = SecurityLevel.MEDIUM
    ): Promise<CrossChainTransfer> {
        try {
            const [gasEstimate, bridgeFee, route, protocol] = await Promise.all([
                this.estimateGas(fromChain, toChain, amount, tokenAddress),
                this.estimateBridgeFee(fromChain, toChain, amount, tokenAddress),
                this.findOptimalRoute(fromChain, toChain, tokenAddress),
                this.selectOptimalProtocol(fromChain, toChain, tokenAddress, securityPreference)
            ]);

            const priority = this.calculatePriority(amount, gasEstimate, bridgeFee);
            const estimatedTime = this.calculateEstimatedTime(fromChain, toChain);
            const securityScore = this.calculateSecurityScore(protocol);

            const transfer: CrossChainTransfer = {
                fromChain,
                toChain,
                from,
                to,
                amount,
                tokenAddress,
                estimatedGas: gasEstimate,
                bridgeFee,
                priority,
                route: route.bridgeAddress,
                estimatedTime,
                protocol,
                securityScore
            };

            this.pendingTransfers.push(transfer);
            return transfer;
        } catch (error) {
            throw new Error(`Failed to optimize cross-chain transfer: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async selectOptimalProtocol(
        fromChain: number,
        toChain: number,
        tokenAddress: string,
        securityPreference: SecurityLevel
    ): Promise<BridgeProtocol> {
        const routeKey = `${fromChain}-${toChain}`;
        const route = this.bridgeRoutes.get(routeKey);

        if (!route) {
            throw new Error('No bridge route found between chains');
        }

        // Filter protocols by security level and token support
        const availableProtocols = route.protocols.filter(protocol => 
            protocol.securityLevel >= securityPreference &&
            protocol.supportedTokens.includes(tokenAddress)
        );

        if (availableProtocols.length === 0) {
            throw new Error('No suitable bridge protocol found');
        }

        // Calculate scores for each protocol
        const protocolScores = await Promise.all(
            availableProtocols.map(async protocol => {
                const fee = await this.estimateProtocolFee(protocol, tokenAddress);
                const securityScore = this.calculateSecurityScore(protocol);
                return {
                    protocol,
                    score: this.calculateRouteScore(fee, protocol.estimatedTime, securityScore)
                };
            })
        );

        // Select protocol with highest score
        return protocolScores.reduce((best, current) => 
            current.score > best.score ? current : best
        ).protocol;
    }

    private async estimateProtocolFee(
        protocol: BridgeProtocol,
        tokenAddress: string
    ): Promise<bigint> {
        const { baseFee, percentageFee, minFee, maxFee } = protocol.feeStructure;
        
        // Calculate percentage-based fee
        const percentageAmount = BigInt(Math.floor(Number(baseFee) * percentageFee));
        
        // Apply min/max bounds
        let fee = baseFee + percentageAmount;
        fee = fee < minFee ? minFee : fee;
        fee = fee > maxFee ? maxFee : fee;
        
        return fee;
    }

    private calculateEstimatedTime(fromChain: number, toChain: number): number {
        const fromConfig = this.chainConfigs.get(fromChain);
        const toConfig = this.chainConfigs.get(toChain);

        if (!fromConfig || !toConfig) return 0;

        // SKALE to SKALE transfers are instant
        if (fromConfig.isSkale && toConfig.isSkale) return 0;

        // SKALE to other chains: 2-5 minutes
        if (fromConfig.isSkale) return 180;

        // Other chains to SKALE: 5-10 minutes
        if (toConfig.isSkale) return 300;

        // Other chains: 10-30 minutes
        return 600;
    }

    private async findOptimalRoute(
        fromChain: number,
        toChain: number,
        tokenAddress: string
    ): Promise<BridgeRoute> {
        const routeKey = `${fromChain}-${toChain}`;
        const route = this.bridgeRoutes.get(routeKey);

        if (!route) {
            throw new Error('No bridge route found between chains');
        }

        if (!route.supportedTokens.includes(tokenAddress)) {
            throw new Error('Token not supported on this bridge route');
        }

        return route;
    }

    private async estimateGas(
        fromChain: number,
        toChain: number,
        amount: string,
        tokenAddress: string
    ): Promise<bigint> {
        try {
            const fromConfig = this.chainConfigs.get(fromChain);
            if (!fromConfig) throw new Error('Invalid source chain');

            if (fromConfig.isSkale) {
                return BigInt(0);
            }

            const gasEstimate = await this.assetManager.estimateGas(
                fromConfig.bridgeAddress || '',
                amount,
                tokenAddress
            );
            return gasEstimate.gasLimit;
        } catch (error) {
            throw new Error(`Failed to estimate gas: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async estimateBridgeFee(
        fromChain: number,
        toChain: number,
        amount: string,
        tokenAddress: string
    ): Promise<bigint> {
        try {
            const fromConfig = this.chainConfigs.get(fromChain);
            const toConfig = this.chainConfigs.get(toChain);

            if (!fromConfig || !toConfig) {
                throw new Error('Invalid chain configuration');
            }

            if (fromConfig.isSkale && toConfig.isSkale) {
                return BigInt(0);
            }

            const amountBigInt = BigInt(amount);
            const baseFee = amountBigInt / BigInt(1000); // 0.1% base fee

            // Add dynamic fee based on network congestion
            const congestionMultiplier = await this.getNetworkCongestion(fromChain);
            return baseFee * BigInt(Math.max(1, congestionMultiplier));
        } catch (error) {
            throw new Error(`Failed to estimate bridge fee: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async getNetworkCongestion(chainId: number): Promise<number> {
        const config = this.chainConfigs.get(chainId);
        if (!config) return 1;

        if (config.isSkale) {
            return 1; // SKALE chains are not congested
        }

        try {
            const provider = new ethers.JsonRpcProvider(config.endpoint);
            const feeData = await provider.getFeeData();
            const baseFee = feeData.gasPrice || BigInt(0);
            return Number(baseFee / config.gasPrice);
        } catch {
            return 1;
        }
    }

    private calculatePriority(
        amount: string,
        gasCost: bigint,
        bridgeFee: bigint
    ): number {
        const amountBigInt = BigInt(amount);
        const totalCost = gasCost + bridgeFee;
        return Number(amountBigInt / (totalCost || BigInt(1)));
    }

    async batchOptimizeCrossChainTransfers(
        transfers: CrossChainTransfer[]
    ): Promise<CrossChainTransfer[]> {
        try {
            const sortedTransfers = [...transfers].sort((a, b) => b.priority - a.priority);
            const transfersByRoute = new Map<string, CrossChainTransfer[]>();

            sortedTransfers.forEach(transfer => {
                const routeKey = `${transfer.fromChain}-${transfer.toChain}`;
                if (!transfersByRoute.has(routeKey)) {
                    transfersByRoute.set(routeKey, []);
                }
                transfersByRoute.get(routeKey)!.push(transfer);
            });

            const results: CrossChainTransfer[] = [];
            for (const [route, routeTransfers] of transfersByRoute) {
                const [fromChain, toChain] = route.split('-').map(Number);
                const batchResults = await this.processRouteBatch(
                    fromChain,
                    toChain,
                    routeTransfers
                );
                results.push(...batchResults);
            }

            return results;
        } catch (error) {
            throw new Error(`Failed to batch optimize cross-chain transfers: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async processRouteBatch(
        fromChain: number,
        toChain: number,
        transfers: CrossChainTransfer[]
    ): Promise<CrossChainTransfer[]> {
        try {
            const fromConfig = this.chainConfigs.get(fromChain);
            const toConfig = this.chainConfigs.get(toChain);

            if (!fromConfig || !toConfig) {
                throw new Error('Invalid chain configuration');
            }

            if (fromConfig.isSkale) {
                // Create optimized transfers for SKALE
                const optimizedTransfers = transfers.map(transfer => ({
                    from: transfer.from,
                    to: transfer.to,
                    amount: transfer.amount,
                    tokenAddress: transfer.tokenAddress,
                    estimatedGas: transfer.estimatedGas,
                    priority: transfer.priority
                }));

                await this.skaleOptimizer.batchOptimizeTransfers(optimizedTransfers);
            } else {
                // Process non-SKALE chain transfers
                for (const transfer of transfers) {
                    await this.assetManager.batchTransfer([{
                        to: transfer.to,
                        amount: transfer.amount,
                        tokenAddress: transfer.tokenAddress
                    }]);
                }
            }

            return transfers;
        } catch (error) {
            throw new Error(`Failed to process route batch: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async getPendingTransfers(): Promise<CrossChainTransfer[]> {
        return [...this.pendingTransfers];
    }

    async clearPendingTransfers(): Promise<void> {
        this.pendingTransfers = [];
    }

    async getTransferStats(): Promise<{
        totalTransfers: number;
        totalAmount: string;
        averageGas: bigint;
        averageBridgeFee: bigint;
        averageTime: number;
        averageSecurityScore: number;
        protocolDistribution: Map<string, number>;
    }> {
        if (this.pendingTransfers.length === 0) {
            return {
                totalTransfers: 0,
                totalAmount: '0',
                averageGas: BigInt(0),
                averageBridgeFee: BigInt(0),
                averageTime: 0,
                averageSecurityScore: 0,
                protocolDistribution: new Map()
            };
        }

        const protocolCount = new Map<string, number>();
        let totalSecurityScore = 0;

        const stats = {
            totalTransfers: this.pendingTransfers.length,
            totalAmount: this.pendingTransfers.reduce(
                (sum, transfer) => sum + BigInt(transfer.amount),
                BigInt(0)
            ).toString(),
            averageGas: this.pendingTransfers.reduce(
                (sum, transfer) => sum + transfer.estimatedGas,
                BigInt(0)
            ) / BigInt(this.pendingTransfers.length),
            averageBridgeFee: this.pendingTransfers.reduce(
                (sum, transfer) => sum + transfer.bridgeFee,
                BigInt(0)
            ) / BigInt(this.pendingTransfers.length),
            averageTime: this.pendingTransfers.reduce(
                (sum, transfer) => sum + transfer.estimatedTime,
                0
            ) / this.pendingTransfers.length,
            averageSecurityScore: 0,
            protocolDistribution: protocolCount
        };

        // Calculate protocol distribution and security scores
        this.pendingTransfers.forEach(transfer => {
            const protocolName = transfer.protocol.name;
            protocolCount.set(
                protocolName,
                (protocolCount.get(protocolName) || 0) + 1
            );
            totalSecurityScore += transfer.securityScore;
        });

        stats.averageSecurityScore = totalSecurityScore / this.pendingTransfers.length;

        return stats;
    }
} 