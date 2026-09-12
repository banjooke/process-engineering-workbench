"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function UpdatePasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [updated, setUpdated] = useState(false);

  useEffect(() => {
    async function checkRecoverySession() {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      setSessionReady(Boolean(session));
      setCheckingSession(false);
    }

    checkRecoverySession();
  }, []);

  async function handleUpdatePassword(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setMessage("");
    setIsError(false);

    if (password.length < 8) {
      setIsError(true);
      setMessage("Your password must contain at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setIsError(true);
      setMessage("The passwords do not match.");
      return;
    }

    setLoading(true);

    const supabase = createClient();

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      setIsError(true);
      setMessage(error.message);
      setLoading(false);
      return;
    }

    setUpdated(true);
    setMessage("Your password has been updated successfully.");
    setLoading(false);

    await supabase.auth.signOut();

    setTimeout(() => {
      router.push("/login");
      router.refresh();
    }, 2000);
  }

  return (
    <main className="page">
      <section className="brandPanel">
        <div className="brandContent">
          <Link href="/" className="logo">
            <span className="logoMark">PE</span>
            <span>Engineering Workbench</span>
          </Link>

          <div className="hero">
            <p className="eyebrow">SECURE ACCOUNT RECOVERY</p>

            <h1>
              Protect your
              <span>engineering workspace.</span>
            </h1>

            <p className="description">
              Choose a strong new password to securely restore access to your
              projects, calculations and engineering reports.
            </p>

            <div className="securityCard">
              <strong>A strong password should:</strong>

              <ul>
                <li>Contain at least eight characters</li>
                <li>Be difficult for someone else to guess</li>
                <li>Not be reused from another account</li>
              </ul>
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

          {checkingSession ? (
            <div className="statusPanel">
              <div className="spinner" />
              <h2>Checking recovery link</h2>
              <p>Please wait while we verify your secure reset link.</p>
            </div>
          ) : !sessionReady ? (
            <div className="statusPanel">
              <div className="statusIcon errorIcon">!</div>

              <p className="stepLabel">LINK NOT VALID</p>
              <h2>Request a new reset link</h2>

              <p>
                This recovery link is invalid or has expired. Request another
                password-reset email to continue.
              </p>

              <Link href="/forgot-password" className="actionLink">
                Request another link
              </Link>
            </div>
          ) : updated ? (
            <div className="statusPanel">
              <div className="statusIcon successIcon">✓</div>

              <p className="stepLabel">PASSWORD UPDATED</p>
              <h2>Your password is ready</h2>

              <p>
                Your password was changed successfully. You will now be taken
                to the sign-in page.
              </p>

              <Link href="/login" className="actionLink">
                Continue to sign in
              </Link>
            </div>
          ) : (
            <>
              <div className="formHeading">
                <p className="stepLabel">CREATE A NEW PASSWORD</p>
                <h2>Set your new password</h2>

                <p>
                  Enter and confirm the new password you want to use for your
                  account.
                </p>
              </div>

              <form onSubmit={handleUpdatePassword} className="form">
                <div className="field">
                  <label htmlFor="password">New password</label>

                  <div className="passwordInput">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={8}
                      autoComplete="new-password"
                      placeholder="Enter at least 8 characters"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                    />

                    <button
                      type="button"
                      className="showButton"
                      onClick={() =>
                        setShowPassword((current) => !current)
                      }
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="confirmPassword">
                    Confirm new password
                  </label>

                  <input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    placeholder="Enter the new password again"
                    value={confirmPassword}
                    onChange={(event) =>
                      setConfirmPassword(event.target.value)
                    }
                  />
                </div>

                <button
                  type="submit"
                  className="submitButton"
                  disabled={loading}
                >
                  {loading ? "Updating password..." : "Update password"}
                  {!loading && <span aria-hidden="true">→</span>}
                </button>

                {message && (
                  <div
                    className={`message ${isError ? "error" : "success"}`}
                    role="alert"
                  >
                    {message}
                  </div>
                )}
              </form>

              <div className="backLink">
                <Link href="/login">← Back to sign in</Link>
              </div>
            </>
          )}
        </div>
      </section>

      <style jsx>{`
        * {
          box-sizing: border-box;
        }

        .page {
          min-height: 100vh;
          display: grid;
          grid-template-columns: minmax(420px, 1.1fr) minmax(420px, 0.9fr);
          color: #10233f;
          background: #f8fafc;
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
          margin: 0;
          font-size: clamp(3rem, 5vw, 5.2rem);
          line-height: 1;
          letter-spacing: -0.055em;
        }

        h1 span {
          display: block;
          color: #49dfc1;
        }

        .description {
          max-width: 590px;
          margin: 30px 0 38px;
          color: #c4d3e3;
          font-size: 1.08rem;
          line-height: 1.75;
        }

        .securityCard {
          max-width: 570px;
          padding: 20px 22px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.05);
        }

        .securityCard strong {
          color: white;
        }

        .securityCard ul {
          display: grid;
          gap: 8px;
          margin: 14px 0 0;
          padding-left: 20px;
          color: #b8c9d9;
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
        .statusPanel h2 {
          margin: 0 0 12px;
          color: #10233f;
          font-size: 2rem;
          letter-spacing: -0.035em;
        }

        .formHeading > p:last-child,
        .statusPanel > p {
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

        .passwordInput {
          position: relative;
        }

        .passwordInput input {
          padding-right: 72px;
        }

        .showButton {
          position: absolute;
          top: 50%;
          right: 12px;
          transform: translateY(-50%);
          padding: 7px;
          border: none;
          background: transparent;
          color: #087c6b;
          font-weight: 700;
          cursor: pointer;
        }

        .submitButton,
        .actionLink {
          min-height: 54px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 14px;
          padding: 0 20px;
          border: none;
          border-radius: 11px;
          background: linear-gradient(135deg, #087c6b, #0ca88e);
          color: white;
          font-size: 0.98rem;
          font-weight: 800;
          text-decoration: none;
          cursor: pointer;
          box-shadow: 0 12px 25px rgba(8, 124, 107, 0.22);
        }

        .submitButton:disabled {
          cursor: not-allowed;
          opacity: 0.65;
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

        .message.success {
          border: 1px solid #a9dfd3;
          background: #edfbf7;
          color: #086554;
        }

        .statusPanel {
          text-align: center;
        }

        .statusIcon {
          width: 62px;
          height: 62px;
          display: grid;
          place-items: center;
          margin: 0 auto 24px;
          border-radius: 50%;
          font-size: 1.6rem;
          font-weight: 900;
        }

        .successIcon {
          background: #e4f8f2;
          color: #087c6b;
        }

        .errorIcon {
          background: #fff0f0;
          color: #b13232;
        }

        .actionLink {
          margin-top: 26px;
        }

        .spinner {
          width: 48px;
          height: 48px;
          margin: 0 auto 24px;
          border: 4px solid #dce8e5;
          border-top-color: #098c78;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
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

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 900px) {
          .page {
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