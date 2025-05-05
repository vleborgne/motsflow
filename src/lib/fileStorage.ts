import fs from 'fs';
import path from 'path';

const PLAN_FILE = path.join(process.cwd(), 'data', 'book-plan.json');

// Ensure the data directory exists
const dataDir = path.dirname(PLAN_FILE);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export function saveBookPlan(plan: any): void {
  fs.writeFileSync(PLAN_FILE, JSON.stringify(plan, null, 2));
}

export function getBookPlan(): any | null {
  if (!fs.existsSync(PLAN_FILE)) {
    return null;
  }
  const content = fs.readFileSync(PLAN_FILE, 'utf-8');
  return JSON.parse(content);
}

export function hasBookPlan(): boolean {
  return fs.existsSync(PLAN_FILE);
}

export function updateBookPlan(updates: Partial<any>): void {
  const currentPlan = getBookPlan();
  if (!currentPlan) {
    throw new Error('No plan exists to update');
  }
  
  const updatedPlan = {
    ...currentPlan,
    ...updates,
  };
  
  saveBookPlan(updatedPlan);
} 