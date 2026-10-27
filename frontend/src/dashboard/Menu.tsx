// 작은 드롭다운 메뉴: 버튼 아래에 열리고, 바깥 클릭·Esc로 닫힌다. 방향키로 항목 이동.
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

export interface MenuItem {
  key: string;
  label: ReactNode;
  onSelect: () => void;
  checked?: boolean; // 있으면 라디오 항목(menuitemradio)
  danger?: boolean;
  disabled?: boolean;
}

interface Props {
  buttonLabel: ReactNode;
  buttonAriaLabel: string;
  buttonClassName?: string;
  items: MenuItem[];
  align?: 'left' | 'right';
}

export default function Menu({ buttonLabel, buttonAriaLabel, buttonClassName, items, align = 'right' }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    // 열리면 선택된 항목(없으면 첫 항목)에 포커스
    const menu = rootRef.current?.querySelector<HTMLElement>('[role="menu"]');
    const target = menu?.querySelector<HTMLElement>('[aria-checked="true"]') ?? menu?.querySelector<HTMLElement>('button:not(:disabled)');
    target?.focus();
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  function close(focusButton = true) {
    setOpen(false);
    if (focusButton) buttonRef.current?.focus();
  }

  function onMenuKey(e: KeyboardEvent<HTMLDivElement>) {
    const buttons = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
    const idx = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      buttons[(idx + 1) % buttons.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      buttons[(idx - 1 + buttons.length) % buttons.length]?.focus();
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  }

  return (
    <div className="menu-root" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className={buttonClassName ?? 'icon-btn'}
        aria-label={buttonAriaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        {buttonLabel}
      </button>
      {open && (
        <div id={menuId} role="menu" className={`menu-pop ${align === 'left' ? 'left' : ''}`} onKeyDown={onMenuKey}>
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              role={item.checked === undefined ? 'menuitem' : 'menuitemradio'}
              aria-checked={item.checked === undefined ? undefined : item.checked}
              className={`menu-item${item.danger ? ' danger' : ''}${item.checked ? ' checked' : ''}`}
              disabled={item.disabled}
              onClick={() => {
                close();
                item.onSelect();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
