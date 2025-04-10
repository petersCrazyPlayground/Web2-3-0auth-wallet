import { ethers } from 'ethers';
import { Transaction } from '../types';

export interface FeeConfig {
    maxFeePerGas: string;
    maxPriorityFeePerGas: string;
    baseFeeMultiplier: number;
    minGasPrice: string;
    validatorFeePercentage: number;
    maxValidatorFee: string;
}

export interface GasEstimate {
    gasLimit: string;
    gasPrice: string;
    maxFeePerGas: string;
    maxPriorityFeePerGas: string;
    estimatedCost: string;
}

export interface ValidatorFee {
    validator: string;
    amount: string;
    timestamp: number;
}

export class FeeManager {
    private config: FeeConfig;
    private provider: ethers.Provider;
    private validatorFees: Map<string, ValidatorFee[]>;
    private lastGasPrice: string;
    private lastGasPriceUpdate: number;
    private gasPriceHistory: { price: string; timestamp: number; }[];

    constructor(config: FeeConfig, provider: ethers.Provider) {
        this.config = config;
        this.provider = provider;
        this.validatorFees = new Map();
        this.lastGasPrice = '0';
        this.lastGasPriceUpdate = 0;
        this.gasPriceHistory = [];
    }

    // Gas estimation
    async estimateGas(tx: Transaction): Promise<GasEstimate> {
        try {
            const [gasPrice, feeData, gasLimit] = await Promise.all([
                this.getOptimalGasPrice(),
                this.provider.getFeeData(),
                this.provider.estimateGas({
                    from: tx.sender,
                    to: tx.recipient,
                    value: tx.amount.toString()
                })
            ]);

            const maxFeePerGas = feeData.maxFeePerGas?.toString() || gasPrice;
            const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas?.toString() || '0';

            // Calculate estimated cost
            const estimatedCost = (
                BigInt(gasLimit) * BigInt(gasPrice)
            ).toString();

            return {
                gasLimit: gasLimit.toString(),
                gasPrice,
                maxFeePerGas,
                maxPriorityFeePerGas,
                estimatedCost
            };
        } catch (error) {
            throw new Error(`Failed to estimate gas: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async getOptimalGasPrice(): Promise<string> {
        try {
            // Check if we need to update gas price
            const now = Date.now();
            if (now - this.lastGasPriceUpdate < 60000) { // 1 minute cache
                return this.lastGasPrice;
            }

            const feeData = await this.provider.getFeeData();
            const baseGasPrice = feeData.gasPrice?.toString() || '0';

            // Calculate optimal gas price
            const optimalPrice = this.optimizeGasPrice(baseGasPrice);
            
            // Update cache
            this.lastGasPrice = optimalPrice;
            this.lastGasPriceUpdate = now;
            
            // Record in history
            this.gasPriceHistory.push({
                price: optimalPrice,
                timestamp: now
            });

            // Keep last 24 hours of history
            const dayAgo = now - 24 * 60 * 60 * 1000;
            this.gasPriceHistory = this.gasPriceHistory.filter(
                entry => entry.timestamp > dayAgo
            );

            return optimalPrice;
        } catch (error) {
            throw new Error(`Failed to get optimal gas price: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    // Fee optimization
    private optimizeGasPrice(baseGasPrice: string): string {
        const baseFee = BigInt(baseGasPrice);
        const minGas = BigInt(this.config.minGasPrice);
        const maxFee = BigInt(this.config.maxFeePerGas);

        // Calculate optimal price based on base fee and multiplier
        let optimalPrice = baseFee * BigInt(Math.floor(this.config.baseFeeMultiplier * 100)) / BigInt(100);

        // Ensure it's within bounds
        if (optimalPrice < minGas) {
            optimalPrice = minGas;
        }
        if (optimalPrice > maxFee) {
            optimalPrice = maxFee;
        }

        return optimalPrice.toString();
    }

    async shouldWaitForLowerFees(currentGasPrice: string): Promise<boolean> {
        if (this.gasPriceHistory.length < 2) {
            return false;
        }

        // Calculate average gas price over last hour
        const hourAgo = Date.now() - 60 * 60 * 1000;
        const recentPrices = this.gasPriceHistory.filter(
            entry => entry.timestamp > hourAgo
        );

        if (recentPrices.length < 2) {
            return false;
        }

        const avgPrice = recentPrices.reduce(
            (sum, entry) => sum + BigInt(entry.price),
            BigInt(0)
        ) / BigInt(recentPrices.length);

        // If current price is significantly higher than average, suggest waiting
        return BigInt(currentGasPrice) > avgPrice * BigInt(120) / BigInt(100); // 20% threshold
    }

    // Fee distribution
    async calculateValidatorFees(amount: string): Promise<string> {
        const fee = (BigInt(amount) * BigInt(this.config.validatorFeePercentage)) / BigInt(100);
        const maxFee = BigInt(this.config.maxValidatorFee);

        return fee > maxFee ? maxFee.toString() : fee.toString();
    }

    async distributeFeesToValidators(
        validators: string[],
        totalFees: string
    ): Promise<void> {
        if (validators.length === 0) {
            return;
        }

        const feePerValidator = BigInt(totalFees) / BigInt(validators.length);
        const timestamp = Date.now();

        validators.forEach(validator => {
            if (!this.validatorFees.has(validator)) {
                this.validatorFees.set(validator, []);
            }

            this.validatorFees.get(validator)!.push({
                validator,
                amount: feePerValidator.toString(),
                timestamp
            });
        });
    }

    async getValidatorFees(validator: string): Promise<ValidatorFee[]> {
        return this.validatorFees.get(validator) || [];
    }

    async clearValidatorFees(validator: string): Promise<void> {
        this.validatorFees.delete(validator);
    }

    // Configuration
    getConfig(): FeeConfig {
        return { ...this.config };
    }

    updateConfig(newConfig: Partial<FeeConfig>): void {
        this.config = { ...this.config, ...newConfig };
    }

    // Gas price history
    getGasPriceHistory(): { price: string; timestamp: number; }[] {
        return [...this.gasPriceHistory];
    }

    async getAverageGasPrice(timeWindow: number = 3600000): Promise<string> {
        const now = Date.now();
        const relevantPrices = this.gasPriceHistory.filter(
            entry => entry.timestamp > now - timeWindow
        );

        if (relevantPrices.length === 0) {
            return '0';
        }

        const sum = relevantPrices.reduce(
            (total, entry) => total + BigInt(entry.price),
            BigInt(0)
        );

        return (sum / BigInt(relevantPrices.length)).toString();
    }
} 