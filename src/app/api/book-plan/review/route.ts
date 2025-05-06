import { NextResponse } from 'next/server';
import { getBookPlan } from '@/lib/fileStorage';
import { reviewerAgent } from '@/lib/agents';

export async function GET() {
  try {
    const currentPlan = getBookPlan();
    if (!currentPlan) {
      return NextResponse.json({ error: 'No plan exists to review' }, { status: 404 });
    }
    const reviewPrompt = [
      `Voici le plan du livre à relire :\n${typeof currentPlan === 'string' ? currentPlan : JSON.stringify(currentPlan, null, 2)}\n\nPour chaque personnage et chaque lieu, vérifie qu'une description complète et détaillée est présente. Il est impératif que tous les personnages et tous les lieux soient bien décrits. Vérifie la cohérence du plan et détecte les répétitions. Génère une liste de suggestions ou corrections à appliquer, sous forme de liste structurée, sans réécrire le plan. TU NE DOIS FOURNIR QUE LA LISTE DES SUGGESTIONS ET CORRECTIONS ET PAS D'AUTRE TEXTE. TU NE DOIS PAS FOURNIR DE TEXTE EXPLICATIF.`
    ];
    const suggestions = await reviewerAgent.submitQuery(reviewPrompt);
    return NextResponse.json({ suggestions });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to review plan' }, { status: 500 });
  }
} 