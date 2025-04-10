export declare enum TransactionStatus {
    PENDING = "PENDING",
    LOCKED = "LOCKED",
    MINTED = "MINTED",
    BURNED = "BURNED",
    UNLOCKED = "UNLOCKED",
    FAILED = "FAILED",
    CANCELLED = "CANCELLED"
}
export declare enum ValidationStatus {
    PENDING = "PENDING",
    APPROVED = "APPROVED",
    REJECTED = "REJECTED",
    TIMEOUT = "TIMEOUT"
}
export interface Transaction {
    symbol: string;
    amount: bigint;
    sender: string;
    recipient: string;
    sourceChain: string;
    targetChain: string;
    timestamp: number;
    status: TransactionStatus;
    validatorSignatures: string[];
}
export interface ValidatorInfo {
    validatorAddress: string;
    stakeAmount: bigint;
    isActive: boolean;
    lastValidation: number;
    slashedAmount: bigint;
}
export interface AssetInfo {
    tokenAddress: string;
    symbol: string;
    decimals: number;
    lockedAmount: bigint;
    mintedAmount: bigint;
    isActive: boolean;
    lastUpdate: number;
}
export interface IBridge {
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
export interface IValidator {
    validateTransaction(txHash: string): Promise<boolean>;
    signTransaction(txHash: string): Promise<void>;
    getSignature(txHash: string): Promise<string>;
    getValidatorAddress(): Promise<string>;
    getStakeAmount(): Promise<bigint>;
    isActive(): Promise<boolean>;
    slash(validator: string): Promise<void>;
    getSlashedAmount(): Promise<bigint>;
}
export interface IAssetManager {
    registerAsset(symbol: string, tokenAddress: string): Promise<void>;
    unregisterAsset(symbol: string): Promise<void>;
    isAssetRegistered(symbol: string): Promise<boolean>;
    getAssetAddress(symbol: string): Promise<string>;
    getAssetSymbol(tokenAddress: string): Promise<string>;
    getAssetDecimals(symbol: string): Promise<number>;
    getLockedBalance(symbol: string): Promise<bigint>;
    getMintedBalance(symbol: string): Promise<bigint>;
    getTotalSupply(symbol: string): Promise<bigint>;
}
export declare class BridgeError extends Error {
    constructor(message: string);
}
export declare class ValidationError extends Error {
    constructor(message: string);
}
export declare class AssetError extends Error {
    constructor(message: string);
}
export interface AvalancheConfig {
    rpcUrl: string;
    chainId: string;
    gasPrice: bigint;
    gasLimit: bigint;
}
export interface AvalancheTransaction {
    hash: string;
    from: string;
    to: string;
    value: bigint;
    gasPrice: bigint;
    gasLimit: bigint;
    nonce: number;
    data: string;
    chainId: string;
}
export interface AvalancheAsset {
    address: string;
    symbol: string;
    decimals: number;
    name: string;
    isNative: boolean;
}
