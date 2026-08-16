const fs = require('fs');
let code = fs.readFileSync('src/components/Navbar.tsx', 'utf8');

const oldLogo = `<div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-black text-base shadow-lg shadow-indigo-200">
              ĐT
            </div>`;

const newLogo = `<div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-base shadow-lg shadow-indigo-200 relative overflow-hidden">
              <Atom className="w-7 h-7 text-white/90 animate-[spin_8s_linear_infinite]" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
            </div>`;

code = code.replace(oldLogo, newLogo);
fs.writeFileSync('src/components/Navbar.tsx', code);
console.log('Navbar patched');
