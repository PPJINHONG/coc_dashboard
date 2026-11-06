import { useEffect, useRef, type ReactNode } from "react";
import Icon from "./Icon";

export default function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="report-modal"
      aria-label={title}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header>
        <h2>{title}</h2>
        <button
          type="button"
          className="icon-button borderless"
          onClick={onClose}
          aria-label="닫기"
        >
          <Icon name="close" size={17} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
