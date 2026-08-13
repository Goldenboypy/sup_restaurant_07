import { useEffect } from "react";

interface QRCodeModalProps {
  imageUrl: string;
  tableNumber: string;
  onClose: () => void;
}

/**
 * "Waiter opens/shows the table's QR code to the guest. Guest scans
 * it -> guest app opens the menu for that exact table." Closes on
 * Escape or backdrop click, since it's a full modal blocking the
 * waiter's view while the guest is looking at their phone.
 */
export default function QRCodeModal({
  imageUrl,
  tableNumber,
  onClose,
}: QRCodeModalProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="qr-code-modal__overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`QR code for table ${tableNumber}`}
      onClick={onClose}
    >
      <div
        className="qr-code-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="qr-code-modal__close"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>

        <img
          src={imageUrl}
          alt={`QR code for table ${tableNumber}`}
          className="qr-code-modal__image"
        />

        <p className="qr-code-modal__hint">
          Show this to the guest to open Table {tableNumber}&apos;s menu
        </p>
      </div>
    </div>
  );
}