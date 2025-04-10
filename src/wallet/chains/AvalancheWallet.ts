import { ethers, Provider } from 'ethers';
import { UniversalWallet } from '../UniversalWallet';
import { IBridge, IAssetManager, Transaction, AssetInfo, BridgeError, AssetError } from '../../types';
import { AvalancheConfig } from '../../types/avalanche';
import { AssetManager } from '../../asset/AssetManager';

export class AvalancheWallet extends UniversalWallet {
    protected config: AvalancheConfig;
    protected bridge: IBridge;
    protected assetManager: AssetManager;
    protected provider: Provider;
    protected signer: ethers.Signer;
    protected address: string | undefined;

    constructor(
        bridge: IBridge,
        assetManager: AssetManager,
        provider: Provider,
        signer: ethers.Signer,
        config: AvalancheConfig
    ) {
        super(bridge, assetManager, provider, signer);
        this.bridge = bridge;
        this.assetManager = assetManager;
        this.provider = provider;
        this.signer = signer;
        this.config = config;
    }

    async initialize(): Promise<void> {
        const address = await this.signer.getAddress();
        if (!address) {
            throw new Error('Failed to get signer address');
        }
        this.address = address;
    }

    async getBalance(tokenAddress: string): Promise<string> {
        try {
            return await this.assetManager.getBalance(tokenAddress);
        } catch (error) {
            if (error instanceof Error) {
                throw new AssetError(`Failed to get balance: ${error.message}`);
            }
            throw new AssetError('Failed to get balance: Unknown error');
        }
    }

    async sendTransaction(
        to: string,
        amount: string,
        tokenAddress: string
    ): Promise<string> {
        try {
            const tx = await this.assetManager.createTransfer(
                to,
                amount,
                tokenAddress
            );
            if (!tx.hash) {
                throw new Error('Transaction hash is null');
            }
            await this.bridge.processTransaction(tx.hash);
            return tx.hash;
        } catch (error) {
            if (error instanceof Error) {
                throw new BridgeError(`Failed to send transaction: ${error.message}`);
            }
            throw new BridgeError('Failed to send transaction: Unknown error');
        }
    }

    async getTransactionStatus(txId: string): Promise<string> {
        try {
            const status = await this.bridge.getTransactionStatus(txId);
            return status.toString();
        } catch (error) {
            if (error instanceof Error) {
                throw new BridgeError(`Failed to get transaction status: ${error.message}`);
            }
            throw new BridgeError('Failed to get transaction status: Unknown error');
        }
    }

    async getCChainBalance(tokenAddress: string): Promise<string> {
        try {
            return await this.getBalance(tokenAddress);
        } catch (error) {
            if (error instanceof Error) {
                throw new AssetError(`Failed to get C-Chain balance: ${error.message}`);
            }
            throw new AssetError('Failed to get C-Chain balance: Unknown error');
        }
    }

    async getXChainBalance(tokenAddress: string): Promise<string> {
        try {
            // X-Chain balance retrieval will be implemented when X-Chain support is added
            throw new Error('X-Chain balance retrieval not yet implemented');
        } catch (error) {
            if (error instanceof Error) {
                throw new AssetError(`Failed to get X-Chain balance: ${error.message}`);
            }
            throw new AssetError('Failed to get X-Chain balance: Unknown error');
        }
    }

    async getPChainBalance(tokenAddress: string): Promise<string> {
        try {
            // P-Chain balance retrieval will be implemented when P-Chain support is added
            throw new Error('P-Chain balance retrieval not yet implemented');
        } catch (error) {
            if (error instanceof Error) {
                throw new AssetError(`Failed to get P-Chain balance: ${error.message}`);
            }
            throw new AssetError('Failed to get P-Chain balance: Unknown error');
        }
    }

    async crossChainTransfer(
        toChain: string,
        toAddress: string,
        amount: string,
        tokenAddress: string
    ): Promise<string> {
        try {
            if (!this.config.crossChainEnabled) {
                throw new Error('Cross-chain transfers are not enabled');
            }

            // Lock tokens on source chain
            await this.bridge.lockTokens(tokenAddress, BigInt(amount));

            // Create and process the cross-chain transaction
            const tx = await this.assetManager.createTransfer(
                toAddress,
                amount,
                tokenAddress
            );
            if (!tx.hash) {
                throw new Error('Transaction hash is null');
            }
            await this.bridge.processTransaction(tx.hash);

            return tx.hash;
        } catch (error) {
            if (error instanceof Error) {
                throw new BridgeError(`Failed to perform cross-chain transfer: ${error.message}`);
            }
            throw new BridgeError('Failed to perform cross-chain transfer: Unknown error');
        }
    }

    getConfig(): AvalancheConfig {
        return this.config;
    }

    updateConfig(newConfig: Partial<AvalancheConfig>): void {
        this.config = { ...this.config, ...newConfig };
    }
}
