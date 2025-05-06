import fs from 'fs';
import path from 'path';

const PLAN_FILE = path.join(process.cwd(), 'data', 'book-plan.md');

// Ensure the data directory exists
const dataDir = path.dirname(PLAN_FILE);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export function saveBookPlan(plan: string | object): void {
  console.log(`[saveBookPlan] Writing to: ${PLAN_FILE}`);
  fs.writeFileSync(PLAN_FILE, typeof plan === 'string' ? plan : JSON.stringify(plan, null, 2), 'utf-8');
}

export function getBookPlan(): string | object | null {
  if (!fs.existsSync(PLAN_FILE)) {
    return null;
  }
  const content = fs.readFileSync(PLAN_FILE, 'utf-8');
  try {
    return JSON.parse(content);
  } catch (e) {
    return content;
  }
}

export function hasBookPlan(): boolean {
  return fs.existsSync(PLAN_FILE);
}

export function updateBookPlan(updates: Partial<object>): void {
  const currentPlan = getBookPlan();
  if (!currentPlan) {
    throw new Error('No plan exists to update');
  }
  if (typeof currentPlan !== 'object' || currentPlan === null) {
    throw new Error('Current plan is not an object and cannot be updated');
  }
  const updatedPlan = {
    ...currentPlan,
    ...updates,
  };
  saveBookPlan(updatedPlan);
} 