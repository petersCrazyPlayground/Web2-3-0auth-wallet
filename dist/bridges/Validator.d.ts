import { IValidator } from '../types';
export declare class Validator implements IValidator {
    private validatorAddress;
    private stakeAmount;
    private active;
    private lastValidation;
    private slashedAmount;
    private signatures;
    constructor(validatorAddress: string);
    validateTransaction(txHash: string): Promise<boolean>;
    signTransaction(txHash: string): Promise<void>;
    getSignature(txHash: string): Promise<string>;
    getValidatorAddress(): Promise<string>;
    getStakeAmount(): Promise<bigint>;
    isActive(): Promise<boolean>;
    slash(validator: string): Promise<void>;
    getSlashedAmount(): Promise<bigint>;
}
