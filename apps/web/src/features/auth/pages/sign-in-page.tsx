import { SignIn } from "@clerk/clerk-react";

export function SignInPage() {
    return (
        <div className="auth-page">
            <section className="hero-card">
                <p className="eyebrow">Phase 1</p>
                <h1>Sign in to start shaping a new platform surface.</h1>
                <p>
                    This MVP keeps the scope tight: authenticate, create a platform, inspect its
                    source inputs, and prepare for the research pipeline in Phase 2.
                </p>
            </section>
            <section className="panel auth-panel">
                <SignIn path="/sign-in" routing="path" signUpUrl="/" />
            </section>
        </div>
    );
}
