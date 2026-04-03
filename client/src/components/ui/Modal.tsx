import { ReactNode } from 'react';

interface ModalProps {
  onClose: () => void;
  children: ReactNode;
  title?: string;
}

export default function Modal({ onClose, children, title }: ModalProps) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-[#0b1120] border border-[#1a2840] rounded-lg p-6 w-full max-w-md mx-4 relative"
        onClick={e => e.stopPropagation()}
      >
        {title && (
          <h2 className="text-lg font-bold text-[#00e5ff] font-mono mb-4 tracking-widest uppercase">
            {title}
          </h2>
        )}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors text-lg leading-none"
          aria-label="Close"
        >
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}
