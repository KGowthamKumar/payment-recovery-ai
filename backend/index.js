require("dotenv").config();
const cors = require("cors");
const express = require("express");
const mongoose = require("mongoose");
const { GoogleGenAI } = require("@google/genai");

const Transaction = require("./models/Transaction");

const app = express();
app.use(cors());
app.use(express.json());



// GEMINI SETUP

// this is debugging
const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});



// MONGODB CONNECTION


mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log("MongoDB connected");
    })
    .catch((error) => {
        console.error(
            "MongoDB connection error:",
            error.message
        );
    });

mongoose.connection.once("open", async () => {
    console.log("MongoDB connected");
    console.log("Database:", mongoose.connection.name);

    const transactions = await Transaction.find({});
    console.log("Transactions:", transactions);
});

// RULES


const MAX_RETRIES = 2;

const ALLOWED_ACTIONS = [
    "RETRY",
    "CHANGE_METHOD",
    "STOP"
];
const TERMINAL_STATUSES = [
    "SUCCESS",
    "RECOVERY_STOPPED"
];

// ================================
// VALIDATE PAYMENT INPUT
// ================================

function validatePaymentInput(req, res, next) {

    const {
        paymentId,
        amount,
        paymentMethod,
        failureReason,
        attemptCount,
        status
    } = req.body;


    // ================================
    // PAYMENT ID
    // ================================

    if (
        !paymentId ||
        typeof paymentId !== "string" ||
        paymentId.trim() === ""
    ) {

        return res.status(400).json({
            success: false,
            error: "Valid paymentId is required"
        });
    }


    // ================================
    // AMOUNT
    // ================================

    if (
        typeof amount !== "number" ||
        amount <= 0
    ) {

        return res.status(400).json({
            success: false,
            error: "Amount must be a number greater than 0"
        });
    }


    // ================================
    // PAYMENT METHOD
    // ================================
    const allowedPaymentMethods = [
        "CARD",
        "UPI",
        "NETBANKING",
        "WALLET"
    ];

    if (
        !allowedPaymentMethods.includes(
            paymentMethod
        )
    ) {

        return res.status(400).json({
            success: false,
            error:
                "Invalid payment method"
        });
    }


    // ================================
    // FAILURE REASON
    // ================================

    if (
        !failureReason ||
        typeof failureReason !== "string"
    ) {

        return res.status(400).json({
            success: false,
            error:
                "Valid failure reason is required"
        });
    }


    // ================================
    // ATTEMPT COUNT
    // ================================

    if (
        typeof attemptCount !== "number" ||
        attemptCount < 0
    ) {

        return res.status(400).json({
            success: false,
            error:
                "Attempt count must be 0 or greater"
        });
    }


    // ================================
    // STATUS
    // ================================

    const allowedStatuses = [
        "FAILED",
        "SUCCESS",
        "COMPLETED"
    ];

    if (
        !allowedStatuses.includes(status)
    ) {

        return res.status(400).json({
            success: false,
            error:
                "Invalid payment status"
        });
    }


    // Everything is valid
    next();
}

// VALIDATE AI ACTION
function validateAction(action, transaction) {

    // Check if AI returned a valid action
    if (!ALLOWED_ACTIONS.includes(action)) {

        return {
            allowed: false,
            reason: "Invalid AI action"
        };
    }


    // Check retry limit
    if (action === "RETRY") {

        if (transaction.attemptCount >= MAX_RETRIES) {

            return {
                allowed: false,
                reason: "Maximum retry limit reached"
            };
        }
    }


    // Prevent changing method if already completed
    if (action === "CHANGE_METHOD") {

        if (transaction.status === "COMPLETED") {

            return {
                allowed: false,
                reason: "Payment is already completed"
            };
        }
    }


    // Action passed all rules
    return {
        allowed: true,
        reason: "Action is allowed"
    };
}
function validateTransaction(transaction) {

    if (!transaction.paymentId) {
        return {
            valid: false,
            reason: "Payment ID is required"
        };
    }

    if (!transaction.amount) {
        return {
            valid: false,
            reason: "Amount is required"
        };
    }

    if (!transaction.paymentMethod) {
        return {
            valid: false,
            reason: "Payment method is required"
        };
    }

    if (!transaction.failureReason) {
        return {
            valid: false,
            reason: "Failure reason is required"
        };
    }

    if (!transaction.status) {
        return {
            valid: false,
            reason: "Status is required"
        };
    }

    return {
        valid: true,
        reason: "Transaction is valid"
    };
}


// RECOVERY: RETRY PAYMENT


function retryPayment(transaction) {

    transaction.attemptCount++;

    console.log("Retrying payment...");
    console.log("Attempt number:", transaction.attemptCount);

    const paymentSuccess = Math.random() > 0.5;

    if (paymentSuccess) {

        transaction.status = "SUCCESS";

        transaction.auditTrail.push({

            attemptNumber: transaction.attemptCount,

            action: "RETRY",

            recoverySuccess: true,

            recoveryMessage: "Payment recovered successfully",
               timestamp: new Date()

        });

        return {
            success: true,
            action: "RETRY",
            message: "Payment recovered successfully"
        };

    } else {

        transaction.status = "FAILED";

        transaction.auditTrail.push({

            attemptNumber: transaction.attemptCount,

            action: "RETRY",

            recoverySuccess: false,

            recoveryMessage: "Payment retry failed",
               timestamp: new Date()

        });

        return {
            success: false,
            action: "RETRY",
            message: "Payment retry failed"
        };
    }
}



// RECOVERY: CHANGE PAYMENT METHOD
function changePaymentMethod(transaction) {

    const oldMethod = transaction.paymentMethod;

    transaction.recommendedPaymentMethod = "UPI";
    transaction.status = "METHOD_CHANGE_REQUIRED";

    transaction.auditTrail.push({

        action: "CHANGE_METHOD",

        recoverySuccess: true,

        recoveryMessage: `Change payment method from ${oldMethod} to UPI`

    });

    return {
        success: true,
        action: "CHANGE_METHOD",
        message: `Change payment method from ${oldMethod} to UPI`
    };
}
// RECOVERY: STOP
function stopRecovery(transaction) {

    transaction.status = "RECOVERY_STOPPED";

    transaction.auditTrail.push({

        action: "STOP",

        recoverySuccess: false,

        recoveryMessage: "No further recovery action will be taken"

    });

    return {
        success: false,
        action: "STOP",
        message: "No further recovery action will be taken"
    };
}
// ================================
// CHECK RECOVERY STATE
// ================================

function canRecover(transaction) {

    if (
        TERMINAL_STATUSES.includes(
            transaction.status
        )
    ) {

        return {
            allowed: false,
            reason:
                `Recovery is not allowed for payment with status: ${transaction.status}`
        };
    }

    return {
        allowed: true,
        reason: "Payment can be recovered"
    };
}
// EXECUTE AI ACTION


function executeAction(action, transaction) {

    if (action === "RETRY") {

        return retryPayment(transaction);

    }

    if (action === "CHANGE_METHOD") {

        return changePaymentMethod(transaction);

    }

    if (action === "STOP") {

        return stopRecovery(transaction);

    }
}



// ANALYZE TRANSACTION WITH GEMINI


async function analyzeTransaction(transaction) {

    try {

        const response =
            await ai.models.generateContent({

                model: "gemini-3.6-flash",

                contents: `
You are a payment recovery AI.

Analyze the failed transaction and choose
exactly ONE recovery action.

Available actions:

RETRY
CHANGE_METHOD
STOP


Transaction Details:

Payment ID: ${transaction.paymentId}

Amount: ₹${transaction.amount}

Payment Method: ${transaction.paymentMethod}

Failure Reason: ${transaction.failureReason}

Attempt Count: ${transaction.attemptCount}

Status: ${transaction.status}


Return ONLY valid JSON.

Example:

{
    "action": "RETRY",
    "reason": "Short explanation"
}


The action must be exactly one of:

RETRY
CHANGE_METHOD
STOP
`,

                config: {
                    responseMimeType: "application/json"
                }

            });


        // Convert Gemini JSON response
        // from string to JavaScript object

        const aiDecision =
            JSON.parse(response.text);


        
        // VALIDATE AI DECISION
        

        const validation =
            validateAction(
                aiDecision.action,
                transaction
            );


        
        // IF ACTION IS BLOCKED
        

       if (!validation.allowed) {

    transaction.auditTrail.push({

        aiAction: aiDecision.action,

        aiReason: aiDecision.reason,

        guardrailAllowed: validation.allowed,

        guardrailReason: validation.reason,

        recoverySuccess: false,

        recoveryMessage: "Recovery action was blocked"

    });


    await transaction.save();


    return {

        aiDecision: aiDecision,

        guardrail: validation,

        recoveryResult: null,

        finalTransaction: transaction

    };
}


        
        // EXECUTE ALLOWED ACTION
        

        const recoveryResult =
            executeAction(
                aiDecision.action,
                transaction
            );


        
        // SAVE UPDATED TRANSACTION
        

        await transaction.save();


        
        // RETURN FINAL RESULT
        

        return {

            aiDecision: aiDecision,

            guardrail: validation,

            recoveryResult: recoveryResult,

            finalTransaction: transaction

        };

    } catch (error) {

        console.error(
            "AI Error:",
            error.message
        );

        throw error;
    }
}



// API ROUTE


app.post(
    "/payments",

    validatePaymentInput,

    async (req, res, next) => {

        try {

            const transaction =
                await Transaction.create(req.body);


            res.status(201).json({

                success: true,

                message:
                    "Transaction created successfully",

                transaction: transaction

            });

        } catch (error) {

            next(error);

        }
    }
);
// ================================
// GET PAYMENT BY PAYMENT ID
// ================================
app.get(
    "/payments/:paymentId",

    async (req, res, next) => {

        try {

            const transaction =
                await Transaction.findOne({

                    paymentId:
                        req.params.paymentId

                });


            if (!transaction) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Transaction not found"

                });
            }


            res.status(200).json({

                success: true,

                transaction: transaction

            });

        } catch (error) {

            next(error);

        }
    }
);
app.post(
    "/payments/:paymentId/recover",

    async (req, res, next) => {

        try {

            const transaction =
                await Transaction.findOne({

                    paymentId:
                        req.params.paymentId

                });


            // Transaction does not exist

            if (!transaction) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Transaction not found"

                });
            }


            // Check whether recovery is allowed

            const recoveryCheck =
                canRecover(transaction);


            if (!recoveryCheck.allowed) {

                return res.status(400).json({

                    success: false,

                    message:
                        recoveryCheck.reason,

                    transaction:
                        transaction

                });
            }


            // Analyze transaction with AI

            const result =
                await analyzeTransaction(
                    transaction
                );


            res.status(200).json({

                success: true,

                result: result

            });

        } catch (error) {

            next(error);

        }
    }
);
app.get("/transactions/:id", async (req, res) => {

    try {

        const transaction = await Transaction.findById(
            req.params.id
        );

        if (!transaction) {

            return res.status(404).json({
                success: false,
                message: "Transaction not found"
            });
        }

        res.json({
            success: true,
            transaction: transaction
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            error: error.message
        });

    }

});
app.post("/transactions/:id/retry", async (req, res) => {

    try {

        if (!isValidId(req.params.id)) {

            return res.status(400).json({
                success: false,
                message: "Invalid transaction ID"
            });

        }


        const transaction =
            await Transaction.findById(req.params.id);


        if (!transaction) {

            return res.status(404).json({
                success: false,
                message: "Transaction not found"
            });

        }


        const result =
            await analyzeTransaction(transaction);


        res.status(200).json(result);

    } catch (error) {

        console.error(
            "Retry error:",
            error.message
        );

        res.status(500).json({
            success: false,
            message: "Failed to retry transaction"
        });

    }

});
// ================================
// GET ALL PAYMENTS
// ================================

app.get(
    "/payments",

    async (req, res, next) => {

        try {

            const transactions =
                await Transaction.find();


            res.status(200).json({

                success: true,

                count: transactions.length,

                transactions: transactions

            });

        } catch (error) {

            next(error);

        }
    }
);

// ================================
// CENTRAL ERROR HANDLER
// ================================
app.use((error, req, res, next) => {

    console.error(
        "Server Error:",
        error.message
    );


    res.status(500).json({

        success: false,

        error: error.message

    });
});
// START SERVER
const PORT =process.env.PORT || 3000;
app.listen(PORT, () => {

    console.log(
        `Server running at http://localhost:${PORT}`
    );

});