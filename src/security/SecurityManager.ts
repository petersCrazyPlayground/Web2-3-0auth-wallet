import { ethers } from 'ethers';
import { SecurityError } from '../types';

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

export interface SignatureData {
    signer: string;
    timestamp: number;
    signature: string;
}

export class SecurityManager {
    private config: SecurityConfig;
    private signers: Map<string, boolean>;
    private transactionHistory: Map<string, number[]>;
    private emergencyMode: boolean;
    private blacklist: Set<string>;
    private whitelist: Set<string>;
    private provider: ethers.Provider;
    private lastEmergencyTrigger: number;

    constructor(config: SecurityConfig, provider: ethers.Provider) {
        this.config = config;
        this.signers = new Map();
        this.transactionHistory = new Map();
        this.emergencyMode = false;
        this.blacklist = new Set();
        this.whitelist = new Set();
        this.provider = provider;
        this.lastEmergencyTrigger = 0;
    }

    // Multi-sig management
    async addSigner(address: string): Promise<void> {
        if (!ethers.isAddress(address)) {
            throw new SecurityError('Invalid address format');
        }
        this.signers.set(address.toLowerCase(), true);
    }

    async removeSigner(address: string): Promise<void> {
        if (!this.signers.has(address.toLowerCase())) {
            throw new SecurityError('Signer not found');
        }
        this.signers.delete(address.toLowerCase());
    }

    async validateSignatures(txHash: string, signatures: SignatureData[]): Promise<boolean> {
        if (signatures.length < this.config.multiSigThreshold) {
            return false;
        }

        const uniqueSigners = new Set<string>();
        const message = ethers.keccak256(ethers.toUtf8Bytes(txHash));

        for (const sigData of signatures) {
            // Verify signature timestamp
            if (Date.now() - sigData.timestamp > 3600000) { // 1 hour expiry
                throw new SecurityError('Signature expired');
            }

            // Recover signer address
            const recoveredAddress = ethers.verifyMessage(message, sigData.signature);
            
            // Verify signer is authorized
            if (!this.signers.has(recoveredAddress.toLowerCase())) {
                throw new SecurityError('Unauthorized signer');
            }

            uniqueSigners.add(recoveredAddress.toLowerCase());
        }

        return uniqueSigners.size >= this.config.multiSigThreshold;
    }

    // Rate limiting
    async checkRateLimit(address: string): Promise<boolean> {
        const history = this.transactionHistory.get(address.toLowerCase()) || [];
        const now = Date.now();

        // Clean up old transactions
        const recentHistory = history.filter(
            timestamp => now - timestamp < this.config.rateLimit.timeWindow
        );

        this.transactionHistory.set(address.toLowerCase(), recentHistory);

        return recentHistory.length < this.config.rateLimit.maxTransactions;
    }

    async recordTransaction(address: string): Promise<void> {
        const history = this.transactionHistory.get(address.toLowerCase()) || [];
        history.push(Date.now());
        this.transactionHistory.set(address.toLowerCase(), history);
    }

    // Emergency controls
    async enableEmergencyMode(): Promise<void> {
        const now = Date.now();
        if (now - this.lastEmergencyTrigger < this.config.emergencyDelay) {
            throw new SecurityError('Emergency mode cooldown period not elapsed');
        }

        this.emergencyMode = true;
        this.lastEmergencyTrigger = now;
    }

    async disableEmergencyMode(): Promise<void> {
        if (!this.emergencyMode) {
            throw new SecurityError('Emergency mode not active');
        }
        this.emergencyMode = false;
    }

    async isEmergencyMode(): Promise<boolean> {
        return this.emergencyMode;
    }

    // Access control
    async addToBlacklist(address: string): Promise<void> {
        if (!this.config.blacklistEnabled) {
            throw new SecurityError('Blacklist feature is disabled');
        }
        if (!ethers.isAddress(address)) {
            throw new SecurityError('Invalid address format');
        }
        this.blacklist.add(address.toLowerCase());
    }

    async removeFromBlacklist(address: string): Promise<void> {
        this.blacklist.delete(address.toLowerCase());
    }

    async isBlacklisted(address: string): Promise<boolean> {
        return this.blacklist.has(address.toLowerCase());
    }

    async addToWhitelist(address: string): Promise<void> {
        if (!this.config.whitelistEnabled) {
            throw new SecurityError('Whitelist feature is disabled');
        }
        if (!ethers.isAddress(address)) {
            throw new SecurityError('Invalid address format');
        }
        this.whitelist.add(address.toLowerCase());
    }

    async removeFromWhitelist(address: string): Promise<void> {
        this.whitelist.delete(address.toLowerCase());
    }

    async isWhitelisted(address: string): Promise<boolean> {
        if (!this.config.whitelistEnabled) {
            return true;
        }
        return this.whitelist.has(address.toLowerCase());
    }

    // Transaction validation
    async validateTransaction(
        from: string,
        to: string,
        amount: string,
        gasPrice: string
    ): Promise<boolean> {
        // Check emergency mode
        if (this.emergencyMode) {
            throw new SecurityError('System is in emergency mode');
        }

        // Check addresses
        if (this.config.blacklistEnabled && (
            await this.isBlacklisted(from) || 
            await this.isBlacklisted(to)
        )) {
            throw new SecurityError('Address is blacklisted');
        }

        if (this.config.whitelistEnabled && (
            !await this.isWhitelisted(from) || 
            !await this.isWhitelisted(to)
        )) {
            throw new SecurityError('Address is not whitelisted');
        }

        // Check rate limit
        if (!await this.checkRateLimit(from)) {
            throw new SecurityError('Rate limit exceeded');
        }

        // Check gas price
        if (BigInt(gasPrice) > BigInt(this.config.maxGasPrice)) {
            throw new SecurityError('Gas price too high');
        }

        return true;
    }

    // Configuration
    getConfig(): SecurityConfig {
        return { ...this.config };
    }

    updateConfig(newConfig: Partial<SecurityConfig>): void {
        this.config = { ...this.config, ...newConfig };
    }
} 