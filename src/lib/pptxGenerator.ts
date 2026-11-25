import JSZip from 'jszip';
import { GeneratedSlide, QuizQuestion } from '../types';

function escapeXml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

interface TextRunOptions {
  text: string;
  sizePt: number;
  bold?: boolean;
  colorHex?: string;
}

function xmlParagraph({ text, sizePt, bold = false, colorHex = '172A1E' }: TextRunOptions): string {
  const sz = Math.round(sizePt * 100);
  return `
    <a:p>
      <a:r>
        <a:rPr lang="en-US" sz="${sz}" b="${bold ? '1' : '0'}" dirty="0">
          <a:solidFill><a:srgbClr val="${colorHex}"/></a:solidFill>
          <a:latin typeface="Calibri"/>
        </a:rPr>
        <a:t>${escapeXml(text)}</a:t>
      </a:r>
    </a:p>`;
}

function buildTextShape(
  id: number,
  name: string,
  x: number,
  y: number,
  cx: number,
  cy: number,
  paragraphsXml: string,
  fillHex?: string
): string {
  const fillXml = fillHex
    ? `<a:solidFill><a:srgbClr val="${fillHex}"/></a:solidFill>`
    : '<a:noFill/>';
  return `
    <p:sp>
      <p:nvSpPr>
        <p:cNvPr id="${id}" name="${escapeXml(name)}"/>
        <p:cNvSpPr txBox="1"/>
        <p:nvPr/>
      </p:nvSpPr>
      <p:spPr>
        <a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>
        <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
        ${fillXml}
      </p:spPr>
      <p:txBody>
        <a:bodyPr wrap="square" lIns="137160" tIns="91440" rIns="137160" bIns="91440"/>
        <a:lstStyle/>
        ${paragraphsXml}
      </p:txBody>
    </p:sp>`;
}

function wrapSlideXml(shapesXml: string, bgHex = 'FAF8F2'): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
       xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:bg>
      <p:bgPr>
        <a:solidFill><a:srgbClr val="${bgHex}"/></a:solidFill>
        <a:effectLst/>
      </p:bgPr>
    </p:bg>
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr>
        <a:xfrm>
          <a:off x="0" y="0"/>
          <a:ext cx="0" cy="0"/>
          <a:chOff x="0" y="0"/>
          <a:chExt cx="0" cy="0"/>
        </a:xfrm>
      </p:grpSpPr>
      ${shapesXml}
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`;
}

// 16:9 widescreen slide size: 12192000 x 6858000 EMU
function buildTitleSlideXml(title: string, subject: string, gradeLevel: string, teacherName: string): string {
  const banner = buildTextShape(
    2,
    'HeaderBand',
    0,
    0,
    12192000,
    900000,
    xmlParagraph({
      text: `SAN LORENZO ACADEMY · ${subject.toUpperCase()} · ${gradeLevel.toUpperCase()}`,
      sizePt: 14,
      bold: true,
      colorHex: 'FFFFFF',
    }),
    '1E5B3A'
  );

  const mainTitle = buildTextShape(
    3,
    'TitleBox',
    914400,
    2000000,
    10363200,
    1900000,
    [
      xmlParagraph({ text: title, sizePt: 40, bold: true, colorHex: '172A1E' }),
      xmlParagraph({
        text: `Interactive Classroom Lesson & Quiz Deck`,
        sizePt: 20,
        bold: false,
        colorHex: 'EA7A26',
      }),
    ].join('')
  );

  const footer = buildTextShape(
    4,
    'TeacherMeta',
    914400,
    5200000,
    10363200,
    900000,
    xmlParagraph({
      text: `Prepared by ${teacherName} · LORENZONE Learning Hub`,
      sizePt: 15,
      bold: true,
      colorHex: '4D6354',
    }),
    'EFE9D8'
  );

  return wrapSlideXml([banner, mainTitle, footer].join(''));
}

function buildContentSlideXml(slide: GeneratedSlide, totalContentSlides: number): string {
  const headerBand = buildTextShape(
    2,
    'SlideHeader',
    0,
    0,
    12192000,
    1150000,
    [
      xmlParagraph({ text: slide.title, sizePt: 24, bold: true, colorHex: 'FFFFFF' }),
      xmlParagraph({
        text: `${slide.subtitle}  ·  Slide ${slide.slideNumber} of ${totalContentSlides}`,
        sizePt: 13,
        bold: false,
        colorHex: 'D1FAE5',
      }),
    ].join(''),
    '1E5B3A'
  );

  const bulletsXml = slide.bullets
    .map((b) =>
      xmlParagraph({
        text: `• ${b}`,
        sizePt: 18,
        bold: false,
        colorHex: '172A1E',
      })
    )
    .join('');

  const bodyBox = buildTextShape(
    3,
    'BodyBullets',
    685800,
    1450000,
    10820400,
    3750000,
    bulletsXml || xmlParagraph({ text: `• ${slide.subtitle}`, sizePt: 18, colorHex: '172A1E' }),
    'FFFFFF'
  );

  const keyBox = buildTextShape(
    4,
    'KeyConceptBox',
    685800,
    5420000,
    10820400,
    950000,
    xmlParagraph({
      text: slide.keyTerm,
      sizePt: 15,
      bold: true,
      colorHex: 'FFFFFF',
    }),
    'EA7A26'
  );

  return wrapSlideXml([headerBand, bodyBox, keyBox].join(''));
}

function buildQuizReviewSlideXml(questionsChunk: QuizQuestion[], pageNum: number): string {
  const headerBand = buildTextShape(
    2,
    'ReviewHeader',
    0,
    0,
    12192000,
    1050000,
    xmlParagraph({
      text: `Classroom Quiz Review (Set ${pageNum})`,
      sizePt: 24,
      bold: true,
      colorHex: 'FFFFFF',
    }),
    'EA7A26'
  );

  const qaXml = questionsChunk
    .flatMap((q, idx) => [
      xmlParagraph({
        text: `Q${idx + 1}: ${q.prompt}`,
        sizePt: 15,
        bold: true,
        colorHex: '172A1E',
      }),
      xmlParagraph({
        text: `Answer: ${q.answer}`,
        sizePt: 13,
        bold: false,
        colorHex: '1E5B3A',
      }),
    ])
    .join('');

  const bodyBox = buildTextShape(
    3,
    'QuizPairs',
    685800,
    1300000,
    10820400,
    5100000,
    qaXml,
    'FFFFFF'
  );

  return wrapSlideXml([headerBand, bodyBox].join(''));
}

export async function generatePptxBlob(params: {
  title: string;
  subject: string;
  gradeLevel: string;
  teacherName: string;
  slides: GeneratedSlide[];
  questions?: QuizQuestion[];
}): Promise<Blob> {
  const zip = new JSZip();

  const slideXmls: string[] = [
    buildTitleSlideXml(params.title, params.subject, params.gradeLevel, params.teacherName),
    ...params.slides.map((s) => buildContentSlideXml(s, params.slides.length)),
  ];

  const reviewQuestions = (params.questions || []).slice(0, 12);
  for (let i = 0; i < reviewQuestions.length; i += 4) {
    slideXmls.push(buildQuizReviewSlideXml(reviewQuestions.slice(i, i + 4), Math.floor(i / 4) + 1));
  }

  const slideCount = slideXmls.length;

  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
  ${slideXmls
    .map(
      (_, i) =>
        `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`
    )
    .join('\n  ')}
</Types>`
  );

  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`
  );

  zip.file(
    'ppt/presentation.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
                xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
                xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldMasterIdLst>
    <p:sldMasterId id="2147483648" r:id="rId1"/>
  </p:sldMasterIdLst>
  <p:sldIdLst>
    ${slideXmls.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 2}"/>`).join('\n    ')}
  </p:sldIdLst>
  <p:sldSz cx="12192000" cy="6858000" type="screen16x9"/>
  <p:notesSz cx="6858000" cy="9144000"/>
</p:presentation>`
  );

  zip.file(
    'ppt/_rels/presentation.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
  ${slideXmls
    .map(
      (_, i) =>
        `<Relationship Id="rId${i + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`
    )
    .join('\n  ')}
  <Relationship Id="rId${slideCount + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>
</Relationships>`
  );

  zip.file(
    'ppt/slideMasters/slideMaster1.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
             xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
             xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>
  <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
  <p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>
</p:sldMaster>`
  );

  zip.file(
    'ppt/slideMasters/_rels/slideMaster1.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>
</Relationships>`
  );

  zip.file(
    'ppt/slideLayouts/slideLayout1.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
             xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
             xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank">
  <p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>
</p:sldLayout>`
  );

  zip.file(
    'ppt/slideLayouts/_rels/slideLayout1.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`
  );

  zip.file(
    'ppt/theme/theme1.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="LorenzoneSLA">
  <a:themeElements>
    <a:clrScheme name="LorenzoneSLA">
      <a:dk1><a:srgbClr val="172A1E"/></a:dk1>
      <a:lt1><a:srgbClr val="FAF8F2"/></a:lt1>
      <a:dk2><a:srgbClr val="1E5B3A"/></a:dk2>
      <a:lt2><a:srgbClr val="FFFFFF"/></a:lt2>
      <a:accent1><a:srgbClr val="1E5B3A"/></a:accent1>
      <a:accent2><a:srgbClr val="EA7A26"/></a:accent2>
      <a:accent3><a:srgbClr val="2E7D32"/></a:accent3>
      <a:accent4><a:srgbClr val="4D6354"/></a:accent4>
      <a:accent5><a:srgbClr val="D97706"/></a:accent5>
      <a:accent6><a:srgbClr val="10B981"/></a:accent6>
      <a:hlink><a:srgbClr val="1E5B3A"/></a:hlink>
      <a:folHlink><a:srgbClr val="4D6354"/></a:folHlink>
    </a:clrScheme>
    <a:fontScheme name="LorenzoneFonts">
      <a:majorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>
      <a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont>
    </a:fontScheme>
    <a:fmtScheme name="LorenzoneFmt">
      <a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst>
      <a:lnStyleLst><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst>
      <a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>
      <a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst>
    </a:fmtScheme>
  </a:themeElements>
</a:theme>`
  );

  slideXmls.forEach((xml, i) => {
    const num = i + 1;
    zip.file(`ppt/slides/slide${num}.xml`, xml);
    zip.file(
      `ppt/slides/_rels/slide${num}.xml.rels`,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`
    );
  });

  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  });
}

export async function downloadGeneratedPptx(params: {
  title: string;
  subject: string;
  gradeLevel: string;
  teacherName: string;
  slides: GeneratedSlide[];
  questions?: QuizQuestion[];
}): Promise<void> {
  const blob = await generatePptxBlob(params);
  const slug =
    params.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'lorenzone-lesson';
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${slug}.pptx`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
