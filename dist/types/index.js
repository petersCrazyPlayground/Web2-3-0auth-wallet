"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssetError = exports.ValidationError = exports.BridgeError = exports.ValidationStatus = exports.TransactionStatus = void 0;
// Enums
var TransactionStatus;
(function (TransactionStatus) {
    TransactionStatus["PENDING"] = "PENDING";
    TransactionStatus["LOCKED"] = "LOCKED";
    TransactionStatus["MINTED"] = "MINTED";
    TransactionStatus["BURNED"] = "BURNED";
    TransactionStatus["UNLOCKED"] = "UNLOCKED";
    TransactionStatus["FAILED"] = "FAILED";
    TransactionStatus["CANCELLED"] = "CANCELLED";
})(TransactionStatus || (exports.TransactionStatus = TransactionStatus = {}));
var ValidationStatus;
(function (ValidationStatus) {
    ValidationStatus["PENDING"] = "PENDING";
    ValidationStatus["APPROVED"] = "APPROVED";
    ValidationStatus["REJECTED"] = "REJECTED";
    ValidationStatus["TIMEOUT"] = "TIMEOUT";
})(ValidationStatus || (exports.ValidationStatus = ValidationStatus = {}));
// Error Types
class BridgeError extends Error {
    constructor(message) {
        super(message);
        this.name = 'BridgeError';
    }
}
exports.BridgeError = BridgeError;
class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ValidationError';
    }
}
exports.ValidationError = ValidationError;
class AssetError extends Error {
    constructor(message) {
        super(message);
        this.name = 'AssetError';
    }
}
exports.AssetError = AssetError;
//# sourceMappingURL=index.js.map