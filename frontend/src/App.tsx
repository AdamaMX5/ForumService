import { useEffect, useState } from 'react';
import { ForumAuthProvider, useForumAuth } from './auth/AuthContext';
import { ForumThreadView } from './components/ForumThread';
import type { ForumNode } from './api/types';

// Demo/dev-server entry point: a small thema picker in front of ForumThreadView, sharing one
// ForumAuthProvider so logging in once covers every ForumThread instance on the page.
export function App() {
  return (
    <ForumAuthProvider>
      <AppInner />
    </ForumAuthProvider>
  );
}

function AppInner() {
  const { api, user, logout } = useForumAuth();
  const [themen, setThemen] = useState<ForumNode[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    api.getThemen({ sort: 'beste' }).then((res) => setThemen(res.data));
  }, [api]);

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-950">
      <div className="mx-auto max-w-5xl p-4">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-lg font-bold">ForumThread Demo</h1>
          {user && (
            <button type="button" onClick={() => logout()} className="text-sm text-blue-600 hover:underline">
              Abmelden ({user.email})
            </button>
          )}
        </div>

        {!selected && (
          <ul className="space-y-2">
            {themen.map((thema) => (
              <li key={thema.id}>
                <button
                  type="button"
                  onClick={() => setSelected(thema.id)}
                  className="w-full rounded border border-gray-200 bg-white p-3 text-left hover:border-blue-400 dark:border-gray-700 dark:bg-gray-900"
                >
                  {thema.texte.neutral?.text}
                </button>
              </li>
            ))}
          </ul>
        )}

        {selected && (
          <div>
            <button type="button" onClick={() => setSelected(null)} className="mb-3 text-sm text-blue-600 hover:underline">
              ← Zurueck zur Themenliste
            </button>
            <ForumThreadView nodeId={selected} />
          </div>
        )}
      </div>
    </div>
  );
}
