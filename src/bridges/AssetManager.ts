import { IAssetManager, AssetInfo, AssetError } from '../types';

export class AssetManager implements IAssetManager {
    private assets: Map<string, AssetInfo> = new Map();
    private tokenAddresses: Map<string, string> = new Map();

    // Asset Registration
    async registerAsset(symbol: string, tokenAddress: string): Promise<void> {
        if (this.assets.has(symbol)) {
            throw new AssetError(`Asset ${symbol} already registered`);
        }
        if (this.tokenAddresses.has(tokenAddress)) {
            throw new AssetError(`Token address ${tokenAddress} already registered`);
        }
        this.assets.set(symbol, {
            tokenAddress,
            symbol,
            decimals: 18, // Default to 18 decimals
            lockedAmount: BigInt(0),
            mintedAmount: BigInt(0),
            isActive: true,
            lastUpdate: Date.now()
        });
        this.tokenAddresses.set(tokenAddress, symbol);
    }

    async unregisterAsset(symbol: string): Promise<void> {
        const asset = this.assets.get(symbol);
        if (!asset) {
            throw new AssetError(`Asset ${symbol} not registered`);
        }
        this.assets.delete(symbol);
        this.tokenAddresses.delete(asset.tokenAddress);
    }

    async isAssetRegistered(symbol: string): Promise<boolean> {
        return this.assets.has(symbol);
    }

    // Asset Information
    async getAssetAddress(symbol: string): Promise<string> {
        const asset = this.assets.get(symbol);
        if (!asset) {
            throw new AssetError(`Asset ${symbol} not registered`);
        }
        return asset.tokenAddress;
    }

    async getAssetSymbol(tokenAddress: string): Promise<string> {
        const symbol = this.tokenAddresses.get(tokenAddress);
        if (!symbol) {
            throw new AssetError(`Token address ${tokenAddress} not registered`);
        }
        return symbol;
    }

    async getAssetDecimals(symbol: string): Promise<number> {
        const asset = this.assets.get(symbol);
        if (!asset) {
            throw new AssetError(`Asset ${symbol} not registered`);
        }
        return asset.decimals;
    }

    // Balance Management
    async getLockedBalance(symbol: string): Promise<bigint> {
        const asset = this.assets.get(symbol);
        if (!asset) {
            throw new AssetError(`Asset ${symbol} not registered`);
        }
        return asset.lockedAmount;
    }

    async getMintedBalance(symbol: string): Promise<bigint> {
        const asset = this.assets.get(symbol);
        if (!asset) {
            throw new AssetError(`Asset ${symbol} not registered`);
        }
        return asset.mintedAmount;
    }

    async getTotalSupply(symbol: string): Promise<bigint> {
        const asset = this.assets.get(symbol);
        if (!asset) {
            throw new AssetError(`Asset ${symbol} not registered`);
        }
        return asset.lockedAmount + asset.mintedAmount;
    }
} 