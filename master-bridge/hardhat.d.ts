import "hardhat/types/config";
import "hardhat/types/runtime";

declare module "hardhat/types/config" {
  interface HardhatUserConfig {
    networks?: {
      [key: string]: {
        url?: string;
        accounts?: string[];
        chainId?: number;
      };
    };
  }
}

declare module "hardhat/types/runtime" {
  interface HardhatRuntimeEnvironment {
    ethers: {
      getSigners(): Promise<Array<{ address: string }>>;
      getContractFactory(name: string): Promise<{
        deploy(): Promise<{
          waitForDeployment(): Promise<void>;
          getAddress(): Promise<string>;
        }>;
      }>;
    };
  }
} 