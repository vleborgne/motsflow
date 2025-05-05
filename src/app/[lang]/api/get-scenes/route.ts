import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export async function GET(request: Request) {
  // Detailed log to track the origin of calls
  const url = new URL(request.url);
  const headers = Object.fromEntries(request.headers.entries());
  console.log('[API get-scenes] Appel reçu', {
    url: request.url,
    headers,
    referer: headers.referer,
    userAgent: headers['user-agent']
  });
  console.log('*********', url.searchParams);

  try {
    const chapterNumber = url.searchParams.get('chapterNumber');
    if (!chapterNumber) {
      return NextResponse.json({ error: 'Missing chapterNumber' }, { status: 400 });
    }
    const scenePath = path.join(process.cwd(), 'data', 'scene', `chapter_${chapterNumber}.json`);
    console.log('API get-scenes', { chapterNumber, scenePath, exists: fs.existsSync(scenePath) });
    if (!fs.existsSync(scenePath)) {
      return NextResponse.json({ error: 'Scenes not found' }, { status: 404 });
    }
    const scenes = JSON.parse(fs.readFileSync(scenePath, 'utf-8'));
    return NextResponse.json({ scenes });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
} 