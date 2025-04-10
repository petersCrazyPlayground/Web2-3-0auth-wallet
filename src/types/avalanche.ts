export interface AvalancheConfig {
    networkId: number;
    chainId: string;
    rpcUrl: string;
    explorerUrl: string;
    gasPrice: string;
    maxFeePerGas: string;
    maxPriorityFeePerGas: string;
    defaultGasLimit: number;
    supportedTokens: string[];
    crossChainEnabled: boolean;
    securityLevel: 'low' | 'medium' | 'high';
} 