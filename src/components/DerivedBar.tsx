function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center rounded border px-4 py-2">
      <span className="text-xs uppercase text-gray-500">{label}</span>
      <span className="text-xl font-bold">{value}</span>
    </div>
  );
}

export function DerivedBar({ parry, toughness, pace }: { parry: number; toughness: number; pace: number }) {
  return (
    <section className="flex gap-3">
      <Stat label="Pace" value={pace} />
      <Stat label="Parry" value={parry} />
      <Stat label="Toughness" value={toughness} />
    </section>
  );
}
