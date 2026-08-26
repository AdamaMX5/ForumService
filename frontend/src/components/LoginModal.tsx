import { useForumAuth } from '../auth/AuthContext';
import { LoginRegisterForm } from './LoginRegisterForm';

export function LoginModal({ onClose }: { onClose: () => void }) {
  const { isExternallyManaged } = useForumAuth();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()}>
        {isExternallyManaged ? (
          <div className="w-full max-w-sm rounded-lg bg-white p-4 shadow-xl dark:bg-gray-900">
            <p className="text-sm text-gray-700 dark:text-gray-200">
              Bitte melde dich über die Anwendung an, in die dieses Forum eingebettet ist.
            </p>
            <button type="button" onClick={onClose} className="mt-3 text-sm text-blue-600 hover:underline">
              Schließen
            </button>
          </div>
        ) : (
          <LoginRegisterForm />
        )}
      </div>
    </div>
  );
}
