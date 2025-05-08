import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const partNumber = searchParams.get('partNumber');
  const chapterNumber = searchParams.get('chapterNumber');

  if (!partNumber || !chapterNumber) {
    return NextResponse.json({ error: 'Missing partNumber or chapterNumber' }, { status: 400 });
  }

  const filePath = path.join(process.cwd(), 'data', 'parts', `part_${partNumber}_chapter_${chapterNumber}.md`);

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return new NextResponse(content, {
      status: 200,
      headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
    });
  } catch (err) {
    return NextResponse.json({ error: 'Chapter not found' }, { status: 404 });
  }
} 