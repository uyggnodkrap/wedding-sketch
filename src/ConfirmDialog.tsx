import { useEffect, useRef } from 'react';

type Props = {
  message: string;
  detail?: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
};

// 브라우저 confirm() 대신 쓰는 확인창. <dialog>가 중앙 배치·Esc·포커스 가두기를 처리
export function ConfirmDialog({ message, detail, confirmLabel, onConfirm, onCancel }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  // 확인창을 연 탭의 뒤늦은 click(iOS)으로 바로 닫히지 않게, 바깥에서 시작된 누름만 인정 (EditSheet와 같은 방식)
  const downOnBackdrop = useRef(false);
  useEffect(() => {
    if (!ref.current?.open) ref.current?.showModal();
  }, []);

  return (
    // 안쪽 div가 내용을 다 덮으므로 dialog 자체가 클릭되면 바깥(::backdrop) 클릭
    <dialog ref={ref} className="confirm" onClose={onCancel}
      onPointerDown={e => { downOnBackdrop.current = e.target === e.currentTarget; }}
      onClick={e => { if (downOnBackdrop.current && e.target === e.currentTarget) onCancel(); }}>
      <div className="confirm-body">
        <p className="confirm-title">{message}</p>
        {detail && <p className="confirm-detail">{detail}</p>}
        <div className="confirm-actions">
          <button onClick={onCancel}>취소</button>
          <button className="danger" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </dialog>
  );
}
