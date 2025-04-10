import { IAssetManager } from '../types';
export declare class AssetManager implements IAssetManager {
    private assets;
    private tokenAddresses;
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
