import { useEffect, useState } from 'react';
import { Loader2, MessageCircle, Send, X } from 'lucide-react';

const API_BASE = 'http://127.0.0.1:8000';

export default function ChatWindow({
  complaintId,
  citizenName,
  staff,
  onClose,
}) {
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const loadMessages = async () => {
    try {
      const response = await fetch(
        `${API_BASE}/complaints/${complaintId}/chat`,
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.detail || 'Could not load chat.');
      }

      setMessages(data.messages || []);
      setError('');
    } catch (err) {
      setError(err.message || 'Could not load chat.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMessages();

    const timer = setInterval(loadMessages, 3000);

    return () => clearInterval(timer);
  }, [complaintId]);

  const sendMessage = async (e) => {
    e.preventDefault();

    const text = message.trim();

    if (!text || sending) return;

    setSending(true);
    setError('');

    try {
      const response = await fetch(
        `${API_BASE}/complaints/${complaintId}/chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sender_role: 'citizen',
            sender_name: citizenName || 'Citizen',
            message: text,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.detail || 'Could not send message.');
      }

      setMessages(data.messages || []);
      setMessage('');
    } catch (err) {
      setError(err.message || 'Could not send message.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="chat-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1100,
        display: 'grid',
        placeItems: 'center',
        padding: 20,
        background: 'rgba(15, 23, 42, 0.62)',
      }}
    >
      <div
        className="card page-enter"
        style={{
          width: 'min(100%, 520px)',
          height: 'min(680px, 90vh)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          className="card-head"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div className="row" style={{ gap: 10 }}>
            <MessageCircle size={20} aria-hidden="true" />

            <div>
              <h2
                id="chat-title"
                style={{ margin: 0, fontSize: 18 }}
              >
                Chat with Electrical Staff
              </h2>

              <div className="hint">
                {staff?.name || 'Assigned Response Staff'}
              </div>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            aria-label="Close chat"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 18,
            background: 'var(--c-bg, #f8fafc)',
          }}
        >
          <div
            className="hint"
            style={{
              marginBottom: 16,
              padding: 10,
              borderRadius: 10,
              background: 'var(--c-surface, white)',
            }}
          >
            ⚡ This chat is linked to your urgent electricity complaint.
            Please stay away from electrical hazards and follow staff
            instructions.
          </div>

          {loading ? (
            <div
              className="row"
              style={{ justifyContent: 'center', padding: 30 }}
            >
              <Loader2 className="spin" size={20} />
              <span className="hint">Loading conversation…</span>
            </div>
          ) : messages.length === 0 ? (
            <div
              className="hint"
              style={{ textAlign: 'center', padding: 30 }}
            >
              No messages yet. Send a message to the assigned staff.
            </div>
          ) : (
            <div className="stack" style={{ '--gap': '10px' }}>
              {messages.map((item, index) => {
                const isCitizen = item.sender_role === 'citizen';

                return (
                  <div
                    key={`${item.at || 'message'}-${index}`}
                    style={{
                      display: 'flex',
                      justifyContent: isCitizen
                        ? 'flex-end'
                        : 'flex-start',
                    }}
                  >
                    <div
                      style={{
                        maxWidth: '82%',
                        padding: '10px 13px',
                        borderRadius: 14,
                        background: isCitizen
                          ? 'var(--c-primary, #2563eb)'
                          : 'white',
                        color: isCitizen ? 'white' : 'var(--c-ink)',
                        border: isCitizen
                          ? 'none'
                          : '1px solid var(--c-line, #e2e8f0)',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          marginBottom: 4,
                          opacity: 0.75,
                        }}
                      >
                        {item.sender_name}
                      </div>

                      <div style={{ lineHeight: 1.45 }}>
                        {item.message}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {error && (
            <div
              className="field-error"
              style={{ marginTop: 12 }}
            >
              {error}
            </div>
          )}
        </div>

        <form
          onSubmit={sendMessage}
          style={{
            display: 'flex',
            gap: 8,
            padding: 14,
            borderTop: '1px solid var(--c-line, #e2e8f0)',
            background: 'white',
          }}
        >
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message…"
            maxLength={500}
            disabled={sending}
            style={{
              flex: 1,
              minWidth: 0,
            }}
          />

          <button
            type="submit"
            className="btn btn-primary"
            disabled={!message.trim() || sending}
          >
            {sending ? (
              <Loader2 className="spin" size={16} />
            ) : (
              <Send size={16} />
            )}
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
