import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import { Question } from '../types';

// Configure pdfjs worker if available in browser
if (typeof window !== 'undefined' && 'GlobalWorkerOptions' in pdfjsLib) {
  // Use CDN worker or inline fallback
  try {
    (pdfjsLib as any).GlobalWorkerOptions.workerSrc =
      `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.10.38'}/pdf.worker.min.mjs`;
  } catch (e) {
    console.warn('PDF.js worker initialization warning:', e);
  }
}

export interface ParseResult {
  success: boolean;
  totalFound: number;
  sectionStats: {
    part1Count: number;
    part2Count: number;
    part3Count: number;
  };
  questions: Question[];
  summary: string;
  detectedSections: string[];
  rawTextPreview?: string;
  error?: string;
}

/**
 * Extract raw plain text from .docx, .pdf, or .txt file
 */
export async function extractTextFromFile(file: File): Promise<string> {
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith('.docx')) {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value || '';
  }

  if (fileName.endsWith('.txt')) {
    return await file.text();
  }

  if (fileName.endsWith('.pdf')) {
    const arrayBuffer = await file.arrayBuffer();
    try {
      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
      const pdf = await loadingTask.promise;
      let fullText = '';

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageItems = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        fullText += `\n--- Trang ${pageNum} ---\n` + pageItems + '\n';
      }

      return fullText;
    } catch (pdfErr) {
      console.warn('Client-side pdfjs extraction error:', pdfErr);
      throw new Error('Không thể đọc nội dung file PDF. Vui lòng đảm bảo file PDF không bị khóa mật khẩu hoặc thử file DOCX / TXT.');
    }
  }

  throw new Error('Định dạng file không được hỗ trợ! Vui lòng chọn file .docx, .pdf hoặc .txt');
}

/**
 * Clean and standardize raw text for high-accuracy regex matching
 */
function cleanExamText(rawText: string): string {
  return rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Remove repeated spaces
    .replace(/[ \t]+/g, ' ')
    // Normalize dashes and bullets
    .replace(/[–—]/g, '-')
    .trim();
}

/**
 * Smart Vietnamese Exam Parser matching the 3 Rounds / Stations
 */
export function parseExamDocument(rawText: string): ParseResult {
  const text = cleanExamText(rawText);
  if (!text || text.length < 20) {
    return {
      success: false,
      totalFound: 0,
      sectionStats: { part1Count: 0, part2Count: 0, part3Count: 0 },
      questions: [],
      summary: 'Tài liệu không có đủ văn bản để phân tích.',
      detectedSections: [],
      error: 'Văn bản quá ngắn hoặc không chứa nội dung câu hỏi hợp lệ.',
    };
  }

  const questions: Question[] = [];
  const detectedSections: string[] = [];

  // Look for Section divisions (Phần I / Phần 1, Phần II / Phần 2, Phần III / Phần 3)
  // or Trạm 1, Trạm 2, Trạm 3
  const sectionSplitRegex = /(?:PHẦN\s+(?:I{1,3}|[123]|MỘT|HAI|BA)|TRẠM\s+[123]|PART\s+[123])/gi;
  const hasExplicitSections = sectionSplitRegex.test(text);

  let part1Text = '';
  let part2Text = '';
  let part3Text = '';

  if (hasExplicitSections) {
    // Break document into sections
    const lines = text.split('\n');
    let currentPart = 1; // Default to Part 1 until explicit change

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lower = line.toLowerCase();

      if (
        lower.includes('phần i:') ||
        lower.includes('phần 1') ||
        lower.includes('phần i ') ||
        lower.includes('trạm 1') ||
        lower.includes('trắc nghiệm nhiều phương án') ||
        lower.includes('trắc nghiệm 4 lựa chọn')
      ) {
        currentPart = 1;
        if (!detectedSections.includes('Phần I: Trắc nghiệm 4 lựa chọn (Trạm 1)')) {
          detectedSections.push('Phần I: Trắc nghiệm 4 lựa chọn (Trạm 1)');
        }
        continue;
      } else if (
        lower.includes('phần ii:') ||
        lower.includes('phần 2') ||
        lower.includes('phần ii ') ||
        lower.includes('trạm 2') ||
        lower.includes('đúng sai') ||
        lower.includes('đúng/sai') ||
        lower.includes('đúng - sai')
      ) {
        currentPart = 2;
        if (!detectedSections.includes('Phần II: Câu trắc nghiệm Đúng - Sai (Trạm 2)')) {
          detectedSections.push('Phần II: Câu trắc nghiệm Đúng - Sai (Trạm 2)');
        }
        continue;
      } else if (
        lower.includes('phần iii:') ||
        lower.includes('phần 3') ||
        lower.includes('phần iii ') ||
        lower.includes('trạm 3') ||
        lower.includes('trả lời ngắn') ||
        lower.includes('điền khuyết') ||
        lower.includes('con số hoặc công thức')
      ) {
        currentPart = 3;
        if (!detectedSections.includes('Phần III: Câu hỏi trả lời ngắn (Trạm 3)')) {
          detectedSections.push('Phần III: Câu hỏi trả lời ngắn (Trạm 3)');
        }
        continue;
      }

      if (currentPart === 1) part1Text += line + '\n';
      else if (currentPart === 2) part2Text += line + '\n';
      else if (currentPart === 3) part3Text += line + '\n';
    }
  } else {
    // If no explicit section markers, parse the whole text and let intelligent heuristic classify
    part1Text = text;
  }

  // Parse Section 1 (Multiple choice 4 options)
  const part1Questions = parseMultipleChoiceSection(part1Text);
  questions.push(...part1Questions);

  // Parse Section 2 (True/False 4 sub-items)
  const part2Questions = parseTrueFalseSection(part2Text || (part1Questions.length === 0 ? text : ''));
  // Avoid duplicate if part2 was parsed from full text
  if (part2Text || (part1Questions.length === 0 && part2Questions.length > 0)) {
    questions.push(...part2Questions);
  }

  // Parse Section 3 (Short answer numbers/formulas)
  const part3Questions = parseShortAnswerSection(part3Text || (part1Questions.length === 0 && part2Questions.length === 0 ? text : ''));
  if (part3Text || (part1Questions.length === 0 && part2Questions.length === 0 && part3Questions.length > 0)) {
    questions.push(...part3Questions);
  }

  // If questions is still empty, run a fallback general parser across the whole text
  if (questions.length === 0) {
    const fallbackMC = parseMultipleChoiceSection(text);
    if (fallbackMC.length > 0) {
      questions.push(...fallbackMC);
    }
  }

  const part1Count = questions.filter((q) => q.station === 1).length;
  const part2Count = questions.filter((q) => q.station === 2).length;
  const part3Count = questions.filter((q) => q.station === 3).length;

  if (detectedSections.length === 0) {
    if (part1Count > 0) detectedSections.push(`Trạm 1: Khởi động (${part1Count} câu trắc nghiệm 4 lựa chọn)`);
    if (part2Count > 0) detectedSections.push(`Trạm 2: Đối đầu (${part2Count} câu Đúng - Sai 4 mệnh đề)`);
    if (part3Count > 0) detectedSections.push(`Trạm 3: Chinh phục (${part3Count} câu trả lời ngắn)`);
  }

  const summary = `Đã phân tích thành công ${questions.length} câu hỏi từ đề thi (Trạm 1: ${part1Count} câu, Trạm 2: ${part2Count} câu, Trạm 3: ${part3Count} câu).`;

  return {
    success: questions.length > 0,
    totalFound: questions.length,
    sectionStats: {
      part1Count,
      part2Count,
      part3Count,
    },
    questions,
    summary,
    detectedSections,
    rawTextPreview: text.substring(0, 500) + (text.length > 500 ? '...' : ''),
  };
}

/**
 * Parse Section 1: Multiple Choice Questions (A, B, C, D) -> Station 1
 */
function parseMultipleChoiceSection(sectionText: string): Question[] {
  if (!sectionText.trim()) return [];

  const questions: Question[] = [];
  // Split by Question markers: "Câu 1:", "Câu 1.", "Câu 1 -", "1.", "1:"
  const rawBlocks = sectionText.split(/(?=(?:^|\n)\s*(?:Câu\s+\d+[\.:\s\-]+|\d+[\.:\s\-]+))/i);

  for (const block of rawBlocks) {
    const trimmed = block.trim();
    if (!trimmed || trimmed.length < 15) continue;

    // Check if block has options A, B, C, D
    const optionMatches = trimmed.match(/(?:^|\s|\n)([A-D])[\.:\)\-]\s+([^\n]+)/g);
    if (!optionMatches || optionMatches.length < 2) continue;

    // Extract Question text (everything before option A)
    const firstOptIndex = trimmed.search(/(?:^|\s|\n)[A-D][\.:\)\-]\s+/);
    if (firstOptIndex <= 0) continue;

    let questionText = trimmed.substring(0, firstOptIndex).trim();
    // Remove "Câu 1:", "1." from start
    questionText = questionText.replace(/^(?:Câu\s+\d+[\.:\s\-]*|\d+[\.:\s\-]*)/i, '').trim();
    if (!questionText) continue;

    // Extract Options A, B, C, D
    const options: string[] = ['', '', '', ''];
    const optRegex = /(?:^|\s|\n)([A-D])[\.:\)\-]\s+([\s\S]*?)(?=(?:(?:^|\s|\n)[A-D][\.:\)\-]\s+)|(?:(?:^|\s|\n)(?:Đáp án|Lời giải|Hướng dẫn|Giải thích))|$)/gi;
    let match;
    let foundCount = 0;

    while ((match = optRegex.exec(trimmed)) !== null) {
      const letter = match[1].toUpperCase();
      const optContent = match[2].trim();
      const idx = letter.charCodeAt(0) - 65; // A=0, B=1, C=2, D=3
      if (idx >= 0 && idx < 4) {
        options[idx] = optContent;
        foundCount++;
      }
    }

    if (foundCount < 2) continue;

    // Fill missing options with placeholder if at least 2 are present
    for (let o = 0; o < 4; o++) {
      if (!options[o]) options[o] = `Phương án ${String.fromCharCode(65 + o)}`;
    }

    // Detect Answer (e.g. "Đáp án: A", "Chọn B", "Key: C", "Đ/a: D")
    let correctAnswer = 0;
    const ansMatch = trimmed.match(/(?:Đáp\s*án|Chọn|Key|Đ\/a|Đáp\s*số)[\s:]*([A-D])/i);
    if (ansMatch) {
      correctAnswer = ansMatch[1].toUpperCase().charCodeAt(0) - 65;
    }

    // Detect Explanation
    let explanation = 'Chọn đáp án chính xác theo kiến thức chuẩn GDPT.';
    const expMatch = trimmed.match(/(?:Lời\s*giải|Hướng\s*dẫn|Giải\s*thích)[\s:]*([\s\S]*?)(?=(?:^|\n)\s*(?:Câu|\d+[\.:])|$)/i);
    if (expMatch && expMatch[1].trim()) {
      explanation = expMatch[1].trim();
    }

    questions.push({
      id: `doc_mc_${Date.now()}_${questions.length + 1}`,
      station: 1,
      difficulty: 1,
      type: 'multiple-choice',
      questionText,
      options,
      correctAnswer,
      explanation,
      baseScore: 100,
      expReward: 10,
      timeLimit: 30,
    });
  }

  return questions;
}

/**
 * Parse Section 2: True/False Questions with 4 sub-statements (a, b, c, d) -> Station 2
 */
function parseTrueFalseSection(sectionText: string): Question[] {
  if (!sectionText.trim()) return [];

  const questions: Question[] = [];
  const rawBlocks = sectionText.split(/(?=(?:^|\n)\s*(?:Câu\s+\d+[\.:\s\-]+|\d+[\.:\s\-]+))/i);

  for (const block of rawBlocks) {
    const trimmed = block.trim();
    if (!trimmed || trimmed.length < 20) continue;

    // Check for sub-items a), b), c), d) or a., b., c., d.
    const subItemRegex = /(?:^|\s|\n)([a-d])[\.:\)\-]\s+([\s\S]*?)(?=(?:(?:^|\s|\n)[a-d][\.:\)\-]\s+)|(?:(?:^|\s|\n)(?:Đáp án|Lời giải|Hướng dẫn))|$)/gi;
    const matches = [...trimmed.matchAll(subItemRegex)];

    if (matches.length < 2) continue;

    // Question Lead Text
    const firstSubIndex = trimmed.search(/(?:^|\s|\n)[a-d][\.:\)\-]\s+/i);
    let questionText = firstSubIndex > 0 ? trimmed.substring(0, firstSubIndex).trim() : 'Đánh giá tính ĐÚNG hoặc SAI của các mệnh đề sau:';
    questionText = questionText.replace(/^(?:Câu\s+\d+[\.:\s\-]*|\d+[\.:\s\-]*)/i, '').trim();
    if (!questionText) questionText = 'Đánh giá tính ĐÚNG hoặc SAI của các mệnh đề sau:';

    const trueFalseItems: { id: string; statement: string; isCorrect: boolean }[] = [];
    const correctArr: boolean[] = [];

    matches.forEach((m, idx) => {
      const letter = m[1].toLowerCase();
      let statement = m[2].trim();

      // Check if statement contains inline answer like "(Đúng)", "(Sai)", "(Đ)", "(S)"
      let isCorrect = true;
      if (/\((?:Sai|S|False|F)\)/i.test(statement) || /-\s*(?:Sai|S)/i.test(statement)) {
        isCorrect = false;
        statement = statement.replace(/\((?:Sai|S|False|F|Đúng|Đ|True|T)\)/gi, '').replace(/-\s*(?:Sai|S|Đúng|Đ)/gi, '').trim();
      } else if (/\((?:Đúng|Đ|True|T)\)/i.test(statement) || /-\s*(?:Đúng|Đ)/i.test(statement)) {
        isCorrect = true;
        statement = statement.replace(/\((?:Sai|S|False|F|Đúng|Đ|True|T)\)/gi, '').replace(/-\s*(?:Sai|S|Đúng|Đ)/gi, '').trim();
      } else {
        // Alternating default
        isCorrect = idx % 2 === 0;
      }

      trueFalseItems.push({
        id: `tf_${letter}_${idx}`,
        statement: statement || `Mệnh đề ${letter}`,
        isCorrect,
      });
      correctArr.push(isCorrect);
    });

    // If fewer than 4 items, fill up to 4
    const letters = ['a', 'b', 'c', 'd'];
    while (trueFalseItems.length < 4) {
      const curLen = trueFalseItems.length;
      const letCode = letters[curLen] || `sub${curLen}`;
      trueFalseItems.push({
        id: `tf_${letCode}_${curLen}`,
        statement: `Mệnh đề ${letCode}) cần xác định tính đúng sai`,
        isCorrect: true,
      });
      correctArr.push(true);
    }

    // Explanation
    let explanation = 'Phân tích kỹ tính đúng/sai của từng mệnh đề theo cấu tạo và tính chất khoa học.';
    const expMatch = trimmed.match(/(?:Lời\s*giải|Hướng\s*dẫn|Giải\s*thích)[\s:]*([\s\S]*?)(?=(?:^|\n)\s*(?:Câu|\d+[\.:])|$)/i);
    if (expMatch && expMatch[1].trim()) {
      explanation = expMatch[1].trim();
    }

    questions.push({
      id: `doc_tf_${Date.now()}_${questions.length + 1}`,
      station: 2,
      difficulty: 2,
      type: 'true-false',
      questionText,
      trueFalseItems,
      correctAnswer: correctArr,
      explanation,
      baseScore: 200,
      expReward: 10,
      timeLimit: 45,
    });
  }

  return questions;
}

/**
 * Parse Section 3: Short Answer (Numbers & Chemical Formulas) -> Station 3
 */
function parseShortAnswerSection(sectionText: string): Question[] {
  if (!sectionText.trim()) return [];

  const questions: Question[] = [];
  const rawBlocks = sectionText.split(/(?=(?:^|\n)\s*(?:Câu\s+\d+[\.:\s\-]+|\d+[\.:\s\-]+))/i);

  for (const block of rawBlocks) {
    const trimmed = block.trim();
    if (!trimmed || trimmed.length < 15) continue;

    // Check if question asks for short answer, number, or formula
    let questionText = trimmed.replace(/^(?:Câu\s+\d+[\.:\s\-]*|\d+[\.:\s\-]*)/i, '').trim();

    // Extract Answer
    let correctAnswer = '13';
    let shortAnswers = ['13'];

    const ansMatch = trimmed.match(/(?:Đáp\s*án|Kết\s*quả|CTHH|Đáp\s*số|Key)[\s:]*([^\n\r]+)/i);
    if (ansMatch && ansMatch[1].trim()) {
      const rawAns = ansMatch[1].trim();
      correctAnswer = rawAns;
      shortAnswers = [rawAns, rawAns.toLowerCase(), rawAns.replace(/\s+/g, '')];

      // Remove the answer line from question text
      questionText = questionText.replace(ansMatch[0], '').trim();
    } else {
      // Look for numbers or formulas inside brackets or at end
      const inlineNumMatch = trimmed.match(/(\d+(?:[,\.]\d+)?|[A-Z][a-z]?\d*(?:[A-Z][a-z]?\d*)+)/);
      if (inlineNumMatch) {
        correctAnswer = inlineNumMatch[1];
        shortAnswers = [correctAnswer];
      }
    }

    // Explanation
    let explanation = 'Nhập chính xác con số hoặc công thức hóa học để hoàn thành câu hỏi.';
    const expMatch = trimmed.match(/(?:Lời\s*giải|Hướng\s*dẫn|Giải\s*thích)[\s:]*([\s\S]*?)(?=(?:^|\n)\s*(?:Câu|\d+[\.:])|$)/i);
    if (expMatch && expMatch[1].trim()) {
      explanation = expMatch[1].trim();
      questionText = questionText.replace(expMatch[0], '').trim();
    }

    questions.push({
      id: `doc_sa_${Date.now()}_${questions.length + 1}`,
      station: 3,
      difficulty: 3,
      type: 'short-answer',
      questionText: questionText.trim() || 'Nhập câu trả lời ngắn (Con số hoặc Công thức hóa học):',
      correctAnswer,
      shortAnswers,
      explanation,
      baseScore: 300,
      expReward: 10,
      timeLimit: 45,
    });
  }

  return questions;
}

/**
 * Generate Sample Exam Text (Standard 3 Parts) for quick copying or template download
 */
export function getSampleExamTemplate(): string {
  return `ĐỀ THI KIỂM TRA CHỦ ĐỀ: NGUYÊN TỬ & PHÂN TỬ
Thời gian làm bài: 45 phút - Chuẩn khảo thí 3 Trạm thi đấu

PHẦN I: CÂU TRẮC NGHIỆM NHIỀU PHƯƠNG ÁN LỰA CHỌN (TRẠM 1: KHỞI ĐỘNG)
Thí sinh trả lời từ Câu 1 đến Câu 10. Mỗi câu chọn 1 đáp án đúng (A, B, C hoặc D).

Câu 1: Loại hạt mang điện tích dương trong hạt nhân nguyên tử là:
A. Hạt Electron
B. Hạt Proton
C. Hạt Neutron
D. Hạt Photon
Đáp án: B
Giải thích: Hạt nhân gồm hạt proton mang điện tích dương và neutron không mang điện.

Câu 2: Khối lượng của nguyên tử hầu như tập trung toàn bộ ở phần nào?
A. Hạt nhân nguyên tử
B. Lớp vỏ electron
C. Phân bố đều khắp nguyên tử
D. Không tập trung ở đâu
Đáp án: A
Giải thích: Khối lượng electron rất nhỏ so với proton và neutron nên khối lượng nguyên tử tập trung ở hạt nhân.

Câu 3: Nguyên tử trung hòa về điện là do:
A. Số hạt proton luôn bằng số hạt neutron
B. Số hạt proton luôn bằng số hạt electron
C. Số hạt neutron luôn bằng số hạt electron
D. Các hạt electron không mang điện
Đáp án: B
Giải thích: Điện tích dương của proton triệt tiêu điện tích âm của electron vì số proton = số electron.

Câu 4: Đơn vị chuẩn quốc tế đo khối lượng nguyên tử là:
A. gam (g)
B. amu
C. kilogam (kg)
D. đvC
Đáp án: B
Giải thích: Theo IUPAC và chuẩn GDPT mới, khối lượng nguyên tử tính bằng amu (atomic mass unit).

PHẦN II: CÂU TRẮC NGHIỆM ĐÚNG - SAI (TRẠM 2: ĐỐI ĐẦU)
Thí sinh trả lời từ Câu 1 đến Câu 4. Trong mỗi ý a), b), c), d) ở mỗi câu, thí sinh chọn Đúng hoặc Sai.

Câu 1: Cho nguyên tử Sodium (Na) có 11 proton và 12 neutron:
a) Số electron ở lớp vỏ nguyên tử Sodium là 11 (Đúng)
b) Khối lượng nguyên tử Sodium xấp xỉ bằng 23 amu (Đúng)
c) Lớp ngoài cùng của nguyên tử Sodium có 2 electron (Sai)
d) Sodium là kim loại kiềm thuộc nhóm IA (Đúng)
Giải thích: Cấu hình electron của Sodium là 2/8/1 nên lớp ngoài cùng chỉ có 1 electron.

Câu 2: Xét về phân tử Khí Carbon dioxide (CO₂):
a) Phân tử CO₂ là hợp chất tạo bởi 2 nguyên tố Carbon và Oxygen (Đúng)
b) Khối lượng phân tử của CO₂ là 44 amu (Đúng)
c) Trong phân tử CO₂, nguyên tố Carbon có hóa trị II (Sai)
d) Khí CO₂ duy trì sự cháy của ngọn lửa (Sai)
Giải thích: Trong CO₂, Carbon có hóa trị IV. CO₂ không duy trì sự cháy.

PHẦN III: CÂU HỎI TRẢ LỜI NGẮN (TRẠM 3: CHINH PHỤC)
Thí sinh nhập câu trả lời là Con số hoặc Công thức Hóa học (CTHH).

Câu 1: Một nguyên tử nguyên tố X có tổng số hạt p, n, e là 40, trong đó số hạt mang điện nhiều hơn số hạt không mang điện là 12. Hãy tìm số proton của nguyên tử X.
Đáp án: 13
Giải thích: 2p + n = 40 và 2p - n = 12 => 4p = 52 => p = 13 (Aluminium).

Câu 2: Viết công thức hóa học của hợp chất tạo bởi kim loại Nhôm (Al hóa trị III) và nhóm Sunfat (SO₄ hóa trị II).
Đáp án: Al2(SO4)3
Giải thích: Quy tắc hóa trị suy ra CTHH là Al₂(SO₄)₃.
`;
}
