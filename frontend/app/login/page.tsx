"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setMessage("");

    const supabase = createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <main className="loginPage">
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

            <div className="statement">
              <p>
                A go-to space where process engineers can work faster, evaluate
                options and develop reliable engineering solutions.
              </p>
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
            <p className="formEyebrow">WELCOME BACK</p>
            <h2>Sign in to your workspace</h2>

            <p>
              Access your engineering tools, saved projects and previous
              calculations.
            </p>
          </div>

          <form onSubmit={handleLogin} className="form">
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

                <Link href="/forgot-password">Forgot password?</Link>
              </div>

              <div className="passwordInput">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  placeholder="Enter your password"
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
              <span>{loading ? "Signing in..." : "Sign in"}</span>
              {!loading && <span aria-hidden="true">→</span>}
            </button>

            {message && (
              <div className="errorMessage" role="alert">
                {message}
              </div>
            )}

            <p className="signUpText">
              Don&apos;t have an account?{" "}
              <Link href="/signup">Create an account</Link>
            </p>
          </form>
        </div>
      </section>

      <style jsx>{`
        * {
          box-sizing: border-box;
        }

        .loginPage {
          min-height: 100vh;
          display: grid;
          grid-template-columns: minmax(420px, 1.1fr) minmax(420px, 0.9fr);
          color: #10233f;
          background-color: #f8fafc !important;
        }

        .brandPanel {
          position: relative;
          overflow: hidden;
          padding: 48px 64px;
          color: #ffffff !important;
          background-color: #071b31 !important;
          background-image:
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
            linear-gradient(
              145deg,
              #071b31 0%,
              #0b2948 55%,
              #0b3554 100%
            ) !important;
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
          background-color: #19c6a3 !important;
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
          color: #ffffff !important;
          font-size: clamp(3rem, 5.2vw, 5.4rem);
          line-height: 0.98;
          letter-spacing: -0.055em;
        }

        h1 span {
          display: block;
          color: #49dfc1 !important;
        }

        .description {
          max-width: 610px;
          margin: 30px 0;
          color: #c4d3e3 !important;
          font-size: 1.08rem;
          line-height: 1.75;
        }

        .statement {
          max-width: 570px;
          padding: 20px 22px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 14px;
          background-color: rgba(255, 255, 255, 0.06) !important;
          backdrop-filter: blur(8px);
        }

        .statement p {
          margin: 0;
          color: #c0d0df !important;
          font-size: 0.98rem;
          line-height: 1.7;
        }

        .footerText {
          margin: 0;
          color: #90a5b9 !important;
          font-size: 0.82rem;
        }

        .formPanel {
          display: grid;
          place-items: center;
          padding: 48px;
          background-color: #f8fafc !important;
          background-image:
            linear-gradient(
              rgba(15, 55, 86, 0.035) 1px,
              transparent 1px
            ),
            linear-gradient(
              90deg,
              rgba(15, 55, 86, 0.035) 1px,
              transparent 1px
            ) !important;
          background-size: 28px 28px;
        }

        .formCard {
          width: min(100%, 470px);
          padding: 42px;
          border: 1px solid #dce5ee;
          border-radius: 24px;
          background-color: #ffffff !important;
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
          color: #10233f !important;
          font-size: 2rem;
          letter-spacing: -0.035em;
        }

        .formHeading > p:last-child {
          margin: 0;
          color: #617187 !important;
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
          color: #182c47 !important;
          font-size: 0.9rem;
          font-weight: 700;
        }

        .passwordLabel {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
        }

        .passwordLabel a {
          margin-bottom: 8px;
          color: #087c6b;
          font-size: 0.8rem;
          font-weight: 700;
          text-decoration: none;
        }

        .passwordLabel a:hover {
          text-decoration: underline;
        }

        input {
          width: 100%;
          min-height: 52px;
          padding: 0 15px;
          border: 1.5px solid #cbd6e2 !important;
          border-radius: 11px;
          outline: none;
          color: #10233f !important;
          background-color: #ffffff !important;
          font: inherit;
          transition:
            border-color 160ms ease,
            box-shadow 160ms ease;
        }

        input::placeholder {
          color: #8d9bad !important;
        }

        input:focus {
          border-color: #098c78 !important;
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
          color: #087c6b !important;
          background: transparent !important;
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
          color: #ffffff !important;
          background-color: #087c6b !important;
          background-image: linear-gradient(
            135deg,
            #087c6b,
            #0ca88e
          ) !important;
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

        .errorMessage {
          padding: 13px 15px;
          border: 1px solid #f1b5b5;
          border-radius: 10px;
          color: #a52e2e !important;
          background-color: #fff1f1 !important;
          font-size: 0.88rem;
          line-height: 1.5;
        }

        .signUpText {
          margin: 2px 0 0;
          color: #65758a !important;
          font-size: 0.9rem;
          text-align: center;
        }

        .signUpText a {
          color: #087c6b;
          font-weight: 800;
          text-decoration: none;
        }

        .signUpText a:hover {
          text-decoration: underline;
        }

        @media (max-width: 900px) {
          .loginPage {
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