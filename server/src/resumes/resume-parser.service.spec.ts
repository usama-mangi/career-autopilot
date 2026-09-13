import { describe, expect, it } from 'vitest';
import { ResumeParserService } from './resume-parser.service';

const parser = new ResumeParserService();

describe('ResumeParserService.validateFile', () => {
  it('maps mime types to resume formats', () => {
    expect(parser.validateFile(Buffer.alloc(0), 'text/plain')).toBe('txt');
    expect(parser.validateFile(Buffer.alloc(0), 'text/html')).toBe('html');
    expect(parser.validateFile(Buffer.alloc(0), 'application/pdf')).toBe('pdf');
    expect(
      parser.validateFile(
        Buffer.alloc(0),
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ),
    ).toBe('docx');
    expect(parser.validateFile(Buffer.alloc(0), 'application/zip')).toBe('linkedin');
  });

  it('rejects unsupported mime types with the accepted list', () => {
    expect(() => parser.validateFile(Buffer.alloc(0), 'application/x-msdownload')).toThrow(
      /Unsupported file type/,
    );
  });
});

describe('ResumeParserService.parse', () => {
  it('parses plain text with a 500-char preview', async () => {
    const long = 'A'.repeat(900);

    const result = await parser.parse(Buffer.from(long, 'utf-8'), 'txt');

    expect(result.format).toBe('txt');
    expect(result.text).toHaveLength(900);
    expect(result.preview).toHaveLength(500);
  });

  it('strips tags from html and trims the text', async () => {
    const html = '<html><body><h1>Jane Doe</h1><p>TypeScript developer</p></body></html>';

    const result = await parser.parse(Buffer.from(html, 'utf-8'), 'html');

    expect(result.format).toBe('html');
    expect(result.text).toContain('Jane Doe');
    expect(result.text).toContain('TypeScript developer');
    expect(result.text).not.toContain('<h1>');
  });

  it('extracts readable text from a DOCX buffer', async () => {
    // Build a minimal DOCX (zip of XML) with jszip, which the parser already
    // depends on, so the test stays offline and dependency-free.
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    zip.file(
      'word/document.xml',
      `<?xml version="1.0"?>
       <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
         <w:body>
           <w:p><w:r><w:t>Jane Doe</w:t></w:r></w:p>
           <w:p><w:r><w:t>Backend Engineer</w:t></w:r></w:p>
         </w:body>
       </w:document>`,
    );
    const buffer = await zip.generateAsync({ type: 'nodebuffer' });

    const result = await parser.parse(buffer, 'docx');

    expect(result.format).toBe('docx');
    expect(result.text).toContain('Jane Doe');
    expect(result.text).toContain('Backend Engineer');
  });

  it('rejects unknown formats', async () => {
    await expect(parser.parse(Buffer.alloc(0), 'rtf' as any)).rejects.toThrow(/Unsupported format/);
  });
});
