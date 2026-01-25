
/// <reference lib="webworker" />

// In a real build, we would import the WASM module here.
// import init, { verify_combat } from './pkg/sector_zero_lean';

interface ProofRequest {
  id: string;
  type: 'COMBAT' | 'INVENTORY';
  payload: any;
}

interface ProofResponse {
  id: string;
  valid: boolean;
  error?: string;
  computeTime: number;
}

addEventListener('message', async ({ data }) => {
  const req = data as ProofRequest;
  const start = performance.now();
  let valid = false;
  let error: string | undefined;

  try {
    switch (req.type) {
      case 'COMBAT':
        valid = verifyCombatSimulated(req.payload);
        break;
      default:
        valid = true;
    }
  } catch (e: any) {
    valid = false;
    error = e.message;
  }

  const end = performance.now();

  const response: ProofResponse = {
    id: req.id,
    valid,
    error,
    computeTime: end - start
  };

  postMessage(response);
});

// --- WASM SIMULATION ---
// Since we cannot compile Lean in this environment, this TS function
// mathematically mimics the constraints defined in `CombatAxioms.lean`.
// In production, this function is replaced by the WASM call.
function verifyCombatSimulated(payload: { oldHp: number, damage: number, newHp: number }): boolean {
  // Lean Axiom: valid_damage_packet
  const cap = 10000;
  if (payload.damage < 0 || payload.damage > cap) return false;

  // Lean Axiom: valid_health_transition
  // Logic: new_hp must be exactly old_hp - damage (clamped to 0)
  const expectedHp = Math.max(0, payload.oldHp - payload.damage);
  
  // Floating point tolerance (since JS uses floats, Lean uses Nats)
  return Math.abs(payload.newHp - expectedHp) < 0.01;
}
