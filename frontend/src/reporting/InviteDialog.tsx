import { useCallback, useEffect, useState } from "react";
import ErrorMessage from "../components/ErrorMessage";
import {
  createInvite,
  getInviteOptions,
  inviteLink,
  listInvites,
  revokeInvite,
  STATUS_LABELS,
  type Invite,
  type InviteOptions,
} from "../api/invites";
import { errorMessage, Modal } from "./components";
import "./InviteDialog.css";

function shortDate(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// 선택지가 하나뿐이면(일반 팀원) 고정값으로, 여럿이면(관리자) 선택 상자로 보여 줍니다.
function OptionField({
  label,
  unit,
  choices,
  value,
  disabled,
  onChange,
}: {
  label: string;
  unit: string;
  choices: number[];
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label>
      <span>{label}</span>
      {choices.length <= 1 ? (
        <strong className="invite-fixed">
          {value}
          {unit}
        </strong>
      ) : (
        <select
          value={String(value)}
          disabled={disabled}
          onChange={(event) => onChange(Number(event.target.value))}
        >
          {choices.map((choice) => (
            <option key={choice} value={String(choice)}>
              {choice}
              {unit}
            </option>
          ))}
        </select>
      )}
    </label>
  );
}

// 로그인한 팀원이 관리자 없이 바로 초대 링크를 만들고 공유합니다.
export default function InviteDialog({ onClose }: { onClose: () => void }) {
  const [options, setOptions] = useState<InviteOptions | null>(null);
  const [expiresDays, setExpiresDays] = useState(1);
  const [maxUses, setMaxUses] = useState(10);
  const [invites, setInvites] = useState<Invite[] | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setInvites(await listInvites());
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    void reload();
    getInviteOptions()
      .then((loaded) => {
        setOptions(loaded);
        setExpiresDays(loaded.default_expires_days);
        setMaxUses(loaded.default_max_uses);
      })
      .catch((err) => setError(errorMessage(err)));
  }, [reload]);

  async function onCreate() {
    if (busy || !options) return;
    setBusy(true);
    setError(null);
    setCopied(null);
    try {
      const invite = await createInvite(expiresDays, maxUses);
      const link = inviteLink(invite.token);
      setCreated(link);
      setCopied(await copyText(link));
      await reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function onRevoke(id: number) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await revokeInvite(id);
      await reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="팀원 초대" onClose={() => !busy && onClose()}>
      <p className="invite-intro">
        링크를 만들어 팀 메신저에 붙여 넣으면, 받은 사람이 바로 가입합니다. 관리자 승인은 필요
        없습니다.
      </p>
      <div className="invite-create">
        <OptionField
          label="사용 기간"
          unit="일"
          choices={options?.expires_days ?? []}
          value={expiresDays}
          disabled={busy}
          onChange={setExpiresDays}
        />
        <OptionField
          label="가입 인원"
          unit="명"
          choices={options?.max_uses ?? []}
          value={maxUses}
          disabled={busy}
          onChange={setMaxUses}
        />
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || !options}
          onClick={onCreate}
        >
          {busy ? "처리 중…" : "링크 만들기"}
        </button>
      </div>
      {options && options.max_uses.length <= 1 && (
        <p className="invite-note">한 번에 더 많은 인원이 필요하면 관리자에게 링크를 요청해 주세요.</p>
      )}

      {created && (
        <div className="invite-created" role="status">
          <input readOnly value={created} aria-label="새 초대 링크" onFocus={(e) => e.target.select()} />
          <button
            type="button"
            className="btn"
            onClick={async () => setCopied(await copyText(created))}
          >
            복사
          </button>
          <small>
            {copied
              ? "클립보드에 복사했습니다. "
              : copied === false
                ? "자동 복사가 막혀 있습니다. 링크를 직접 복사해 주세요. "
                : ""}
            이 링크는 지금만 표시됩니다.
          </small>
        </div>
      )}

      <ErrorMessage message={error} />

      <h3 className="invite-list-title">만든 링크</h3>
      {invites === null ? (
        <p className="invite-empty">불러오는 중…</p>
      ) : invites.length === 0 ? (
        <p className="invite-empty">아직 만든 초대 링크가 없습니다.</p>
      ) : (
        <ul className="invite-list">
          {invites.map((invite) => (
            <li key={invite.id} className={`invite-item invite-${invite.status}`}>
              <div>
                <strong>…{invite.token_hint}</strong>
                <span className="invite-status">{STATUS_LABELS[invite.status]}</span>
                <small>
                  {invite.created_by_name} · {shortDate(invite.expires_at)}까지 · 가입{" "}
                  {invite.use_count}
                  {invite.max_uses === null ? "명" : `/${invite.max_uses}명`}
                </small>
                {invite.joined.length > 0 && <small>가입: {invite.joined.join(", ")}</small>}
              </div>
              {invite.status === "active" && (
                <button
                  type="button"
                  className="btn"
                  disabled={busy}
                  onClick={() => onRevoke(invite.id)}
                >
                  취소
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
