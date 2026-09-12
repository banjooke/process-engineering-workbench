"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignUpPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSignUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setMessage("");
    setIsError(false);

    const supabase = createClient();

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setIsError(true);
      setMessage(error.message);
      setLoading(false);
      return;
    }

    if (data.session) {
      router.push("/");
      router.refresh();
      return;
    }

    setMessage(
      "Account created successfully. Check your email to confirm your account."
    );
    setLoading(false);
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
            <p className="eyebrow">INTEGRATED PROCESS ENGINEERING PLATFORM</p>

            <h1>
              Process Engineering
              <span>Workbench</span>
            </h1>

            <p className="description">
              An integrated workspace where process engineers can design
              systems, perform engineering calculations and develop practical
              solutions across a wide range of process operations.
            </p>

            <div className="features">
              <div className="feature">
                <span className="featureNumber">01</span>

                <div>
                  <strong>Design and size</strong>
                  <p>
                    Access practical tools for process design, equipment sizing
                    and scale-up.
                  </p>
                </div>
              </div>

              <div className="feature">
                <span className="featureNumber">02</span>

                <div>
                  <strong>Calculate and analyse</strong>
                  <p>
                    Perform reliable calculations and rapidly evaluate
                    engineering scenarios.
                  </p>
                </div>
              </div>

              <div className="feature">
                <span className="featureNumber">03</span>

                <div>
                  <strong>Solve and document</strong>
                  <p>
                    Develop practical solutions, save project work and generate
                    structured engineering reports.
                  </p>
                </div>
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

          <div className="formHeading">
            <p className="formEyebrow">CREATE YOUR WORKSPACE</p>
            <h2>Create an account</h2>

            <p>
              Register to save projects and access the Process Engineering
              Workbench.
            </p>
          </div>

          <form onSubmit={handleSignUp} className="form">
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

            <div className="field">
              <div className="passwordLabel">
                <label htmlFor="password">Password</label>
                <span>Minimum 6 characters</span>
              </div>

              <div className="passwordInput">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  placeholder="Create a secure password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />

                <button
                  type="button"
                  className="showButton"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="submitButton"
              disabled={loading}
            >
              <span>
                {loading ? "Creating your account..." : "Create account"}
              </span>

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

            <p className="signInText">
              Already have an account?{" "}
              <Link href="/login">Sign in</Link>
            </p>
          </form>

          <p className="terms">
            By creating an account, you agree to use the platform responsibly
            and protect your login information.
          </p>
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
          top: 17%;
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
          letter-spacing: 0.02em;
          text-decoration: none;
        }

        .logoMark {
          width: 42px;
          height: 42px;
          display: grid;
          place-items: center;
          flex-shrink: 0;
          border-radius: 11px;
          color: #062238;
          background: #19c6a3;
          font-size: 0.88rem;
          font-weight: 900;
        }

        .hero {
          margin: auto 0;
          padding: 64px 0;
        }

        .eyebrow,
        .formEyebrow {
          margin: 0 0 18px;
          color: #31d6b4;
          font-size: 0.77rem;
          font-weight: 800;
          letter-spacing: 0.16em;
        }

        h1 {
          max-width: 680px;
          margin: 0;
          font-size: clamp(3rem, 5.2vw, 5.4rem);
          line-height: 0.98;
          letter-spacing: -0.055em;
        }

        h1 span {
          display: block;
          color: #49dfc1;
        }

        .description {
          max-width: 610px;
          margin: 30px 0 38px;
          color: #c4d3e3;
          font-size: 1.08rem;
          line-height: 1.75;
        }

        .features {
          max-width: 590px;
          display: grid;
          gap: 14px;
        }

        .feature {
          display: grid;
          grid-template-columns: 42px 1fr;
          gap: 16px;
          align-items: start;
          padding: 17px 19px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(8px);
        }

        .featureNumber {
          width: 36px;
          height: 36px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(73, 223, 193, 0.32);
          border-radius: 10px;
          color: #49dfc1;
          background: rgba(73, 223, 193, 0.08);
          font-size: 0.78rem;
          font-weight: 900;
        }

        .feature strong {
          display: block;
          color: white;
          font-size: 0.97rem;
        }

        .feature p {
          margin: 5px 0 0;
          color: #aebfd1;
          font-size: 0.86rem;
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

        .formEyebrow {
          margin-bottom: 12px;
          color: #087c6b;
        }

        .formHeading h2 {
          margin: 0 0 12px;
          color: #10233f;
          font-size: 2rem;
          letter-spacing: -0.035em;
        }

        .formHeading > p:last-child {
          margin: 0;
          color: #617187;
          font-size: 0.98rem;
          line-height: 1.6;
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

        .passwordLabel {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
        }

        .passwordLabel span {
          margin-bottom: 8px;
          color: #77869a;
          font-size: 0.76rem;
        }

        input {
          width: 100%;
          min-height: 52px;
          padding: 0 15px;
          border: 1.5px solid #cbd6e2;
          border-radius: 11px;
          outline: none;
          color: #10233f;
          background: white;
          font: inherit;
          transition:
            border-color 160ms ease,
            box-shadow 160ms ease;
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
          color: #087c6b;
          background: transparent;
          font-weight: 700;
          cursor: pointer;
        }

        .submitButton {
          min-height: 54px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 14px;
          margin-top: 4px;
          padding: 0 20px;
          border: none;
          border-radius: 11px;
          color: white;
          background: linear-gradient(135deg, #087c6b, #0ca88e);
          font-size: 0.98rem;
          font-weight: 800;
          cursor: pointer;
          box-shadow: 0 12px 25px rgba(8, 124, 107, 0.22);
          transition:
            transform 150ms ease,
            box-shadow 150ms ease;
        }

        .submitButton:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 15px 30px rgba(8, 124, 107, 0.28);
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

        .message.success {
          border: 1px solid #a9dfd3;
          color: #086554;
          background: #edfbf7;
        }

        .message.error {
          border: 1px solid #f1b5b5;
          color: #a52e2e;
          background: #fff1f1;
        }

        .signInText {
          margin: 2px 0 0;
          color: #65758a;
          font-size: 0.9rem;
          text-align: center;
        }

        .signInText a {
          color: #087c6b;
          font-weight: 800;
          text-decoration: none;
        }

        .signInText a:hover {
          text-decoration: underline;
        }

        .terms {
          margin: 26px 0 0;
          color: #8794a5;
          font-size: 0.76rem;
          line-height: 1.55;
          text-align: center;
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

          .formHeading h2 {
            font-size: 1.75rem;
          }
        }
      `}</style>
    </main>
  );
}