import type { Rng } from '../domain/dice';

// Yields exact die faces in order. Each entry is [sides, face]; converts to the
// float that rollDie maps back to `face` via Math.floor(rng()*sides)+1.
export function facesRng(faces: Array<[number, number]>): Rng {
  let i = 0;
  return () => {
    if (i >= faces.length) throw new Error('facesRng exhausted');
    const [sides, face] = faces[i++];
    return (face - 0.5) / sides;
  };
}
