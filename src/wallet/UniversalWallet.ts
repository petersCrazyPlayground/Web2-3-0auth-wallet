import { IBridge } from '../types';
import { ethers } from 'ethers';
import { AssetManager } from '../asset/AssetManager';

export abstract class UniversalWallet {
    protected bridge: IBridge;
    protected assetManager: AssetManager;
    protected provider: ethers.Provider;
    protected signer: ethers.Signer;

    constructor(
        bridge: IBridge,
        assetManager: AssetManager,
        provider: ethers.Provider,
        signer: ethers.Signer
    ) {
        this.bridge = bridge;
        this.assetManager = assetManager;
        this.provider = provider;
        this.signer = signer;
    }

    abstract getBalance(tokenAddress: string): Promise<string>;
    abstract sendTransaction(to: string, amount: string, tokenAddress: string): Promise<string>;
    abstract getTransactionStatus(txId: string): Promise<string>;
}
