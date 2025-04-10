"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Validator = void 0;
const types_1 = require("../types");
class Validator {
    constructor(validatorAddress) {
        this.signatures = new Map();
        this.validatorAddress = validatorAddress;
        this.stakeAmount = BigInt(0);
        this.active = true;
        this.lastValidation = Date.now();
        this.slashedAmount = BigInt(0);
    }
    // Validation Management
    async validateTransaction(txHash) {
        if (!this.active) {
            throw new types_1.ValidationError('Validator is not active');
        }
        // Validation logic here
        this.lastValidation = Date.now();
        return true;
    }
    async signTransaction(txHash) {
        if (!this.active) {
            throw new types_1.ValidationError('Validator is not active');
        }
        // Signing logic here
        this.signatures.set(txHash, 'signature');
        this.lastValidation = Date.now();
    }
    async getSignature(txHash) {
        const signature = this.signatures.get(txHash);
        if (!signature) {
            throw new types_1.ValidationError(`No signature found for transaction ${txHash}`);
        }
        return signature;
    }
    // Validator Information
    async getValidatorAddress() {
        return this.validatorAddress;
    }
    async getStakeAmount() {
        return this.stakeAmount;
    }
    async isActive() {
        return this.active;
    }
    // Slashing
    async slash(validator) {
        if (validator !== this.validatorAddress) {
            throw new types_1.ValidationError('Cannot slash other validators');
        }
        this.slashedAmount += this.stakeAmount;
        this.stakeAmount = BigInt(0);
        this.active = false;
    }
    async getSlashedAmount() {
        return this.slashedAmount;
    }
}
exports.Validator = Validator;
//# sourceMappingURL=Validator.js.map