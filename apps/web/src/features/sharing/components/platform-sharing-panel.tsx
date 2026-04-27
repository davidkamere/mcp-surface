import { useUser } from "@clerk/clerk-react";
import type { PlatformShareInvite } from "@mcpsurface/shared";
import { useEffect, useMemo, useState } from "react";
import { createPlatformInvite, listPlatformInvites, revokePlatformInvite } from "../../platforms/api/platforms-api";

export function PlatformSharingPanel({
  platformId,
  ownerUserId,
}: {
  platformId: string;
  ownerUserId: string;
}) {
  const { user, isLoaded } = useUser();
  const [email, setEmail] = useState("");
  const [invites, setInvites] = useState<PlatformShareInvite[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);
  const isOwner = user?.id === ownerUserId;

  const shareOrigin = useMemo(() => {
    if (typeof window === "undefined") {
      return "";
    }

    return window.location.origin;
  }, []);

  useEffect(() => {
    if (!isLoaded || !isOwner || !user) {
      return;
    }

    let isActive = true;
    setIsLoading(true);
    setError(null);

    void listPlatformInvites(platformId, user.id)
      .then((nextInvites) => {
        if (isActive) {
          setInvites(nextInvites);
        }
      })
      .catch((requestError) => {
        if (isActive) {
          setError(requestError instanceof Error ? requestError.message : "Unable to load invites.");
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
  }, [isLoaded, isOwner, platformId, user]);

  if (!isOwner) {
    return null;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const invite = await createPlatformInvite(platformId, { email }, user.id);
      setInvites((current) => [invite, ...current.filter((entry) => entry.id !== invite.id)]);
      setEmail("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to create invite.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function copyShareLink(invite: PlatformShareInvite) {
    const value = `${shareOrigin}/share/${invite.inviteToken}`;

    try {
      await navigator.clipboard.writeText(value);
      setCopiedInviteId(invite.id);
      window.setTimeout(() => setCopiedInviteId((current) => (current === invite.id ? null : current)), 2000);
    } catch {
      setError("Unable to copy share link.");
    }
  }

  async function handleRevoke(inviteId: string) {
    if (!user) {
      return;
    }

    try {
      const revoked = await revokePlatformInvite(inviteId, user.id);
      setInvites((current) => current.map((entry) => (entry.id === revoked.id ? revoked : entry)));
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to revoke invite.");
    }
  }

  return (
    <section className="panel sharing-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Sharing</p>
          <h2>Invite by email</h2>
        </div>
      </div>

      <form className="sharing-form" onSubmit={handleSubmit}>
        <label className="form-field">
          <span>Invite email</span>
          <input
            className="text-input"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="teammate@example.com"
            type="email"
            value={email}
          />
        </label>
        <button className="button button-primary" disabled={isSubmitting || email.trim().length === 0} type="submit">
          {isSubmitting ? "Inviting..." : "Create invite"}
        </button>
      </form>

      {error ? <p className="error-text">{error}</p> : null}
      {isLoading ? <p className="muted-text">Loading invites...</p> : null}

      <div className="sharing-invite-list">
        {invites.length === 0 ? <p className="muted-text">No invites yet.</p> : null}
        {invites.map((invite) => {
          const link = `${shareOrigin}/share/${invite.inviteToken}`;

          return (
            <article className="sharing-invite-card" key={invite.id}>
              <div>
                <strong>{invite.email}</strong>
                <p className="muted-text">
                  {invite.status} • expires {new Date(invite.expiresAt).toLocaleDateString()}
                </p>
                <p className="sharing-link-preview">{link}</p>
              </div>
              <button className="button button-secondary" onClick={() => void copyShareLink(invite)} type="button">
                {copiedInviteId === invite.id ? "Copied" : "Copy link"}
              </button>
              {invite.status === "pending" ? (
                <button className="button button-secondary" onClick={() => void handleRevoke(invite.id)} type="button">
                  Revoke
                </button>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
