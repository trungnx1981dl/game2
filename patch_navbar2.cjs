const fs = require('fs');
let code = fs.readFileSync('src/components/Navbar.tsx', 'utf8');

code = code.replace("import React, { useState } from 'react';", "import React, { useState, useRef, useEffect } from 'react';");
code = code.replace("import { Volume2, Atom,", "import { Volume2, Atom, Music,");

const bgmLogic = `
  const [bgmUrl, setBgmUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (bgmUrl) URL.revokeObjectURL(bgmUrl);
      const url = URL.createObjectURL(file);
      setBgmUrl(url);
    }
  };

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = isMuted;
      audioRef.current.volume = 0.3;
    }
  }, [isMuted, bgmUrl]);
`;

code = code.replace("const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);", "const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);\n" + bgmLogic);

const musicButton = `
            {/* Custom Music Upload */}
            <input type="file" id="bgm-upload" accept="audio/*" className="hidden" onChange={handleFileChange} />
            <label
              htmlFor="bgm-upload"
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-xl transition-all shadow-xs cursor-pointer"
              title="Tải lên nhạc nền (MP3/WAV)"
            >
              <Music className="w-4 h-4" />
              <span className="hidden sm:inline">Nhạc nền</span>
            </label>
`;

code = code.replace("{/* Sound Toggle */}", musicButton + "\n            {/* Sound Toggle */}");
code = code.replace("return (", "return (\n    <>\n      <audio ref={audioRef} src={bgmUrl || undefined} loop autoPlay />");
// Close the fragment at the end. Oh wait, Navbar already returns a fragment.
code = code.replace("return (\n    <>\n      <audio ref={audioRef} src={bgmUrl || undefined} loop autoPlay />\n    <>", "return (\n    <>\n      <audio ref={audioRef} src={bgmUrl || undefined} loop autoPlay />");

fs.writeFileSync('src/components/Navbar.tsx', code);
console.log('Navbar updated with custom bgm');
