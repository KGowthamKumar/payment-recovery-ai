
import { useState, useEffect } from "react";
import "./App.css";

function App() {

    const [payments, setPayments] = useState([]);
    const [recoveryResult, setRecoveryResult] = useState(null);
    const [loadingPaymentId, setLoadingPaymentId] = useState(null);
    const [error, setError] = useState("");

    // =================================
    // FETCH PAYMENTS
    // =================================

    const fetchPayments = async () => {
        try {

            const response = await fetch(
                "http://localhost:3000/payments"
            );

            const data = await response.json();

            setPayments(data.transactions);

        } catch (error) {

            console.error(
                "Error fetching payments:",
                error
            );

            setError("Could not load payments");
        }
    };


    useEffect(() => {
        fetchPayments();
    }, []);


    // =================================
    // PAYMENT COUNTS
    // =================================

    const failedPayments = payments.filter(
        (payment) => payment.status === "FAILED"
    );

    const successfulPayments = payments.filter(
        (payment) => payment.status === "SUCCESS"
    );


    // =================================
    // RECOVER PAYMENT
    // =================================

    const recoverPayment = async (paymentId) => {

        try {

            // Only the clicked payment is loading
            setLoadingPaymentId(paymentId);

            setError("");
            setRecoveryResult(null);


            const response = await fetch(
                `http://localhost:3000/payments/${paymentId}/recover`,
                {
                    method: "POST"
                }
            );


            const data = await response.json();


            if (!response.ok) {

                setError(
                    data.message ||
                    data.error ||
                    "Recovery failed"
                );

                return;
            }


            setRecoveryResult(data);


            // Refresh payments
            await fetchPayments();


        } catch (error) {

            console.error(
                "Recovery Error:",
                error
            );

            setError(
                "Could not connect to the backend"
            );


        } finally {

            // Stop loading
            setLoadingPaymentId(null);
        }
    };


    // =================================
    // STATUS CLASS
    // =================================

    const getStatusClass = (status) => {

        if (status === "SUCCESS") {
            return "status-success";
        }

        if (status === "FAILED") {
            return "status-failed";
        }

        return "status-other";
    };


    return (

        <div className="app">


            {/* =========================
                HEADER
            ========================= */}

            <header className="header">

                <div>

                    <h1>
                        Payment Recovery AI
                    </h1>

                    <p>
                        AI-powered payment recovery dashboard
                    </p>

                </div>

            </header>



            {/* =========================
                DASHBOARD CARDS
            ========================= */}

            <section className="dashboard">


                <div className="stat-card">

                    <span>
                        Total Payments
                    </span>

                    <strong>
                        {payments.length}
                    </strong>

                </div>



                <div className="stat-card">

                    <span>
                        Failed Payments
                    </span>

                    <strong>
                        {failedPayments.length}
                    </strong>

                </div>



                <div className="stat-card">

                    <span>
                        Successful Payments
                    </span>

                    <strong>
                        {successfulPayments.length}
                    </strong>

                </div>


            </section>



            {/* =========================
                ERROR
            ========================= */}

            {
                error && (

                    <div className="error-box">

                        {error}

                    </div>

                )
            }



            {/* =========================
                RECOVERY RESULT
            ========================= */}

            {
                recoveryResult && (

                    <section className="recovery-panel">


                        <div className="section-title">

                            <h2>
                                Recovery Result
                            </h2>

                        </div>



                        <div className="recovery-grid">


                            {/* AI ACTION */}

                            <div>

                                <span>
                                    AI Action
                                </span>

                                <strong>

                                    {
                                        recoveryResult
                                            .result
                                            .aiDecision
                                            .action
                                    }

                                </strong>

                            </div>



                            {/* GUARDRAIL */}

                            <div>

                                <span>
                                    Guardrail
                                </span>

                                <strong>

                                    {
                                        recoveryResult
                                            .result
                                            .guardrail
                                            .allowed
                                            ? "ALLOWED"
                                            : "BLOCKED"
                                    }

                                </strong>

                            </div>



                            {/* FINAL STATUS */}

                            <div>

                                <span>
                                    Final Status
                                </span>

                                <strong>

                                    {
                                        recoveryResult
                                            .result
                                            .finalTransaction
                                            .status
                                    }

                                </strong>

                            </div>


                        </div>



                        {/* AI REASON */}

                        <div className="reason">

                            <strong>
                                AI Reason
                            </strong>

                            <p>

                                {
                                    recoveryResult
                                        .result
                                        .aiDecision
                                        .reason
                                }

                            </p>

                        </div>



                        {/* RECOVERY RESULT */}

                        {
                            recoveryResult
                                .result
                                .recoveryResult && (

                                <div className="reason">

                                    <strong>
                                        Recovery Result
                                    </strong>

                                    <p>

                                        {
                                            recoveryResult
                                                .result
                                                .recoveryResult
                                                .message
                                        }

                                    </p>

                                </div>

                            )
                        }


                    </section>

                )
            }



            {/* =========================
                PAYMENTS
            ========================= */}

            <section className="payments-section">


                <div className="section-title">

                    <h2>
                        Payments
                    </h2>

                    <span>
                        {payments.length} transactions
                    </span>

                </div>



                {
                    payments.length === 0 ? (

                        <div className="empty-state">

                            <h3>
                                No payments found
                            </h3>

                            <p>
                                Create a payment to start
                                the recovery process.
                            </p>

                        </div>

                    ) : (


                        <div className="payment-list">


                            {
                                payments.map((payment) => (

                                    <div
                                        className="payment-card"
                                        key={payment.paymentId}
                                    >


                                        {/* PAYMENT HEADER */}

                                        <div className="payment-main">


                                            <div>

                                                <h3>
                                                    {
                                                        payment.paymentId
                                                    }
                                                </h3>

                                                <p>

                                                    {
                                                        payment.paymentMethod
                                                    }

                                                    {" • "}

                                                    {
                                                        payment.failureReason
                                                    }

                                                </p>

                                            </div>



                                            <div className="amount">

                                                ₹
                                                {
                                                    payment.amount
                                                }

                                            </div>


                                        </div>



                                        {/* PAYMENT DETAILS */}

                                        <div className="payment-details">


                                            {/* STATUS */}

                                            <div>

                                                <span>
                                                    Status
                                                </span>


                                                <span
                                                    className={
                                                        `status ${getStatusClass(
                                                            payment.status
                                                        )}`
                                                    }
                                                >

                                                    {
                                                        payment.status
                                                    }

                                                </span>

                                            </div>



                                            {/* ATTEMPTS */}

                                            <div>

                                                <span>
                                                    Attempts
                                                </span>

                                                <strong>

                                                    {
                                                        payment.attemptCount
                                                    }

                                                </strong>

                                            </div>



                                            {/* ACTION */}

                                            <div className="action">


                                                {
                                                    payment.status === "FAILED" && (

                                                        <button
                                                            onClick={() =>
                                                                recoverPayment(
                                                                    payment.paymentId
                                                                )
                                                            }

                                                            disabled={
                                                                loadingPaymentId ===
                                                                payment.paymentId
                                                            }
                                                        >

                                                            {
                                                                loadingPaymentId ===
                                                                payment.paymentId
                                                                    ? "Recovering..."
                                                                    : "Recover Payment"
                                                            }

                                                        </button>

                                                    )
                                                }


                                            </div>


                                        </div>


                                    </div>

                                ))
                            }


                        </div>

                    )
                }


            </section>


        </div>

    );
}
export default App;
