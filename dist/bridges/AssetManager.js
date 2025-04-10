"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssetManager = void 0;
const types_1 = require("../types");
class AssetManager {
    constructor() {
        this.assets = new Map();
        this.tokenAddresses = new Map();
    }
    // Asset Registration
    async registerAsset(symbol, tokenAddress) {
        if (this.assets.has(symbol)) {
            throw new types_1.AssetError(`Asset ${symbol} already registered`);
        }
        if (this.tokenAddresses.has(tokenAddress)) {
            throw new types_1.AssetError(`Token address ${tokenAddress} already registered`);
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
    async unregisterAsset(symbol) {
        const asset = this.assets.get(symbol);
        if (!asset) {
            throw new types_1.AssetError(`Asset ${symbol} not registered`);
        }
        this.assets.delete(symbol);
        this.tokenAddresses.delete(asset.tokenAddress);
    }
    async isAssetRegistered(symbol) {
        return this.assets.has(symbol);
    }
    // Asset Information
    async getAssetAddress(symbol) {
        const asset = this.assets.get(symbol);
        if (!asset) {
            throw new types_1.AssetError(`Asset ${symbol} not registered`);
        }
        return asset.tokenAddress;
    }
    async getAssetSymbol(tokenAddress) {
        const symbol = this.tokenAddresses.get(tokenAddress);
        if (!symbol) {
            throw new types_1.AssetError(`Token address ${tokenAddress} not registered`);
        }
        return symbol;
    }
    async getAssetDecimals(symbol) {
        const asset = this.assets.get(symbol);
        if (!asset) {
            throw new types_1.AssetError(`Asset ${symbol} not registered`);
        }
        return asset.decimals;
    }
    // Balance Management
    async getLockedBalance(symbol) {
        const asset = this.assets.get(symbol);
        if (!asset) {
            throw new types_1.AssetError(`Asset ${symbol} not registered`);
        }
        return asset.lockedAmount;
    }
    async getMintedBalance(symbol) {
        const asset = this.assets.get(symbol);
        if (!asset) {
            throw new types_1.AssetError(`Asset ${symbol} not registered`);
        }
        return asset.mintedAmount;
    }
    async getTotalSupply(symbol) {
        const asset = this.assets.get(symbol);
        if (!asset) {
            throw new types_1.AssetError(`Asset ${symbol} not registered`);
        }
        return asset.lockedAmount + asset.mintedAmount;
    }
}
exports.AssetManager = AssetManager;
//# sourceMappingURL=AssetManager.js.map