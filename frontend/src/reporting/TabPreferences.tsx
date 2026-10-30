import { useState } from "react";
import ErrorMessage from "../components/ErrorMessage";
import Icon from "../components/Icon";
import { errorMessage, Modal } from "./components";
import { FEATURES } from "./HomePage";
import type { NavigationPreference } from "./api";
import { saveNavigationPreference } from "./api";
import { canAccessTab } from "./config";

export default function TabPreferences({
  preference,
  onClose,
  onSaved,
  isAdmin,
}: {
  preference: NavigationPreference;
  onClose: () => void;
  onSaved: (value: NavigationPreference) => void;
  isAdmin: boolean;
}) {
  const [hidden, setHidden] = useState(preference.hidden_tabs);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  return (
    <Modal
      title="내 탭 관리"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <p className="preferences-description">
        내 화면에 표시할 기능을 선택하세요. 숨긴 기능은 이곳에서 언제든 다시
        표시할 수 있습니다.
      </p>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy) return;
          setBusy(true);
          setError(null);
          try {
            const value = await saveNavigationPreference({
              ...preference,
              hidden_tabs: hidden,
            });
            onSaved(value);
            onClose();
          } catch (err) {
            setError(errorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset className="preference-options" disabled={busy}>
          {FEATURES.filter((feature) => canAccessTab(feature.id, isAdmin)).map((feature) => (
            <label key={feature.id} className="preference-option">
              <span className="preference-icon">
                <Icon name={feature.icon} size={18} />
              </span>
              <span>
                <strong>{feature.label}</strong>
                <small>{feature.english}</small>
              </span>
              <input
                type="checkbox"
                checked={!hidden.includes(feature.id)}
                onChange={(event) =>
                  setHidden((old) =>
                    event.target.checked
                      ? old.filter((tab) => tab !== feature.id)
                      : [...old, feature.id],
                  )
                }
              />
            </label>
          ))}
        </fieldset>
        <p className="field-hint preference-hint">
          <Icon name="shield" size={13} />
          홈과 관리자 DB 메뉴는 숨기지 않습니다. 탭 숨김은 데이터나 접근 권한을
          변경하지 않습니다.
        </p>
        <ErrorMessage message={error} />
        <div className="preferences-actions">
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => setHidden([])}
          >
            모두 표시
          </button>
          <div className="actions">
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={onClose}
            >
              취소
            </button>
            <button className="btn btn-primary" disabled={busy}>
              {busy ? "저장 중…" : "설정 저장"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
