import { useUser } from "@clerk/clerk-react";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { acceptShareInvite, getShareInvite } from "../../platforms/api/platforms-api";

export function ShareInvitePage({ inviteToken }: { inviteToken: string }) {
  const navigate = useNavigate();
  const { user, isLoaded } = useUser();
  const [invite, setInvite] = useState<Awaited<ReturnType<typeof getShareInvite>> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;
    setIsLoading(true);
    setError(null);

    void getShareInvite(inviteToken)
      .then((result) => {
        if (isActive) {
          setInvite(result);
        }
      })
      .catch((requestError) => {
        if (isActive) {
          setError(requestError instanceof Error ? requestError.message : "Unable to load invite.");
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [inviteToken]);

  const userEmail =
    user?.primaryEmailAddress?.emailAddress ??
    user?.emailAddresses?.find((entry) => Boolean(entry.emailAddress))?.emailAddress ??
    null;

  async function acceptInvite() {
    if (!user || !userEmail) {
      setError("Sign in with the invited email first.");
      return;
    }

    setIsAccepting(true);
    setError(null);

    try {
      const result = await acceptShareInvite(inviteToken, user.id, userEmail);
      await navigate({
        to: "/platforms/$platformId/chat",
        params: { platformId: result.platform.id },
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to accept invite.");
    } finally {
      setIsAccepting(false);
    }
  }

  return (
    <section className="panel share-landing-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Shared access</p>
          <h1>{invite?.platform.name ?? "Platform invite"}</h1>
        </div>
      </div>

      {isLoading ? <p className="muted-text">Loading invite...</p> : null}
      {invite ? (
        <div className="share-landing-copy">
          <p>
            This invite is bound to <strong>{invite.invite.email}</strong>.
          </p>
          <p className="muted-text">
            You need to be signed in with the matching Clerk email before you can accept access and enter chat.
          </p>
          <p className="muted-text">
            Signed in as: <strong>{isLoaded ? userEmail ?? "not signed in" : "loading..."}</strong>
          </p>
        </div>
      ) : null}
      {error ? <p className="error-text">{error}</p> : null}

      <div className="share-landing-actions">
        <button className="button button-primary" disabled={isLoading || isAccepting} onClick={() => void acceptInvite()} type="button">
          {isAccepting ? "Accepting..." : "Accept invite"}
        </button>
      </div>
    </section>
  );
}
