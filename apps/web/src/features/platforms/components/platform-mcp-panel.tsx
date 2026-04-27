import { useUser } from "@clerk/clerk-react";
import { useEffect, useState } from "react";
import { createMcpToken, listMcpTokens, revokeMcpToken } from "../api/platforms-api";
import { getApiBaseUrl } from "../../../lib/api-client";

interface PlatformMcpPanelProps {
  platformId: string;
  ownerEmail: string;
}

interface McpTokenMetadata {
  id: string;
  platformId: string;
  userEmail: string;
  createdAt: string;
  revokedAt?: string | undefined;
}

export function PlatformMcpPanel({ platformId, ownerEmail }: PlatformMcpPanelProps) {
  const { user, isLoaded } = useUser();
  const [tokens, setTokens] = useState<McpTokenMetadata[]>([]);
  const [draftEmail, setDraftEmail] = useState(ownerEmail);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdToken, setCreatedToken] = useState<string | null>(null);

  const endpointUrl = `${getApiBaseUrl().replace(/\/api$/, "")}/mcp/${platformId}`;
  const currentUserEmail = user?.primaryEmailAddress?.emailAddress?.trim().toLowerCase() ?? null;

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    void loadTokens();
  }, [currentUserEmail, isLoaded, platformId]);

  async function loadTokens() {
    if (!currentUserEmail) {
      setTokens([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const nextTokens = await listMcpTokens(platformId, currentUserEmail);
      setTokens(nextTokens);
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load MCP tokens.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateToken() {
    if (!currentUserEmail) {
      setError("You must be signed in to manage MCP access.");
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await createMcpToken(
        platformId,
        { userEmail: draftEmail.trim().toLowerCase() },
        currentUserEmail,
      );
      setCreatedToken(result.token);
      await loadTokens();
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to create MCP token.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRevoke(tokenId: string) {
    if (!currentUserEmail) {
      setError("You must be signed in to manage MCP access.");
      return;
    }

    try {
      await revokeMcpToken(tokenId, currentUserEmail);
      await loadTokens();
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to revoke MCP token.");
    }
  }

  return (
    <section className="panel setup-composer">
      <div className="panel-header">
        <div>
          <p className="eyebrow">External MCP</p>
          <h2>Enable MCP access</h2>
          <p className="muted-text">Create per-user MCP access tokens for external clients.</p>
        </div>
      </div>

      <div className="setup-block">
        <label className="stack">
          <span>User email</span>
          <input
            className="text-input"
            onChange={(event) => setDraftEmail(event.target.value)}
            placeholder="user@example.com"
            type="email"
            value={draftEmail}
          />
        </label>
        <div className="action-row">
          <button
            className="button button-primary"
            disabled={!currentUserEmail || isSubmitting || draftEmail.trim().length === 0}
            onClick={() => void handleCreateToken()}
            type="button"
          >
            Create token
          </button>
          <span className="muted-text">Endpoint: {endpointUrl}</span>
        </div>
        {createdToken ? (
          <div className="chat-attachment chat-attachment-approval_request">
            <div className="chat-attachment-header">
              <strong>Token created</strong>
            </div>
            <p>Copy this now. It will not be shown again.</p>
            <code className="mono-block">{createdToken}</code>
          </div>
        ) : null}
        {error ? <p className="error-text">{error}</p> : null}
      </div>

      <div className="setup-block">
        <div className="panel-header">
          <div>
            <h3>Issued tokens</h3>
          </div>
        </div>
        {isLoading ? <p className="muted-text">Loading tokens...</p> : null}
        {!isLoading && tokens.length === 0 ? <p className="muted-text">No MCP tokens yet.</p> : null}
        {!isLoading && tokens.length > 0 ? (
          <div className="stack">
            {tokens.map((token) => (
              <div className="chat-attachment" key={token.id}>
                <div className="chat-attachment-header">
                  <strong>{token.userEmail}</strong>
                  {!token.revokedAt ? (
                    <button className="button button-secondary" onClick={() => void handleRevoke(token.id)} type="button">
                      Revoke
                    </button>
                  ) : null}
                </div>
                <p>Created: {new Date(token.createdAt).toLocaleString()}</p>
                {token.revokedAt ? <p>Revoked: {new Date(token.revokedAt).toLocaleString()}</p> : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
