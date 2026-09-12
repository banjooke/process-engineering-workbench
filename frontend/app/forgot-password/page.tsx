"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  async function handleReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setMessage("");
    setIsError(false);

    const supabase = createClient();

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/update-password`,
    });

    if (error) {
      setIsError(true);
      setMessage(error.message);
      setLoading(false);
      return;
    }

    setEmailSent(true);
    setMessage(
      "Password reset instructions have been sent. Please check your email."
    );
    setLoading(false);
  }

  return (
    <main className="resetPage">
      <section className="brandPanel">
        <div className="brandContent">
          <Link href="/" className="logo">
            <span className="logoMark">PE</span>
            <span>Engineering Workbench</span>
          </Link>

          <div className="hero">
            <p className="eyebrow">ACCOUNT RECOVERY</p>

            <h1>
              Return to your
              <span>engineering workspace.</span>
            </h1>

            <p className="description">
              Recover access to your projects, calculations and engineering
              work securely.
            </p>

            <div className="process">
              <div className="processItem">
                <span>01</span>
                <p>Enter the email address linked to your account.</p>
              </div>

              <div className="processItem">
                <span>02</span>
                <p>Open the secure password-reset link in your email.</p>
              </div>

              <div className="processItem">
                <span>03</span>
                <p>Create a new password and return to your workspace.</p>
              </div>
            </div>
          </div>

          <p className="footerText">
            Your go-to workspace for practical process engineering.
          </p>
        </div>
      </section>

      <section className="formPanel">
        <div className="formCard">
          <div className="mobileLogo">
            <span className="logoMark">PE</span>
            <span>Engineering Workbench</span>
          </div>

          {!emailSent ? (
            <>
              <div className="formHeading">
                <p className="stepLabel">RESET YOUR PASSWORD</p>
                <h2>Forgot your password?</h2>

                <p>
                  Enter your registered email address and we will send you a
                  secure link to choose a new password.
                </p>
              </div>

              <form onSubmit={handleReset} className="form">
                <div className="field">
                  <label htmlFor="email">Email address</label>

                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="engineer@company.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  className="submitButton"
                  disabled={loading}
                >
                  <span>
                    {loading ? "Sending reset link..." : "Send reset link"}
                  </span>

                  {!loading && <span aria-hidden="true">→</span>}
                </button>

                {message && isError && (
                  <div className="message error" role="alert">
                    {message}
                  </div>
                )}
              </form>
            </>
          ) : (
            <div className="successPanel">
              <div className="successIcon">✓</div>

              <p className="stepLabel">EMAIL SENT</p>
              <h2>Check your inbox</h2>

              <p>
                We sent password-reset instructions to:
              </p>

              <strong className="submittedEmail">{email}</strong>

              <p>
                Open the email and follow the secure link to create a new
                password.
              </p>

              <button
                type="button"
                className="secondaryButton"
                onClick={() => {
                  setEmailSent(false);
                  setMessage("");
                }}
              >
                Use another email
              </button>
            </div>
          )}

          <div className="backLink">
            <Link href="/login">← Back to sign in</Link>
          </div>
        </div>
      </section>

      <style jsx>{`
        * {
          box-sizing: border-box;
        }

        .resetPage {
          min-height: 100vh;
          display: grid;
          grid-template-columns: minmax(420px, 1.1fr) minmax(420px, 0.9fr);
          background: #f8fafc;
          color: #10233f;
        }

        .brandPanel {
          position: relative;
          overflow: hidden;
          padding: 48px 64px;
          color: white;
          background:
            radial-gradient(
              circle at 15% 10%,
              rgba(23, 197, 166, 0.23),
              transparent 30%
            ),
            radial-gradient(
              circle at 90% 90%,
              rgba(42, 117, 255, 0.2),
              transparent 36%
            ),
            linear-gradient(145deg, #071b31 0%, #0b2948 55%, #0b3554 100%);
        }

        .brandPanel::after {
          content: "";
          position: absolute;
          top: 18%;
          right: -170px;
          width: 380px;
          height: 380px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 50%;
          box-shadow:
            0 0 0 55px rgba(255, 255, 255, 0.025),
            0 0 0 110px rgba(255, 255, 255, 0.018);
        }

        .brandContent {
          position: relative;
          z-index: 1;
          min-height: calc(100vh - 96px);
          max-width: 680px;
          margin: auto;
          display: flex;
          flex-direction: column;
        }

        .logo,
        .mobileLogo {
          display: flex;
          align-items: center;
          gap: 12px;
          color: inherit;
          font-size: 0.95rem;
          font-weight: 750;
          text-decoration: none;
        }

        .logoMark {
          width: 42px;
          height: 42px;
          display: grid;
          place-items: center;
          flex-shrink: 0;
          border-radius: 11px;
          background: #19c6a3;
          color: #062238;
          font-size: 0.88rem;
          font-weight: 900;
        }

        .hero {
          margin: auto 0;
          padding: 64px 0;
        }

        .eyebrow,
        .stepLabel {
          margin: 0 0 18px;
          color: #31d6b4;
          font-size: 0.77rem;
          font-weight: 800;
          letter-spacing: 0.16em;
        }

        h1 {
          max-width: 680px;
          margin: 0;
          font-size: clamp(3rem, 5.2vw, 5.2rem);
          line-height: 1;
          letter-spacing: -0.055em;
        }

        h1 span {
          display: block;
          color: #49dfc1;
        }

        .description {
          max-width: 580px;
          margin: 30px 0 38px;
          color: #c4d3e3;
          font-size: 1.08rem;
          line-height: 1.75;
        }

        .process {
          max-width: 580px;
          display: grid;
          gap: 12px;
        }

        .processItem {
          display: flex;
          align-items: center;
          gap: 17px;
          padding: 15px 18px;
          border: 1px solid rgba(255, 255, 255, 0.09);
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.045);
        }

        .processItem span {
          color: #49dfc1;
          font-size: 0.8rem;
          font-weight: 800;
        }

        .processItem p {
          margin: 0;
          color: #b8c9d9;
          font-size: 0.9rem;
          line-height: 1.5;
        }

        .footerText {
          margin: 0;
          color: #90a5b9;
          font-size: 0.82rem;
        }

        .formPanel {
          display: grid;
          place-items: center;
          padding: 48px;
          background:
            linear-gradient(
              rgba(15, 55, 86, 0.035) 1px,
              transparent 1px
            ),
            linear-gradient(
              90deg,
              rgba(15, 55, 86, 0.035) 1px,
              transparent 1px
            ),
            #f8fafc;
          background-size: 28px 28px;
        }

        .formCard {
          width: min(100%, 470px);
          padding: 42px;
          border: 1px solid #dce5ee;
          border-radius: 24px;
          background: rgba(255, 255, 255, 0.98);
          box-shadow: 0 24px 70px rgba(19, 43, 70, 0.12);
        }

        .mobileLogo {
          display: none;
          margin-bottom: 34px;
          color: #10233f;
        }

        .formHeading h2,
        .successPanel h2 {
          margin: 0 0 12px;
          color: #10233f;
          font-size: 2rem;
          letter-spacing: -0.035em;
        }

        .formHeading > p:last-child,
        .successPanel > p {
          margin: 0;
          color: #617187;
          font-size: 0.98rem;
          line-height: 1.65;
        }

        .stepLabel {
          margin-bottom: 12px !important;
          color: #087c6b !important;
        }

        .form {
          display: grid;
          gap: 20px;
          margin-top: 30px;
        }

        .field label {
          display: block;
          margin-bottom: 8px;
          color: #182c47;
          font-size: 0.9rem;
          font-weight: 700;
        }

        input {
          width: 100%;
          min-height: 52px;
          padding: 0 15px;
          border: 1.5px solid #cbd6e2;
          border-radius: 11px;
          outline: none;
          background: white;
          color: #10233f;
          font: inherit;
        }

        input::placeholder {
          color: #8d9bad;
        }

        input:focus {
          border-color: #098c78;
          box-shadow: 0 0 0 4px rgba(9, 140, 120, 0.11);
        }

        .submitButton,
        .secondaryButton {
          min-height: 54px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 14px;
          padding: 0 20px;
          border: none;
          border-radius: 11px;
          font-size: 0.98rem;
          font-weight: 800;
          cursor: pointer;
        }

        .submitButton {
          color: white;
          background: linear-gradient(135deg, #087c6b, #0ca88e);
          box-shadow: 0 12px 25px rgba(8, 124, 107, 0.22);
        }

        .submitButton:disabled {
          cursor: not-allowed;
          opacity: 0.65;
        }

        .secondaryButton {
          width: 100%;
          margin-top: 24px;
          border: 1px solid #b9c8d8;
          color: #17314f;
          background: white;
        }

        .message {
          padding: 13px 15px;
          border-radius: 10px;
          font-size: 0.88rem;
          line-height: 1.5;
        }

        .message.error {
          border: 1px solid #f1b5b5;
          background: #fff1f1;
          color: #a52e2e;
        }

        .successPanel {
          text-align: center;
        }

        .successIcon {
          width: 62px;
          height: 62px;
          display: grid;
          place-items: center;
          margin: 0 auto 24px;
          border-radius: 50%;
          background: #e4f8f2;
          color: #087c6b;
          font-size: 1.6rem;
          font-weight: 900;
        }

        .submittedEmail {
          display: block;
          margin: 14px 0;
          color: #10233f;
          overflow-wrap: anywhere;
        }

        .backLink {
          margin-top: 26px;
          text-align: center;
        }

        .backLink a {
          color: #087c6b;
          font-size: 0.9rem;
          font-weight: 800;
          text-decoration: none;
        }

        @media (max-width: 900px) {
          .resetPage {
            display: block;
          }

          .brandPanel {
            padding: 42px 28px 48px;
          }

          .brandContent {
            min-height: auto;
          }

          .hero {
            padding: 58px 0 0;
          }

          h1 {
            font-size: clamp(2.8rem, 11vw, 4.5rem);
          }

          .footerText {
            display: none;
          }

          .formPanel {
            padding: 56px 24px;
          }
        }

        @media (max-width: 560px) {
          .brandPanel {
            display: none;
          }

          .formPanel {
            min-height: 100vh;
            padding: 24px 18px;
          }

          .formCard {
            padding: 30px 22px;
            border-radius: 18px;
          }

          .mobileLogo {
            display: flex;
          }
        }
      `}</style>
    </main>
  );
}