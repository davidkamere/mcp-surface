import { Link } from "@tanstack/react-router";

const lockedFeatures = [
    { name: "Chat", description: "Work with the researched platform surface." },
    { name: "Workspace", description: "Explore synthesized operations and evidence." },
    { name: "Runtime", description: "Configure and run the generated execution surface." },
    { name: "MCP & sharing", description: "Connect clients or invite collaborators." },
];

export function ResearchUnlockPanel({
    researchCompleted,
    artifactError,
    backToPlatformId,
}: {
    researchCompleted: boolean;
    artifactError?: string | null;
    backToPlatformId?: string;
}) {
    return (
        <section className="research-unlock-panel" aria-labelledby="research-unlock-title">
            <div className="research-unlock-heading">
                <span className="research-unlock-icon" aria-hidden="true">
                    <LockIcon />
                </span>
                <div>
                    <p className="eyebrow">Next stage</p>
                    <h2 id="research-unlock-title">
                        {artifactError
                            ? "Artifact status unavailable"
                            : researchCompleted
                            ? "Your workspace is being prepared"
                            : "Research unlocks your workspace"}
                    </h2>
                    <p>
                        {artifactError
                            ? "We could not confirm that the generated artifacts are ready. Return to setup and check the research status before continuing."
                            : researchCompleted
                              ? "The research run finished, but artifact generation did not complete. Review the run status, then rerun research to try again."
                              : "Complete a research run to generate the artifacts that power these features. Until then, this setup stays focused on your sources and findings."}
                    </p>
                </div>
            </div>

            <div className="research-unlock-features" aria-label="Features unlocked after research">
                {lockedFeatures.map((feature, index) => (
                    <div className="research-unlock-feature" key={feature.name}>
                        <span className="research-unlock-step">0{index + 1}</span>
                        <div>
                            <strong>{feature.name}</strong>
                            <span>{feature.description}</span>
                        </div>
                        <LockIcon />
                    </div>
                ))}
            </div>

            {backToPlatformId ? (
                <Link
                    className="button button-secondary research-unlock-back"
                    params={{ platformId: backToPlatformId }}
                    to="/platforms/$platformId"
                >
                    Back to platform setup
                </Link>
            ) : null}
        </section>
    );
}

export function LockedChatLink() {
    return (
        <span className="locked-action-wrap" title="Complete research to unlock chat">
            <button className="button button-secondary button-locked" disabled type="button">
                <LockIcon /> Chat
            </button>
            <span className="sr-only">Chat unlocks after research artifacts are generated.</span>
        </span>
    );
}

function LockIcon() {
    return (
        <svg aria-hidden="true" className="lock-icon" fill="none" viewBox="0 0 16 16">
            <rect
                height="7"
                rx="1.5"
                stroke="currentColor"
                strokeWidth="1.3"
                width="10"
                x="3"
                y="7"
            />
            <path
                d="M5.25 7V4.9a2.75 2.75 0 0 1 5.5 0V7"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="1.3"
            />
        </svg>
    );
}

