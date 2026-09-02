const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({

    paymentId: {
        type: String,
        required: true,
        unique: true
    },

    amount: {
        type: Number,
        required: true
    },

    paymentMethod: {
        type: String,
        required: true
    },

    failureReason: {
        type: String,
        required: true
    },

    attemptCount: {
        type: Number,
        default: 0
    },

    status: {
        type: String,
        default: "FAILED"
    },

    recommendedPaymentMethod: {
        type: String
    },



    // AUDIT TRAIL


    auditTrail: [
        {

            aiAction: String,

            aiReason: String,

            guardrailAllowed: Boolean,

            guardrailReason: String,

            recoverySuccess: Boolean,

            recoveryMessage: String,

            timestamp: {
                type: Date,
                default: Date.now
            }

        }
    ]

}, {
    timestamps: true
});


const Transaction = mongoose.model(
    "Transaction",
    transactionSchema
);


module.exports = Transaction;