import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import fsSync from 'fs';
import path from 'path';

const CONFIG_FILE = path.join(process.cwd(), 'data', 'book-config.json');

interface BookConfig {
  description: string;
  writingStyle: string;
  bookType: string;
}

export async function GET() {
  try {
    if (!fsSync.existsSync(CONFIG_FILE)) {
      return NextResponse.json({
        description: '',
        writingStyle: '',
        bookType: ''
      });
    }

    const content = await fs.readFile(CONFIG_FILE, 'utf-8');
    return NextResponse.json(JSON.parse(content));
  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to get book config',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const config: BookConfig = await request.json();
    await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
    return NextResponse.json(config);
  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to save book config',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 