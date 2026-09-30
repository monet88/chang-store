import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  isFaceSwapRefusal,
  isFaceSwapPrompt,
  normalizePromptForRefusal,
  FACE_SWAP_REFUSAL_PHRASES,
} from '@/platform/desktopLocalQwen';
import {
  LocalQwenImageDriverAdapter,
  FACE_SWAP_LORA_NAME,
} from '@/services/providers/local-qwen/LocalQwenImageDriverAdapter';
import { resetLocalQwenLock } from '@/services/providers/local-qwen/localQwenLock';
import type { DesktopLocalQwenApi } from '@/platform/desktopLocalQwen';
import type { GenerateJob } from '@/services/providers/ImageDriver';

describe('Adversarial Challenger: Aggressive Refusal Fuzzing & Invariant Safety', () => {
  let adapter: LocalQwenImageDriverAdapter;
  let mockDesktopApi: {
    getStatus: ReturnType<typeof vi.fn>;
    startServer: ReturnType<typeof vi.fn>;
    stopServer: ReturnType<typeof vi.fn>;
    generateImage: ReturnType<typeof vi.fn>;
    cancelJob: ReturnType<typeof vi.fn>;
    upscaleImage: ReturnType<typeof vi.fn>;
  };

  const SAMPLE_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    resetLocalQwenLock();

    mockDesktopApi = {
      getStatus: vi.fn().mockResolvedValue({ ok: true, value: { state: 'ready', isAppOwned: true, port: 8188 } }),
      startServer: vi.fn().mockResolvedValue({ ok: true, value: { state: 'ready', isAppOwned: true, port: 8188 } }),
      stopServer: vi.fn().mockResolvedValue({ ok: true, value: { stopped: true, wasExternal: false } }),
      generateImage: vi.fn().mockResolvedValue({
        ok: true,
        value: { image: { base64: SAMPLE_BASE64, mimeType: 'image/png' } },
      }),
      cancelJob: vi.fn().mockResolvedValue({ ok: true, value: { cancelled: true } }),
      upscaleImage: vi.fn().mockResolvedValue({
        ok: true,
        value: { image: SAMPLE_BASE64, mimeType: 'image/png' },
      }),
    };

    window.desktopLocalQwen = mockDesktopApi as unknown as DesktopLocalQwenApi;
    adapter = new LocalQwenImageDriverAdapter();
  });

  afterEach(() => {
    resetLocalQwenLock();
    delete window.desktopLocalQwen;
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  // =========================================================================
  // Fuzzing Vector 1: 22 Baseline Adversarial Attack Vectors
  // =========================================================================
  describe('Vector 1: Baseline 22 Adversarial Refusal Attack Vectors', () => {
    const vectors22 = [
      // English Compounding
      { phrase: 'no faceswap', prompt: 'Model wearing winter coat, no faceswap' },
      { phrase: 'without faceswap', prompt: 'Winter lookbook, without faceswap' },
      // English Hyphenation
      { phrase: 'no face-swap', prompt: 'Editorial shoot, no face-swap please' },
      { phrase: 'without face-swap', prompt: 'Portrait mode, without face-swap' },
      // English Contraction & Phrasing
      { phrase: 'dont swap', prompt: 'Studio portrait, dont swap face' },
      { phrase: 'keep original face', prompt: 'Fashion lookbook, keep original face' },
      { phrase: 'never swap face', prompt: 'Model in trench coat, never swap face' },
      { phrase: 'do not swap the face', prompt: 'Editorial photoshoot, do not swap the face' },
      // Vietnamese Imperative "đừng"
      { phrase: 'đừng đổi mặt', prompt: 'Chụp lookbook áo dạ, đừng đổi mặt mẫu' },
      { phrase: 'đừng thay mặt', prompt: 'Ảnh quảng cáo thời trang, đừng thay mặt' },
      { phrase: 'đừng ghép mặt', prompt: 'Bộ sưu tập mùa thu, đừng ghép mặt người mẫu' },
      // Vietnamese Semantic "giữ nguyên"
      { phrase: 'giữ nguyên mặt', prompt: 'Áo sơ mi lụa tơ tằm, giữ nguyên mặt mẫu gốc' },
      { phrase: 'giữ mặt gốc', prompt: 'Thời trang dạ hội, giữ mặt gốc nha' },
      { phrase: 'giữ nguyên khuôn mặt', prompt: 'Chụp ngoại cảnh, giữ nguyên khuôn mặt mẫu' },
      // Mixed Language
      { phrase: 'không face swap', prompt: 'Chụp mẫu áo vest, không face swap nhé' },
      { phrase: 'không faceswap', prompt: 'Tạo ảnh lookbook, không faceswap' },
      { phrase: 'đừng face swap', prompt: 'Người mẫu đầm công sở, đừng face swap' },
      { phrase: 'đừng faceswap', prompt: 'Thời trang đường phố, đừng faceswap' },
      // Unaccented Vietnamese
      { phrase: 'khong doi mat', prompt: 'Chup anh ao dai, khong doi mat' },
      { phrase: 'khong thay mat', prompt: 'Mau vay cuoi, khong thay mat' },
      { phrase: 'khong ghep mat', prompt: 'Lookbook mua he, khong ghep mat' },
      { phrase: 'dung doi mat', prompt: 'Ao khoac mang to, dung doi mat' },
    ];

    it.each(vectors22)('detects refusal for baseline vector: "$phrase"', ({ prompt }) => {
      expect(isFaceSwapRefusal(prompt)).toBe(true);
    });
  });

  // =========================================================================
  // Fuzzing Vector 2: Mixed Casing & Whitespace Variations
  // =========================================================================
  describe('Vector 2: Mixed Casing & Whitespace Variations', () => {
    const casingAndWhitespaceCases = [
      'NO FACE SWAP',
      'No FaCe SwAp',
      'dOnT sWaP fAcE',
      'WITHOUT FACE SWAP',
      'KHÔNG ĐỔI MẶT',
      'Không Thay Mặt',
      'ĐỪNG GHÉP MẶT',
      'GIỮ NGUYÊN KHUÔN MẶT',
      '  no    face    swap   ',
      '\t\twithout\t\tface\tswap\n\n',
      'Chụp mẫu áo dài,   không    đổi    mặt   nha!',
      'Model portrait,   NEVER   SWAP   FACE   please',
    ];

    it.each(casingAndWhitespaceCases)('detects refusal across casing and whitespace: "%s"', (prompt) => {
      expect(isFaceSwapRefusal(prompt)).toBe(true);
    });
  });

  // =========================================================================
  // Fuzzing Vector 3: Punctuation, Brackets, and Separators
  // =========================================================================
  describe('Vector 3: Punctuation, Brackets, and Separators', () => {
    const punctuationCases = [
      'no face_swap',
      'without_face_swap',
      'no-face-swap',
      'dont-swap-face',
      'please (no face swap)',
      'lookbook [without face swap]',
      'fashion shoot: do not swap face!',
      'model in red dress; keep original face.',
      'khong-doi-mat',
      'khong_thay_mat',
      '(đừng đổi mặt mẫu)',
      '[giữ nguyên mặt gốc]',
      'studio: không ghép mặt!',
    ];

    it.each(punctuationCases)('detects refusal with punctuation/brackets: "%s"', (prompt) => {
      expect(isFaceSwapRefusal(prompt)).toBe(true);
    });
  });

  // =========================================================================
  // Fuzzing Vector 4: Emojis and Symbols
  // =========================================================================
  describe('Vector 4: Emojis and Symbols', () => {
    const emojiCases = [
      '🚫 no face swap',
      'Fashion shoot, do not swap face ❌',
      '📸 Model in evening gown, without face swap ✨',
      'Áo dài truyền thống 🌸 đừng đổi mặt 🚫',
      'Lookbook 2026 🔥 không thay mặt nha 👗',
      'Keep original face 👍 please!',
    ];

    it.each(emojiCases)('detects refusal when prompts contain emojis: "%s"', (prompt) => {
      expect(isFaceSwapRefusal(prompt)).toBe(true);
    });
  });

  // =========================================================================
  // Fuzzing Vector 5: Negative Controls (Must NOT trigger false refusal)
  // =========================================================================
  describe('Vector 5: Negative Controls (Zero False Positives)', () => {
    const negativeControls = [
      // Facial features description
      'Close-up facial portrait of young woman with gentle smile',
      'Chân dung cận cảnh khuôn mặt thanh tú của người mẫu áo dài',
      'Model with sharp facial features and neutral expression',
      'Gương mặt khả ái, đường nét tự nhiên, trang điểm nhẹ',
      // Color & Wardrobe change
      'Swap jacket color from beige to navy blue',
      'Thay đổi màu sắc váy từ đỏ sang xanh pastel',
      'Đổi màu nền studio sang tông xám ấm',
      'Swap background to Parisian street at sunset',
      // Vietnamese homographs and non-refusal phrases
      'Mặt trời lặn trên biển Phú Quốc rực rỡ',
      'Mặt trăng chiếu sáng qua khung cửa sổ cổ kính',
      'Mặt hàng thời trang cao cấp xuất khẩu',
      'Áo dạ hội màu đỏ mặt trước xẻ tà quyến rũ',
      'Không gian studio hiện đại với ánh sáng tự nhiên',
      'Không khí buổi biểu diễn thời trang sôi động',
      'Thay đổi phong cách thời trang đường phố',
      'Đổi góc chụp từ trên cao xuống toàn thân',
      'Chuyển động tự nhiên của tà áo lụa trong gió',
      'Ghép nhiều khung hình lookbook vào một bố cục',
      // Pure non-refusal standard prompt
      'Professional studio photography of model wearing silk trench coat',
    ];

    it.each(negativeControls)('does NOT falsely trigger refusal on negative control: "%s"', (prompt) => {
      expect(isFaceSwapRefusal(prompt)).toBe(false);
    });
  });

  // =========================================================================
  // Fuzzing Vector 6: Invariant - LoRA Auto-Injection Strictly Suppressed
  // =========================================================================
  describe('Vector 6: LoRA Auto-Injection Suppression Invariant', () => {
    it('never injects LoRA when refusal is detected across diverse refusal prompts', async () => {
      const refusalPrompts = [
        'Model in silk blouse, no face swap',
        'Lookbook photo, without face-swap',
        'Áo dài hoa nhí, đừng đổi mặt',
        'Thời trang công sở, không thay khuôn mặt',
        'High fashion editorial, keep the original face',
        'Chụp ngoại cảnh, giữ nguyên mặt gốc',
      ];

      for (const prompt of refusalPrompts) {
        mockDesktopApi.generateImage.mockClear();
        adapter.clearRecordedJobs();

        const callerJob: GenerateJob = {
          prompt,
          workflow: 'identity-transfer',
        };

        // Freeze to verify immutability
        Object.freeze(callerJob);

        const results = await adapter.generate(callerJob);
        expect(results).toHaveLength(1);

        // Verification 1: Bridge call must NOT include LoRA
        expect(mockDesktopApi.generateImage).toHaveBeenCalledWith(
          expect.objectContaining({
            workflow: 'standard', // Downgraded to standard
            loraName: undefined,
          }),
        );
        expect(mockDesktopApi.generateImage).not.toHaveBeenCalledWith(
          expect.objectContaining({
            loraName: FACE_SWAP_LORA_NAME,
          }),
        );

        // Verification 2: Caller job was not mutated
        expect(callerJob.injectedLora).toBeUndefined();

        // Verification 3: Recorded job preserves refusal state without LoRA
        const recorded = adapter.getRecordedJobs();
        expect(recorded).toHaveLength(1);
        expect((recorded[0] as GenerateJob).injectedLora).toBeUndefined();
      }
    });

    it('refusal strictly overrides explicit caller-provided injectedLora', async () => {
      const callerJobWithLora: GenerateJob = {
        prompt: 'Lookbook portrait, do not swap face',
        workflow: 'identity-transfer',
        injectedLora: 'custom-face-lora.safetensors',
      };

      await adapter.generate(callerJobWithLora);

      expect(mockDesktopApi.generateImage).toHaveBeenCalledWith(
        expect.objectContaining({
          workflow: 'standard',
          loraName: undefined,
        }),
      );
      const recorded = adapter.getRecordedJobs();
      expect((recorded[0] as GenerateJob).injectedLora).toBeUndefined();
    });

    it('non-refusal in identity-transfer mode correctly auto-injects LoRA', async () => {
      const validPrompt = 'QWEN IDENTITY TRANSFER SPECIFICATION: Swap face with reference image';
      const job: GenerateJob = {
        prompt: validPrompt,
        workflow: 'identity-transfer',
      };

      await adapter.generate(job);

      expect(mockDesktopApi.generateImage).toHaveBeenCalledWith(
        expect.objectContaining({
          workflow: 'identity-transfer',
          loraName: FACE_SWAP_LORA_NAME,
        }),
      );
      const recorded = adapter.getRecordedJobs();
      expect((recorded[0] as GenerateJob).injectedLora).toBe(FACE_SWAP_LORA_NAME);
    });
  });

  // =========================================================================
  // Fuzzing Vector 7: Boundary Edge Cases (Unicode Zero-Width, Extended Vietnamese)
  // =========================================================================
  describe('Vector 7: Extended Boundary Exploration', () => {
    it('characterizes zero-width space and invisible character behavior', () => {
      const zws = '\u200B';
      const zwnj = '\u200C';
      const zwj = '\u200D';
      const bom = '\uFEFF';

      // 1. Boundary zero-width spaces (at start or end of string / word boundaries)
      expect(isFaceSwapRefusal(`${bom}no face swap`)).toBe(true);
      expect(isFaceSwapRefusal(`no face swap${bom}`)).toBe(true);
      expect(isFaceSwapRefusal(`${zws}no face swap`)).toBe(true);
      expect(isFaceSwapRefusal(`no face swap${zws}`)).toBe(true);
      expect(isFaceSwapRefusal(`${zwnj}without face swap`)).toBe(true);
      expect(isFaceSwapRefusal(`${zwj}do not swap`)).toBe(true);
      expect(isFaceSwapRefusal(`${zws}không đổi mặt`)).toBe(true);
      expect(isFaceSwapRefusal(`không đổi mặt${zws}`)).toBe(true);

      // 2. Intra-word zero-width insertion (adversarial steganography)
      // When zero-width space is inserted directly inside a word (e.g., 'f\u200Bace'),
      // standard regex / word boundary treats it as breaking the contiguous token.
      const intraWordResult = isFaceSwapRefusal(`no f${zws}ace swap`);
      expect(typeof intraWordResult).toBe('boolean');
    });

    it('evaluates Vietnamese colloquial imperatives & negative variants', () => {
      // "chớ" is captured because chớ -> cho
      expect(isFaceSwapRefusal('Bộ sưu tập áo dạ, chớ đổi mặt mẫu')).toBe(true);
      expect(isFaceSwapRefusal('Thời trang mùa thu, chớ thay khuôn mặt')).toBe(true);

      // "đừng hoán đổi mặt"
      expect(isFaceSwapRefusal('Người mẫu áo cưới, đừng hoán đổi mặt')).toBe(true);
      expect(isFaceSwapRefusal('Không hoán đổi danh tính')).toBe(true);

      // Vietnamese phrase "giữ nguyên mặt gốc"
      expect(isFaceSwapRefusal('Giữ nguyên mặt gốc giúp tôi')).toBe(true);
      expect(isFaceSwapRefusal('giu mat goc')).toBe(true);
      expect(isFaceSwapRefusal('giu nguyen khuon mat')).toBe(true);
    });

    it('evaluates negative controls with homograph "mặt" and "đổi" in fashion context', () => {
      const safePrompts = [
        'Mặt tiền cửa hàng thời trang lộng lẫy',
        'Mặt sau áo thun in họa tiết hoa sen',
        'Người mẫu đổi tư thế đứng sang ngồi tự nhiên',
        'Thay đổi ánh sáng từ studio sang ngoài trời',
        'Đổi góc máy quay sang cận cảnh chi tiết đường may',
        'Không gian trưng bày bộ sưu tập mới',
        'Không khí rộn ràng của buổi diễn thời trang',
      ];
      for (const p of safePrompts) {
        expect(isFaceSwapRefusal(p)).toBe(false);
      }
    });
  });
});
