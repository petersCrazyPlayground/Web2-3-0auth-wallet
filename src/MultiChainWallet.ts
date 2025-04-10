import { ethers } from 'ethers';
import { SecurityManager } from './security/SecurityManager';
import { AnalyticsManager } from './analytics/AnalyticsManager';
import { FeeManager } from './fees/FeeManager';
import { TransactionHistoryManager } from './history/TransactionHistoryManager';
import { UniversalWallet } from './wallet/UniversalWallet';
import { IBridge } from './types';
import { SecurityConfig, FeeConfig } from './types';

export interface WalletConfig {
    security: SecurityConfig;
    fees: FeeConfig;
    updateInterval?: number;
}

export class MultiChainWallet {
    private securityManager: SecurityManager;
    private analyticsManager: AnalyticsManager;
    private feeManager: FeeManager;
    private historyManager: TransactionHistoryManager;
    private wallets: Map<string, UniversalWallet>;
    private bridges: Map<string, IBridge>;
    private provider: ethers.Provider;
    private signer: ethers.Signer;
    private config: WalletConfig;

    constructor(
        provider: ethers.Provider,
        signer: ethers.Signer,
        config: WalletConfig
    ) {
        this.provider = provider;
        this.signer = signer;
        this.config = config;
        this.wallets = new Map();
        this.bridges = new Map();

        // Initialize managers
        this.securityManager = new SecurityManager(config.security, provider);
        this.analyticsManager = new AnalyticsManager(provider, config.updateInterval);
        this.feeManager = new FeeManager(config.fees, provider);
        this.historyManager = new TransactionHistoryManager(provider, config.updateInterval);
    }

    // Wallet Management
    async addWallet(chainId: string, wallet: UniversalWallet): Promise<void> {
        if (this.wallets.has(chainId)) {
            throw new Error(`Wallet for chain ${chainId} already exists`);
        }
        this.wallets.set(chainId, wallet);
    }

    async removeWallet(chainId: string): Promise<void> {
        this.wallets.delete(chainId);
    }

    getWallet(chainId: string): UniversalWallet | undefined {
        return this.wallets.get(chainId);
    }

    // Bridge Management
    async addBridge(chainId: string, bridge: IBridge): Promise<void> {
        if (this.bridges.has(chainId)) {
            throw new Error(`Bridge for chain ${chainId} already exists`);
        }
        this.bridges.set(chainId, bridge);
    }

    async removeBridge(chainId: string): Promise<void> {
        this.bridges.delete(chainId);
    }

    getBridge(chainId: string): IBridge | undefined {
        return this.bridges.get(chainId);
    }

    // Transaction Management
    async sendTransaction(
        chainId: string,
        to: string,
        amount: string,
        tokenAddress?: string
    ): Promise<string> {
        const wallet = this.getWallet(chainId);
        if (!wallet) {
            throw new Error(`No wallet configured for chain ${chainId}`);
        }

        // Validate transaction
        await this.securityManager.validateTransaction(
            await this.signer.getAddress(),
            to,
            amount,
            await this.feeManager.getOptimalGasPrice()
        );

        // Get gas estimate
        const gasEstimate = await this.feeManager.estimateGas({
            from: await this.signer.getAddress(),
            to,
            value: amount,
            data: tokenAddress ? '0x' : undefined
        });

        // Send transaction
        const txHash = await wallet.sendTransaction(to, amount, tokenAddress);

        // Record transaction
        await this.historyManager.recordTransaction(chainId, {
            hash: txHash,
            from: await this.signer.getAddress(),
            to,
            value: amount,
            gasUsed: gasEstimate.gasLimit,
            gasPrice: gasEstimate.gasPrice,
            timestamp: Date.now(),
            status: 'pending',
            chainId,
            nonce: await this.provider.getTransactionCount(await this.signer.getAddress())
        });

        // Update analytics
        await this.analyticsManager.recordTransaction(chainId, txHash, {
            gasUsed: BigInt(gasEstimate.gasLimit),
            gasPrice: gasEstimate.gasPrice,
            timestamp: Date.now(),
            status: 'pending'
        });

        return txHash;
    }

    // Cross-chain Operations
    async bridgeTokens(
        sourceChainId: string,
        targetChainId: string,
        tokenAddress: string,
        amount: string
    ): Promise<string> {
        const sourceBridge = this.getBridge(sourceChainId);
        const targetBridge = this.getBridge(targetChainId);

        if (!sourceBridge || !targetBridge) {
            throw new Error('Bridges not configured for both chains');
        }

        // Validate transaction
        await this.securityManager.validateTransaction(
            await this.signer.getAddress(),
            sourceBridge.getBridgeId(),
            amount,
            await this.feeManager.getOptimalGasPrice()
        );

        // Get gas estimate
        const gasEstimate = await this.feeManager.estimateGas({
            from: await this.signer.getAddress(),
            to: sourceBridge.getBridgeId(),
            value: amount,
            data: tokenAddress
        });

        // Lock tokens
        const txHash = await sourceBridge.lockTokens(tokenAddress, BigInt(amount));

        // Record transaction
        await this.historyManager.recordTransaction(sourceChainId, {
            hash: txHash,
            from: await this.signer.getAddress(),
            to: sourceBridge.getBridgeId(),
            value: amount,
            gasUsed: gasEstimate.gasLimit,
            gasPrice: gasEstimate.gasPrice,
            timestamp: Date.now(),
            status: 'pending',
            chainId: sourceChainId,
            nonce: await this.provider.getTransactionCount(await this.signer.getAddress())
        });

        // Update analytics
        await this.analyticsManager.recordTransaction(sourceChainId, txHash, {
            gasUsed: BigInt(gasEstimate.gasLimit),
            gasPrice: gasEstimate.gasPrice,
            timestamp: Date.now(),
            status: 'pending'
        });

        return txHash;
    }

    // Analytics
    async getTransactionHistory(
        chainId: string,
        options: {
            startBlock?: number;
            endBlock?: number;
            status?: 'success' | 'failed' | 'pending';
            limit?: number;
            offset?: number;
        } = {}
    ): Promise<any[]> {
        return this.historyManager.getTransactionHistory(
            chainId,
            await this.signer.getAddress(),
            options
        );
    }

    async getChainMetrics(chainId: string): Promise<any> {
        return this.analyticsManager.getChainMetrics(chainId);
    }

    async getNetworkStats(chainId: string): Promise<any> {
        return this.analyticsManager.getNetworkStats(chainId);
    }

    // Security
    async enableEmergencyMode(): Promise<void> {
        await this.securityManager.enableEmergencyMode();
    }

    async disableEmergencyMode(): Promise<void> {
        await this.securityManager.disableEmergencyMode();
    }

    async isEmergencyMode(): Promise<boolean> {
        return this.securityManager.isEmergencyMode();
    }

    // Fee Management
    async getOptimalGasPrice(): Promise<string> {
        return this.feeManager.getOptimalGasPrice();
    }

    async shouldWaitForLowerFees(currentGasPrice: string): Promise<boolean> {
        return this.feeManager.shouldWaitForLowerFees(currentGasPrice);
    }

    // Configuration
    getConfig(): WalletConfig {
        return { ...this.config };
    }

    updateConfig(newConfig: Partial<WalletConfig>): void {
        this.config = { ...this.config, ...newConfig };
        this.securityManager.updateConfig(newConfig.security || {});
        this.feeManager.updateConfig(newConfig.fees || {});
    }
} 