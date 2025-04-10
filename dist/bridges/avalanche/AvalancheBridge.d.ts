import { IBridge, TransactionStatus } from '../../types';
import { AvalancheConfig } from '../../types';
export declare class AvalancheBridge implements IBridge {
    private initialized;
    private bridgeId;
    private config;
    private provider;
    private assets;
    private transactions;
    private paused;
    constructor(bridgeId: string, config: AvalancheConfig);
    initialize(): Promise<void>;
    isInitialized(): Promise<boolean>;
    getBridgeId(): Promise<string>;
    registerAsset(symbol: string, tokenAddress: string): Promise<void>;
    unregisterAsset(symbol: string): Promise<void>;
    isAssetSupported(symbol: string): Promise<boolean>;
    lockTokens(symbol: string, amount: bigint): Promise<void>;
    unlockTokens(symbol: string, amount: bigint): Promise<void>;
    mintTokens(symbol: string, amount: bigint): Promise<void>;
    burnTokens(symbol: string, amount: bigint): Promise<void>;
    getTransactionStatus(txHash: string): Promise<TransactionStatus>;
    getPendingTransactions(): Promise<string[]>;
    processTransaction(txHash: string): Promise<void>;
    addValidator(validator: string): Promise<void>;
    removeValidator(validator: string): Promise<void>;
    isValidator(account: string): Promise<boolean>;
    getValidators(): Promise<string[]>;
    pause(): Promise<void>;
    unpause(): Promise<void>;
    emergencyWithdraw(symbol: string): Promise<void>;
}
