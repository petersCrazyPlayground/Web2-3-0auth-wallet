// Enums
export enum TransactionStatus {
    PENDING = 'PENDING',
    LOCKED = 'LOCKED',
    MINTED = 'MINTED',
    BURNED = 'BURNED',
    UNLOCKED = 'UNLOCKED',
    FAILED = 'FAILED',
    CANCELLED = 'CANCELLED'
}

export enum ValidationStatus {
    PENDING = 'PENDING',
    APPROVED = 'APPROVED',
    REJECTED = 'REJECTED',
    TIMEOUT = 'TIMEOUT'
}

// Data Structures
export interface Transaction {
    hash: string;
    from: string;
    to: string;
    value: string;
    gasUsed: string;
    gasPrice: string;
    timestamp: number;
    status: TransactionStatus;
    chainId: string;
    nonce: number;
    data?: string;
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

// Core Interfaces
export interface IBridge {
    // Bridge Management
    initialize(): Promise<void>;
    isInitialized(): Promise<boolean>;
    getBridgeId(): Promise<string>;
    
    // Asset Management
    registerAsset(symbol: string, tokenAddress: string): Promise<void>;
    unregisterAsset(symbol: string): Promise<void>;
    isAssetSupported(symbol: string): Promise<boolean>;
    
    // Cross-Chain Operations
    lockTokens(symbol: string, amount: bigint): Promise<void>;
    unlockTokens(symbol: string, amount: bigint): Promise<void>;
    mintTokens(symbol: string, amount: bigint): Promise<void>;
    burnTokens(symbol: string, amount: bigint): Promise<void>;
    
    // Transaction Management
    getTransactionStatus(txHash: string): Promise<TransactionStatus>;
    getPendingTransactions(): Promise<string[]>;
    processTransaction(txHash: string): Promise<void>;
    
    // Security Features
    addValidator(validator: string): Promise<void>;
    removeValidator(validator: string): Promise<void>;
    isValidator(account: string): Promise<boolean>;
    getValidators(): Promise<string[]>;
    
    // Emergency Functions
    pause(): Promise<void>;
    unpause(): Promise<void>;
    emergencyWithdraw(symbol: string): Promise<void>;
}

export interface IValidator {
    // Validation Management
    validateTransaction(txHash: string): Promise<boolean>;
    signTransaction(txHash: string): Promise<void>;
    getSignature(txHash: string): Promise<string>;
    
    // Validator Information
    getValidatorAddress(): Promise<string>;
    getStakeAmount(): Promise<bigint>;
    isActive(): Promise<boolean>;
    
    // Slashing
    slash(validator: string): Promise<void>;
    getSlashedAmount(): Promise<bigint>;
}

export interface IAssetManager {
    // Asset Registration
    registerAsset(symbol: string, tokenAddress: string): Promise<void>;
    unregisterAsset(symbol: string): Promise<void>;
    isAssetRegistered(symbol: string): Promise<boolean>;
    
    // Asset Information
    getAssetAddress(symbol: string): Promise<string>;
    getAssetSymbol(tokenAddress: string): Promise<string>;
    getAssetDecimals(symbol: string): Promise<number>;
    
    // Balance Management
    getLockedBalance(symbol: string): Promise<bigint>;
    getMintedBalance(symbol: string): Promise<bigint>;
    getTotalSupply(symbol: string): Promise<bigint>;
}

// Error Types
export class BridgeError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'BridgeError';
    }
}

export class ValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ValidationError';
    }
}

export class AssetError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'AssetError';
    }
}

export class SecurityError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'SecurityError';
    }
}

// Avalanche-specific types
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

export interface SecurityConfig {
    multiSigThreshold: number;
    rateLimit: {
        maxTransactions: number;
        timeWindow: number; // in milliseconds
    };
    emergencyDelay: number; // in milliseconds
    maxGasPrice: string;
    blacklistEnabled: boolean;
    whitelistEnabled: boolean;
}

export interface FeeConfig {
    maxFeePerGas: string;
    maxPriorityFeePerGas: string;
    baseFeeMultiplier: number;
    minGasPrice: string;
    validatorFeePercentage: number;
    maxValidatorFee: string;
}
