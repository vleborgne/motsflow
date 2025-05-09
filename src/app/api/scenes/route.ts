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

export async function PUT(request: Request) {
  try {
    const { partNumber, chapterNumber, content } = await request.json();
    if (!partNumber || !chapterNumber || typeof content !== 'string') {
      return NextResponse.json({ error: 'Missing partNumber, chapterNumber, or content' }, { status: 400 });
    }
    // Extract the main chapter number (the number after the first dot)
    // e.g., for I.1.1 or I.1, mainChapterNumber is 1
    const match = chapterNumber.match(/^[^\.]+\.(\d+)/);
    const mainChapterNumber = match ? match[1] : chapterNumber;
    const filePath = path.join(process.cwd(), 'data', 'parts', `part_${partNumber}_chapter_${mainChapterNumber}.md`);
    await fs.writeFile(filePath, content, 'utf-8');
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to save chapter' }, { status: 500 });
  }
} 