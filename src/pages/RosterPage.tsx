import { useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCharacterStore } from '../store/characterStore';

export function RosterPage() {
  const navigate = useNavigate();
  const roster = useCharacterStore((s) => s.roster);
  const load = useCharacterStore((s) => s.load);
  const createCharacter = useCharacterStore((s) => s.createCharacter);
  const duplicateCharacter = useCharacterStore((s) => s.duplicateCharacter);
  const deleteCharacter = useCharacterStore((s) => s.deleteCharacter);
  const importJson = useCharacterStore((s) => s.importJson);
  const exportJson = useCharacterStore((s) => s.exportJson);
  const lastError = useCharacterStore((s) => s.lastError);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => { void load(); }, [load]);

  const onExport = async () => {
    try {
      const json = await exportJson();
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'savage-worlds-roster.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      useCharacterStore.setState({ lastError: `Export failed: ${String(err)}` });
    }
  };

  const onImportFile = async (file: File) => {
    try {
      await importJson(await file.text());
    } catch (err) {
      useCharacterStore.setState({ lastError: `Import failed: ${String(err)}` });
    }
  };

  return (
    <main className="mx-auto max-w-3xl p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Savage Worlds Sheets</h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={async () => { const id = await createCharacter(); navigate(`/c/${id}`); }}
            className="rounded bg-gray-800 px-3 py-2 text-white"
          >
            + New character
          </button>
          <button type="button" onClick={onExport} className="rounded border px-3 py-2">Export</button>
          <button type="button" onClick={() => fileInput.current?.click()} className="rounded border px-3 py-2">Import</button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json"
            className="hidden"
            aria-label="Import roster file"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void onImportFile(f); e.target.value = ''; }}
          />
        </div>
      </div>

      {lastError && <p className="mb-3 rounded bg-red-100 p-2 text-red-700">{lastError}</p>}

      {roster.length === 0 ? (
        <p className="text-gray-500">No characters yet. Create one to get started.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {roster.map((c) => (
            <li key={c.id} className="flex items-center justify-between rounded border p-3">
              <Link to={`/c/${c.id}`} className="font-semibold underline">{c.name || 'Unnamed'}</Link>
              <div className="flex gap-2">
                <button type="button" onClick={() => void duplicateCharacter(c.id)} className="rounded border px-2 py-1">Duplicate</button>
                <button type="button" onClick={() => void deleteCharacter(c.id)} aria-label={`Delete ${c.name || 'character'}`} className="rounded border px-2 py-1">Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
